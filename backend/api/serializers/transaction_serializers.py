# api/serializers/transaction_serializers.py
from rest_framework import serializers
from ..models import TransactionLog

class TransactionLogSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = TransactionLog
        fields = (
            'id',
            'user',
            'transaction_type',
            'action',
            'related_model',
            'related_object_id',
            'amount',
            'description',
            'ip_address',
            'timestamp'
        )
        read_only_fields = fields

