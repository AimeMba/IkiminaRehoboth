from django.test import TestCase

from datetime import date

from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .admin import EmployeeAdminForm
from .models import (
    AnnualClosing,
    Biometric,
    Department,
    Employee,
    Expense,
    ExpenseCategory,
    Fine,
    FineRule,
    Income,
    IncomeCategory,
    Loan,
    LoanRepayment,
    LoanRequest,
    LoanType,
    Location,
    Member,
    MemberAnnualProfit,
    MemberExit,
    MemberSavingChoice,
    MemberWithdrawal,
    MembershipFee,
    MonthlySaving,
    SavingCategory,
    User,
)
from .serializers.annual_serializers import AnnualClosingSerializer, MemberAnnualProfitSerializer
from .serializers.employee_serializers_v2 import EmployeeSerializer
from .serializers.expense_serializers import ExpenseCategorySerializer
from .serializers.income_serializers import IncomeCategorySerializer
from .views.annual_closing_views import AnnualClosingView, MemberProfitRequestReviewAPIView
from .views.biometric_views import BiometricListCreateAPIView
from .views.loan_request_views import LoanRequestReviewAPIView, StaffLoanRequestCreateAPIView
from .views.loan_views import LoanTypeListAPIView
from .views.member_exit_views import MemberExitCreateView
from .utils.biometrics import BIOMETRIC_HASH_PREFIX, verify_biometric_template
from .utils.pdf_reports import _resolve_manager_contact
from .utils.phone_numbers import compose_phone_number, normalize_phone_number, split_phone_number


class PhoneNumberUtilsTests(SimpleTestCase):
    def test_normalize_phone_number_trims_and_preserves_valid_rwanda_number(self):
        self.assertEqual(normalize_phone_number("  +250785422343  "), "+250785422343")

    def test_normalize_phone_number_requires_country_code(self):
        with self.assertRaisesMessage(ValidationError, "Phone number must include country code"):
            normalize_phone_number("0785422343")

    def test_compose_phone_number_limits_local_digits_to_nine(self):
        with self.assertRaisesMessage(ValidationError, "must not exceed 9"):
            compose_phone_number("+250", "1234567890")

    def test_split_phone_number_supports_existing_unknown_country_code(self):
        self.assertEqual(split_phone_number("+491701234567"), ("+491", "701234567"))


class EmployeeWorkflowTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(name="Finance", base_salary=500000)
        self.user = User.objects.create_user(
            username="staff1",
            password="pass12345",
            role=User.Roles.ADMIN,
            first_name="Jane",
            last_name="Doe",
            email="jane@example.com",
        )

    def test_employee_serializer_normalizes_external_phone_and_department_salary(self):
        serializer = EmployeeSerializer(
            data={
                "user": self.user.pk,
                "external_full_name": "Jane Doe",
                "external_phone": " +250785422343 ",
                "department": self.department.pk,
                "salary": 1,
                "is_active": True,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        employee = serializer.save()

        self.assertEqual(employee.external_phone, "+250785422343")
        self.assertEqual(employee.salary, self.department.base_salary)

    def test_employee_serializer_rejects_invalid_external_phone(self):
        serializer = EmployeeSerializer(
            data={
                "user": self.user.pk,
                "external_full_name": "Jane Doe",
                "external_phone": "0785422343",
                "department": self.department.pk,
                "salary": 1,
                "is_active": True,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("external_phone", serializer.errors)

    def test_employee_admin_form_overrides_manual_salary_with_department_salary(self):
        form = EmployeeAdminForm(
            data={
                "user": str(self.user.pk),
                "member": "",
                "external_full_name": "Jane Doe",
                "external_national_id": "",
                "external_phone_0": "",
                "external_phone_1": "",
                "external_email": "",
                "department": str(self.department.pk),
                "salary": "1",
                "hired_date": "",
                "is_active": "on",
            }
        )

        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["salary"], self.department.base_salary)

    def test_manager_contact_prefers_employee_phone(self):
        manager = User.objects.create_user(
            username="manager1",
            password="pass12345",
            role=User.Roles.MANAGER,
            first_name="Gilgazi",
            last_name="Leader",
            email="manager@example.com",
        )
        Employee.objects.create(
            user=manager,
            external_full_name="Gilgazi Leader",
            external_phone="+250788000111",
            department=self.department,
            salary=self.department.base_salary,
        )

        self.assertEqual(
            _resolve_manager_contact(manager),
            {"phone": "+250788000111", "email": "manager@example.com"},
        )


class AnnualClosingMetricsTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(id=111111111, type="VILLAGE", name="Village A")
        self.closed_by = User.objects.create_user(
            username="finance1",
            password="pass12345",
            role=User.Roles.FINANCE,
            first_name="Finance",
            last_name="Officer",
        )
        self.member_user_1 = User.objects.create_user(
            username="member101",
            password="pass12345",
            role=User.Roles.MEMBER,
            first_name="Alpha",
            last_name="Member",
        )
        self.member_user_2 = User.objects.create_user(
            username="member102",
            password="pass12345",
            role=User.Roles.MEMBER,
            first_name="Beta",
            last_name="Member",
        )
        self.member_1 = Member.objects.create(
            user=self.member_user_1,
            national_id="1234567890123456",
            phone="+250788000001",
            address=self.location,
        )
        self.member_2 = Member.objects.create(
            user=self.member_user_2,
            national_id="1234567890123457",
            phone="+250788000002",
            address=self.location,
        )
        self.closing = AnnualClosing.objects.create(
            year=2026,
            total_savings=250000,
            total_income=50000,
            loan_interest=40000,
            fines=10000,
            expenses=20000,
            total_adjusted_capital=260000,
            net_profit=30000,
            profit_rate_percent="11.5385",
            total_shares=130,
            december_unpaid_deducted_members=1,
            policy_version="annual_closing_v2_snapshot",
            closed_by=self.closed_by,
        )
        self.member_profit_1 = MemberAnnualProfit.objects.create(
            member=self.member_1,
            closing=self.closing,
            total_amount=100000,
            shares=50,
            profit=12000,
        )
        MemberAnnualProfit.objects.create(
            member=self.member_2,
            closing=self.closing,
            total_amount=150000,
            shares=75,
            profit=18000,
        )

    def test_annual_closing_serializer_exposes_total_adjusted_capital_and_profit_rate(self):
        data = AnnualClosingSerializer(self.closing).data

        self.assertEqual(data["total_income"], 50000)
        self.assertEqual(data["total_adjusted_capital"], 260000)
        self.assertEqual(data["profit_rate_percent"], 11.5385)
        self.assertEqual(data["policy_version"], "annual_closing_v2_snapshot")

    def test_member_annual_profit_serializer_exposes_member_rate_percent(self):
        data = MemberAnnualProfitSerializer(self.member_profit_1).data

        self.assertEqual(data["profit_rate_percent"], 12.0)


class AnnualClosingSnapshotTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.location = Location.objects.create(id=333333333, type="VILLAGE", name="Village C")
        self.finance_user = User.objects.create_user(
            username="finance2",
            password="pass12345",
            role=User.Roles.FINANCE,
            first_name="Finance",
            last_name="Closer",
        )
        self.member_user = User.objects.create_user(
            username="member301",
            password="pass12345",
            role=User.Roles.MEMBER,
            first_name="Delta",
            last_name="Saver",
        )
        self.member = Member.objects.create(
            user=self.member_user,
            national_id="3234567890123456",
            phone="+250788000301",
            address=self.location,
        )
        self.saving_category = SavingCategory.objects.create(
            name="Regular Saving",
            monthly_amount=10000,
            year=2026,
        )
        self.saving_choice = MemberSavingChoice.objects.create(
            member=self.member,
            category=self.saving_category,
            is_active=True,
        )
        MonthlySaving.objects.create(
            saving_choice=self.saving_choice,
            month=1,
            amount_paid=10000,
            saved_on=date(2026, 1, 5),
            received_by=self.finance_user,
        )
        self.income_category = IncomeCategory.objects.create(name="Other Income")
        self.expense_category = ExpenseCategory.objects.create(name="Operations")
        Income.objects.create(
            category=self.income_category,
            amount=3000,
            description="Annual service income",
            income_date=date(2026, 2, 1),
            recorded_by=self.finance_user,
        )
        Expense.objects.create(
            category=self.expense_category,
            amount=2000,
            description="Office supplies",
            expense_date=date(2026, 2, 2),
            recorded_by=self.finance_user,
        )

    def test_annual_closing_persists_snapshot_metrics(self):
        request = self.factory.post("/api/reports/annual-closing/", {"year": 2026}, format="json")
        force_authenticate(request, user=self.finance_user)

        response = AnnualClosingView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        closing = AnnualClosing.objects.get(year=2026)
        self.assertEqual(closing.total_income, 3000)
        self.assertEqual(closing.total_adjusted_capital, 9000)
        self.assertEqual(float(closing.profit_rate_percent), 11.1111)
        self.assertEqual(closing.total_shares, 4)
        self.assertEqual(closing.december_unpaid_deducted_members, 1)
        self.assertEqual(closing.policy_version, "annual_closing_v2_snapshot")

        Income.objects.create(
            category=self.income_category,
            amount=7000,
            description="Late-added income",
            income_date=date(2026, 3, 1),
            recorded_by=self.finance_user,
        )

        data = AnnualClosingSerializer(closing).data
        self.assertEqual(data["total_income"], 3000)
        self.assertEqual(data["total_adjusted_capital"], 9000)
        self.assertEqual(data["profit_rate_percent"], 11.1111)


class SecurityAndIntegrityTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(id=222222222, type="VILLAGE", name="Village B")
        self.member_user = User.objects.create_user(
            username="member201",
            password="pass12345",
            role=User.Roles.MEMBER,
            first_name="Gamma",
            last_name="Member",
        )
        self.member = Member.objects.create(
            user=self.member_user,
            national_id="2234567890123456",
            phone="+250788000201",
            address=self.location,
        )

    def test_biometric_templates_are_hashed_before_storage(self):
        biometric = Biometric.objects.create(
            owner_type="MEMBER",
            member=self.member,
            fingerprint_template="finger-template-001",
        )

        self.assertTrue(biometric.fingerprint_template.startswith(BIOMETRIC_HASH_PREFIX))
        self.assertNotEqual(biometric.fingerprint_template, "finger-template-001")
        is_match, _hashed = verify_biometric_template(
            biometric.fingerprint_template,
            "finger-template-001",
        )
        self.assertTrue(is_match)

    def test_income_category_delete_is_blocked_when_income_history_exists(self):
        category = IncomeCategory.objects.create(name="Test Income")
        Income.objects.create(category=category, amount=5000, description="History row")

        with self.assertRaises(ProtectedError):
            category.delete()


class PermissionRegressionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.location = Location.objects.create(id=444444444, type="VILLAGE", name="Village D")
        self.manager_user = User.objects.create_user(
            username="manager403",
            password="pass12345",
            role=User.Roles.MANAGER,
        )
        self.member_user = User.objects.create_user(
            username="member403",
            password="pass12345",
            role=User.Roles.MEMBER,
        )
        self.member = Member.objects.create(
            user=self.member_user,
            national_id="4234567890123456",
            phone="+250788000403",
            address=self.location,
        )
        self.finance_user = User.objects.create_user(
            username="finance403",
            password="pass12345",
            role=User.Roles.FINANCE,
        )
        self.teller_user = User.objects.create_user(
            username="teller403",
            password="pass12345",
            role=User.Roles.TELLER,
        )

    def test_manager_cannot_review_profit_requests(self):
        request = self.factory.post(
            "/api/reports/member-profit-requests/1/review/",
            {"status": "APPROVED"},
            format="json",
        )
        force_authenticate(request, user=self.manager_user)

        response = MemberProfitRequestReviewAPIView.as_view()(request, pk=1)

        self.assertEqual(response.status_code, 403)

    def test_member_cannot_list_biometrics(self):
        request = self.factory.get("/api/biometrics/")
        force_authenticate(request, user=self.member_user)

        response = BiometricListCreateAPIView.as_view()(request)

        self.assertEqual(response.status_code, 403)

    def test_finance_cannot_create_staff_loan_request(self):
        request = self.factory.post(
            "/api/loan-requests/staff/",
            {"owner_type": "MEMBER", "owner_id": 1},
            format="json",
        )
        force_authenticate(request, user=self.finance_user)

        response = StaffLoanRequestCreateAPIView.as_view()(request)

        self.assertEqual(response.status_code, 403)

    def test_teller_cannot_view_loan_type_options(self):
        request = self.factory.get("/api/loan-types/")
        force_authenticate(request, user=self.teller_user)

        response = LoanTypeListAPIView.as_view()(request)

        self.assertEqual(response.status_code, 403)

    def test_saving_category_delete_is_blocked_when_member_choice_exists(self):
        category = SavingCategory.objects.create(name="Regular Saving", monthly_amount=5000, year=2026)
        MemberSavingChoice.objects.create(member=self.member, category=category, is_active=True)

        with self.assertRaises(ProtectedError):
            category.delete()


class BusinessWorkflowIntegrationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.location = Location.objects.create(id=555555555, type="VILLAGE", name="Village E")
        self.finance_user = User.objects.create_user(
            username="finance_workflow",
            password="pass12345",
            role=User.Roles.FINANCE,
            first_name="Finance",
            last_name="Workflow",
        )
        self.loan_officer_user = User.objects.create_user(
            username="loanofficer_workflow",
            password="pass12345",
            role=User.Roles.LOAN_OFFICER,
            first_name="Loan",
            last_name="Officer",
        )
        self.member_user = User.objects.create_user(
            username="member_workflow",
            password="pass12345",
            role=User.Roles.MEMBER,
            first_name="Member",
            last_name="Workflow",
        )
        self.member = Member.objects.create(
            user=self.member_user,
            national_id="5234567890123456",
            phone="+250788000555",
            address=self.location,
            is_active=True,
        )
        self.saving_category = SavingCategory.objects.create(
            name="Regular Saving",
            monthly_amount=10000,
            year=2026,
        )
        self.saving_choice = MemberSavingChoice.objects.create(
            member=self.member,
            category=self.saving_category,
            is_active=True,
        )
        MonthlySaving.objects.create(
            saving_choice=self.saving_choice,
            month=1,
            amount_paid=10000,
            saved_on=date(2026, 1, 10),
            received_by=self.finance_user,
        )
        self.loan_type = LoanType.objects.create(name="Standard Loan", interest_rate="2.00")
        self.fine_rule = FineRule.objects.create(
            name="Late Saving Fine",
            fine_type=FineRule.FineType.SAVING,
            percentage="10.00",
            applies_after_days=5,
            is_active=True,
        )

    def test_membership_fee_signal_generates_income_and_activates_user(self):
        pending_user = User.objects.create_user(
            username="pending_member",
            password="pass12345",
            role=User.Roles.MEMBER,
            is_active=False,
        )
        pending_member = Member.objects.create(
            user=pending_user,
            national_id="6234567890123456",
            phone="+250788000556",
            address=self.location,
            is_active=True,
        )

        fee = MembershipFee.objects.create(
            member=pending_member,
            amount=5000,
            received_by=self.finance_user,
        )

        income = Income.objects.get(
            related_model="MembershipFee",
            related_object_id=fee.id,
        )
        pending_user.refresh_from_db()

        self.assertIsNotNone(fee.paid_on)
        self.assertEqual(income.category.name, "Membership Fee")
        self.assertEqual(income.amount, 5000)
        self.assertEqual(income.recorded_by, self.finance_user)
        self.assertTrue(pending_user.is_active)

    def test_loan_repayment_interest_income_updates_and_deletes(self):
        loan = Loan.objects.create(
            member=self.member,
            loan_type=self.loan_type,
            principal_amount=50000,
            term_months=2,
            requested_by=self.finance_user,
        )
        repayment = LoanRepayment.objects.create(
            loan=loan,
            amount=12000,
            principal_amount=10000,
            interest_amount=2000,
            paid_on=date(2026, 2, 1),
            received_by=self.finance_user,
        )

        income = Income.objects.get(
            related_model="LoanRepayment",
            related_object_id=repayment.id,
        )
        self.assertEqual(income.category.name, "Loan Interest")
        self.assertEqual(income.amount, 2000)

        repayment.principal_amount = 10500
        repayment.interest_amount = 1500
        repayment.amount = 12000
        repayment.save()
        income.refresh_from_db()
        self.assertEqual(income.amount, 1500)

        repayment.principal_amount = 12000
        repayment.interest_amount = 0
        repayment.amount = 12000
        repayment.save()
        self.assertFalse(
            Income.objects.filter(
                related_model="LoanRepayment",
                related_object_id=repayment.id,
            ).exists()
        )

    def test_paid_and_waived_fine_toggles_income_record(self):
        fine = Fine.objects.create(
            member=self.member,
            rule=self.fine_rule,
            amount=1000,
            is_paid=True,
            paid_on=date(2026, 2, 2),
        )

        income = Income.objects.get(related_model="Fine", related_object_id=fine.id)
        self.assertEqual(income.category.name, "Fines")
        self.assertEqual(income.amount, 1000)

        fine.is_waived = True
        fine.waived_by = self.finance_user
        fine.save()
        fine.refresh_from_db()

        self.assertFalse(fine.is_paid)
        self.assertFalse(
            Income.objects.filter(related_model="Fine", related_object_id=fine.id).exists()
        )

    def test_loan_request_approval_creates_loan_and_marks_request_reviewed(self):
        loan_request = LoanRequest.objects.create(
            member=self.member,
            requested_loan_type=self.loan_type,
            requested_amount=60000,
            requested_term_months=3,
            requested_by=self.member_user,
            request_origin=LoanRequest.RequestOrigin.SELF,
            purpose="Business capital",
        )
        request = self.factory.post(
            f"/api/loan-requests/{loan_request.id}/review/",
            {"status": LoanRequest.StatusChoices.APPROVED, "loan_type": self.loan_type.id},
            format="json",
        )
        force_authenticate(request, user=self.loan_officer_user)

        response = LoanRequestReviewAPIView.as_view()(request, pk=loan_request.id)

        self.assertEqual(response.status_code, 200)
        loan_request.refresh_from_db()
        self.assertEqual(loan_request.status, LoanRequest.StatusChoices.APPROVED)
        self.assertEqual(loan_request.reviewed_by, self.loan_officer_user)
        self.assertIsNotNone(loan_request.approved_loan_id)
        self.assertTrue(
            Loan.objects.filter(
                id=loan_request.approved_loan_id,
                principal_amount=60000,
                request_origin=LoanRequest.RequestOrigin.SELF,
            ).exists()
        )

    def test_member_exit_creates_retained_income_and_disables_member_access(self):
        request = self.factory.post(
            "/api/member-exit/",
            {"member": self.member.id, "notes": "Exit approved"},
            format="json",
        )
        force_authenticate(request, user=self.finance_user)

        response = MemberExitCreateView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        self.member.refresh_from_db()
        self.member_user.refresh_from_db()
        self.saving_choice.refresh_from_db()
        exit_record = MemberExit.objects.get(member=self.member)
        withdrawal = MemberWithdrawal.objects.get(member_exit=exit_record)
        retained_income = Income.objects.get(
            related_model="MemberExit",
            related_object_id=exit_record.id,
        )

        self.assertFalse(self.member.is_active)
        self.assertFalse(self.member_user.is_active)
        self.assertFalse(self.saving_choice.is_active)
        self.assertEqual(exit_record.amount_paid, 9000)
        self.assertEqual(exit_record.retained_amount, 1000)
        self.assertEqual(withdrawal.amount, 9000)
        self.assertEqual(withdrawal.withdrawal_type, MemberWithdrawal.WithdrawalType.EXIT)
        self.assertEqual(retained_income.category.name, "Retained Member Exit Funds")
        self.assertEqual(retained_income.amount, 1000)

    def test_annual_closing_aggregates_generated_income_sources(self):
        MembershipFee.objects.create(
            member=self.member,
            amount=5000,
            received_by=self.finance_user,
        )
        loan = Loan.objects.create(
            member=self.member,
            loan_type=self.loan_type,
            principal_amount=50000,
            term_months=2,
            requested_by=self.finance_user,
        )
        LoanRepayment.objects.create(
            loan=loan,
            amount=12000,
            principal_amount=10000,
            interest_amount=2000,
            paid_on=date(2026, 3, 1),
            received_by=self.finance_user,
        )
        Fine.objects.create(
            member=self.member,
            rule=self.fine_rule,
            amount=1000,
            is_paid=True,
            paid_on=date(2026, 3, 2),
        )
        expense_category = ExpenseCategory.objects.create(name="Utilities")
        Expense.objects.create(
            category=expense_category,
            amount=500,
            description="Utility expense",
            expense_date=date(2026, 3, 3),
            recorded_by=self.finance_user,
        )

        request = self.factory.post("/api/reports/annual-closing/", {"year": 2026}, format="json")
        force_authenticate(request, user=self.finance_user)

        response = AnnualClosingView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        closing = AnnualClosing.objects.get(year=2026)
        self.assertEqual(closing.total_income, 8000)
        self.assertEqual(closing.loan_interest, 2000)
        self.assertEqual(closing.fines, 1000)
        self.assertEqual(closing.expenses, 500)


class FinanceReferenceDataTests(TestCase):
    def test_default_income_categories_are_seeded(self):
        self.assertTrue(IncomeCategory.objects.filter(name="Membership Fee").exists())
        self.assertTrue(IncomeCategory.objects.filter(name="Loan Interest").exists())
        self.assertTrue(IncomeCategory.objects.filter(name="Fines").exists())
        self.assertTrue(IncomeCategory.objects.filter(name="Retained Member Exit Funds").exists())
        self.assertTrue(IncomeCategory.objects.filter(name="Other Income").exists())

    def test_default_expense_categories_are_seeded(self):
        self.assertTrue(ExpenseCategory.objects.filter(name="Operations").exists())
        self.assertTrue(ExpenseCategory.objects.filter(name="Utilities").exists())
        self.assertTrue(ExpenseCategory.objects.filter(name="Transport").exists())
        self.assertTrue(ExpenseCategory.objects.filter(name="Salaries").exists())
        self.assertTrue(ExpenseCategory.objects.filter(name="Other Expenses").exists())

    def test_income_category_serializer_blocks_case_insensitive_duplicates(self):
        IncomeCategory.objects.create(name="Community Support")

        serializer = IncomeCategorySerializer(data={"name": "  community support  "})

        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_expense_category_serializer_blocks_case_insensitive_duplicates(self):
        ExpenseCategory.objects.create(name="Operations Reserve")

        serializer = ExpenseCategorySerializer(data={"name": "operations reserve"})

        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

