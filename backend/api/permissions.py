from rest_framework.permissions import BasePermission, SAFE_METHODS


# =====================================================
# BASE ROLE CHECKER
# =====================================================
class HasRole(BasePermission):
    """
    Generic role checker
    """
    allowed_roles = []

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in self.allowed_roles
        )


# =====================================================
# ADMIN
# =====================================================
class IsAdmin(HasRole):
    allowed_roles = ["ADMIN"]


# =====================================================
# MANAGER
# =====================================================
class IsManager(HasRole):
    allowed_roles = ["MANAGER"]


class IsAdminOrManager(HasRole):
    allowed_roles = ["ADMIN", "MANAGER"]


# =====================================================
# TELLER
# =====================================================
class IsTeller(HasRole):
    allowed_roles = ["TELLER"]


class IsAdminOrTeller(HasRole):
    allowed_roles = ["ADMIN", "TELLER"]


# =====================================================
# LOAN OFFICER
# =====================================================
class IsLoanOfficer(HasRole):
    allowed_roles = ["LOAN_OFFICER"]


class IsAdminOrLoanOfficer(HasRole):
    allowed_roles = ["ADMIN", "LOAN_OFFICER"]


# =====================================================
# FINANCE
# =====================================================
class IsFinance(HasRole):
    allowed_roles = ["FINANCE"]


class IsAdminOrFinance(HasRole):
    allowed_roles = ["ADMIN", "FINANCE"]


# =====================================================
# AUDITOR (READ-ONLY)
# =====================================================
class IsAuditor(BasePermission):
    """
    Auditor can ONLY read (GET, HEAD, OPTIONS)
    """

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "AUDITOR"
            and request.method in SAFE_METHODS
        )


class IsAdminOrAuditor(BasePermission):
    """
    Admin full access
    Auditor read-only
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if request.user.role == "ADMIN":
            return True

        if request.user.role == "AUDITOR" and request.method in SAFE_METHODS:
            return True

        return False


# =====================================================
# MEMBER
# =====================================================
class IsMember(HasRole):
    allowed_roles = ["MEMBER"]


# =====================================================
# CLIENT
# =====================================================
class IsClient(HasRole):
    allowed_roles = ["CLIENT"]


# =====================================================
# SELF-ACCESS PERMISSION
# =====================================================
class IsSelfOrAdmin(BasePermission):
    """
    User can access ONLY their own data
    Admin can access everything
    """

    def has_object_permission(self, request, view, obj):
        if request.user.role == "ADMIN":
            return True

        # For models with user or member relation
        if hasattr(obj, "user"):
            return obj.user == request.user

        if hasattr(obj, "member"):
            return obj.member.user == request.user

        return False

