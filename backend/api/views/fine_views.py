from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import FineRule, Fine, Member, MemberSavingChoice
from ..permissions.role_permissions import IsAdminFinanceOrAuditor, IsMember
from ..serializers.fine_serializers import FineRuleSerializer, FineSerializer
from ..services.transaction_logger import log_transaction
from ..utils.pdf_reports import build_pdf_report_response
from ..utils.report_language import get_report_lang, report_choice, report_text


def _get_fines_queryset(request):
    queryset = Fine.objects.select_related("member__user", "rule").order_by("-calculated_on", "-id")
    member_id = request.query_params.get("member")
    search = (request.query_params.get("search") or "").strip()
    status = (request.query_params.get("status") or "").strip().upper()
    is_paid = request.query_params.get("is_paid")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if search:
        search_query = (
            Q(member__national_id__icontains=search)
            | Q(member__account_number__icontains=search)
            | Q(member__user__username__icontains=search)
            | Q(member__user__first_name__icontains=search)
            | Q(member__user__last_name__icontains=search)
            | Q(rule__name__icontains=search)
            | Q(rule__fine_type__icontains=search)
        )
        if search.isdigit():
            search_query |= Q(id=int(search)) | Q(amount=int(search))
        queryset = queryset.filter(search_query)
    if member_id:
        queryset = queryset.filter(member_id=member_id)
    if status == "PAID":
        queryset = queryset.filter(is_paid=True, is_waived=False)
    elif status == "WAIVED":
        queryset = queryset.filter(is_waived=True)
    elif status == "PENDING":
        queryset = queryset.filter(is_paid=False, is_waived=False)
    if is_paid in {"true", "false"}:
        queryset = queryset.filter(is_paid=(is_paid == "true"))
    if date_from:
        queryset = queryset.filter(calculated_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(calculated_on__lte=date_to)
    return queryset


class FineRuleListCreateView(generics.ListCreateAPIView):
    queryset = FineRule.objects.all().order_by("-created_on")
    serializer_class = FineRuleSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_create(self, serializer):
        rule = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="FineRule",
            related_object_id=rule.id,
            description=f"Created fine rule {rule.name}",
            request=self.request,
        )


class FineRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = FineRule.objects.all()
    serializer_class = FineRuleSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_update(self, serializer):
        rule = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="FineRule",
            related_object_id=rule.id,
            description=f"Updated fine rule {rule.name}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        rule_id = instance.id
        rule_name = instance.name
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="DELETE",
            related_model="FineRule",
            related_object_id=rule_id,
            description=f"Deleted fine rule {rule_name}",
            request=self.request,
        )


class FineListCreateView(generics.ListCreateAPIView):
    serializer_class = FineSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_fines_queryset(self.request)

    def perform_create(self, serializer):
        fine = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="FINE",
            action="CREATE",
            related_model="Fine",
            related_object_id=fine.id,
            amount=fine.amount,
            description=f"Created fine for member {fine.member.national_id}",
            request=self.request,
        )


class MyFineListView(generics.ListAPIView):
    serializer_class = FineSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        queryset = Fine.objects.select_related("member__user", "rule").filter(
            member__user=self.request.user
        )
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(calculated_on__gte=date_from)
        if date_to:
            queryset = queryset.filter(calculated_on__lte=date_to)
        is_paid = self.request.query_params.get("is_paid")
        if is_paid in {"true", "false"}:
            queryset = queryset.filter(is_paid=(is_paid == "true"))
        return queryset.order_by("-calculated_on", "-id")


class FineFormOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        fine_year = timezone.localdate().year
        members = (
            Member.objects.select_related("user")
            .filter(
                is_active=True,
                user__isnull=False,
                user__is_active=True,
                saving_choices__is_active=True,
                saving_choices__category__year=fine_year,
            )
            .distinct()
            .order_by("user__first_name", "user__last_name", "national_id")
        )
        rules = FineRule.objects.filter(is_active=True).order_by("fine_type", "name")

        monthly_choices = {
            choice.member_id: choice
            for choice in MemberSavingChoice.objects.select_related("category").filter(
                member__in=members,
                is_active=True,
                category__year=fine_year,
            )
        }

        members_payload = []
        for member in members:
            saving_choice = monthly_choices.get(member.id)
            if not saving_choice:
                continue
            member_user = getattr(member, "user", None)
            full_name = member_user.get_full_name() if member_user else ""
            username = member_user.username if member_user else ""
            members_payload.append(
                {
                    "id": member.id,
                    "label": (
                        full_name or username or member.national_id
                    ),
                    "national_id": member.national_id,
                    "account_number": member.account_number,
                    "monthly_amount": int(saving_choice.category.monthly_amount),
                    "category_name": saving_choice.category.name,
                    "year": fine_year,
                }
            )

        rules_payload = [
            {
                "id": rule.id,
                "name": rule.name,
                "fine_type": rule.fine_type,
                "percentage": str(rule.percentage),
            }
            for rule in rules
        ]
        return Response({"members": members_payload, "rules": rules_payload})


class FineWaiveAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def post(self, request, pk):
        fine = get_object_or_404(Fine, pk=pk)
        if fine.is_paid:
            return Response(
                {"detail": "Paid fine cannot be waived."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if fine.is_waived:
            return Response(
                {"detail": "Fine is already waived."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {"reason": ["Waiver reason is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fine.is_waived = True
        fine.waived_on = timezone.localdate()
        fine.waived_by = request.user
        fine.waiver_reason = reason
        fine.save()

        log_transaction(
            user=request.user,
            transaction_type="FINE",
            action="UPDATE",
            related_model="Fine",
            related_object_id=fine.id,
            amount=fine.amount,
            description=f"Waived fine #{fine.id} for member {fine.member.national_id}",
            request=request,
        )

        return Response({"message": "Fine waived successfully."}, status=status.HTTP_200_OK)


class FineDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Fine.objects.select_related("member__user", "rule")
    serializer_class = FineSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_update(self, serializer):
        fine = serializer.save()
        action = "PAY" if fine.is_paid else "UPDATE"
        log_transaction(
            user=self.request.user,
            transaction_type="FINE",
            action=action,
            related_model="Fine",
            related_object_id=fine.id,
            amount=fine.amount,
            description=f"Updated fine #{fine.id}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        fine_id = instance.id
        amount = instance.amount
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="FINE",
            action="DELETE",
            related_model="Fine",
            related_object_id=fine_id,
            amount=amount,
            description=f"Deleted fine #{fine_id}",
            request=self.request,
        )


class FineExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        lang = get_report_lang(request)
        queryset = _get_fines_queryset(request)
        serializer = FineSerializer(queryset, many=True)
        rows = []
        total_amount = 0
        paid_count = 0
        waived_count = 0
        for item in serializer.data:
            amount = int(item.get("amount") or 0)
            total_amount += amount
            paid_count += 1 if item.get("is_paid") else 0
            waived_count += 1 if item.get("is_waived") else 0
            if item.get("is_waived"):
                status_label = report_choice(lang, "fine_status", "WAIVED")
            elif item.get("is_paid"):
                status_label = report_choice(lang, "fine_status", "PAID")
            else:
                status_label = report_choice(lang, "fine_status", "PENDING")
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("member_name") or "-",
                    item.get("rule_name") or "-",
                    report_choice(lang, "fine_type", item.get("rule_type"), default="-"),
                    f"{amount:,} RWF",
                    item.get("calculated_on") or "-",
                    status_label,
                ]
            )

        return build_pdf_report_response(
            filename="fines_report.pdf",
            title=report_text(lang, "report.fines.title"),
            subtitle=report_text(lang, "report.fines.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.member"),
                report_text(lang, "label.rule"),
                report_text(lang, "label.type"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.calculated_on"),
                report_text(lang, "label.status"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.member"): request.query_params.get("member"),
                report_text(lang, "label.status"): report_choice(
                    lang,
                    "fine_status",
                    request.query_params.get("status"),
                    default=request.query_params.get("status"),
                ),
                report_text(lang, "label.is_paid"): (
                    report_choice(lang, "fine_status", "PAID")
                    if request.query_params.get("is_paid") == "true"
                    else (
                        report_text(lang, "value.unpaid")
                        if request.query_params.get("is_paid") == "false"
                        else request.query_params.get("is_paid")
                    )
                ),
                f"{report_text(lang, 'label.calculated_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.calculated_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_amount"): f"{total_amount:,} RWF",
                report_text(lang, "label.paid_fines"): paid_count,
                report_text(lang, "label.waived_fines"): waived_count,
            },
            lang=lang,
            acting_user=request.user,
        )
