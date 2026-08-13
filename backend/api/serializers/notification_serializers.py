from rest_framework import serializers

from api.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "user_id",
            "username",
            "user_email",
            "notification_type",
            "title",
            "message",
            "year",
            "month",
            "sent_email",
            "sent_sms",
            "is_read",
            "created_at",
        )
        read_only_fields = (
            "id",
            "notification_type",
            "title",
            "message",
            "year",
            "month",
            "sent_email",
            "sent_sms",
            "created_at",
        )

