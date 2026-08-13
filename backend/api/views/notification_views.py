from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import Notification
from api.serializers.notification_serializers import NotificationSerializer
from api.services.reminder_service import (
    send_loan_payment_reminders,
    send_monthly_saving_reminders,
)


class MyNotificationListAPIView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user).order_by("-created_at")
        params = self.request.query_params

        notification_type = params.get("notification_type")
        is_read = params.get("is_read")
        search = params.get("search")
        date_from = params.get("date_from")
        date_to = params.get("date_to")

        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        if is_read in {"true", "false", "1", "0"}:
            queryset = queryset.filter(is_read=is_read in {"true", "1"})

        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(message__icontains=search))

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset


class StaffNotificationListAPIView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    staff_roles = {"ADMIN", "MANAGER", "FINANCE", "AUDITOR", "LOAN_OFFICER", "TELLER"}

    def get_queryset(self):
        role = str(getattr(self.request.user, "role", "")).upper()
        if role not in self.staff_roles:
            raise PermissionDenied("You do not have permission to perform this action.")

        queryset = Notification.objects.select_related("user").all().order_by("-created_at")
        params = self.request.query_params

        notification_type = params.get("notification_type")
        is_read = params.get("is_read")
        search = params.get("search")
        user_id = params.get("user_id")
        date_from = params.get("date_from")
        date_to = params.get("date_to")

        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        if is_read in {"true", "false", "1", "0"}:
            queryset = queryset.filter(is_read=is_read in {"true", "1"})

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(message__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
            )

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset


class MarkNotificationReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        notification_id = request.data.get("notification_id")
        if notification_id:
            updated = Notification.objects.filter(
                id=notification_id,
                user=request.user,
            ).update(is_read=True)
            return Response({"updated": updated})

        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"updated": updated})


class TriggerReminderNotificationsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        role = str(getattr(request.user, "role", "")).upper()
        if role not in {"ADMIN", "MANAGER", "FINANCE"}:
            raise PermissionDenied("You do not have permission to perform this action.")

        saving_result = send_monthly_saving_reminders(force=True)
        loan_result = send_loan_payment_reminders(force=True)

        return Response(
            {
                "status": "ok",
                "saving": saving_result,
                "loan": loan_result,
            }
        )
