from rest_framework.views import APIView
from rest_framework import generics
from rest_framework.response import Response
from django.db.models import Sum
from django.utils.timezone import now
from rest_framework.permissions import IsAuthenticated
from ..models import Expense, ExpenseCategory
from ..serializers.expense_serializers import ExpenseSerializer, ExpenseCategorySerializer
from ..permissions.role_permissions import IsAdminFinanceOrAuditor
from ..services.transaction_logger import log_transaction


class ExpenseCategoryListCreateView(generics.ListCreateAPIView):
    queryset = ExpenseCategory.objects.all().order_by("name")
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_expenses_queryset(self.request)

    def perform_create(self, serializer):
        expense = serializer.save(recorded_by=self.request.user)
        log_transaction(
            user=self.request.user,
            transaction_type="EXPENSE",
            action="CREATE",
            related_model="Expense",
            related_object_id=expense.id,
            amount=expense.amount,
            description=f"Recorded expense in category {expense.category.name}",
            request=self.request,
        )


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Expense.objects.select_related("category", "recorded_by")
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_update(self, serializer):
        expense = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="EXPENSE",
            action="UPDATE",
            related_model="Expense",
            related_object_id=expense.id,
            amount=expense.amount,
            description=f"Updated expense #{expense.id}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        expense_id = instance.id
        amount = instance.amount
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="EXPENSE",
            action="DELETE",
            related_model="Expense",
            related_object_id=expense_id,
            amount=amount,
            description=f"Deleted expense #{expense_id}",
            request=self.request,
        )

class ExpenseSummaryView(APIView):
    permission_classes = [IsAdminFinanceOrAuditor]

    def get(self, request):
        today = now().date()

        weekly_total = Expense.objects.filter(
            expense_date__week=today.isocalendar().week
        ).aggregate(total=Sum('amount'))['total'] or 0

        monthly_total = Expense.objects.filter(
            expense_date__month=today.month
        ).aggregate(total=Sum('amount'))['total'] or 0

        yearly_total = Expense.objects.filter(
            expense_date__year=today.year
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            "weekly_expenses": weekly_total,
            "monthly_expenses": monthly_total,
            "yearly_expenses": yearly_total,
        })


def _get_expenses_queryset(request):
    from django.db.models import Q

    queryset = Expense.objects.select_related("category", "recorded_by").order_by(
        "-expense_date", "-id"
    )
    params = request.query_params
    search = (params.get("search") or "").strip()
    category = params.get("category")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if search:
        search_query = (
            Q(category__name__icontains=search)
            | Q(description__icontains=search)
            | Q(recorded_by__username__icontains=search)
            | Q(recorded_by__first_name__icontains=search)
            | Q(recorded_by__last_name__icontains=search)
        )
        if search.isdigit():
            search_query |= Q(id=int(search)) | Q(amount=int(search))
        queryset = queryset.filter(search_query)

    if category:
        queryset = queryset.filter(category_id=category)
    if date_from:
        queryset = queryset.filter(expense_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(expense_date__lte=date_to)

    return queryset


class ExpenseExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        from ..utils.pdf_reports import build_pdf_report_response
        from ..utils.report_language import get_report_lang, report_text

        lang = get_report_lang(request)
        queryset = _get_expenses_queryset(request)
        serializer = ExpenseSerializer(queryset, many=True)
        total_amount = 0
        rows = []

        for item in serializer.data:
            amount = int(item.get("amount") or 0)
            total_amount += amount
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("category_name") or "-",
                    f"{amount:,} RWF",
                    item.get("description") or "-",
                    item.get("expense_date") or "-",
                    item.get("recorded_by_username") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="expenses_report.pdf",
            title=report_text(lang, "report.expenses.title"),
            subtitle=report_text(lang, "report.expenses.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.category"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.details"),
                report_text(lang, "label.time"),
                report_text(lang, "label.recorded_by"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.category"): request.query_params.get("category"),
                f"{report_text(lang, 'label.time')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.time')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_expenses"): f"{total_amount:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )

