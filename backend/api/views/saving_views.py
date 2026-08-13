from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.deletion import ProtectedError
from django.conf import settings

from ..models import (
    SavingCategory,
    MemberSavingChoice,
    SavingChoiceChangeRequest,
    MonthlySaving,
    FineRule,
    Fine,
)

from ..serializers.saving_serializers import (
    SavingCategorySerializer,
    MemberSavingChoiceSerializer,
    MonthlySavingSerializer,
    MySavingChoiceSelectSerializer,
    SavingChoiceChangeRequestSerializer,
    SavingChoiceChangeRequestCreateSerializer,
    SavingChoiceChangeRequestReviewSerializer,
)

from ..permissions.role_permissions import (
    IsTellerOrAdmin,
    IsAdminManagerOrTeller,
    IsAdminFinanceOrAuditor,
    IsSavingsStaff,
    IsMember,
    IsAdminOrManager,
)
from ..services.transaction_logger import log_transaction
from ..utils.pdf_reports import build_pdf_report_response
from ..utils.report_language import get_report_lang, report_choice, report_text


def _saving_due_date(year, month):
    # Payment for month M is due by 5th of month M+1; late starts on 6th.
    if month == 12:
        return date(year + 1, 1, 6)
    return date(year, month + 1, 6)


def _monthly_fine_applicable(month):
    # December exception: handled during annual closing.
    return month != 12


def _is_within_member_choice_change_window(target_year, today):
    start_month = int(getattr(settings, "SAVING_CHOICE_CHANGE_START_MONTH", 1))
    start_day = int(getattr(settings, "SAVING_CHOICE_CHANGE_START_DAY", 1))
    end_month = int(getattr(settings, "SAVING_CHOICE_CHANGE_END_MONTH", 1))
    end_day = int(getattr(settings, "SAVING_CHOICE_CHANGE_END_DAY", 5))

    start_date = date(target_year, start_month, start_day)
    end_date = date(target_year, end_month, end_day)
    return start_date <= today <= end_date


def _get_monthly_savings_queryset(request):
    queryset = MonthlySaving.objects.select_related(
        "saving_choice__member__user",
        "saving_choice__category",
        "received_by",
    ).all()

    year = request.query_params.get("year")
    month = request.query_params.get("month")
    member_id = request.query_params.get("member_id")
    search = (request.query_params.get("search") or "").strip()
    if year:
        queryset = queryset.filter(year=year)
    if month:
        queryset = queryset.filter(month=month)
    if member_id:
        queryset = queryset.filter(saving_choice__member_id=member_id)
    if search:
        search_query = (
            Q(saving_choice__member__national_id__icontains=search)
            | Q(saving_choice__member__user__username__icontains=search)
            | Q(saving_choice__member__user__first_name__icontains=search)
            | Q(saving_choice__member__user__last_name__icontains=search)
            | Q(saving_choice__category__name__icontains=search)
            | Q(received_by__username__icontains=search)
            | Q(received_by__first_name__icontains=search)
            | Q(received_by__last_name__icontains=search)
        )
        if search.isdigit():
            search_query |= (
                Q(id=int(search))
                | Q(year=int(search))
                | Q(month=int(search))
                | Q(amount_paid=int(search))
            )
        queryset = queryset.filter(search_query)

    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if date_from:
        queryset = queryset.filter(saved_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(saved_on__lte=date_to)

    return queryset.order_by("-year", "-month", "-id")


def _get_my_monthly_savings_base_queryset(request):
    return MonthlySaving.objects.select_related(
        "saving_choice__member__user",
        "saving_choice__member",
        "saving_choice__category",
        "received_by",
    ).filter(saving_choice__member__user=request.user)


def _apply_my_monthly_savings_filters(queryset, request):
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if date_from:
        queryset = queryset.filter(saved_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(saved_on__lte=date_to)

    return queryset


def _create_saving_choice_change_request(*, actor, member, requested_category, reason, request_origin, request):
    if not member:
        raise ValidationError("Member profile not found.")
    if not member.is_active:
        raise ValidationError("Inactive member cannot request saving choice change.")

    current_year = timezone.localdate().year
    target_year = requested_category.year

    if target_year != current_year:
        raise ValidationError("Saving choice request is only allowed for the current year.")

    current_choice = (
        MemberSavingChoice.objects.select_related("category")
        .filter(member=member, category__year=target_year, is_active=True)
        .order_by("-id")
        .first()
    )
    if current_choice and current_choice.category_id == requested_category.id:
        raise ValidationError("Requested category is already active for this year.")

    pending_exists = SavingChoiceChangeRequest.objects.filter(
        member=member,
        year=target_year,
        status=SavingChoiceChangeRequest.Status.PENDING,
    ).exists()
    if pending_exists:
        raise ValidationError("There is already a pending saving choice change request for this year.")

    item = SavingChoiceChangeRequest.objects.create(
        member=member,
        year=target_year,
        current_category=current_choice.category if current_choice else None,
        requested_category=requested_category,
        reason=reason,
        request_origin=request_origin,
        requested_by=actor,
    )

    request_label = "requested on behalf" if request_origin == SavingChoiceChangeRequest.RequestOrigin.ON_BEHALF else "requested"
    log_transaction(
        user=actor,
        transaction_type="SAVING",
        action="CREATE",
        related_model="SavingChoiceChangeRequest",
        related_object_id=item.id,
        description=(
            f"Member {member.national_id} {request_label} saving choice change "
            f"to {requested_category.name} ({target_year})"
        ),
        request=request,
    )
    return item


# ======================================================
# SAVING CATEGORY (ACTIVE ONLY)
# ======================================================

class SavingCategoryListView(generics.ListAPIView):
    serializer_class = SavingCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get_queryset(self):
        queryset = SavingCategory.objects.all().order_by("-year", "monthly_amount")
        year = self.request.query_params.get("year")
        name = self.request.query_params.get("name")
        if year:
            queryset = queryset.filter(year=year)
        if name:
            queryset = queryset.filter(name__icontains=name)
        return queryset


class SavingCategoryMemberListView(generics.ListAPIView):
    serializer_class = SavingCategorySerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        queryset = SavingCategory.objects.all().order_by("-year", "monthly_amount")
        year = self.request.query_params.get("year")
        if year:
            queryset = queryset.filter(year=year)
        return queryset


class SavingCategoryCreateView(generics.CreateAPIView):
    queryset = SavingCategory.objects.all()
    serializer_class = SavingCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_create(self, serializer):
        item = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SAVING",
            action="CREATE",
            related_model="SavingCategory",
            related_object_id=item.id,
            description=(
                f"Created saving category {item.name} ({item.year}) "
                f"with monthly amount {item.monthly_amount}"
            ),
            request=self.request,
        )


class SavingCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SavingCategory.objects.all()
    serializer_class = SavingCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_update(self, serializer):
        item = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SAVING",
            action="UPDATE",
            related_model="SavingCategory",
            related_object_id=item.id,
            description=(
                f"Updated saving category {item.name} ({item.year}) "
                f"with monthly amount {item.monthly_amount}"
            ),
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        category_name = instance.name
        category_year = instance.year
        category_id = instance.id
        try:
            super().destroy(request, *args, **kwargs)
        except ProtectedError as exc:
            raise ValidationError(
                {
                    "detail": (
                        "This saving category cannot be deleted because it is still linked to "
                        f"{len(getattr(exc, 'protected_objects', []))} related record(s)."
                    )
                }
            ) from exc
        log_transaction(
            user=request.user,
            transaction_type="SAVING",
            action="DELETE",
            related_model="SavingCategory",
            related_object_id=category_id,
            description=f"Deleted saving category {category_name} ({category_year})",
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ======================================================
# MEMBER SAVING CHOICE
# ======================================================

class MemberSavingChoiceCreateView(generics.CreateAPIView):
    queryset = MemberSavingChoice.objects.all()
    serializer_class = MemberSavingChoiceSerializer
    permission_classes = [IsAuthenticated, IsAdminManagerOrTeller]

    def perform_create(self, serializer):
        member = serializer.validated_data["member"]

        if not member.is_active:
            raise ValidationError("Inactive member cannot choose saving category.")

        choice = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SAVING",
            action="CREATE",
            related_model="MemberSavingChoice",
            related_object_id=choice.id,
            description=f"Member {member.national_id} selected {choice.category.name}",
            request=self.request,
        )


class MemberSavingChoiceListView(generics.ListAPIView):
    queryset = MemberSavingChoice.objects.select_related("member__user", "category").filter(
        member__is_active=True,
        member__user__is_active=True,
        member__user__role="MEMBER",
    )
    serializer_class = MemberSavingChoiceSerializer
    permission_classes = [IsAuthenticated, IsSavingsStaff]

    def get_queryset(self):
        queryset = super().get_queryset()
        member_id = self.request.query_params.get("member_id")
        year = self.request.query_params.get("year")
        is_active = self.request.query_params.get("is_active")
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        if year:
            queryset = queryset.filter(category__year=year)
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))
        return queryset.order_by("-category__year", "category__name")


class MySavingChoiceListView(generics.ListAPIView):
    serializer_class = MemberSavingChoiceSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        queryset = (
            MemberSavingChoice.objects.select_related("member__user", "category")
            .filter(member__user=self.request.user)
            .order_by("-category__year", "category__name")
        )
        year = self.request.query_params.get("year")
        if year:
            queryset = queryset.filter(category__year=year)
        return queryset


class MySavingChoiceSelectView(APIView):
    permission_classes = [IsAuthenticated, IsMember]

    def post(self, request):
        raise ValidationError(
            "Direct saving category selection is disabled for members. "
            "Please submit a request and wait for manager approval."
        )


class MySavingChoiceChangeRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsMember]

    def get(self, request):
        member = getattr(request.user, "member_profile", None)
        if not member:
            raise ValidationError("Member profile not found.")
        queryset = SavingChoiceChangeRequest.objects.select_related(
            "member__user",
            "current_category",
            "requested_category",
            "reviewed_by",
        ).filter(member=member)
        year = request.query_params.get("year")
        if year:
            queryset = queryset.filter(year=year)
        serializer = SavingChoiceChangeRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        member = getattr(request.user, "member_profile", None)

        serializer = SavingChoiceChangeRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_category = serializer.validated_data["requested_category"]
        reason = serializer.validated_data.get("reason", "")
        item = _create_saving_choice_change_request(
            actor=request.user,
            member=member,
            requested_category=requested_category,
            reason=reason,
            request_origin=SavingChoiceChangeRequest.RequestOrigin.SELF,
            request=request,
        )
        return Response(
            SavingChoiceChangeRequestSerializer(item).data,
            status=status.HTTP_201_CREATED,
        )


class SavingChoiceChangeRequestListView(generics.ListCreateAPIView):
    serializer_class = SavingChoiceChangeRequestSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get_queryset(self):
        queryset = SavingChoiceChangeRequest.objects.select_related(
            "member__user",
            "current_category",
            "requested_category",
            "reviewed_by",
        )
        year = self.request.query_params.get("year")
        status_filter = self.request.query_params.get("status")
        if year:
            queryset = queryset.filter(year=year)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        member_id = self.request.query_params.get("member")
        if member_id:
            queryset = queryset.filter(member_id=member_id)
        return queryset.order_by("-requested_on")

    def create(self, request, *args, **kwargs):
        serializer = SavingChoiceChangeRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        member = serializer.validated_data.get("member")
        requested_category = serializer.validated_data["requested_category"]
        reason = serializer.validated_data.get("reason", "")

        item = _create_saving_choice_change_request(
            actor=request.user,
            member=member,
            requested_category=requested_category,
            reason=reason,
            request_origin=SavingChoiceChangeRequest.RequestOrigin.ON_BEHALF,
            request=request,
        )
        output = SavingChoiceChangeRequestSerializer(item)
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)


class SavingChoiceChangeRequestReviewAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, pk):
        item = SavingChoiceChangeRequest.objects.select_related(
            "member",
            "requested_category",
        ).filter(pk=pk).first()
        if not item:
            return Response({"detail": "Request not found."}, status=status.HTTP_404_NOT_FOUND)
        if item.status != SavingChoiceChangeRequest.Status.PENDING:
            return Response(
                {"detail": "Request is already reviewed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SavingChoiceChangeRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]
        review_note = serializer.validated_data.get("review_note", "")

        with transaction.atomic():
            if decision == "APPROVE":
                (
                    MemberSavingChoice.objects.filter(
                        member=item.member,
                        category__year=item.year,
                        is_active=True,
                    )
                    .exclude(category=item.requested_category)
                    .update(is_active=False)
                )
                choice, _created = MemberSavingChoice.objects.get_or_create(
                    member=item.member,
                    category=item.requested_category,
                    defaults={"is_active": True},
                )
                if not choice.is_active:
                    choice.is_active = True
                    choice.save(update_fields=["is_active"])
                item.status = SavingChoiceChangeRequest.Status.APPROVED
            else:
                item.status = SavingChoiceChangeRequest.Status.REJECTED

            item.reviewed_by = request.user
            item.reviewed_on = timezone.now()
            item.review_note = review_note
            item.save(update_fields=["status", "reviewed_by", "reviewed_on", "review_note"])

        log_transaction(
            user=request.user,
            transaction_type="SAVING",
            action="UPDATE",
            related_model="SavingChoiceChangeRequest",
            related_object_id=item.id,
            description=(
                f"{item.status} saving choice change request #{item.id} "
                f"for member {item.member.national_id}"
            ),
            request=request,
        )
        return Response(SavingChoiceChangeRequestSerializer(item).data, status=status.HTTP_200_OK)


# ======================================================
# MONTHLY SAVINGS (TRANSACTIONS)
# ======================================================

class MonthlySavingCreateView(generics.CreateAPIView):
    queryset = MonthlySaving.objects.all()
    serializer_class = MonthlySavingSerializer
    permission_classes = [IsTellerOrAdmin]

    @staticmethod
    def _get_late_saving_rule():
        rule = FineRule.objects.filter(
            fine_type=FineRule.FineType.SAVING,
            percentage=Decimal("10.00"),
            is_active=True,
        ).order_by("-created_on").first()
        if rule:
            return rule
        return FineRule.objects.create(
            name="Late Saving - Article 7",
            fine_type=FineRule.FineType.SAVING,
            percentage=Decimal("10.00"),
            applies_after_days=5,
            is_active=True,
        )

    @staticmethod
    def _compute_overdue_unpaid_months(choice, today):
        year = choice.category.year
        if year > today.year:
            return 0
        max_month = 12 if year < today.year else today.month
        paid_months = set(
            MonthlySaving.objects.filter(saving_choice=choice).values_list("month", flat=True)
        )
        overdue = 0
        for month in range(1, max_month + 1):
            if not _monthly_fine_applicable(month):
                continue
            due_date = _saving_due_date(year, month)
            if today >= due_date and month not in paid_months:
                overdue += 1
        return overdue

    def perform_create(self, serializer):
        saving_choice = serializer.validated_data["saving_choice"]
        member = saving_choice.member

        if not member.is_active:
            raise ValidationError("Inactive member cannot deposit savings.")

        monthly_saving = serializer.save(received_by=self.request.user)

        # Article 7: Payment is due by 5th of next month; late starts on 6th.
        paid_on = monthly_saving.saved_on or timezone.localdate()
        due_date = _saving_due_date(monthly_saving.year, monthly_saving.month)
        if paid_on >= due_date and _monthly_fine_applicable(monthly_saving.month):
            rule = self._get_late_saving_rule()
            existing_month_fine = Fine.objects.filter(
                member=member,
                rule=rule,
                # Late fine for saving month M is generated on due period month (M+1),
                # so use due_date month/year for deduplication against scheduled task.
                calculated_on__month=due_date.month,
                calculated_on__year=due_date.year,
            ).exists()
            # Fine must be based on member's selected saving category for that year.
            fine_base_amount = Decimal(saving_choice.category.monthly_amount)
            fine_amount = int(
                (fine_base_amount * rule.percentage / Decimal("100")).quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            )
            if not existing_month_fine:
                fine, created = Fine.objects.get_or_create(
                    member=member,
                    rule=rule,
                    saving=monthly_saving,
                    defaults={"amount": fine_amount},
                )
                if created:
                    log_transaction(
                        user=self.request.user,
                        transaction_type="FINE",
                        action="CREATE",
                        related_model="Fine",
                        related_object_id=fine.id,
                        amount=fine.amount,
                        description=(
                            f"Article 7 late saving fine for member {member.national_id} "
                            f"month {monthly_saving.month}/{monthly_saving.year}"
                        ),
                        request=self.request,
                    )

        overdue_months = self._compute_overdue_unpaid_months(saving_choice, timezone.localdate())
        if overdue_months >= 2:
            log_transaction(
                user=self.request.user,
                transaction_type="SYSTEM",
                action="UPDATE",
                related_model="Member",
                related_object_id=member.id,
                description=(
                    f"Member {member.national_id} has {overdue_months} overdue unpaid months. "
                    "Committee review required for membership status (Article 7)."
                ),
                request=self.request,
            )

        log_transaction(
            user=self.request.user,
            transaction_type="SAVING",
            action="PAY",
            related_model="MonthlySaving",
            related_object_id=monthly_saving.id,
            amount=monthly_saving.amount_paid,
            description=(
                f"Recorded monthly saving for member {member.national_id} "
                f"month {monthly_saving.month}/{monthly_saving.year}"
            ),
            request=self.request,
        )


class MonthlySavingListView(generics.ListAPIView):
    serializer_class = MonthlySavingSerializer
    permission_classes = [IsAuthenticated, IsSavingsStaff]

    def get_queryset(self):
        return _get_monthly_savings_queryset(self.request)


class MonthlySavingExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsSavingsStaff]

    def get(self, request):
        lang = get_report_lang(request)
        queryset = _get_monthly_savings_queryset(request)
        headers = [
            report_text(lang, "label.member"),
            report_text(lang, "label.category"),
            report_text(lang, "label.month"),
            report_text(lang, "label.year"),
            report_text(lang, "label.amount"),
            report_text(lang, "label.saved_on"),
            report_text(lang, "label.received_by"),
            report_text(lang, "label.late_fine"),
            report_text(lang, "label.status"),
        ]
        rows = []
        total_amount = 0
        total_fine = 0
        for item in queryset:
            serializer = MonthlySavingSerializer(item)
            data = serializer.data
            amount_paid = int(data.get("amount_paid") or 0)
            late_fine_amount = int(data.get("late_fine_amount") or 0)
            total_amount += amount_paid
            total_fine += late_fine_amount
            if data.get("committee_review_required"):
                status_label = report_choice(
                    lang,
                    "saving_status",
                    "COMMITTEE_REVIEW_REQUIRED",
                )
            elif data.get("is_late"):
                status_label = report_choice(lang, "saving_status", "LATE")
            else:
                status_label = report_choice(lang, "saving_status", "ON_TIME")
            rows.append(
                [
                    data.get("member_name") or "-",
                    data.get("category_name") or "-",
                    data.get("month") or "-",
                    data.get("year") or "-",
                    f"{amount_paid:,} RWF",
                    data.get("saved_on") or "-",
                    data.get("received_by_username") or "-",
                    f"{late_fine_amount:,} RWF",
                    status_label,
                ]
            )

        filters = {
            report_text(lang, "label.search"): request.query_params.get("search"),
            report_text(lang, "label.year"): request.query_params.get("year"),
            report_text(lang, "label.month"): request.query_params.get("month"),
            report_text(lang, "label.member_id"): request.query_params.get("member_id"),
            report_text(lang, "label.from"): request.query_params.get("date_from"),
            report_text(lang, "label.to"): request.query_params.get("date_to"),
        }
        summary = {
            report_text(lang, "label.total_records"): queryset.count(),
            report_text(lang, "label.total_savings"): f"{total_amount:,} RWF",
            report_text(lang, "label.total_late_fines"): f"{total_fine:,} RWF",
        }
        generated_by = request.user.get_full_name().strip() or request.user.username
        return build_pdf_report_response(
            filename="monthly_savings_report.pdf",
            title=report_text(lang, "report.monthly_savings.title"),
            subtitle=report_text(lang, "report.monthly_savings.subtitle"),
            headers=headers,
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=generated_by,
            filters=filters,
            summary=summary,
            lang=lang,
            acting_user=request.user,
        )


class MyMonthlySavingListView(generics.ListAPIView):
    serializer_class = MonthlySavingSerializer
    permission_classes = [IsMember]

    def get_queryset(self):
        queryset = _apply_my_monthly_savings_filters(
            _get_my_monthly_savings_base_queryset(self.request),
            self.request,
        )
        return queryset.order_by("-saved_on", "-id")


class MyMonthlySavingStatementPDFView(APIView):
    permission_classes = [IsAuthenticated, IsMember]

    def get(self, request):
        lang = get_report_lang(request)
        member = getattr(request.user, "member_profile", None)
        if not member:
            raise ValidationError("Member profile not found.")

        base_queryset = _get_my_monthly_savings_base_queryset(request)
        filtered_queryset = _apply_my_monthly_savings_filters(base_queryset, request)
        statement_queryset = filtered_queryset.order_by("saved_on", "id")

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        opening_balance = 0
        if date_from:
            opening_balance = int(
                base_queryset.filter(saved_on__lt=date_from).aggregate(total=Sum("amount_paid"))["total"]
                or 0
            )

        running_balance = opening_balance
        total_savings = 0
        total_fines = 0
        rows = []

        for item in statement_queryset:
            serializer = MonthlySavingSerializer(item)
            data = serializer.data
            amount_paid = int(data.get("amount_paid") or 0)
            late_fine_amount = int(data.get("late_fine_amount") or 0)
            total_savings += amount_paid
            total_fines += late_fine_amount
            running_balance += amount_paid

            if data.get("committee_review_required"):
                status_label = report_choice(lang, "saving_status", "COMMITTEE_REVIEW_REQUIRED")
            elif data.get("is_late"):
                status_label = report_choice(lang, "saving_status", "LATE")
            else:
                status_label = report_choice(lang, "saving_status", "ON_TIME")

            notes = [data.get("category_name") or "-", status_label]
            if late_fine_amount:
                notes.append(
                    f"{report_text(lang, 'label.late_fine')}: {late_fine_amount:,} RWF"
                )

            rows.append(
                [
                    data.get("saved_on") or "-",
                    f"SV-{item.id:06d}",
                    f"{report_text(lang, 'label.savings')} {int(item.month):02d}/{item.year}",
                    f"{amount_paid:,} RWF",
                    f"{running_balance:,} RWF",
                    " | ".join(notes),
                ]
            )

        all_time_label = report_text(lang, "value.all_time")
        if date_from or date_to:
            period_value = f"{date_from or all_time_label} - {date_to or all_time_label}"
        else:
            period_value = all_time_label

        filters = {
            report_text(lang, "label.from"): date_from,
            report_text(lang, "label.to"): date_to,
        }
        summary = {
            report_text(lang, "label.member"): member.user.get_full_name().strip()
            or member.user.username,
            report_text(lang, "label.account_number"): member.account_number or "-",
            report_text(lang, "label.statement_period"): period_value,
            report_text(lang, "label.opening_balance"): f"{opening_balance:,} RWF",
            report_text(lang, "label.closing_balance"): f"{running_balance:,} RWF",
            report_text(lang, "label.total_savings"): f"{total_savings:,} RWF",
            report_text(lang, "label.total_late_fines"): f"{total_fines:,} RWF",
            report_text(lang, "label.total_records"): statement_queryset.count(),
        }
        generated_by = request.user.get_full_name().strip() or request.user.username

        return build_pdf_report_response(
            filename="my_savings_statement.pdf",
            title=report_text(lang, "report.member_savings_statement.title"),
            subtitle=report_text(lang, "report.member_savings_statement.subtitle"),
            headers=[
                report_text(lang, "label.saved_on"),
                report_text(lang, "label.reference"),
                report_text(lang, "label.details"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.balance"),
                report_text(lang, "label.notes"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-"]],
            generated_by=generated_by,
            filters=filters,
            summary=summary,
            lang=lang,
            acting_user=request.user,
            landscape_mode=False,
        )

