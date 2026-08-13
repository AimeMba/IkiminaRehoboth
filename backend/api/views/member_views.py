from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from ..models import Member
from ..serializers.member_serializers import MemberSerializer
from ..permissions.role_permissions import (
    IsAdminOrManager,
    IsMember,
    IsAdminFinanceOrAuditor
)
from ..services.transaction_logger import log_transaction

# ======================================================
# MEMBERS (ACTIVE ONLY)
# ======================================================

class MemberListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get_queryset(self):
        """
        Show members by status:
        - active (default)
        - exited
        - all
        """
        status_filter = str(self.request.query_params.get("status", "active")).lower()
        queryset = Member.objects.select_related("address", "user")

        if status_filter == "all":
            return queryset
        if status_filter == "exited":
            return queryset.filter(is_active=False)
        return queryset.filter(is_active=True)

    def perform_create(self, serializer):
        member = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="Member",
            related_object_id=member.id,
            description=f"Created member {member.national_id}",
            request=self.request,
        )


class MemberDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get_queryset(self):
        """
        Prevent updating exited members.
        """
        return Member.objects.filter(
            is_active=True
        ).select_related("address", "user")

    def perform_update(self, serializer):
        member = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="Member",
            related_object_id=member.id,
            description=f"Updated member {member.national_id}",
            request=self.request,
        )


# ======================================================
# MEMBER PROFILE (SELF)
# ======================================================

class MyMemberProfileAPIView(generics.RetrieveAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_object(self):
        """
        Member can access profile only if active.
        """
        member = get_object_or_404(Member, user=self.request.user)

        if not member.is_active:
            raise PermissionDenied("Inactive members cannot access services.")

        return member


# ======================================================
# EXITED MEMBERS (FINANCE / AUDITOR)
# ======================================================

class ExitedMemberListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        """
        Finance/Admin can view members who exited.
        """
        exited = Member.objects.filter(is_active=False)

        serializer = MemberSerializer(
            exited,
            many=True,
            context={"request": request}
        )

        return Response(serializer.data)


class MemberOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        members = (
            Member.objects.filter(is_active=True)
            .select_related("user")
            .order_by("user__first_name", "user__last_name", "national_id")
        )
        payload = [
            {
                "id": item.id,
                "user_id": item.user_id,
                "full_name": item.user.get_full_name() or item.user.username,
                "username": item.user.username,
                "national_id": item.national_id,
                "is_active": item.is_active,
                "unpaid_profit_total": item.total_unpaid_profit(),
            }
            for item in members
        ]
        return Response(payload)

