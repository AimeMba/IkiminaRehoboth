from django.db import models
from django.db import transaction
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.validators import RegexValidator
from django.core.exceptions import ObjectDoesNotExist, ValidationError
import os
import re
import uuid

from .utils.biometrics import hash_biometric_template, is_hashed_biometric_template


def biometric_photo_upload_to(instance, filename):
    owner_folder = "members" if instance.owner_type == "MEMBER" else "clients"
    owner_id = instance.member_id or instance.client_id or "unassigned"
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    return (
        f"biometrics/{owner_folder}/{owner_id}/photos/"
        f"{timezone.localtime().strftime('%Y/%m')}/{uuid.uuid4().hex}{ext}"
    )


# =====================================================
# AUTHENTICATION
# =====================================================
class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        MANAGER = 'MANAGER', 'Manager'
        MEMBER = 'MEMBER', 'Member'
        TELLER = 'TELLER', 'Teller'
        LOAN_OFFICER = 'LOAN_OFFICER', 'Loan Officer'
        FINANCE = 'FINANCE', 'Finance'
        AUDITOR = 'AUDITOR', 'Auditor'
        CLIENT = 'CLIENT', 'Client'

    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.MEMBER
    )

    created_by = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='created_users'
    )
    updated_by = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_users'
    )
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    failed_login_last_at = models.DateTimeField(null=True, blank=True)
    locked_by_system = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role"],
                condition=models.Q(role="MANAGER"),
                name="unique_manager_role",
            )
        ]

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def display_name(self):
        return self.get_full_name() or self.username or self.email or str(self.pk)

    @property
    def holder_name(self):
        try:
            employee = self.employee
        except ObjectDoesNotExist:
            employee = None

        if employee:
            if employee.member and employee.member.user:
                return employee.member.user.get_full_name() or employee.member.user.username
            if employee.external_full_name:
                return employee.external_full_name
            if employee.user:
                return employee.user.get_full_name() or employee.user.username

        return self.display_name

    @property
    def holder_type(self):
        try:
            employee = self.employee
        except ObjectDoesNotExist:
            employee = None

        if employee:
            if employee.member_id:
                return "MEMBER"
            if employee.external_full_name:
                return "EXTERNAL"
            return "STAFF"

        if hasattr(self, "member_profile"):
            return "MEMBER"
        if hasattr(self, "client_profile"):
            return "CLIENT"
        if self.role in {
            self.Roles.ADMIN,
            self.Roles.MANAGER,
            self.Roles.TELLER,
            self.Roles.LOAN_OFFICER,
            self.Roles.FINANCE,
            self.Roles.AUDITOR,
        }:
            return "STAFF"

        return self.role or "ACCOUNT"

    def save(self, *args, **kwargs):
        is_create = self.pk is None
        previous_role = None
        if not is_create:
            previous_role = (
                User.objects.filter(pk=self.pk).values_list("role", flat=True).first()
            )

        super().save(*args, **kwargs)

        assignment_actor = self.updated_by or self.created_by
        now = timezone.now()

        if is_create:
            RoleAssignmentHistory.objects.get_or_create(
                user=self,
                role=self.role,
                started_at=self.date_joined or now,
                defaults={
                    "assigned_by": assignment_actor,
                    "is_current": True,
                },
            )
            return

        if previous_role and previous_role != self.role:
            RoleAssignmentHistory.objects.filter(
                user=self,
                role=previous_role,
                is_current=True,
            ).update(is_current=False, ended_at=now)
            RoleAssignmentHistory.objects.create(
                user=self,
                role=self.role,
                started_at=now,
                assigned_by=assignment_actor,
                is_current=True,
            )


class RoleAssignmentHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignment_history",
    )
    role = models.CharField(max_length=20, choices=User.Roles.choices)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_role_histories",
    )
    is_current = models.BooleanField(default=True)

    class Meta:
        ordering = ["-started_at", "-id"]

    def __str__(self):
        return f"{self.user.display_name} - {self.role}"


class StaffAccountHolderHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_holder_history",
    )
    employee = models.ForeignKey(
        "Employee",
        on_delete=models.CASCADE,
        related_name="account_holder_history",
    )
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_staff_holder_histories",
    )
    is_current = models.BooleanField(default=True)

    class Meta:
        ordering = ["-started_at", "-id"]

    def __str__(self):
        return f"{self.user.username} -> {self.employee}"


# =====================================================
# ADDRESS
# =====================================================
class Location(models.Model):
    LOCATION_TYPES = (
        ("PROVINCE", "Province"),
        ("DISTRICT", "District"),
        ("SECTOR", "Sector"),
        ("CELL", "Cell"),
        ("VILLAGE", "Village"),
    )

    id = models.BigIntegerField(primary_key=True)
    type = models.CharField(max_length=20, choices=LOCATION_TYPES)
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        hierarchy = []
        current = self
        while current:
            hierarchy.insert(0, current.name)

            if current.type in ["VILLAGE", "CELL", "SECTOR"]:
                parent_id = current.id // 100
            elif current.type == "DISTRICT":
                parent_id = current.id // 10
            else:
                parent_id = None

            try:
                current = Location.objects.get(id=parent_id) if parent_id else None
            except Location.DoesNotExist:
                current = None

        return " > ".join(hierarchy)

# =====================================================
# MEMBER
# =====================================================
class Member(models.Model):
    ACCOUNT_PREFIX = "MBR"
    class EnrollmentType(models.TextChoices):
        NEW = "NEW", "New"
        FOUNDER = "FOUNDER", "Founder"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="member_profile"
    )
    national_id = models.CharField(
        max_length=16,
        unique=True,
        validators=[
            RegexValidator(
                regex=r"^\d{16}$",
                message="National ID must be exactly 16 digits.",
            )
        ],
    )
    account_number = models.CharField(max_length=30, unique=True)
    phone = models.CharField(max_length=20)

    address = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        limit_choices_to={"type": "VILLAGE"}
    )

    joined_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    enrollment_type = models.CharField(
        max_length=10,
        choices=EnrollmentType.choices,
        default=EnrollmentType.NEW,
    )

    @classmethod
    def generate_next_account_number(cls):
        pattern = re.compile(rf"^{cls.ACCOUNT_PREFIX}-(\d+)$")
        max_number = 0
        for value in cls.objects.select_for_update().values_list("account_number", flat=True):
            match = pattern.match(value or "")
            if match:
                max_number = max(max_number, int(match.group(1)))
        return f"{cls.ACCOUNT_PREFIX}-{max_number + 1:06d}"

    def save(self, *args, **kwargs):
        if not self.pk:
            with transaction.atomic():
                self.account_number = self.generate_next_account_number()
                super().save(*args, **kwargs)
                return
        super().save(*args, **kwargs)

    def total_savings_amount(self, up_to_year=None):
        queryset = MonthlySaving.objects.filter(saving_choice__member=self)
        if up_to_year is not None:
            queryset = queryset.filter(year__lte=up_to_year)
        return int(queryset.aggregate(total=models.Sum("amount_paid"))["total"] or 0)

    def total_allocated_profit(self, up_to_year=None):
        queryset = MemberAnnualProfit.objects.filter(member=self)
        if up_to_year is not None:
            queryset = queryset.filter(closing__year__lte=up_to_year)
        return int(queryset.aggregate(total=models.Sum("profit"))["total"] or 0)

    def total_paid_profit(self, up_to_year=None):
        queryset = self.profit_payouts.all()
        if up_to_year is not None:
            queryset = queryset.filter(paid_on__year__lte=up_to_year)
        return int(queryset.aggregate(total=models.Sum("amount"))["total"] or 0)

    def total_unpaid_profit(self, up_to_year=None):
        return max(self.total_allocated_profit(up_to_year) - self.total_paid_profit(up_to_year), 0)

    def total_amount_in_system(self, up_to_year=None):
        return self.total_savings_amount(up_to_year) + self.total_unpaid_profit(up_to_year)

    def current_shares(self, up_to_year=None):
        return self.total_amount_in_system(up_to_year) // 2000

    def __str__(self):
        full_name = ""
        if self.user:
            full_name = self.user.get_full_name() or self.user.username or ""
        return full_name or self.national_id


class MemberExit(models.Model):
    member = models.OneToOneField(
        Member,
        on_delete=models.PROTECT,
        related_name="exit_record"
    )

    total_savings = models.PositiveBigIntegerField()
    amount_paid = models.PositiveBigIntegerField()       # 90%
    retained_amount = models.PositiveBigIntegerField()   # 10%

    exit_date = models.DateField(null=True, blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.member} exited on {self.exit_date}"


# =====================================================
# CLIENT
# =====================================================
class Client(models.Model):
    ACCOUNT_PREFIX = "CLT"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_profile"
    )
    full_name = models.CharField(max_length=150)
    national_id = models.CharField(
        max_length=16,
        unique=True,
        null=True,
        blank=True,
        validators=[
            RegexValidator(
                regex=r"^\d{16}$",
                message="National ID must be exactly 16 digits.",
            )
        ],
    )
    account_number = models.CharField(max_length=30, unique=True)
    phone = models.CharField(max_length=20)

    address = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        limit_choices_to={"type": "VILLAGE"}
    )

    created_on = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    @classmethod
    def generate_next_account_number(cls):
        pattern = re.compile(rf"^{cls.ACCOUNT_PREFIX}-(\d+)$")
        max_number = 0
        for value in cls.objects.select_for_update().values_list("account_number", flat=True):
            match = pattern.match(value or "")
            if match:
                max_number = max(max_number, int(match.group(1)))
        return f"{cls.ACCOUNT_PREFIX}-{max_number + 1:06d}"

    def save(self, *args, **kwargs):
        if not self.pk:
            with transaction.atomic():
                self.account_number = self.generate_next_account_number()
                super().save(*args, **kwargs)
                return
        super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name


# =====================================================
# BIOMETRIC
# =====================================================
class Biometric(models.Model):
    OWNER_TYPE_CHOICES = (
        ('MEMBER', 'Member'),
        ('CLIENT', 'Client'),
    )

    owner_type = models.CharField(max_length=10, choices=OWNER_TYPE_CHOICES)

    member = models.OneToOneField(
        Member,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='biometric'
    )

    client = models.OneToOneField(
        Client,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='biometric'
    )

    photo = models.ImageField(upload_to=biometric_photo_upload_to, null=True, blank=True)
    fingerprint_template = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.fingerprint_template and not is_hashed_biometric_template(self.fingerprint_template):
            self.fingerprint_template = hash_biometric_template(self.fingerprint_template)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Biometric ({self.owner_type})"


# =====================================================
# MEMBERSHIP FEE
# =====================================================
class MembershipFee(models.Model):
    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name="membership_fee")
    amount = models.PositiveIntegerField()
    paid_on = models.DateField(null=True, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

# =====================================================
# SAVING CATEGORY & SAVINGS
# =====================================================

class SavingCategory(models.Model):
    """
    Defines a saving plan for a given year.
    Example: Regular Saving - 5000/month (2026)
    """

    name = models.CharField(max_length=100)
    monthly_amount = models.PositiveBigIntegerField()

    year = models.PositiveIntegerField()

    class Meta:
        unique_together = ("name", "year")

    def __str__(self):
        return f"{self.name} - {self.monthly_amount} RWF ({self.year})"


class MemberSavingChoice(models.Model):
    """
    Member chooses a saving category for that year.
    """

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="saving_choices"
    )

    category = models.ForeignKey(
        SavingCategory,
        on_delete=models.PROTECT,
        related_name="member_choices"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("member", "category")

    def __str__(self):
        full_name = self.member.user.get_full_name() or self.member.user.username
        return f"{full_name} chose {self.category.name} ({self.category.year})"


class SavingChoiceChangeRequest(models.Model):
    class RequestOrigin(models.TextChoices):
        SELF = "SELF", "Self Requested"
        ON_BEHALF = "ON_BEHALF", "Requested On Behalf"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="saving_choice_change_requests",
    )
    current_category = models.ForeignKey(
        SavingCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_choice_change_requests",
    )
    requested_category = models.ForeignKey(
        SavingCategory,
        on_delete=models.CASCADE,
        related_name="requested_choice_change_requests",
    )
    year = models.PositiveIntegerField()
    reason = models.TextField(blank=True)
    request_origin = models.CharField(
        max_length=20,
        choices=RequestOrigin.choices,
        default=RequestOrigin.SELF,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_saving_choice_change_requests",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    requested_on = models.DateTimeField(auto_now_add=True)
    reviewed_on = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_saving_choice_change_requests",
    )
    review_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-requested_on"]

    def __str__(self):
        member_name = self.member.user.get_full_name() or self.member.user.username or self.member.national_id
        return (
            f"{member_name} -> {self.requested_category.name} "
            f"({self.year}) [{self.status}]"
        )


class MonthlySaving(models.Model):
    """
    Monthly saving payment.

    MAIN table for:
    - monthly savings tracking
    - fine calculation for delays
    - income automation
    """

    saving_choice = models.ForeignKey(
        MemberSavingChoice,
        on_delete=models.PROTECT,
        related_name="monthly_savings"
    )

    month = models.PositiveSmallIntegerField(
        validators=[
            MinValueValidator(1),
            MaxValueValidator(12)
        ]
    )

    year = models.PositiveIntegerField(editable=False)

    amount_paid = models.PositiveBigIntegerField()

    saved_on = models.DateField(null=True, blank=True)

    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        unique_together = ("saving_choice", "month", "year")

    def clean(self):
        """
        Ensure monthly payment matches category monthly amount.
        """

        expected = self.saving_choice.category.monthly_amount

        if self.amount_paid != expected:
            raise ValidationError(
                f"Monthly saving must be exactly {expected} RWF."
            )

    def save(self, *args, **kwargs):
        """
        Auto-set year from SavingCategory before saving.
        """

        self.year = self.saving_choice.category.year

        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        full_name = (
            self.saving_choice.member.user.get_full_name()
            or self.saving_choice.member.user.username
        )

        return (
            f"{full_name} saved {self.amount_paid} "
            f"for month {self.month}/{self.year}"
        )

# =====================================================
# LOAN TYPE (ADMIN MANAGED)
# =====================================================
class LoanType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    interest_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Interest rate %"
    )

    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.interest_rate}%)"


# =====================================================
# LOANS
# =====================================================
class Loan(models.Model):
    class RequestOrigin(models.TextChoices):
        SELF = "SELF", "Self Requested"
        ON_BEHALF = "ON_BEHALF", "Requested On Behalf"
        DIRECT = "DIRECT", "Direct Loan Entry"

    STATUS_CHOICES = (
        ('ONGOING', 'Ongoing'),
        ('PAID', 'Paid'),
        ('DEFAULTED', 'Defaulted'),
    )

    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True)

    loan_type = models.ForeignKey(
        LoanType,
        on_delete=models.PROTECT,
        related_name="loans"
    )

    principal_amount = models.PositiveIntegerField()
    term_months = models.PositiveSmallIntegerField(default=1)
    term_days = models.PositiveSmallIntegerField(null=True, blank=True)

    interest_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        editable=False
    )

    issued_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="ONGOING"
    )
    request_origin = models.CharField(
        max_length=20,
        choices=RequestOrigin.choices,
        default=RequestOrigin.DIRECT,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_loans",
    )

    def save(self, *args, **kwargs):
        if not self.pk:
            self.interest_rate = self.loan_type.interest_rate
            if not self.issued_date:
                self.issued_date = timezone.localdate()
            if not self.due_date and self.issued_date:
                if self.term_days:
                    self.due_date = self.issued_date + timedelta(days=int(self.term_days))
                else:
                    self.due_date = self.issued_date + timedelta(days=30 * int(self.term_months or 1))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Loan {self.id} - {self.loan_type.name}"


class LoanRequest(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
    class RequestOrigin(models.TextChoices):
        SELF = "SELF", "Self Requested"
        ON_BEHALF = "ON_BEHALF", "Requested On Behalf"

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="loan_requests",
        null=True,
        blank=True,
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="loan_requests",
        null=True,
        blank=True,
    )
    requested_loan_type = models.ForeignKey(
        LoanType,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="loan_requests",
    )
    requested_amount = models.PositiveIntegerField()
    requested_term_months = models.PositiveSmallIntegerField(default=1)
    requested_term_days = models.PositiveSmallIntegerField(null=True, blank=True)
    purpose = models.TextField(blank=True)
    application_form = models.FileField(
        upload_to="loan_requests/forms/",
        null=True,
        blank=True,
    )
    id_copy = models.FileField(
        upload_to="loan_requests/id_copies/",
        null=True,
        blank=True,
    )
    guarantee_cheque = models.FileField(
        upload_to="loan_requests/guarantee_cheques/",
        null=True,
        blank=True,
    )
    requested_on = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_loan_requests",
    )
    reviewed_on = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    request_origin = models.CharField(
        max_length=20,
        choices=RequestOrigin.choices,
        default=RequestOrigin.SELF,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_loan_requests",
    )
    approved_loan = models.OneToOneField(
        Loan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_request",
    )

    class Meta:
        ordering = ["-requested_on"]

    def clean(self):
        if bool(self.member) == bool(self.client):
            raise ValidationError("Loan request must belong to exactly one owner: member or client.")

    def __str__(self):
        owner = self.member.national_id if self.member else self.client.full_name
        return f"LoanRequest {self.id} - {owner} ({self.status})"


class LoanRepayment(models.Model):
    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="repayments"
    )

    amount = models.PositiveIntegerField(default=0)
    principal_amount = models.PositiveIntegerField(default=0)
    interest_amount = models.PositiveIntegerField(default=0)

    paid_on = models.DateField(null=True, blank=True)

    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    def save(self, *args, **kwargs):
        if self.principal_amount + self.interest_amount != self.amount:
            raise ValueError("Principal + Interest must equal total amount")
        if not self.paid_on:
            self.paid_on = timezone.localdate()

        super().save(*args, **kwargs)

        if self.interest_amount > 0:
            category, _ = IncomeCategory.objects.get_or_create(name="Loan Interest")
            Income.objects.update_or_create(
                related_model="LoanRepayment",
                related_object_id=self.id,
                defaults={
                    "category": category,
                    "amount": self.interest_amount,
                    "description": f"Interest earned from Loan #{self.loan.id}",
                    "income_date": self.paid_on,
                    "recorded_by": self.received_by,
                },
            )
        else:
            Income.objects.filter(
                related_model="LoanRepayment",
                related_object_id=self.id,
            ).delete()


# =====================================================
# FINES
# =====================================================
class FineRule(models.Model):

    class FineType(models.TextChoices):
        SAVING = "SAVING", "Late Saving"
        LOAN = "LOAN", "Late Loan"
        ADMIN = "ADMIN", "Administrative"
        OTHER = "OTHER", "Other"

    name = models.CharField(max_length=100)

    fine_type = models.CharField(
        max_length=20,
        choices=FineType.choices
    )

    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Percentage to apply"
    )

    applies_after_days = models.PositiveIntegerField(
        help_text="Days after due date"
    )

    is_active = models.BooleanField(default=True)

    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.percentage}%)"


class Fine(models.Model):

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="fines"
    )

    rule = models.ForeignKey(
        FineRule,
        on_delete=models.PROTECT
    )

    saving = models.ForeignKey(
        MonthlySaving,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    amount = models.PositiveBigIntegerField()

    calculated_on = models.DateField(auto_now_add=True)

    is_paid = models.BooleanField(default=False)

    paid_on = models.DateField(null=True, blank=True)
    is_waived = models.BooleanField(default=False)
    waived_on = models.DateField(null=True, blank=True)
    waived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waived_fines",
    )
    waiver_reason = models.TextField(blank=True, default="")

    def save(self, *args, **kwargs):
        if self.is_waived:
            self.is_paid = False
            self.paid_on = None
            if not self.waived_on:
                self.waived_on = timezone.localdate()

        if self.is_paid and not self.paid_on:
            self.paid_on = timezone.localdate()

        super().save(*args, **kwargs)

        if self.is_paid and not self.is_waived:
            category, _ = IncomeCategory.objects.get_or_create(name="Fines")
            Income.objects.update_or_create(
                related_model="Fine",
                related_object_id=self.id,
                defaults={
                    "category": category,
                    "amount": self.amount,
                    "description": (
                        f"Fine paid by {self.member} "
                        f"({self.rule.name})"
                    ),
                    "income_date": self.paid_on,
                },
            )
        else:
            Income.objects.filter(
                related_model="Fine",
                related_object_id=self.id
            ).delete()

    def __str__(self):
        return f"{self.member} - {self.amount} ({self.rule.name})"

# =====================================================
# INCOME
# =====================================================
class IncomeCategory(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Income(models.Model):
    category = models.ForeignKey(IncomeCategory, on_delete=models.PROTECT)

    amount = models.PositiveBigIntegerField()
    description = models.TextField(blank=True)

    income_date = models.DateField(null=True, blank=True)

    related_model = models.CharField(max_length=100, blank=True, null=True)
    related_object_id = models.PositiveIntegerField(blank=True, null=True)

    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.category.name} - {self.amount}"


# =====================================================
# EMPLOYEES & SALARY
# =====================================================
class Department(models.Model):
    name = models.CharField(max_length=100)
    base_salary = models.PositiveIntegerField()

    def __str__(self):
        return self.name


class Employee(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    member = models.OneToOneField(Member, on_delete=models.SET_NULL, null=True, blank=True)
    external_full_name = models.CharField(max_length=150, blank=True, default="")
    external_national_id = models.CharField(
        max_length=16,
        blank=True,
        default="",
        validators=[
            RegexValidator(
                regex=r"^\d{16}$",
                message="External National ID must be exactly 16 digits.",
            )
        ],
    )
    external_phone = models.CharField(max_length=20, blank=True, default="")
    external_email = models.EmailField(blank=True, default="")

    department = models.ForeignKey(Department, on_delete=models.PROTECT)
    salary = models.PositiveIntegerField()
    hired_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        if self.user:
            return self.user.get_full_name() or self.user.username
        if self.member and self.member.user:
            return self.member.user.get_full_name() or self.member.user.username
        if self.external_full_name:
            return self.external_full_name
        return f"{self.department.name} - {self.salary}"


class SalaryPayment(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT)
    amount = models.PositiveBigIntegerField()

    paid_on = models.DateField(null=True, blank=True)

    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.employee} salary - {self.amount}"


# =====================================================
# EXPENSES
# =====================================================
class ExpenseCategory(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Expense(models.Model):
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT)
    amount = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    expense_date = models.DateField(null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.category.name} - {self.amount}"


# =====================================================
# NOTIFICATIONS
# =====================================================
class Notification(models.Model):
    class NotificationType(models.TextChoices):
        SAVING_REMINDER = "SAVING_REMINDER", "Saving Reminder"
        LOAN_REMINDER = "LOAN_REMINDER", "Loan Reminder"
        SYSTEM = "SYSTEM", "System"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=150)
    message = models.TextField()
    year = models.PositiveIntegerField(null=True, blank=True)
    month = models.PositiveSmallIntegerField(null=True, blank=True)
    sent_email = models.BooleanField(default=False)
    sent_sms = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "notification_type", "year", "month"],
                name="unique_monthly_notification_per_user",
            )
        ]

    def __str__(self):
        return f"{self.user} | {self.notification_type} | {self.month}/{self.year}"


# =====================================================
# TRANSACTION LOG
# =====================================================
class TransactionLog(models.Model):

    class TransactionType(models.TextChoices):
        SAVING = "SAVING", "Saving"
        LOAN = "LOAN", "Loan"
        REPAYMENT = "REPAYMENT", "Loan Repayment"
        FINE = "FINE", "Fine"
        EXPENSE = "EXPENSE", "Expense"
        MEMBERSHIP = "MEMBERSHIP", "Membership Fee"
        SYSTEM = "SYSTEM", "System"

    class ActionType(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        PAY = "PAY", "Pay"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    action = models.CharField(max_length=20, choices=ActionType.choices)

    related_model = models.CharField(max_length=100)
    related_object_id = models.PositiveIntegerField(null=True, blank=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    description = models.TextField(blank=True, default="")

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.transaction_type} | {self.action} | {self.user}"


# =====================================================
# ANNUAL CLOSING
# =====================================================
class AnnualClosing(models.Model):
    year = models.PositiveIntegerField(unique=True)

    total_savings = models.PositiveBigIntegerField(editable=False)
    total_income = models.PositiveBigIntegerField(editable=False, default=0)
    loan_interest = models.PositiveBigIntegerField(editable=False)
    fines = models.PositiveBigIntegerField(editable=False)
    expenses = models.PositiveBigIntegerField(editable=False)

    total_adjusted_capital = models.PositiveBigIntegerField(editable=False, default=0)
    net_profit = models.IntegerField(editable=False)
    profit_rate_percent = models.DecimalField(
        max_digits=9,
        decimal_places=4,
        editable=False,
        default=0,
    )
    total_shares = models.PositiveBigIntegerField(editable=False, default=0)
    december_unpaid_deducted_members = models.PositiveIntegerField(editable=False, default=0)
    policy_version = models.CharField(max_length=40, editable=False, default="annual_closing_v2_snapshot")

    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    closed_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Annual Closing {self.year}"


class MemberAnnualProfit(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    closing = models.ForeignKey(AnnualClosing, on_delete=models.CASCADE)

    total_amount = models.PositiveBigIntegerField(editable=False)
    shares = models.PositiveIntegerField(editable=False)
    profit = models.IntegerField(editable=False)

    @property
    def paid_amount(self):
        return int(self.payouts.aggregate(total=models.Sum("amount"))["total"] or 0)

    @property
    def unpaid_amount(self):
        return max(int(self.profit) - self.paid_amount, 0)

    def __str__(self):
        return f"{self.member} - {self.closing.year}"


class MemberProfitPayout(models.Model):
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="profit_payouts",
    )
    annual_profit = models.ForeignKey(
        MemberAnnualProfit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payouts",
    )
    amount = models.PositiveBigIntegerField()
    paid_on = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_profit_payouts",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-paid_on", "-id"]

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})

        if self.annual_profit and self.annual_profit.member_id != self.member_id:
            raise ValidationError({"annual_profit": "Selected annual profit does not belong to this member."})

        if self.annual_profit:
            paid_against_profit = (
                self.annual_profit.payouts.exclude(pk=self.pk).aggregate(total=models.Sum("amount"))["total"]
                or 0
            )
            available_amount = max(int(self.annual_profit.profit) - int(paid_against_profit), 0)
        else:
            paid_so_far = (
                MemberProfitPayout.objects.filter(member=self.member)
                .exclude(pk=self.pk)
                .aggregate(total=models.Sum("amount"))["total"]
                or 0
            )
            allocated = (
                MemberAnnualProfit.objects.filter(member=self.member)
                .aggregate(total=models.Sum("profit"))["total"]
                or 0
            )
            available_amount = max(int(allocated) - int(paid_so_far), 0)

        if self.amount > available_amount:
            raise ValidationError(
                {"amount": f"Amount exceeds available unpaid profit balance of {available_amount} RWF."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.paid_on:
            self.paid_on = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member} profit payout - {self.amount}"


class MemberProfitRequest(models.Model):
    class RequestMode(models.TextChoices):
        ALL = "ALL", "All Profits"
        PARTIAL = "PARTIAL", "Partial Profit"

    class StatusChoices(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="profit_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_profit_requests",
    )
    request_mode = models.CharField(
        max_length=20,
        choices=RequestMode.choices,
        default=RequestMode.ALL,
    )
    requested_amount = models.PositiveBigIntegerField(null=True, blank=True)
    requested_balance = models.PositiveBigIntegerField(default=0, editable=False)
    request_notes = models.TextField(blank=True, default="")
    requested_on = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
    )
    approved_amount = models.PositiveBigIntegerField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_profit_requests",
    )
    reviewed_on = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-requested_on", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["member"],
                condition=models.Q(status="PENDING"),
                name="unique_pending_profit_request_per_member",
            )
        ]

    @property
    def effective_requested_amount(self):
        if self.request_mode == self.RequestMode.ALL:
            return int(self.requested_balance or 0)
        return int(self.requested_amount or 0)

    def clean(self):
        if not self.member_id:
            raise ValidationError({"member": "Member is required."})

        current_unpaid_profit = int(self.member.total_unpaid_profit() if self.member_id else 0)
        if current_unpaid_profit <= 0 and not self.pk:
            raise ValidationError({"member": "This member has no unpaid profit balance."})

        if self.request_mode == self.RequestMode.PARTIAL:
            if not self.requested_amount or int(self.requested_amount) <= 0:
                raise ValidationError(
                    {"requested_amount": "Requested amount must be greater than zero."}
                )
            if int(self.requested_amount) > max(current_unpaid_profit, int(self.requested_balance or 0)):
                raise ValidationError(
                    {
                        "requested_amount": (
                            f"Requested amount exceeds available unpaid profit balance of "
                            f"{max(current_unpaid_profit, int(self.requested_balance or 0))} RWF."
                        )
                    }
                )
        else:
            self.requested_amount = None

        if (
            self.status == self.StatusChoices.APPROVED
            and (not self.approved_amount or int(self.approved_amount) <= 0)
        ):
            raise ValidationError({"approved_amount": "Approved amount must be greater than zero."})

    def save(self, *args, **kwargs):
        if not self.pk:
            self.requested_balance = int(self.member.total_unpaid_profit())
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member} profit request - {self.status}"


class MemberWithdrawal(models.Model):
    class WithdrawalType(models.TextChoices):
        EXIT = "EXIT", "Member Exit"
        PROFIT = "PROFIT", "Profit Withdrawal"
        OTHER = "OTHER", "Other"

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="withdrawals",
    )
    withdrawal_type = models.CharField(
        max_length=20,
        choices=WithdrawalType.choices,
        default=WithdrawalType.OTHER,
    )
    amount = models.PositiveBigIntegerField()
    withdrawn_on = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_member_withdrawals",
    )
    member_exit = models.OneToOneField(
        MemberExit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="withdrawal_record",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-withdrawn_on", "-id"]

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})

        if self.withdrawal_type == self.WithdrawalType.EXIT and not self.member_exit_id:
            raise ValidationError({"member_exit": "Member exit withdrawal must be linked to a member exit record."})

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.withdrawn_on:
            self.withdrawn_on = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member} withdrawal - {self.amount}"


class MemberCertificateApproval(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="certificate_approvals")
    year = models.PositiveIntegerField()
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="approved_certificates",
    )
    approved_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("member", "year")
        ordering = ["-year", "-approved_on"]

    def __str__(self):
        return f"{self.member} certificate approved for {self.year}"

