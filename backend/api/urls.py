from django.urls import path
from api.views.auth_views import (
    MyTokenObtainPairView,
    current_user,
    change_password,
    logout,
)
from api.views.user_views import (
    admin_create_user,
    list_current_role_holders,
    list_staff_account_holder_history,
    list_users,
    list_role_assignment_history,
    list_users_options,
    update_user,
    delete_user,
    search_users,
    update_profile,
    admin_reset_password,
)
from .views.address_views import (
    ProvinceListAPIView,
    DistrictListAPIView,
    SectorListAPIView,
    CellListAPIView,
    VillageListAPIView,
    VillageHierarchyAPIView
)
from api.views.reports_views import (
    IkiminaSummaryReport,
    MemberSharesReport
)
from api.views.annual_closing_views import (
    AnnualClosingView,
    AnnualClosingListView,
    AnnualClosingExportPDFView,
    MemberAnnualProfitListView,
    MemberProfitBulkPayoutAPIView,
    MemberProfitPayoutExportPDFView,
    MemberProfitPayoutListCreateAPIView,
    MemberProfitRequestExportPDFView,
    MemberProfitRequestListAPIView,
    MemberProfitRequestReviewAPIView,
    MyMemberAnnualProfitListView,
    MyMemberCertificateAPIView,
    MyMemberCertificatePDFAPIView,
    MyMemberProfitPayoutListAPIView,
    MyMemberProfitRequestListCreateAPIView,
    MyMemberProfitSummaryAPIView,
)
from api.views.loan_request_views import (
    LoanRequestFormOptionsAPIView,
    LoanRequestExportPDFView,
    MyLoanRequestListCreateAPIView,
    StaffLoanRequestCreateAPIView,
    LoanRequestListAPIView,
    LoanRequestReviewAPIView,
    LoanRequestReviewOptionsAPIView,
)
from api.views.certificate_views import (
    CertificateApprovalListAPIView,
    CertificateApprovalCreateAPIView,
)
from api.views.membership_views import (
    MembershipFeeCreateView,
    MembershipFeeExportPDFView,
    MembershipFeeListView,
    MembershipFeeOptionsAPIView,
)
from api.views.member_views import (
    MemberListCreateAPIView,
    MemberDetailAPIView,
    MyMemberProfileAPIView,
    ExitedMemberListView,
    MemberOptionsAPIView,
)
from api.views.client_views import (
    ClientListCreateAPIView,
    ClientDetailAPIView,
    MyClientProfileAPIView,
)
from api.views.loan_views import (
    LoanCreateView,
    LoanListAPIView,
    LoanDetailAPIView,
    LoanUpdateAPIView,
    LoanDeleteAPIView,
    LoanExportPDFView,
    LoanRepaymentCreateView,
    LoanRepaymentListAPIView,
    LoanRepaymentExportPDFView,
    LoanRepaymentFormOptionsAPIView,
    LoanTypeListAPIView,
    LoanFormOptionsAPIView,
    MyLoanListAPIView,
    MyLoanRepaymentListAPIView,
)
from api.views.income_views import (
    IncomeCategoryListCreateView,
    IncomeExportPDFView,
    IncomeListCreateView,
    IncomeDetailView,
)
from api.views.expense_views import (
    ExpenseCategoryListCreateView,
    ExpenseExportPDFView,
    ExpenseListCreateView,
    ExpenseDetailView,
    ExpenseSummaryView,
)
from api.views.fine_views import (
    FineRuleListCreateView,
    FineRuleDetailView,
    FineListCreateView,
    FineExportPDFView,
    FineFormOptionsAPIView,
    FineDetailView,
    MyFineListView,
    FineWaiveAPIView,
)
from api.views.transaction_views import TransactionLogListView, TransactionLogExportView
from api.views.notification_views import (
    MarkNotificationReadAPIView,
    MyNotificationListAPIView,
    StaffNotificationListAPIView,
    TriggerReminderNotificationsAPIView,
)

from api.views.member_exit_views import (
    MemberExitCreateView,
    MemberExitListView,
    MemberExitOptionsAPIView,
)

from api.views.salary_views import (
    SalaryPaymentCreateView,
    SalaryPaymentExportPDFView,
    SalaryPaymentListAPIView,
    SalaryPaymentDetailAPIView,
    SalaryPaymentDeleteAPIView,
    SalaryPaymentUpdateAPIView,
    SalaryPaymentFormOptionsAPIView,
)
from api.views.workforce_views import (
    DepartmentListCreateAPIView,
    DepartmentDetailAPIView,
    EmployeeListCreateAPIView,
    EmployeeDetailAPIView,
    EmployeeFormOptionsAPIView,
)
from api.views.saving_views import (
    SavingCategoryListView,
    SavingCategoryMemberListView,
    SavingCategoryCreateView,
    SavingCategoryDetailView,
    MemberSavingChoiceListView,
    MemberSavingChoiceCreateView,
    MySavingChoiceListView,
    MySavingChoiceSelectView,
    MySavingChoiceChangeRequestListCreateView,
    SavingChoiceChangeRequestListView,
    SavingChoiceChangeRequestReviewAPIView,
    MonthlySavingCreateView,
    MonthlySavingListView,
    MonthlySavingExportPDFView,
    MyMonthlySavingListView,
    MyMonthlySavingStatementPDFView,
)
from api.views.biometric_views import (
    BiometricListCreateAPIView,
    BiometricDetailAPIView,
    MyBiometricAPIView,
    BiometricVerifyAPIView,
)


urlpatterns = [

    # ---------------- AUTH ----------------
    path("token/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("me/", current_user, name="current_user"),
    path("change-password/", change_password, name="change_password"),
    path("logout/", logout, name="logout"),

    # ---------------- USERS (ADMIN) ----------------
    path("users/create/", admin_create_user, name="admin_create_user"),
    path("users/", list_users, name="list_users"),
    path("users/role-holders/", list_current_role_holders, name="current_role_holders"),
    path(
        "users/staff-account-holder-history/",
        list_staff_account_holder_history,
        name="staff_account_holder_history",
    ),
    path("users/role-history/", list_role_assignment_history, name="role_assignment_history"),
    path("users/options/", list_users_options, name="list_users_options"),
    path("users/<int:user_id>/update/", update_user, name="update_user"),
    path("users/<int:user_id>/delete/", delete_user, name="delete_user"),
    path("users/search/", search_users, name="search_users"),
    path("users/profile/", update_profile, name="update_profile"),
    path("users/<int:user_id>/reset-password/", admin_reset_password, name="admin_reset_password"),

    # ---------------- MEMBERS ----------------
    path("members/", MemberListCreateAPIView.as_view(), name="members"),
    path("members/options/", MemberOptionsAPIView.as_view(), name="member_options"),
    path("members/<int:pk>/", MemberDetailAPIView.as_view(), name="member_detail"),
    path("members/me/", MyMemberProfileAPIView.as_view(), name="member_me"),
    path("members/exited/", ExitedMemberListView.as_view(), name="members_exited"),

    # ---------------- CLIENTS ----------------
    path("clients/", ClientListCreateAPIView.as_view(), name="clients"),
    path("clients/<int:pk>/", ClientDetailAPIView.as_view(), name="client_detail"),
    path("clients/me/", MyClientProfileAPIView.as_view(), name="client_me"),

    # ---------------- LOANS ----------------
    path("loans/", LoanListAPIView.as_view(), name="loans"),
    path("loans/create/", LoanCreateView.as_view(), name="loan_create"),
    path("loans/export/pdf/", LoanExportPDFView.as_view(), name="loan_export_pdf"),
    path("loans/<int:pk>/", LoanDetailAPIView.as_view(), name="loan_detail"),
    path("loans/<int:pk>/update/", LoanUpdateAPIView.as_view(), name="loan_update"),
    path("loans/<int:pk>/delete/", LoanDeleteAPIView.as_view(), name="loan_delete"),
    path("loan-types/", LoanTypeListAPIView.as_view(), name="loan_types"),
    path("loans/form-options/", LoanFormOptionsAPIView.as_view(), name="loan_form_options"),
    path("loans/me/", MyLoanListAPIView.as_view(), name="my_loans"),
    path("loan-requests/me/", MyLoanRequestListCreateAPIView.as_view(), name="my_loan_requests"),
    path("loan-requests/", LoanRequestListAPIView.as_view(), name="loan_requests"),
    path("loan-requests/export/pdf/", LoanRequestExportPDFView.as_view(), name="loan_requests_export_pdf"),
    path("loan-requests/create/", StaffLoanRequestCreateAPIView.as_view(), name="loan_request_create"),
    path("loan-requests/form-options/", LoanRequestFormOptionsAPIView.as_view(), name="loan_request_form_options"),
    path("loan-requests/<int:pk>/review/", LoanRequestReviewAPIView.as_view(), name="loan_request_review"),
    path("loan-requests/review-options/", LoanRequestReviewOptionsAPIView.as_view(), name="loan_request_review_options"),
    path("loan-repayments/", LoanRepaymentListAPIView.as_view(), name="loan_repayments"),
    path("loan-repayments/export/pdf/", LoanRepaymentExportPDFView.as_view(), name="loan_repayments_export_pdf"),
    path(
        "loan-repayments/form-options/",
        LoanRepaymentFormOptionsAPIView.as_view(),
        name="loan_repayment_form_options",
    ),
    path("loan-repayments/create/", LoanRepaymentCreateView.as_view(), name="loan_repayment_create"),
    path("loan-repayments/me/", MyLoanRepaymentListAPIView.as_view(), name="my_loan_repayments"),

    # ---------------- INCOME ----------------
    path("income-categories/", IncomeCategoryListCreateView.as_view(), name="income_categories"),
    path("income/", IncomeListCreateView.as_view(), name="income"),
    path("income/export/pdf/", IncomeExportPDFView.as_view(), name="income_export_pdf"),
    path("income/<int:pk>/", IncomeDetailView.as_view(), name="income_detail"),

    # ---------------- EXPENSES ----------------
    path("expense-categories/", ExpenseCategoryListCreateView.as_view(), name="expense_categories"),
    path("expenses/", ExpenseListCreateView.as_view(), name="expenses"),
    path("expenses/export/pdf/", ExpenseExportPDFView.as_view(), name="expenses_export_pdf"),
    path("expenses/<int:pk>/", ExpenseDetailView.as_view(), name="expense_detail"),
    path("expenses/summary/", ExpenseSummaryView.as_view(), name="expense_summary"),

    # ---------------- FINES ----------------
    path("fine-rules/", FineRuleListCreateView.as_view(), name="fine_rules"),
    path("fine-rules/<int:pk>/", FineRuleDetailView.as_view(), name="fine_rule_detail"),
    path("fines/", FineListCreateView.as_view(), name="fines"),
    path("fines/export/pdf/", FineExportPDFView.as_view(), name="fine_export_pdf"),
    path("fines/form-options/", FineFormOptionsAPIView.as_view(), name="fines_form_options"),
    path("fines/me/", MyFineListView.as_view(), name="my_fines"),
    path("fines/<int:pk>/waive/", FineWaiveAPIView.as_view(), name="fine_waive"),
    path("fines/<int:pk>/", FineDetailView.as_view(), name="fine_detail"),
    # ---------------- ADDRESS HIERARCHY ENDPOINTS ----------------
    path('provinces/', ProvinceListAPIView.as_view(), name='province-list'),
    path('districts/', DistrictListAPIView.as_view(), name='district-list'),
    path('sectors/', SectorListAPIView.as_view(), name='sector-list'),
    path('cells/', CellListAPIView.as_view(), name='cell-list'),
    path('villages/', VillageListAPIView.as_view(), name='village-list'),

    # ---------------- GET FULL HIERARCHY OF A VILLAGE ----------------
    path('village/<int:village_id>/hierarchy/', VillageHierarchyAPIView.as_view(), name='village-hierarchy'),

    # ---------------- IKIMINA SUMMARY ----------------
    path('reports/summary/', IkiminaSummaryReport.as_view()),
    path('reports/members-shares/', MemberSharesReport.as_view()),

    # ---------------- ANNUAL CLOSING ----------------
    path('reports/annual-closing/', AnnualClosingView.as_view()),
    path('reports/annual-closing/list/', AnnualClosingListView.as_view(), name="annual_closing_list"),
    path('reports/annual-closing/export/pdf/', AnnualClosingExportPDFView.as_view(), name="annual_closing_export_pdf"),
    path('reports/member-profits/', MemberAnnualProfitListView.as_view(), name="member_profits"),
    path('reports/member-profits/me/', MyMemberAnnualProfitListView.as_view(), name="my_member_profits"),
    path('reports/member-profit-payouts/me/', MyMemberProfitPayoutListAPIView.as_view(), name="my_member_profit_payouts"),
    path('reports/member-profit-requests/me/', MyMemberProfitRequestListCreateAPIView.as_view(), name="my_member_profit_requests"),
    path('reports/member-profits/me/summary/', MyMemberProfitSummaryAPIView.as_view(), name="my_member_profit_summary"),
    path('reports/member-profit-payouts/', MemberProfitPayoutListCreateAPIView.as_view(), name="member_profit_payouts"),
    path('reports/member-profit-payouts/export/pdf/', MemberProfitPayoutExportPDFView.as_view(), name="member_profit_payouts_export_pdf"),
    path('reports/member-profit-payouts/bulk/', MemberProfitBulkPayoutAPIView.as_view(), name="member_profit_payouts_bulk"),
    path('reports/member-profit-requests/', MemberProfitRequestListAPIView.as_view(), name="member_profit_requests"),
    path('reports/member-profit-requests/export/pdf/', MemberProfitRequestExportPDFView.as_view(), name="member_profit_requests_export_pdf"),
    path('reports/member-profit-requests/<int:pk>/review/', MemberProfitRequestReviewAPIView.as_view(), name="member_profit_request_review"),
    path('reports/member-certificate/me/', MyMemberCertificateAPIView.as_view(), name="my_member_certificate"),
    path('reports/member-certificate/me/pdf/', MyMemberCertificatePDFAPIView.as_view(), name="my_member_certificate_pdf"),
    path(
        "reports/member-certificates/approvals/",
        CertificateApprovalListAPIView.as_view(),
        name="certificate_approvals",
    ),
    path(
        "reports/member-certificates/approvals/approve/",
        CertificateApprovalCreateAPIView.as_view(),
        name="certificate_approvals_approve",
    ),

    path("membership-fees/", MembershipFeeListView.as_view()),
    path("membership-fees/export/pdf/", MembershipFeeExportPDFView.as_view(), name="membership_fees_export_pdf"),
    path("membership-fees/create/", MembershipFeeCreateView.as_view()),
    path("membership-fees/options/", MembershipFeeOptionsAPIView.as_view()),

    path("member-exit/", MemberExitCreateView.as_view()),
    path("member-exit/list/", MemberExitListView.as_view()),
    path("member-exit/options/", MemberExitOptionsAPIView.as_view()),

    path("salary-payments/", SalaryPaymentListAPIView.as_view()),
    path("salary-payments/export/pdf/", SalaryPaymentExportPDFView.as_view(), name="salary_payments_export_pdf"),
    path("salary-payments/create/", SalaryPaymentCreateView.as_view()),
    path("salary-payments/form-options/", SalaryPaymentFormOptionsAPIView.as_view()),
    path("salary-payments/<int:pk>/", SalaryPaymentDetailAPIView.as_view()),
    path("salary-payments/<int:pk>/update/", SalaryPaymentUpdateAPIView.as_view()),
    path("salary-payments/<int:pk>/delete/", SalaryPaymentDeleteAPIView.as_view()),
    path("departments/", DepartmentListCreateAPIView.as_view()),
    path("departments/<int:pk>/", DepartmentDetailAPIView.as_view()),
    path("employees/", EmployeeListCreateAPIView.as_view()),
    path("employees/options/", EmployeeFormOptionsAPIView.as_view()),
    path("employees/<int:pk>/", EmployeeDetailAPIView.as_view()),
    path("transaction-logs/", TransactionLogListView.as_view(), name="transaction_logs"),
    path("transaction-logs/export/", TransactionLogExportView.as_view(), name="transaction_logs_export"),
    path("notifications/me/", MyNotificationListAPIView.as_view(), name="my_notifications"),
    path("notifications/", StaffNotificationListAPIView.as_view(), name="notifications"),
    path("notifications/read/", MarkNotificationReadAPIView.as_view(), name="mark_notifications_read"),
    path(
        "notifications/trigger-reminders/",
        TriggerReminderNotificationsAPIView.as_view(),
        name="trigger_reminder_notifications",
    ),

    # ---------------- SAVINGS ----------------
    path("saving-categories/", SavingCategoryListView.as_view()),
    path("saving-categories/member/", SavingCategoryMemberListView.as_view()),
    path("saving-categories/create/", SavingCategoryCreateView.as_view()),
    path("saving-categories/<int:pk>/", SavingCategoryDetailView.as_view()),
    path("saving-choices/", MemberSavingChoiceListView.as_view()),
    path("saving-choices/create/", MemberSavingChoiceCreateView.as_view()),
    path("saving-choices/me/", MySavingChoiceListView.as_view(), name="my_saving_choices"),
    path("saving-choices/me/select/", MySavingChoiceSelectView.as_view(), name="my_saving_choice_select"),
    path(
        "saving-choices/me/change-requests/",
        MySavingChoiceChangeRequestListCreateView.as_view(),
        name="my_saving_choice_change_requests",
    ),
    path(
        "saving-choice-change-requests/",
        SavingChoiceChangeRequestListView.as_view(),
        name="saving_choice_change_requests",
    ),
    path(
        "saving-choice-change-requests/<int:pk>/review/",
        SavingChoiceChangeRequestReviewAPIView.as_view(),
        name="saving_choice_change_requests_review",
    ),
    path("monthly-savings/create/", MonthlySavingCreateView.as_view()),
    path("monthly-savings/", MonthlySavingListView.as_view()),
    path("monthly-savings/export/pdf/", MonthlySavingExportPDFView.as_view(), name="monthly_savings_export_pdf"),
    path("monthly-savings/me/", MyMonthlySavingListView.as_view(), name="my_monthly_savings"),
    path(
        "monthly-savings/me/statement/pdf/",
        MyMonthlySavingStatementPDFView.as_view(),
        name="my_monthly_savings_statement_pdf",
    ),

    # ---------------- BIOMETRIC ----------------
    path("biometrics/", BiometricListCreateAPIView.as_view(), name="biometrics"),
    path("biometrics/<int:pk>/", BiometricDetailAPIView.as_view(), name="biometric_detail"),
    path("biometrics/me/", MyBiometricAPIView.as_view(), name="my_biometric"),
    path("biometrics/verify/", BiometricVerifyAPIView.as_view(), name="biometric_verify"),
]


