from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import MemberExit, Member
from ..serializers.member_exit_serializers import MemberExitSerializer
from ..permissions.role_permissions import IsAdminFinanceOrAuditor
from ..services.transaction_logger import log_transaction


class MemberExitCreateView(generics.CreateAPIView):
    """
    Exit a member:
    - Member becomes inactive
    - Member user account becomes inactive
    - Active saving choices become inactive
    - 90% payout becomes member withdrawal
    - 10% retained â†’ Income
    - Member blocked from system services
    """

    queryset = MemberExit.objects.all()
    serializer_class = MemberExitSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def perform_create(self, serializer):
        record = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="MemberExit",
            related_object_id=record.id,
            amount=record.amount_paid,
            description=f"Member exit processed for {record.member.national_id}",
            request=self.request,
        )


class MemberExitListView(generics.ListAPIView):
    """
    Finance/Admin can view exited members
    """

    queryset = MemberExit.objects.select_related("member__user", "approved_by")
    serializer_class = MemberExitSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]


class MemberExitOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        members = (
            Member.objects.select_related("user")
            .filter(is_active=True, exit_record__isnull=True)
            .order_by("user__first_name", "user__last_name", "national_id")
        )
        payload = [
            {
                "id": member.id,
                "label": (
                    member.user.get_full_name()
                    or member.user.username
                    or member.national_id
                ),
                "national_id": member.national_id,
                "account_number": member.account_number,
            }
            for member in members
        ]
        return Response({"members": payload})

