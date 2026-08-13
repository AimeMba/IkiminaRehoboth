import csv
from datetime import datetime, time

from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.http import HttpResponse
import openpyxl

from ..models import TransactionLog
from ..permissions.role_permissions import IsAdminOrAuditor
from ..serializers.transaction_serializers import TransactionLogSerializer
from ..utils.pdf_reports import build_pdf_report_response
from ..utils.report_language import get_report_lang, report_choice, report_text


class TransactionLogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def get_filtered_queryset(request):
    queryset = TransactionLog.objects.select_related("user").all()
    transaction_type = request.query_params.get("transaction_type")
    action = request.query_params.get("action")
    user_id = request.query_params.get("user")
    search = request.query_params.get("search")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if transaction_type:
        queryset = queryset.filter(transaction_type=transaction_type)
    if action:
        queryset = queryset.filter(action=action)
    if user_id:
        queryset = queryset.filter(user_id=user_id)
    if search:
        queryset = queryset.filter(
            Q(description__icontains=search)
            | Q(related_model__icontains=search)
            | Q(transaction_type__icontains=search)
            | Q(action__icontains=search)
            | Q(user__username__icontains=search)
        )
    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
            queryset = queryset.filter(timestamp__date__gte=from_date)
        except ValueError:
            pass
    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
            queryset = queryset.filter(timestamp__lte=datetime.combine(to_date, time.max))
        except ValueError:
            pass

    return queryset.order_by("-timestamp")


class TransactionLogListView(generics.ListAPIView):
    serializer_class = TransactionLogSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]
    pagination_class = TransactionLogPagination

    def get_queryset(self):
        return get_filtered_queryset(self.request)


class TransactionLogExportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get(self, request):
        # Avoid DRF's reserved "format" query parameter, which can trigger a 404
        # before this view runs when values like "pdf" are sent.
        export_format = (
            request.query_params.get("export_format")
            or request.query_params.get("file_format")
            or request.query_params.get("download_format")
            or request.query_params.get("format")
            or "csv"
        ).lower()
        queryset = get_filtered_queryset(request)

        if export_format == "pdf":
            return self._export_pdf(request, queryset)
        if export_format == "xlsx":
            return self._export_xlsx(queryset)
        if export_format == "csv":
            return self._export_csv(queryset)

        return Response({"detail": "Unsupported format. Use csv, xlsx or pdf."}, status=400)

    def _export_csv(self, queryset):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="transaction_logs.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "timestamp",
                "user",
                "transaction_type",
                "action",
                "related_model",
                "related_object_id",
                "amount",
                "description",
                "ip_address",
            ]
        )
        for item in queryset:
            writer.writerow(
                [
                    item.timestamp.isoformat() if item.timestamp else "",
                    item.user.username if item.user else "",
                    item.transaction_type,
                    item.action,
                    item.related_model,
                    item.related_object_id or "",
                    item.amount or "",
                    item.description or "",
                    item.ip_address or "",
                ]
            )
        return response

    def _export_xlsx(self, queryset):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Transaction Logs"
        sheet.append(
            [
                "timestamp",
                "user",
                "transaction_type",
                "action",
                "related_model",
                "related_object_id",
                "amount",
                "description",
                "ip_address",
            ]
        )
        for item in queryset:
            sheet.append(
                [
                    item.timestamp.isoformat() if item.timestamp else "",
                    item.user.username if item.user else "",
                    item.transaction_type,
                    item.action,
                    item.related_model,
                    item.related_object_id or "",
                    str(item.amount) if item.amount is not None else "",
                    item.description or "",
                    item.ip_address or "",
                ]
            )

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="transaction_logs.xlsx"'
        workbook.save(response)
        return response

    def _export_pdf(self, request, queryset):
        lang = get_report_lang(request)
        headers = [
            report_text(lang, "label.time"),
            report_text(lang, "label.user"),
            report_text(lang, "label.type"),
            report_text(lang, "label.action"),
            report_text(lang, "label.model"),
            report_text(lang, "label.object_id"),
            report_text(lang, "label.amount"),
            report_text(lang, "label.details"),
            report_text(lang, "label.ip_address"),
        ]
        rows = [
            [
                item.timestamp.strftime("%Y-%m-%d %H:%M:%S") if item.timestamp else "-",
                item.user.username if item.user else "-",
                report_choice(lang, "transaction_type", item.transaction_type, default="-"),
                report_choice(lang, "transaction_action", item.action, default="-"),
                item.related_model or "-",
                item.related_object_id or "-",
                str(item.amount) if item.amount is not None else "-",
                item.description or "-",
                item.ip_address or "-",
            ]
            for item in queryset
        ]
        filters = {
            report_text(lang, "label.search"): request.query_params.get("search"),
            report_text(lang, "label.type"): report_choice(
                lang,
                "transaction_type",
                request.query_params.get("transaction_type"),
                default=request.query_params.get("transaction_type"),
            ),
            report_text(lang, "label.action"): report_choice(
                lang,
                "transaction_action",
                request.query_params.get("action"),
                default=request.query_params.get("action"),
            ),
            report_text(lang, "label.from"): request.query_params.get("date_from"),
            report_text(lang, "label.to"): request.query_params.get("date_to"),
        }
        total_amount = sum((item.amount or 0) for item in queryset if item.amount is not None)
        summary = {
            report_text(lang, "label.total_records"): queryset.count(),
            report_text(lang, "label.total_amount"): total_amount,
        }
        generated_by = request.user.get_full_name().strip() or request.user.username
        return build_pdf_report_response(
            filename="transaction_logs.pdf",
            title=report_text(lang, "report.transaction_logs.title"),
            subtitle=report_text(lang, "report.transaction_logs.subtitle"),
            headers=headers,
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=generated_by,
            filters=filters,
            summary=summary,
            lang=lang,
            acting_user=request.user,
        )

