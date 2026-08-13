from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from ..models import Biometric
from ..permissions.role_permissions import IsBiometricStaff
from ..serializers.biometric_serializers import BiometricSerializer, BiometricVerifySerializer
from ..services.transaction_logger import log_transaction
from ..utils.biometrics import verify_biometric_template


class BiometricListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BiometricSerializer
    permission_classes = [IsAuthenticated, IsBiometricStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Biometric.objects.select_related("member__user", "client__user").order_by("-created_at")

    def perform_create(self, serializer):
        item = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="Biometric",
            related_object_id=item.id,
            description=f"Created biometric for {item.owner_type}",
            request=self.request,
        )


class BiometricDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BiometricSerializer
    permission_classes = [IsAuthenticated, IsBiometricStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Biometric.objects.select_related("member__user", "client__user")

    def perform_update(self, serializer):
        item = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="Biometric",
            related_object_id=item.id,
            description=f"Updated biometric #{item.id}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        biometric_id = instance.id
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="DELETE",
            related_model="Biometric",
            related_object_id=biometric_id,
            description=f"Deleted biometric #{biometric_id}",
            request=self.request,
        )


class MyBiometricAPIView(generics.RetrieveAPIView):
    serializer_class = BiometricSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user = self.request.user
        if user.role == "MEMBER":
            return get_object_or_404(
                Biometric.objects.select_related("member__user"),
                member__user=user,
            )
        if user.role == "CLIENT":
            return get_object_or_404(
                Biometric.objects.select_related("client__user"),
                client__user=user,
            )
        raise PermissionDenied("You do not have permission to perform this action.")


class BiometricVerifyAPIView(APIView):
    permission_classes = [IsAuthenticated, IsBiometricStaff]

    def post(self, request):
        serializer = BiometricVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        template = serializer.validated_data["fingerprint_template"].strip()
        owner_type = serializer.validated_data.get("owner_type")

        queryset = Biometric.objects.select_related(
            "member__user",
            "client__user",
        ).exclude(
            fingerprint_template__isnull=True
        ).exclude(
            fingerprint_template=""
        )
        if owner_type:
            queryset = queryset.filter(owner_type=owner_type)

        matched = None
        for biometric in queryset.iterator():
            is_match, hashed_template = verify_biometric_template(
                biometric.fingerprint_template,
                template,
            )
            if is_match:
                if hashed_template and biometric.fingerprint_template != hashed_template:
                    biometric.fingerprint_template = hashed_template
                    biometric.save(update_fields=["fingerprint_template"])
                matched = biometric
                break

        if not matched:
            return Response(
                {
                    "matched": False,
                    "message": "No matching biometric record found.",
                },
                status=status.HTTP_200_OK,
            )

        if matched.owner_type == "MEMBER" and matched.member:
            user = matched.member.user
            full_name = (
                user.get_full_name().strip() if user else ""
            ) or (user.username if user else matched.member.national_id)
            payload = {
                "matched": True,
                "owner_type": "MEMBER",
                "biometric_id": matched.id,
                "member_id": matched.member.id,
                "owner_label": full_name,
                "national_id": matched.member.national_id,
                "account_number": matched.member.account_number,
                "phone": matched.member.phone,
                "is_active": matched.member.is_active,
            }
        elif matched.owner_type == "CLIENT" and matched.client:
            payload = {
                "matched": True,
                "owner_type": "CLIENT",
                "biometric_id": matched.id,
                "client_id": matched.client.id,
                "owner_label": matched.client.full_name,
                "national_id": matched.client.national_id,
                "account_number": matched.client.account_number,
                "phone": matched.client.phone,
                "is_active": matched.client.is_active,
            }
        else:
            return Response(
                {
                    "matched": False,
                    "message": "Biometric record is incomplete.",
                },
                status=status.HTTP_200_OK,
            )

        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="PAY",
            related_model="Biometric",
            related_object_id=matched.id,
            description=f"Biometric verification success for {payload.get('owner_type')}",
            request=request,
        )
        return Response(payload, status=status.HTTP_200_OK)
