from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import SalaryPayment, Employee
from ..serializers.salary_serializers import SalaryPaymentSerializer

from ..permissions.role_permissions import (
    IsAdmin,
    IsAdminFinanceOrAuditor
)

from ..permissions.role_permissions import BlockMembers
from ..services.transaction_logger import log_transaction


# =====================================================
# SALARY PAYMENT CREATE
# =====================================================

class SalaryPaymentCreateView(generics.CreateAPIView):
    """
    Pay employee salary.

    Automatically:
    âœ… Creates Expense record inside serializer
    """

    queryset = SalaryPayment.objects.all()
    serializer_class = SalaryPaymentSerializer

    permission_classes = [
        IsAuthenticated,
        BlockMembers,
        IsAdminFinanceOrAuditor
    ]

    def perform_create(self, serializer):
        payment = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="EXPENSE",
            action="PAY",
            related_model="SalaryPayment",
            related_object_id=payment.id,
            amount=payment.amount,
            description=f"Salary paid to employee #{payment.employee.id}",
            request=self.request,
        )


# =====================================================
# SALARY PAYMENT LIST
# =====================================================

class SalaryPaymentListAPIView(generics.ListAPIView):
    """
    List all salary payments (Finance/Admin/Auditor)
    """

    serializer_class = SalaryPaymentSerializer

    permission_classes = [
        IsAuthenticated,
        BlockMembers,
        IsAdminFinanceOrAuditor
    ]

    def get_queryset(self):
        return _get_salary_payments_queryset(self.request)


# =====================================================
# SALARY PAYMENT DETAIL
# =====================================================

class SalaryPaymentDetailAPIView(generics.RetrieveAPIView):
    """
    Retrieve one salary payment record
    """

    queryset = SalaryPayment.objects.all()
    serializer_class = SalaryPaymentSerializer

    permission_classes = [
        IsAuthenticated,
        BlockMembers,
        IsAdminFinanceOrAuditor
    ]


# =====================================================
# SALARY PAYMENT DELETE (Admin Only)
# =====================================================

class SalaryPaymentDeleteAPIView(generics.DestroyAPIView):
    """
    Delete salary payment (Admin only)
    """

    queryset = SalaryPayment.objects.all()
    serializer_class = SalaryPaymentSerializer

    permission_classes = [
        IsAuthenticated,
        IsAdmin
    ]

    def perform_destroy(self, instance):
        payment_id = instance.id
        amount = instance.amount
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="EXPENSE",
            action="DELETE",
            related_model="SalaryPayment",
            related_object_id=payment_id,
            amount=amount,
            description=f"Deleted salary payment #{payment_id}",
            request=self.request,
        )


# =====================================================
# SALARY PAYMENT UPDATE
# =====================================================

class SalaryPaymentUpdateAPIView(generics.UpdateAPIView):
    queryset = SalaryPayment.objects.select_related("employee", "paid_by")
    serializer_class = SalaryPaymentSerializer
    permission_classes = [
        IsAuthenticated,
        BlockMembers,
        IsAdminFinanceOrAuditor
    ]

    def perform_update(self, serializer):
        payment = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="EXPENSE",
            action="UPDATE",
            related_model="SalaryPayment",
            related_object_id=payment.id,
            amount=payment.amount,
            description=f"Updated salary payment #{payment.id}",
            request=self.request,
        )


# =====================================================
# SALARY PAYMENT FORM OPTIONS
# =====================================================

class SalaryPaymentFormOptionsAPIView(generics.GenericAPIView):
    permission_classes = [
        IsAuthenticated,
        BlockMembers,
        IsAdminFinanceOrAuditor
    ]

    def get(self, request, *args, **kwargs):
        employees = []
        queryset = Employee.objects.select_related("user", "member__user", "department").filter(is_active=True)
        for employee in queryset.order_by("id"):
            if employee.user:
                full_name = employee.user.get_full_name().strip() or employee.user.username
            elif employee.member and employee.member.user:
                full_name = employee.member.user.get_full_name().strip() or employee.member.user.username
            elif employee.external_full_name:
                full_name = employee.external_full_name
            else:
                full_name = f"Employee #{employee.id}"

            employees.append(
                {
                    "id": employee.id,
                    "label": f"{full_name} - {employee.department.name}",
                    "salary": employee.salary,
                    "department_name": employee.department.name,
                }
            )

        return Response({"employees": employees})


def _get_salary_payments_queryset(request):
    from django.db.models import Q

    queryset = SalaryPayment.objects.select_related(
        "employee",
        "employee__user",
        "employee__member__user",
        "employee__department",
        "paid_by",
    ).order_by("-paid_on", "-id")
    params = request.query_params
    search = (params.get("search") or "").strip()
    employee_id = params.get("employee")
    department_id = params.get("department")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if search:
        search_query = (
            Q(employee__department__name__icontains=search)
            | Q(employee__external_full_name__icontains=search)
            | Q(employee__external_national_id__icontains=search)
            | Q(employee__user__username__icontains=search)
            | Q(employee__user__first_name__icontains=search)
            | Q(employee__user__last_name__icontains=search)
            | Q(employee__member__user__username__icontains=search)
            | Q(employee__member__user__first_name__icontains=search)
            | Q(employee__member__user__last_name__icontains=search)
            | Q(paid_by__username__icontains=search)
            | Q(paid_by__first_name__icontains=search)
            | Q(paid_by__last_name__icontains=search)
        )
        if search.isdigit():
            search_query |= Q(id=int(search)) | Q(amount=int(search))
        queryset = queryset.filter(search_query)

    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    if department_id:
        queryset = queryset.filter(employee__department_id=department_id)
    if date_from:
        queryset = queryset.filter(paid_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(paid_on__lte=date_to)

    return queryset


class SalaryPaymentExportPDFView(generics.GenericAPIView):
    permission_classes = [
        IsAuthenticated,
        BlockMembers,
        IsAdminFinanceOrAuditor,
    ]

    def get(self, request, *args, **kwargs):
        from ..utils.pdf_reports import build_pdf_report_response
        from ..utils.report_language import get_report_lang, report_text

        lang = get_report_lang(request)
        queryset = _get_salary_payments_queryset(request)
        serializer = SalaryPaymentSerializer(queryset, many=True)
        total_amount = 0
        rows = []

        for item in serializer.data:
            amount = int(item.get("amount") or 0)
            total_amount += amount
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("employee_name") or "-",
                    item.get("department_name") or "-",
                    f"{amount:,} RWF",
                    item.get("paid_on") or "-",
                    item.get("paid_by_name") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="salary_payments_report.pdf",
            title=report_text(lang, "report.salary_payments.title"),
            subtitle=report_text(lang, "report.salary_payments.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.employee"),
                report_text(lang, "label.department"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.paid_on"),
                report_text(lang, "label.recorded_by"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.employee"): request.query_params.get("employee"),
                report_text(lang, "label.department"): request.query_params.get("department"),
                f"{report_text(lang, 'label.paid_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.paid_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_amount"): f"{total_amount:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )



