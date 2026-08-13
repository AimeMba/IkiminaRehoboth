from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from ..models import Income, IncomeCategory
from ..serializers.income_serializers import IncomeSerializer, IncomeCategorySerializer
from ..permissions.role_permissions import IsAdminFinanceOrAuditor
from ..services.transaction_logger import log_transaction

# -------------------------------
# INCOME CATEGORY
# -------------------------------
class IncomeCategoryListCreateView(generics.ListCreateAPIView):
    queryset = IncomeCategory.objects.all()
    serializer_class = IncomeCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_create(self, serializer):
        category = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="IncomeCategory",
            related_object_id=category.id,
            description=f"Created income category {category.name}",
            request=self.request,
        )

# -------------------------------
# INCOME
# -------------------------------
class IncomeListCreateView(generics.ListCreateAPIView):
    serializer_class = IncomeSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_income_queryset(self.request)

    def perform_create(self, serializer):
        # Automatic record of who recorded this income
        income = serializer.save(
            recorded_by=self.request.user,
            income_date=timezone.localdate()
        )
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="Income",
            related_object_id=income.id,
            amount=income.amount,
            description=f"Recorded income in category {income.category.name}",
            request=self.request,
        )

class IncomeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Income.objects.all()
    serializer_class = IncomeSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_update(self, serializer):
        income = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="Income",
            related_object_id=income.id,
            amount=income.amount,
            description=f"Updated income #{income.id}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        income_id = instance.id
        amount = instance.amount
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="DELETE",
            related_model="Income",
            related_object_id=income_id,
            amount=amount,
            description=f"Deleted income #{income_id}",
            request=self.request,
        )


def _get_income_queryset(request):
    from django.db.models import Q

    queryset = Income.objects.select_related("category", "recorded_by").order_by(
        "-income_date", "-id"
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
            | Q(related_model__icontains=search)
        )
        if search.isdigit():
            search_query |= (
                Q(id=int(search))
                | Q(amount=int(search))
                | Q(related_object_id=int(search))
            )
        queryset = queryset.filter(search_query)

    if category:
        queryset = queryset.filter(category_id=category)
    if date_from:
        queryset = queryset.filter(income_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(income_date__lte=date_to)

    return queryset


class IncomeExportPDFView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        from ..utils.pdf_reports import build_pdf_report_response
        from ..utils.report_language import get_report_lang, report_text

        lang = get_report_lang(request)
        queryset = _get_income_queryset(request)
        serializer = IncomeSerializer(queryset, many=True)
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
                    item.get("income_date") or "-",
                    item.get("recorded_by_name") or "-",
                    item.get("related_model") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="income_report.pdf",
            title=report_text(lang, "report.income.title"),
            subtitle=report_text(lang, "report.income.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.category"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.details"),
                report_text(lang, "label.time"),
                report_text(lang, "label.recorded_by"),
                report_text(lang, "label.model"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.category"): request.query_params.get("category"),
                f"{report_text(lang, 'label.time')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.time')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_amount"): f"{total_amount:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )

