from django.contrib import admin
import json

from django import forms
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.http import HttpResponse
import openpyxl
from reportlab.pdfgen import canvas

from .models import (
    User,
    RoleAssignmentHistory,
    StaffAccountHolderHistory,
    Location,
    Member,
    MemberExit,
    Client,
    Biometric,
    MembershipFee,
    SavingCategory,
    MemberSavingChoice,
    SavingChoiceChangeRequest,
    MonthlySaving,
    LoanType,
    Loan,
    LoanRepayment,
    FineRule,
    Fine,
    IncomeCategory,
    Income,
    Department,
    Employee,
    SalaryPayment,
    ExpenseCategory,
    Expense,
    Notification,
    TransactionLog,
    AnnualClosing,
    MemberAnnualProfit,
    MemberProfitPayout,
    MemberProfitRequest,
    MemberWithdrawal,
    MemberCertificateApproval,
)
from .utils.phone_numbers import COUNTRY_CODE_CHOICES, compose_phone_number, split_phone_number


admin.site.site_header = "Ikimina Rehoboth Admin"
admin.site.site_title = "Ikimina Rehoboth"
admin.site.index_title = "Core Administration"

class CountryPhoneWidget(forms.MultiWidget):
    def __init__(self, choices=None, attrs=None):
        widgets = [
            forms.Select(
                choices=choices or COUNTRY_CODE_CHOICES,
                attrs={"style": "min-width: 170px;"},
            ),
            forms.TextInput(
                attrs={
                    "placeholder": "7XXXXXXX",
                    "maxlength": "9",
                    "inputmode": "numeric",
                    "pattern": r"\d{1,9}",
                    "style": "min-width: 220px;",
                }
            ),
        ]
        super().__init__(widgets, attrs)

    def decompress(self, value):
        code, local = split_phone_number(value)
        return [code, local]


class CountryPhoneFormField(forms.MultiValueField):
    def __init__(self, *args, choices=None, required=True, **kwargs):
        field_choices = choices or COUNTRY_CODE_CHOICES
        fields = (
            forms.ChoiceField(choices=field_choices, required=required),
            forms.CharField(required=required),
        )
        widget = CountryPhoneWidget(choices=field_choices)
        kwargs.setdefault("help_text", "Select a country code and enter up to 9 digits.")
        super().__init__(
            fields=fields,
            require_all_fields=required,
            required=required,
            widget=widget,
            *args,
            **kwargs,
        )

    def clean(self, value):
        if not value or all(item in self.empty_values for item in value):
            if self.required:
                raise forms.ValidationError(self.error_messages["required"], code="required")
            return ""
        return super().clean(value)

    def compress(self, data_list):
        if not data_list:
            return ""
        try:
            return compose_phone_number(
                data_list[0],
                data_list[1],
                required=self.required,
            )
        except forms.ValidationError:
            raise
        except Exception as exc:
            messages = getattr(exc, "messages", None) or [str(exc)]
            raise forms.ValidationError(messages)


class CountryPhoneAdminFormMixin:
    phone_field_names = ()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name in self.phone_field_names:
            field = self.fields.get(field_name)
            if not field:
                continue

            current_value = ""
            if self.instance and getattr(self.instance, "pk", None):
                current_value = getattr(self.instance, field_name, "")
            else:
                current_value = self.initial.get(field_name, "")

            code, _ = split_phone_number(current_value)
            current_choices = list(COUNTRY_CODE_CHOICES)
            if code and all(choice_code != code for choice_code, _ in current_choices):
                current_choices.insert(0, (code, f"Current ({code})"))

            if hasattr(field, "fields") and field.fields:
                field.fields[0].choices = current_choices
            if hasattr(field.widget, "widgets") and field.widget.widgets:
                field.widget.widgets[0].choices = current_choices


class MemberAdminForm(CountryPhoneAdminFormMixin, forms.ModelForm):
    phone_field_names = ("phone",)
    phone = CountryPhoneFormField(label="Phone")

    class Meta:
        model = Member
        fields = "__all__"


class ClientAdminForm(CountryPhoneAdminFormMixin, forms.ModelForm):
    phone_field_names = ("phone",)
    phone = CountryPhoneFormField(label="Phone")

    class Meta:
        model = Client
        fields = "__all__"


class EmployeeAdminForm(CountryPhoneAdminFormMixin, forms.ModelForm):
    phone_field_names = ("external_phone",)
    external_phone = CountryPhoneFormField(label="External phone", required=False)

    class Meta:
        model = Employee
        fields = "__all__"

    class Media:
        js = ("employee_salary_sync.js",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        salary_field = self.fields.get("salary")
        department_field = self.fields.get("department")

        if salary_field:
            salary_field.required = False
            salary_field.widget.attrs["readonly"] = True
            salary_field.help_text = "Auto-filled from the selected department salary."

        if department_field:
            salary_map = {
                str(department.id): int(department.base_salary or 0)
                for department in Department.objects.all().order_by("name")
            }
            department_field.widget.attrs["data-salary-map"] = json.dumps(salary_map)
            department_field.widget.attrs["onchange"] = "syncEmployeeSalaryFromDepartment(this)"

        department = self._selected_department()
        if salary_field:
            salary_field.initial = department.base_salary if department else ""

    def _selected_department(self):
        department_id = self.data.get("department") or getattr(self.instance, "department_id", None)
        if not department_id:
            return None
        try:
            return Department.objects.get(pk=department_id)
        except (Department.DoesNotExist, ValueError, TypeError):
            return None

    def clean(self):
        cleaned_data = super().clean()
        department = cleaned_data.get("department")
        if department:
            cleaned_data["salary"] = department.base_salary
        return cleaned_data


def get_parent_location_name(location, target_type):
    if not location:
        return None

    loc_id = str(location.id)
    parent_id = None

    if target_type == "PROVINCE":
        parent_id = loc_id[:1]
    elif target_type == "DISTRICT":
        parent_id = loc_id[:2]
    elif target_type == "SECTOR":
        parent_id = loc_id[:4]
    elif target_type == "CELL":
        parent_id = loc_id[:6]
    elif target_type == "VILLAGE":
        parent_id = loc_id
    else:
        return None

    try:
        return Location.objects.get(id=int(parent_id)).name
    except Location.DoesNotExist:
        return None


def export_members_excel(modeladmin, request, queryset):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Members"
    ws.append(["ID", "National ID", "Account No", "Phone", "Joined Date"])

    for member in queryset:
        ws.append(
            [
                member.id,
                member.national_id,
                member.account_number,
                member.phone,
                member.joined_date.strftime("%Y-%m-%d") if member.joined_date else "",
            ]
        )

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = "attachment; filename=members.xlsx"
    wb.save(response)
    return response


def export_loans_pdf(modeladmin, request, queryset):
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="loans.pdf"'

    pdf = canvas.Canvas(response)
    y = 800

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(180, y, "IKIMINA REHOBOTH - LOANS REPORT")
    y -= 40
    pdf.setFont("Helvetica", 10)

    for loan in queryset:
        pdf.drawString(
            40,
            y,
            f"Loan ID: {loan.id} | Type: {loan.loan_type.name} | "
            f"Principal: {loan.principal_amount} RWF | Status: {loan.status}",
        )
        y -= 20
        if y < 60:
            pdf.showPage()
            y = 800

    pdf.showPage()
    pdf.save()
    return response


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class MemberSavingChoiceInline(admin.TabularInline):
    model = MemberSavingChoice
    extra = 0
    fields = ("category", "is_active")
    autocomplete_fields = ("category",)


class MembershipFeeInline(admin.StackedInline):
    model = MembershipFee
    extra = 0
    can_delete = False
    fields = ("amount", "paid_on", "received_by")
    readonly_fields = ("paid_on", "received_by")


class MemberExitInline(admin.StackedInline):
    model = MemberExit
    extra = 0
    can_delete = False
    fields = ("total_savings", "amount_paid", "retained_amount", "exit_date", "approved_by")
    readonly_fields = fields


class MemberBiometricInline(admin.StackedInline):
    model = Biometric
    fk_name = "member"
    extra = 0
    fields = ("photo", "fingerprint_template", "created_at")
    readonly_fields = ("created_at",)


class ClientBiometricInline(admin.StackedInline):
    model = Biometric
    fk_name = "client"
    extra = 0
    fields = ("photo", "fingerprint_template", "created_at")
    readonly_fields = ("created_at",)


class CustomUserCreationForm(forms.ModelForm):
    password1 = forms.CharField(label="Password", widget=forms.PasswordInput)
    password2 = forms.CharField(label="Confirm password", widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ("username", "email", "first_name", "last_name", "role", "is_active", "is_staff")

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords do not match.")
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = CustomUserCreationForm
    list_display = (
        "username",
        "email",
        "role",
        "is_active",
        "locked_by_system",
        "failed_login_attempts",
        "is_staff",
        "date_joined",
    )
    list_filter = ("role", "is_active", "locked_by_system", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")
    readonly_fields = (
        "last_login",
        "date_joined",
        "created_by",
        "updated_by",
        "failed_login_attempts",
        "failed_login_last_at",
        "locked_at",
    )
    list_per_page = 25

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email")}),
        ("Role", {"fields": ("role",)}),
        (
            "Security",
            {"fields": ("locked_by_system", "failed_login_attempts", "failed_login_last_at", "locked_at")},
        ),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Audit", {"fields": ("last_login", "date_joined", "created_by", "updated_by")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                    "is_active",
                    "is_staff",
                    "password1",
                    "password2",
                ),
            },
        ),
    )

    actions = ["unlock_selected_users"]

    @admin.action(description="Unlock selected user accounts")
    def unlock_selected_users(self, request, queryset):
        updated = queryset.update(
            is_active=True,
            locked_by_system=False,
            failed_login_attempts=0,
            failed_login_last_at=None,
            locked_at=None,
        )
        self.message_user(request, f"{updated} user account(s) unlocked successfully.")

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(RoleAssignmentHistory)
class RoleAssignmentHistoryAdmin(admin.ModelAdmin):
    list_display = ("role", "user", "assigned_by", "started_at", "ended_at", "is_current")
    list_filter = ("role", "is_current")
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    autocomplete_fields = ("user", "assigned_by")
    list_select_related = ("user", "assigned_by")
    ordering = ("-started_at", "-id")


@admin.register(StaffAccountHolderHistory)
class StaffAccountHolderHistoryAdmin(admin.ModelAdmin):
    list_display = ("user", "employee", "assigned_by", "started_at", "ended_at", "is_current")
    list_filter = ("is_current", "user__role")
    search_fields = (
        "user__username",
        "employee__external_full_name",
        "employee__member__user__first_name",
        "employee__member__user__last_name",
    )
    autocomplete_fields = ("user", "employee", "assigned_by")
    list_select_related = ("user", "employee", "employee__member__user", "assigned_by")
    ordering = ("-started_at", "-id")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "type", "parent")
    list_filter = ("type",)
    search_fields = ("name", "id")
    ordering = ("id",)
    list_per_page = 50

    def parent(self, obj):
        if obj.type == "VILLAGE":
            return get_parent_location_name(obj, "CELL")
        if obj.type == "CELL":
            return get_parent_location_name(obj, "SECTOR")
        if obj.type == "SECTOR":
            return get_parent_location_name(obj, "DISTRICT")
        if obj.type == "DISTRICT":
            return get_parent_location_name(obj, "PROVINCE")
        return None


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    form = MemberAdminForm
    list_display = (
        "national_id",
        "account_number",
        "user",
        "enrollment_type",
        "phone",
        "is_active",
        "joined_date",
        "province",
        "district",
        "sector",
        "cell",
        "village",
    )
    list_filter = ("enrollment_type", "is_active", "joined_date")
    search_fields = ("national_id", "account_number", "phone", "user__username")
    autocomplete_fields = ("address", "user")
    list_select_related = ("user", "address")
    actions = [export_members_excel]
    inlines = [MemberSavingChoiceInline, MembershipFeeInline, MemberExitInline, MemberBiometricInline]
    list_per_page = 25

    fieldsets = (
        ("Identity", {"fields": ("user", "enrollment_type", "national_id", "account_number")}),
        ("Contact", {"fields": ("phone", "address")}),
        ("Status", {"fields": ("joined_date", "is_active")}),
    )

    def province(self, obj):
        return get_parent_location_name(obj.address, "PROVINCE")

    def district(self, obj):
        return get_parent_location_name(obj.address, "DISTRICT")

    def sector(self, obj):
        return get_parent_location_name(obj.address, "SECTOR")

    def cell(self, obj):
        return get_parent_location_name(obj.address, "CELL")

    def village(self, obj):
        return obj.address.name if obj.address else None


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    form = ClientAdminForm
    list_display = ("full_name", "account_number", "phone", "is_active", "created_on", "address")
    list_filter = ("is_active", "created_on")
    search_fields = ("full_name", "account_number", "phone")
    autocomplete_fields = ("address", "user")
    list_select_related = ("address", "user")
    inlines = [ClientBiometricInline]
    list_per_page = 25

    fieldsets = (
        ("Identity", {"fields": ("user", "full_name", "account_number")}),
        ("Contact", {"fields": ("phone", "address")}),
        ("Status", {"fields": ("created_on", "is_active")}),
    )
    readonly_fields = ("created_on",)


@admin.register(Biometric)
class BiometricAdmin(admin.ModelAdmin):
    list_display = ("owner_type", "member", "client", "created_at")
    list_filter = ("owner_type", "created_at")
    search_fields = ("member__national_id", "client__account_number")
    readonly_fields = ("created_at",)
    list_per_page = 25


@admin.register(MembershipFee)
class MembershipFeeAdmin(admin.ModelAdmin):
    list_display = ("member", "amount", "paid_on", "received_by")
    list_filter = ("paid_on",)
    search_fields = ("member__national_id", "received_by__username")
    autocomplete_fields = ("member", "received_by")
    list_select_related = ("member", "received_by")
    list_per_page = 25


@admin.register(SavingCategory)
class SavingCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "monthly_amount", "year")
    list_filter = ("year",)
    search_fields = ("name",)
    ordering = ("-year", "monthly_amount")
    list_per_page = 25


@admin.register(MemberSavingChoice)
class MemberSavingChoiceAdmin(admin.ModelAdmin):
    list_display = ("member", "category", "is_active")
    list_filter = ("is_active", "category__year")
    search_fields = ("member__national_id", "category__name")
    autocomplete_fields = ("member", "category")
    list_select_related = ("member", "category")
    list_per_page = 25


@admin.register(SavingChoiceChangeRequest)
class SavingChoiceChangeRequestAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "year",
        "current_category",
        "requested_category",
        "request_origin",
        "requested_by",
        "status",
        "requested_on",
        "reviewed_by",
        "reviewed_on",
    )
    list_filter = ("status", "year")
    search_fields = (
        "member__national_id",
        "member__user__username",
        "requested_by__username",
        "requested_by__first_name",
        "requested_by__last_name",
        "requested_category__name",
        "current_category__name",
    )
    autocomplete_fields = ("member", "current_category", "requested_category", "requested_by", "reviewed_by")
    list_select_related = ("member", "current_category", "requested_category", "requested_by", "reviewed_by")
    list_per_page = 25


@admin.register(MonthlySaving)
class MonthlySavingAdmin(admin.ModelAdmin):
    list_display = ("get_member", "get_category", "month", "year", "amount_paid", "saved_on", "received_by")
    list_filter = ("year", "month")
    search_fields = ("saving_choice__member__national_id", "saving_choice__category__name")
    autocomplete_fields = ("saving_choice", "received_by")
    list_select_related = ("saving_choice__member", "saving_choice__category", "received_by")
    readonly_fields = ("year",)
    date_hierarchy = "saved_on"
    list_per_page = 25

    def get_member(self, obj):
        return obj.saving_choice.member.national_id

    get_member.short_description = "Member"
    get_member.admin_order_field = "saving_choice__member__national_id"

    def get_category(self, obj):
        return obj.saving_choice.category.name

    get_category.short_description = "Saving Category"
    get_category.admin_order_field = "saving_choice__category__name"


@admin.register(LoanType)
class LoanTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "interest_rate", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
    list_per_page = 25


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("id", "member", "client", "loan_type", "principal_amount", "interest_rate", "issued_date", "status")
    list_filter = ("status", "loan_type")
    search_fields = ("member__national_id", "client__account_number")
    autocomplete_fields = ("member", "client", "loan_type")
    list_select_related = ("member", "client", "loan_type")
    actions = [export_loans_pdf]
    date_hierarchy = "issued_date"
    list_per_page = 25


@admin.register(LoanRepayment)
class LoanRepaymentAdmin(admin.ModelAdmin):
    list_display = ("loan", "amount", "principal_amount", "interest_amount", "paid_on", "received_by")
    list_filter = ("paid_on",)
    search_fields = ("loan__id", "received_by__username")
    autocomplete_fields = ("loan", "received_by")
    list_select_related = ("loan", "received_by")
    date_hierarchy = "paid_on"
    list_per_page = 25


@admin.register(FineRule)
class FineRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "fine_type", "percentage", "applies_after_days", "is_active")
    list_filter = ("fine_type", "is_active")
    search_fields = ("name",)
    list_per_page = 25


@admin.register(Fine)
class FineAdmin(admin.ModelAdmin):
    list_display = ("member", "rule", "amount", "calculated_on", "is_paid", "paid_on")
    list_filter = ("is_paid", "rule__fine_type", "calculated_on")
    search_fields = ("member__national_id", "member__user__username")
    autocomplete_fields = ("member", "rule", "saving", "loan")
    list_select_related = ("member", "rule")
    date_hierarchy = "calculated_on"
    list_per_page = 25


@admin.register(IncomeCategory)
class IncomeCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    list_per_page = 25


@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "amount", "income_date", "recorded_by", "related_model", "related_object_id")
    list_filter = ("category", "income_date")
    search_fields = ("description", "recorded_by__username")
    autocomplete_fields = ("category", "recorded_by")
    list_select_related = ("category", "recorded_by")
    date_hierarchy = "income_date"
    list_per_page = 25


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "base_salary")
    search_fields = ("name",)
    list_per_page = 25


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    form = EmployeeAdminForm
    list_display = ("id", "user", "member", "department", "salary", "hired_date", "is_active")
    list_filter = ("department", "is_active")
    search_fields = ("user__username", "member__national_id")
    autocomplete_fields = ("user", "member", "department")
    list_select_related = ("user", "member", "department")
    list_per_page = 25


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = ("employee", "amount", "paid_on", "paid_by")
    list_filter = ("paid_on",)
    search_fields = ("employee__id", "paid_by__username")
    autocomplete_fields = ("employee", "paid_by")
    list_select_related = ("employee", "paid_by")
    date_hierarchy = "paid_on"
    list_per_page = 25


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    list_per_page = 25


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "amount", "expense_date", "recorded_by")
    list_filter = ("category", "expense_date")
    search_fields = ("description", "recorded_by__username")
    autocomplete_fields = ("category", "recorded_by")
    list_select_related = ("category", "recorded_by")
    date_hierarchy = "expense_date"
    list_per_page = 25


@admin.register(TransactionLog)
class TransactionLogAdmin(ReadOnlyAdmin):
    list_display = (
        "timestamp",
        "transaction_type",
        "action",
        "user",
        "related_model",
        "related_object_id",
        "amount",
    )
    list_filter = ("transaction_type", "action", "timestamp")
    search_fields = ("user__username", "related_model", "description")
    readonly_fields = (
        "timestamp",
        "user",
        "transaction_type",
        "action",
        "related_model",
        "related_object_id",
        "amount",
        "description",
        "ip_address",
    )
    ordering = ("-timestamp",)
    date_hierarchy = "timestamp"
    list_per_page = 25


@admin.register(Notification)
class NotificationAdmin(ReadOnlyAdmin):
    list_display = (
        "created_at",
        "user",
        "notification_type",
        "year",
        "month",
        "sent_email",
        "sent_sms",
        "is_read",
    )
    list_filter = ("notification_type", "year", "month", "sent_email", "sent_sms", "is_read")
    search_fields = ("user__username", "title", "message")
    list_per_page = 25


@admin.register(AnnualClosing)
class AnnualClosingAdmin(ReadOnlyAdmin):
    list_display = ("year", "total_savings", "loan_interest", "fines", "expenses", "net_profit", "closed_by", "closed_on")
    readonly_fields = list_display
    list_filter = ("year",)
    ordering = ("-year",)
    list_per_page = 25


@admin.register(MemberAnnualProfit)
class MemberAnnualProfitAdmin(ReadOnlyAdmin):
    list_display = ("member", "closing", "total_amount", "shares", "profit")
    readonly_fields = list_display
    list_filter = ("closing",)
    search_fields = ("member__national_id",)
    list_per_page = 25


@admin.register(MemberProfitPayout)
class MemberProfitPayoutAdmin(admin.ModelAdmin):
    list_display = ("member", "annual_profit", "amount", "paid_on", "approved_by")
    list_filter = ("paid_on", "annual_profit__closing__year")
    search_fields = ("member__national_id", "member__user__username", "member__user__first_name", "member__user__last_name")
    autocomplete_fields = ("member", "annual_profit", "approved_by")
    list_per_page = 25


@admin.register(MemberProfitRequest)
class MemberProfitRequestAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "requested_by",
        "request_mode",
        "requested_amount",
        "requested_balance",
        "status",
        "approved_amount",
        "requested_on",
        "reviewed_by",
    )
    list_filter = ("request_mode", "status", "requested_on", "reviewed_on")
    search_fields = (
        "member__national_id",
        "member__user__username",
        "member__user__first_name",
        "member__user__last_name",
        "requested_by__username",
        "requested_by__first_name",
        "requested_by__last_name",
    )
    autocomplete_fields = ("member", "requested_by", "reviewed_by")
    list_per_page = 25


@admin.register(MemberWithdrawal)
class MemberWithdrawalAdmin(admin.ModelAdmin):
    list_display = ("member", "withdrawal_type", "amount", "withdrawn_on", "approved_by")
    list_filter = ("withdrawal_type", "withdrawn_on")
    search_fields = ("member__national_id", "member__user__username", "member__user__first_name", "member__user__last_name")
    autocomplete_fields = ("member", "approved_by")
    list_per_page = 25


@admin.register(MemberCertificateApproval)
class MemberCertificateApprovalAdmin(ReadOnlyAdmin):
    list_display = ("member", "year", "approved_by", "approved_on")
    list_filter = ("year", "approved_on")
    search_fields = ("member__national_id", "member__user__username", "approved_by__username")
    list_per_page = 25

