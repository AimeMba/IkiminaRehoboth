from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from ..models import Client, Loan, LoanRequest, LoanType, Member
from ..permissions.role_permissions import IsLoanReadStaff, IsLoanStaff, IsMemberOrClient
from ..serializers.loan_request_serializers import LoanRequestReviewSerializer, LoanRequestSerializer
from ..services.transaction_logger import log_transaction


class MyLoanRequestListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = LoanRequestSerializer
    permission_classes = [IsAuthenticated, IsMemberOrClient]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = LoanRequest.objects.select_related(
            "member__user",
            "client__user",
            "requested_loan_type",
            "reviewed_by",
            "requested_by",
            "approved_loan",
        )
        if self.request.user.role == "MEMBER":
            return queryset.filter(member__user=self.request.user)
        return queryset.filter(client__user=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.role == "MEMBER":
            owner = getattr(self.request.user, "member_profile", None)
            if not owner:
                raise ValidationError("Member profile not found for this user.")
            if not owner.is_active:
                raise ValidationError("Inactive member cannot request a loan.")
            request_obj = serializer.save(
                member=owner,
                client=None,
                requested_by=self.request.user,
                request_origin=LoanRequest.RequestOrigin.SELF,
            )
            owner_label = owner.national_id
        else:
            owner = getattr(self.request.user, "client_profile", None)
            if not owner:
                raise ValidationError("Client profile not found for this user.")
            if not owner.is_active:
                raise ValidationError("Inactive client cannot request a loan.")
            request_obj = serializer.save(
                client=owner,
                member=None,
                requested_by=self.request.user,
                request_origin=LoanRequest.RequestOrigin.SELF,
            )
            owner_label = owner.account_number

        log_transaction(
            user=self.request.user,
            transaction_type="LOAN",
            action="CREATE",
            related_model="LoanRequest",
            related_object_id=request_obj.id,
            amount=request_obj.requested_amount,
            description=f"{self.request.user.role} {owner_label} requested a loan",
            request=self.request,
        )


class LoanRequestListAPIView(generics.ListAPIView):
    serializer_class = LoanRequestSerializer
    permission_classes = [IsAuthenticated, IsLoanReadStaff]

    def get_queryset(self):
        return _get_loan_requests_queryset(self.request)


class StaffLoanRequestCreateAPIView(generics.CreateAPIView):
    serializer_class = LoanRequestSerializer
    permission_classes = [IsAuthenticated, IsLoanStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        owner_type = str(request.data.get("owner_type", "")).upper()
        owner_id = request.data.get("owner_id")
        if owner_type not in {"MEMBER", "CLIENT"}:
            raise ValidationError({"owner_type": "Owner type must be MEMBER or CLIENT."})
        if not owner_id:
            raise ValidationError({"owner_id": "Owner is required."})

        payload = request.data.copy()
        payload.pop("owner_type", None)
        payload.pop("owner_id", None)
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)

        if owner_type == "MEMBER":
            member = Member.objects.filter(pk=owner_id).select_related("user").first()
            if not member:
                raise ValidationError({"owner_id": "Member not found."})
            if not member.is_active:
                raise ValidationError({"owner_id": "Inactive member cannot request a loan."})
            request_obj = serializer.save(
                member=member,
                client=None,
                requested_by=request.user,
                request_origin=LoanRequest.RequestOrigin.ON_BEHALF,
            )
            owner_label = member.national_id
        else:
            client = Client.objects.filter(pk=owner_id).first()
            if not client:
                raise ValidationError({"owner_id": "Client not found."})
            if not client.is_active:
                raise ValidationError({"owner_id": "Inactive client cannot request a loan."})
            request_obj = serializer.save(
                client=client,
                member=None,
                requested_by=request.user,
                request_origin=LoanRequest.RequestOrigin.ON_BEHALF,
            )
            owner_label = client.account_number

        log_transaction(
            user=request.user,
            transaction_type="LOAN",
            action="CREATE",
            related_model="LoanRequest",
            related_object_id=request_obj.id,
            amount=request_obj.requested_amount,
            description=f"{request.user.role} submitted loan request on behalf of {owner_label}",
            request=request,
        )

        output = self.get_serializer(request_obj)
        return Response(output.data, status=201)


class LoanRequestFormOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsLoanStaff]

    def get(self, request):
        members = Member.objects.filter(is_active=True).select_related("user").order_by(
            "user__first_name",
            "user__last_name",
            "national_id",
        )
        clients = Client.objects.filter(is_active=True).order_by("full_name")
        loan_types = LoanType.objects.filter(is_active=True).order_by("name")

        member_options = [
            {
                "id": member.id,
                "label": (member.user.get_full_name() or member.user.username or member.national_id),
                "national_id": member.national_id,
                "account_number": member.account_number,
                "phone": member.phone,
                "is_active": member.is_active,
            }
            for member in members
        ]
        client_options = [
            {
                "id": client.id,
                "label": client.full_name,
                "national_id": client.national_id,
                "account_number": client.account_number,
                "phone": client.phone,
                "is_active": client.is_active,
            }
            for client in clients
        ]
        loan_type_options = [
            {
                "id": loan_type.id,
                "name": loan_type.name,
                "interest_rate": loan_type.interest_rate,
            }
            for loan_type in loan_types
        ]
        return Response(
            {
                "members": member_options,
                "clients": client_options,
                "loan_types": loan_type_options,
            }
        )


class LoanRequestReviewAPIView(APIView):
    permission_classes = [IsAuthenticated, IsLoanStaff]

    def post(self, request, pk):
        loan_request = LoanRequest.objects.select_related(
            "member__user",
            "client__user",
            "requested_loan_type",
            "requested_by",
            "approved_loan",
        ).filter(pk=pk).first()
        if not loan_request:
            raise ValidationError("Loan request not found.")
        if loan_request.status != LoanRequest.StatusChoices.PENDING:
            raise ValidationError("Only pending loan requests can be reviewed.")

        serializer = LoanRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        with transaction.atomic():
            loan_request.status = payload["status"]
            loan_request.review_notes = payload.get("review_notes", "")
            loan_request.reviewed_by = request.user
            loan_request.reviewed_on = timezone.now()

            if loan_request.status == LoanRequest.StatusChoices.APPROVED:
                selected_loan_type_id = payload.get("loan_type") or loan_request.requested_loan_type_id
                loan_type = LoanType.objects.filter(pk=selected_loan_type_id, is_active=True).first()
                if not loan_type:
                    raise ValidationError({"loan_type": "Invalid active loan type."})
                loan_type_name = (loan_type.name or "").strip().lower()
                committee_discretion_names = {
                    "ubushishozi bwa committee",
                    "committee discretion",
                }
                if (
                    loan_type_name in committee_discretion_names
                    and not loan_request.guarantee_cheque
                ):
                    raise ValidationError(
                        {
                            "guarantee_cheque": (
                                "Guarantee cheque is required for 'Ubushishozi bwa committee' loan type."
                            )
                        }
                    )

                loan = Loan.objects.create(
                    member=loan_request.member,
                    client=loan_request.client,
                    loan_type=loan_type,
                    principal_amount=loan_request.requested_amount,
                    term_months=loan_request.requested_term_months,
                    term_days=loan_request.requested_term_days,
                    due_date=payload.get("due_date"),
                    requested_by=loan_request.requested_by,
                    request_origin=loan_request.request_origin,
                )
                loan_request.approved_loan = loan

                log_transaction(
                    user=request.user,
                    transaction_type="LOAN",
                    action="CREATE",
                    related_model="Loan",
                    related_object_id=loan.id,
                    amount=loan.principal_amount,
                    description=f"Loan created from request #{loan_request.id}",
                    request=request,
                )

            loan_request.save()

        log_transaction(
            user=request.user,
            transaction_type="LOAN",
            action="UPDATE",
            related_model="LoanRequest",
            related_object_id=loan_request.id,
            amount=loan_request.requested_amount,
            description=f"Loan request #{loan_request.id} {loan_request.status.lower()}",
            request=request,
        )

        return Response({"detail": f"Loan request {loan_request.status.lower()} successfully."})


class LoanRequestReviewOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsLoanStaff]

    def get(self, request):
        loan_types = LoanType.objects.filter(is_active=True).order_by("name").values(
            "id",
            "name",
            "interest_rate",
        )
        return Response({"loan_types": list(loan_types)})


def _get_loan_requests_queryset(request):
    queryset = LoanRequest.objects.select_related(
        "member__user",
        "client__user",
        "requested_loan_type",
        "reviewed_by",
        "requested_by",
        "approved_loan",
    )
    params = request.query_params
    status = params.get("status")
    owner_type = params.get("owner_type")
    owner_id = params.get("owner_id")
    search = (params.get("search") or "").strip()
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if status:
        queryset = queryset.filter(status=status)
    if owner_type == "MEMBER":
        queryset = queryset.filter(member__isnull=False)
    elif owner_type == "CLIENT":
        queryset = queryset.filter(client__isnull=False)
    if owner_id:
        if owner_type == "CLIENT":
            queryset = queryset.filter(client_id=owner_id)
        else:
            queryset = queryset.filter(member_id=owner_id)
    if search:
        search_query = (
            Q(member__national_id__icontains=search)
            | Q(member__account_number__icontains=search)
            | Q(member__user__username__icontains=search)
            | Q(member__user__first_name__icontains=search)
            | Q(member__user__last_name__icontains=search)
            | Q(client__full_name__icontains=search)
            | Q(client__account_number__icontains=search)
            | Q(client__national_id__icontains=search)
            | Q(requested_by__username__icontains=search)
            | Q(requested_by__first_name__icontains=search)
            | Q(requested_by__last_name__icontains=search)
            | Q(reviewed_by__username__icontains=search)
            | Q(reviewed_by__first_name__icontains=search)
            | Q(reviewed_by__last_name__icontains=search)
            | Q(requested_loan_type__name__icontains=search)
            | Q(purpose__icontains=search)
        )
        if search.isdigit():
            search_query |= Q(id=int(search)) | Q(requested_amount=int(search))
        queryset = queryset.filter(search_query)
    if date_from:
        queryset = queryset.filter(requested_on__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(requested_on__date__lte=date_to)

    return queryset.order_by("-requested_on", "-id")


class LoanRequestExportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ..utils.pdf_reports import build_pdf_report_response
        from ..utils.report_language import get_report_lang, report_choice, report_text

        lang = get_report_lang(request)
        queryset = _get_loan_requests_queryset(request)
        total_requested = 0
        pending_count = 0
        rows = []

        for loan_request in queryset:
            item = LoanRequestSerializer(loan_request, context={"request": request}).data
            amount = int(item.get("requested_amount") or 0)
            total_requested += amount
            pending_count += 1 if str(item.get("status") or "").upper() == "PENDING" else 0
            reviewed_by_name = "-"
            if loan_request.reviewed_by:
                reviewed_by_name = (
                    loan_request.reviewed_by.get_full_name()
                    or loan_request.reviewed_by.username
                    or "-"
                )
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("requested_on") or "-",
                    item.get("owner_name") or "-",
                    report_choice(lang, "owner_type", item.get("owner_type"), default="-"),
                    item.get("requested_loan_type_name") or "-",
                    f"{amount:,} RWF",
                    report_choice(lang, "request_status", item.get("status"), default=item.get("status")),
                    item.get("requested_by_name") or "-",
                    reviewed_by_name,
                    item.get("approved_loan_id") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="loan_requests_report.pdf",
            title=report_text(lang, "report.loan_requests.title"),
            subtitle=report_text(lang, "report.loan_requests.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.requested_on"),
                report_text(lang, "label.owner"),
                report_text(lang, "label.owner_type"),
                report_text(lang, "label.loan_type"),
                report_text(lang, "label.requested_amount"),
                report_text(lang, "label.status"),
                report_text(lang, "label.requested_by"),
                report_text(lang, "label.reviewed_by"),
                report_text(lang, "label.approved_loan"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.status"): report_choice(
                    lang,
                    "request_status",
                    request.query_params.get("status"),
                    default=request.query_params.get("status"),
                ),
                report_text(lang, "label.owner_type"): report_choice(
                    lang,
                    "owner_type",
                    request.query_params.get("owner_type"),
                    default=request.query_params.get("owner_type"),
                ),
                report_text(lang, "label.owner_id"): request.query_params.get("owner_id"),
                f"{report_text(lang, 'label.requested_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.requested_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_requests"): queryset.count(),
                report_text(lang, "label.pending_requests"): pending_count,
                report_text(lang, "label.requested_amount"): f"{total_requested:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )

