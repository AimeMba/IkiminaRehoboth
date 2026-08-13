from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.exceptions import PermissionDenied


# =====================================================
# BASE ROLE PERMISSION
# =====================================================

class HasRole(BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):

        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.role in self.allowed_roles


# =====================================================
# ROLE-BASED PERMISSIONS
# =====================================================

class IsAdmin(HasRole):
    allowed_roles = ['ADMIN']


class IsAdminOrManager(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER']


class IsManager(HasRole):
    allowed_roles = ['MANAGER']


class IsAdminOrFinance(HasRole):
    allowed_roles = ['ADMIN', 'FINANCE']


class IsAdminFinanceOrManager(HasRole):
    allowed_roles = ['ADMIN', 'FINANCE', 'MANAGER']


class IsAdminFinanceOrAuditor(HasRole):
    allowed_roles = ['ADMIN', 'FINANCE', 'AUDITOR', 'MANAGER']

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Auditor and Manager are strictly read-only on finance/admin endpoints
        # protected by this permission class.
        if request.user.role in {"AUDITOR", "MANAGER"} and request.method not in SAFE_METHODS:
            return False

        return True


class IsLoanOfficerOrAdmin(HasRole):
    allowed_roles = ['ADMIN', 'LOAN_OFFICER']


class IsLoanStaff(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER', 'LOAN_OFFICER']


class IsLoanReadStaff(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER', 'LOAN_OFFICER', 'FINANCE', 'AUDITOR']


class IsLoanTypeViewer(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER', 'LOAN_OFFICER', 'FINANCE', 'AUDITOR', 'MEMBER', 'CLIENT']


class IsRepaymentReadStaff(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER', 'TELLER', 'FINANCE', 'AUDITOR']


class IsTellerOrAdmin(HasRole):
    allowed_roles = ['ADMIN', 'TELLER']


class IsAdminManagerOrTeller(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER', 'TELLER']


class IsBiometricStaff(HasRole):
    allowed_roles = ['ADMIN', 'MANAGER', 'TELLER']


class IsSavingsStaff(HasRole):
    allowed_roles = ['ADMIN', 'TELLER', 'FINANCE', 'AUDITOR', 'MANAGER']


class IsMember(HasRole):
    allowed_roles = ['MEMBER']


class IsClient(HasRole):
    allowed_roles = ['CLIENT']


class IsMemberOrClient(HasRole):
    allowed_roles = ['MEMBER', 'CLIENT']


class IsAdminOrAuditor(HasRole):
    allowed_roles = ['ADMIN', 'AUDITOR']


# =====================================================
# BLOCK MEMBERS FROM STAFF SERVICES
# =====================================================

class BlockMembers(BasePermission):
    """
    Prevent Members from accessing restricted endpoints.
    Useful for finance/admin services like:
    - SalaryPayment
    - Expenses
    - Annual Closing
    """

    def has_permission(self, request, view):

        if not request.user or not request.user.is_authenticated:
            return False

        # ðŸš« Block members completely
        if request.user.role == "MEMBER":
            raise PermissionDenied(
                "Access denied. Members are not allowed to access this service."
            )

        return True


# =====================================================
# READ ONLY OR ADMIN
# =====================================================

class IsReadOnlyOrAdmin(BasePermission):
    """
    Allow GET access for everyone authenticated,
    but only Admin can create/update/delete.
    """

    def has_permission(self, request, view):

        if request.method in SAFE_METHODS:
            return True

        return (
            request.user.is_authenticated
            and request.user.role == 'ADMIN'
        )

