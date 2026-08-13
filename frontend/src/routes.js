/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

// Material Dashboard 2 React layouts
import Dashboard from "layouts/dashboard";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import AdminUsers from "layouts/admin/users";
import TransactionLogs from "layouts/admin/transaction-logs";
import MembersPage from "layouts/members";
import ClientsPage from "layouts/clients";
import PartyDetailsPage from "layouts/party-details";
import BiometricsPage from "layouts/biometrics";
import SavingCategoriesPage from "layouts/saving-categories";
import MonthlySavingsPage from "layouts/monthly-savings";
import LoansPage from "layouts/loans";
import LoanRequestsPage from "layouts/loan-requests";
import LoanRepaymentsPage from "layouts/loan-repayments";
import MembershipFeesPage from "layouts/membership-fees";
import MemberExitsPage from "layouts/member-exits";
import IncomePage from "layouts/income";
import ExpensesPage from "layouts/expenses";
import FinesPage from "layouts/fines";
import AnnualClosingPage from "layouts/annual-closing";
import DepartmentsPage from "layouts/departments";
import EmployeesPage from "layouts/employees";
import SalaryPaymentsPage from "layouts/salary-payments";
import MyRecordsPage from "layouts/my-records";
import MemberCertificatePage from "layouts/member-certificate";
import ProfitRequestsPage from "layouts/profit-requests";
import CertificateApprovalsPage from "layouts/manager/certificate-approvals";
import NotificationsPage from "layouts/notifications";
import MySavingChoicePage from "layouts/my-saving-choice";
import SavingChoiceRequestsPage from "layouts/manager/saving-choice-requests";

// @mui icons
import Icon from "components/AppIcon";

export const USER_ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  MEMBER: "MEMBER",
  TELLER: "TELLER",
  LOAN_OFFICER: "LOAN_OFFICER",
  FINANCE: "FINANCE",
  AUDITOR: "AUDITOR",
  CLIENT: "CLIENT",
};

const STAFF_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.TELLER,
  USER_ROLES.LOAN_OFFICER,
  USER_ROLES.FINANCE,
  USER_ROLES.AUDITOR,
];

const AUTHENTICATED_ROLES = [...STAFF_ROLES, USER_ROLES.MEMBER, USER_ROLES.CLIENT];
const ADMIN_ONLY = [USER_ROLES.ADMIN];
const ADMIN_MANAGER = [USER_ROLES.ADMIN, USER_ROLES.MANAGER];
const ADMIN_FINANCE = [USER_ROLES.ADMIN, USER_ROLES.FINANCE];
const ADMIN_FINANCE_AUDITOR = [USER_ROLES.ADMIN, USER_ROLES.FINANCE, USER_ROLES.AUDITOR];
const ADMIN_TELLER = [USER_ROLES.ADMIN, USER_ROLES.TELLER];
const ADMIN_LOAN = [USER_ROLES.ADMIN, USER_ROLES.LOAN_OFFICER];
const MEMBER_CLIENT = [USER_ROLES.MEMBER, USER_ROLES.CLIENT];

const routes = [
  {
    type: "title",
    title: "Main",
    key: "main-title",
    allowedRoles: AUTHENTICATED_ROLES,
  },
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
    allowedRoles: AUTHENTICATED_ROLES,
  },
  {
    type: "title",
    title: "My Records",
    key: "my-records-title",
    allowedRoles: MEMBER_CLIENT,
  },
  {
    type: "collapse",
    name: "My Savings",
    key: "my-savings",
    icon: <Icon fontSize="small">savings</Icon>,
    route: "/my-savings",
    component: <MyRecordsPage mode="savings" />,
    allowedRoles: [USER_ROLES.MEMBER],
  },
  {
    type: "collapse",
    name: "My Saving Choice",
    key: "my-saving-choice",
    icon: <Icon fontSize="small">tune</Icon>,
    route: "/my-saving-choice",
    component: <MySavingChoicePage />,
    allowedRoles: [USER_ROLES.MEMBER],
  },
  {
    type: "collapse",
    name: "Saving Choice Requests",
    key: "saving-choice-requests",
    icon: <Icon fontSize="small">assignment_turned_in</Icon>,
    route: "/saving-choice-requests",
    component: <SavingChoiceRequestsPage />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    type: "collapse",
    name: "My Loans",
    key: "my-loans",
    icon: <Icon fontSize="small">account_balance</Icon>,
    route: "/my-loans",
    component: <MyRecordsPage mode="loans" />,
    allowedRoles: MEMBER_CLIENT,
  },
  {
    type: "collapse",
    name: "My Loan Requests",
    key: "my-loan-requests",
    icon: <Icon fontSize="small">request_quote</Icon>,
    route: "/my-loan-requests",
    component: <MyRecordsPage mode="loan-requests" />,
    allowedRoles: MEMBER_CLIENT,
  },
  {
    type: "collapse",
    name: "My Repayments",
    key: "my-repayments",
    icon: <Icon fontSize="small">payments</Icon>,
    route: "/my-repayments",
    component: <MyRecordsPage mode="repayments" />,
    allowedRoles: MEMBER_CLIENT,
  },
  {
    type: "collapse",
    name: "My Fines",
    key: "my-fines",
    icon: <Icon fontSize="small">gavel</Icon>,
    route: "/my-fines",
    component: <MyRecordsPage mode="fines" />,
    allowedRoles: [USER_ROLES.MEMBER],
  },
  {
    type: "collapse",
    name: "My Certificate",
    key: "my-certificate",
    icon: <Icon fontSize="small">workspace_premium</Icon>,
    route: "/my-certificate",
    component: <MemberCertificatePage />,
    allowedRoles: [USER_ROLES.MEMBER],
  },
  {
    type: "collapse",
    name: "My Profit Requests",
    key: "my-profit-requests",
    icon: <Icon fontSize="small">request_quote</Icon>,
    route: "/my-profit-requests",
    component: <ProfitRequestsPage />,
    allowedRoles: [USER_ROLES.MEMBER],
  },
  {
    type: "title",
    title: "Members & Clients",
    key: "members-clients-title",
    allowedRoles: ADMIN_MANAGER,
  },
  {
    type: "collapse",
    name: "Members",
    key: "members",
    icon: <Icon fontSize="small">groups</Icon>,
    route: "/members",
    component: <MembersPage />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    type: "collapse",
    name: "Clients",
    key: "clients",
    icon: <Icon fontSize="small">person_add</Icon>,
    route: "/clients",
    component: <ClientsPage />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    key: "member-detail",
    route: "/members/:id",
    component: <PartyDetailsPage kind="member" />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    key: "client-detail",
    route: "/clients/:id",
    component: <PartyDetailsPage kind="client" />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    type: "collapse",
    name: "Biometrics",
    key: "biometrics",
    icon: <Icon fontSize="small">fingerprint</Icon>,
    route: "/biometrics",
    component: <BiometricsPage />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    type: "title",
    title: "Savings & Loans",
    key: "savings-loans-title",
    allowedRoles: [
      USER_ROLES.ADMIN,
      USER_ROLES.MANAGER,
      USER_ROLES.TELLER,
      USER_ROLES.LOAN_OFFICER,
      USER_ROLES.FINANCE,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    type: "collapse",
    name: "Saving Categories",
    key: "saving-categories",
    icon: <Icon fontSize="small">savings</Icon>,
    route: "/saving-categories",
    component: <SavingCategoriesPage />,
    allowedRoles: ADMIN_FINANCE,
  },
  {
    type: "collapse",
    name: "Monthly Savings",
    key: "monthly-savings",
    icon: <Icon fontSize="small">calendar_month</Icon>,
    route: "/monthly-savings",
    component: <MonthlySavingsPage />,
    allowedRoles: [...ADMIN_TELLER, USER_ROLES.MANAGER, USER_ROLES.FINANCE, USER_ROLES.AUDITOR],
  },
  {
    type: "collapse",
    name: "Loans",
    key: "loans",
    icon: <Icon fontSize="small">account_balance</Icon>,
    route: "/loans",
    component: <LoansPage />,
    allowedRoles: [...ADMIN_LOAN, USER_ROLES.FINANCE, USER_ROLES.AUDITOR],
  },
  {
    type: "collapse",
    name: "Loan Requests",
    key: "loan-requests",
    icon: <Icon fontSize="small">request_quote</Icon>,
    route: "/loan-requests",
    component: <LoanRequestsPage />,
    allowedRoles: [...ADMIN_LOAN, USER_ROLES.MANAGER, USER_ROLES.FINANCE, USER_ROLES.AUDITOR],
  },
  {
    type: "collapse",
    name: "Loan Repayments",
    key: "loan-repayments",
    icon: <Icon fontSize="small">payments</Icon>,
    route: "/loan-repayments",
    component: <LoanRepaymentsPage />,
    allowedRoles: [...ADMIN_TELLER, USER_ROLES.FINANCE, USER_ROLES.AUDITOR],
  },
  {
    type: "title",
    title: "Finance",
    key: "finance-title",
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Membership Fees",
    key: "membership-fees",
    icon: <Icon fontSize="small">credit_card</Icon>,
    route: "/membership-fees",
    component: <MembershipFeesPage />,
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Member Exits",
    key: "member-exits",
    icon: <Icon fontSize="small">logout</Icon>,
    route: "/member-exits",
    component: <MemberExitsPage />,
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Income",
    key: "income",
    icon: <Icon fontSize="small">trending_up</Icon>,
    route: "/income",
    component: <IncomePage />,
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Expenses",
    key: "expenses",
    icon: <Icon fontSize="small">receipt_long</Icon>,
    route: "/expenses",
    component: <ExpensesPage />,
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Fines",
    key: "fines",
    icon: <Icon fontSize="small">gavel</Icon>,
    route: "/fines",
    component: <FinesPage />,
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Annual Closing",
    key: "annual-closing",
    icon: <Icon fontSize="small">event_note</Icon>,
    route: "/annual-closing",
    component: <AnnualClosingPage />,
    allowedRoles: ADMIN_FINANCE_AUDITOR,
  },
  {
    type: "collapse",
    name: "Profit Requests",
    key: "profit-requests",
    icon: <Icon fontSize="small">request_quote</Icon>,
    route: "/profit-requests",
    component: <ProfitRequestsPage />,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.FINANCE, USER_ROLES.MANAGER, USER_ROLES.AUDITOR],
  },
  {
    type: "title",
    title: "Workforce",
    key: "workforce-title",
    allowedRoles: ADMIN_FINANCE,
  },
  {
    type: "collapse",
    name: "Departments",
    key: "departments",
    icon: <Icon fontSize="small">apartment</Icon>,
    route: "/departments",
    component: <DepartmentsPage />,
    allowedRoles: ADMIN_FINANCE,
  },
  {
    type: "collapse",
    name: "Employees",
    key: "employees",
    icon: <Icon fontSize="small">badge</Icon>,
    route: "/employees",
    component: <EmployeesPage />,
    allowedRoles: ADMIN_FINANCE,
  },
  {
    type: "collapse",
    name: "Salary Payments",
    key: "salary-payments",
    icon: <Icon fontSize="small">paid</Icon>,
    route: "/salary-payments",
    component: <SalaryPaymentsPage />,
    allowedRoles: ADMIN_FINANCE,
  },
  {
    type: "title",
    title: "Administration",
    key: "admin-title",
    allowedRoles: ADMIN_ONLY,
  },
  {
    type: "collapse",
    name: "Users",
    key: "users",
    icon: <Icon fontSize="small">manage_accounts</Icon>,
    route: "/users",
    component: <AdminUsers />,
    allowedRoles: ADMIN_ONLY,
  },
  {
    type: "collapse",
    name: "Transaction Logs",
    key: "transaction-logs",
    icon: <Icon fontSize="small">history</Icon>,
    route: "/transaction-logs",
    component: <TransactionLogs />,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.AUDITOR],
  },
  {
    type: "collapse",
    name: "Certificate Approvals",
    key: "certificate-approvals",
    icon: <Icon fontSize="small">workspace_premium</Icon>,
    route: "/certificate-approvals",
    component: <CertificateApprovalsPage />,
    allowedRoles: ADMIN_MANAGER,
  },
  {
    type: "collapse",
    name: "Notifications",
    key: "notifications",
    icon: <Icon fontSize="small">notifications</Icon>,
    route: "/notifications",
    component: <NotificationsPage />,
    allowedRoles: AUTHENTICATED_ROLES,
  },
  {
    type: "divider",
    key: "account-divider",
    allowedRoles: AUTHENTICATED_ROLES,
  },
  {
    type: "collapse",
    name: "Profile",
    key: "profile",
    icon: <Icon fontSize="small">person</Icon>,
    route: "/profile",
    component: <Profile />,
    allowedRoles: AUTHENTICATED_ROLES,
  },
  {
    type: "collapse",
    name: "Sign In",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
];

export default routes;
