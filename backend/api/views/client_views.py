from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from ..models import Client
from ..serializers.client_serializers import ClientSerializer
from ..permissions.role_permissions import IsAdminOrManager, IsClient
from ..services.transaction_logger import log_transaction


# ======================================================
# CLIENTS (ACTIVE ONLY)
# ======================================================

class ClientListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get_queryset(self):
        """
        Only active clients can access services.
        """
        return Client.objects.filter(
            is_active=True
        ).select_related("address", "user")

    def perform_create(self, serializer):
        client = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="Client",
            related_object_id=client.id,
            description=f"Created client {client.account_number}",
            request=self.request,
        )


class ClientDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get_queryset(self):
        """
        Prevent updating inactive clients.
        """
        return Client.objects.filter(
            is_active=True
        ).select_related("address", "user")

    def perform_update(self, serializer):
        client = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="Client",
            related_object_id=client.id,
            description=f"Updated client {client.account_number}",
            request=self.request,
        )


class MyClientProfileAPIView(generics.RetrieveAPIView):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsClient]

    def get_object(self):
        client = get_object_or_404(Client, user=self.request.user)
        if not client.is_active:
            raise PermissionDenied("Inactive clients cannot access services.")
        return client

