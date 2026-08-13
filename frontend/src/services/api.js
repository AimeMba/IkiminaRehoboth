const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000/api";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const LANG_KEY = "app_lang";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || "";
}

export function setTokens(access, refresh) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function getCurrentLanguageCode() {
  return sessionStorage.getItem(LANG_KEY) || localStorage.getItem(LANG_KEY) || "rw";
}

export async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
    "Accept-Language": getCurrentLanguageCode(),
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.error || JSON.stringify(data);
    } catch (_e) {
      // ignore
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}

export async function login(username, password) {
  const data = await apiRequest("/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function fetchDashboardData() {
  const me = await fetchCurrentUser();
  const role = me?.effective_role || me?.role;

  if (role === "MEMBER") {
    const [profile, savings, loans, profits, loanRequests] = await Promise.all([
      apiRequest("/members/me/"),
      apiRequest("/monthly-savings/me/"),
      apiRequest("/loans/me/"),
      apiRequest("/reports/member-profits/me/"),
      apiRequest("/loan-requests/me/"),
    ]);

    const totalSavings = (savings || []).reduce(
      (acc, item) => acc + Number(item.amount_paid || 0),
      0
    );
    const totalShares = (profits || []).reduce((acc, item) => acc + Number(item.shares || 0), 0);
    const totalProfit = (profits || []).reduce((acc, item) => acc + Number(item.profit || 0), 0);
    const totalLoanInterest = (loans || []).reduce(
      (acc, item) => acc + (Number(item.total_amount || 0) - Number(item.principal_amount || 0)),
      0
    );
    const remainingTotal = (loans || []).reduce(
      (acc, item) => acc + Number(item.remaining_balance || 0),
      0
    );

    return {
      summary: {
        total_savings: totalSavings,
        total_shares: totalShares,
        loan_count: (loans || []).length,
        member_profit: totalProfit,
        loan_interest: totalLoanInterest,
        remaining_total: remainingTotal,
        expenses: 0,
        net_profit: totalProfit,
        status: profile?.is_active ? "ACTIVE" : "INACTIVE",
      },
      members: profile ? [profile] : [],
      savings: savings || [],
      loans: loans || [],
      profits: profits || [],
      loanRequests: loanRequests || [],
      profile,
      role,
    };
  }

  if (role === "CLIENT") {
    const [profile, loans, loanRequests] = await Promise.all([
      apiRequest("/clients/me/"),
      apiRequest("/loans/me/"),
      apiRequest("/loan-requests/me/"),
    ]);
    const totalLoanInterest = (loans || []).reduce(
      (acc, item) => acc + (Number(item.total_amount || 0) - Number(item.principal_amount || 0)),
      0
    );
    const remainingTotal = (loans || []).reduce(
      (acc, item) => acc + Number(item.remaining_balance || 0),
      0
    );

    return {
      summary: {
        total_savings: 0,
        total_shares: 0,
        loan_count: (loans || []).length,
        loan_interest: totalLoanInterest,
        remaining_total: remainingTotal,
        member_profit: 0,
        expenses: 0,
        net_profit: 0,
        status: profile?.is_active ? "ACTIVE" : "INACTIVE",
      },
      members: [],
      savings: [],
      loans: loans || [],
      profits: [],
      loanRequests: loanRequests || [],
      profile,
      role,
    };
  }

  if (role === "ADMIN" || role === "MANAGER") {
    const [summary, members, clients, savings, loans] = await Promise.all([
      apiRequest("/reports/summary/"),
      apiRequest("/members/"),
      apiRequest("/clients/"),
      apiRequest("/monthly-savings/"),
      apiRequest("/loans/"),
    ]);

    return {
      summary,
      members: Array.isArray(members) ? members : [],
      clients: Array.isArray(clients) ? clients : [],
      savings: Array.isArray(savings) ? savings : [],
      loans: Array.isArray(loans) ? loans : [],
      profits: [],
      loanRequests: [],
      role,
    };
  }

  if (role === "FINANCE" || role === "AUDITOR") {
    const [summary, savings, loans] = await Promise.all([
      apiRequest("/reports/summary/"),
      apiRequest("/monthly-savings/"),
      apiRequest("/loans/"),
    ]);

    return {
      summary,
      members: [],
      clients: [],
      savings: Array.isArray(savings) ? savings : [],
      loans: Array.isArray(loans) ? loans : [],
      profits: [],
      loanRequests: [],
      role,
    };
  }

  if (role === "LOAN_OFFICER") {
    const loans = await apiRequest("/loans/");
    const normalizedLoans = Array.isArray(loans) ? loans : [];

    const totalLoanInterest = normalizedLoans.reduce(
      (acc, item) => acc + (Number(item.total_amount || 0) - Number(item.principal_amount || 0)),
      0
    );
    const remainingTotal = normalizedLoans.reduce(
      (acc, item) => acc + Number(item.remaining_balance || 0),
      0
    );

    return {
      summary: {
        total_savings: 0,
        total_shares: 0,
        loan_count: normalizedLoans.length,
        loan_interest: totalLoanInterest,
        remaining_total: remainingTotal,
        member_profit: 0,
        expenses: 0,
        net_profit: totalLoanInterest,
      },
      members: [],
      clients: [],
      savings: [],
      loans: normalizedLoans,
      profits: [],
      loanRequests: [],
      role,
    };
  }

  if (role === "TELLER") {
    const savings = await apiRequest("/monthly-savings/");
    const totalSavings = (savings || []).reduce(
      (acc, item) => acc + Number(item.amount_paid || 0),
      0
    );

    return {
      summary: {
        total_savings: totalSavings,
        total_shares: 0,
        loan_count: 0,
        loan_interest: 0,
        remaining_total: 0,
        member_profit: 0,
        expenses: 0,
        net_profit: totalSavings,
      },
      members: [],
      clients: [],
      savings: Array.isArray(savings) ? savings : [],
      loans: [],
      profits: [],
      loanRequests: [],
      role,
    };
  }

  return {
    summary: {
      total_savings: 0,
      total_shares: 0,
      loan_count: 0,
      loan_interest: 0,
      remaining_total: 0,
      member_profit: 0,
      expenses: 0,
      net_profit: 0,
    },
    members: [],
    clients: [],
    savings: [],
    loans: [],
    profits: [],
    loanRequests: [],
    role,
  };
}
export async function fetchTableData() {
  const [members, savings, loans] = await Promise.all([
    apiRequest("/members/"),
    apiRequest("/monthly-savings/"),
    apiRequest("/loans/"),
  ]);

  return { members, savings, loans };
}

export async function fetchCurrentUser() {
  return apiRequest("/me/");
}

export async function fetchUsers() {
  return apiRequest("/users/");
}

export async function fetchCurrentRoleHolders() {
  return apiRequest("/users/role-holders/");
}

export async function fetchStaffAccountHolderHistory(params = {}) {
  return apiRequest(`/users/staff-account-holder-history/${buildQuery(params)}`);
}

export async function fetchRoleAssignmentHistory(params = {}) {
  return apiRequest(`/users/role-history/${buildQuery(params)}`);
}

export async function fetchUserOptions(role, profile) {
  const query = new URLSearchParams();
  if (role) {
    query.set("role", role);
  }
  if (profile) {
    query.set("profile", profile);
  }
  const queryString = query.toString();
  return apiRequest(`/users/options/${queryString ? `?${queryString}` : ""}`);
}

export async function fetchMembers(params = {}) {
  return apiRequest(`/members/${buildQuery(params)}`);
}

export async function fetchMemberOptions() {
  return apiRequest("/members/options/");
}

export async function createMember(payload) {
  return apiRequest("/members/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMember(memberId, payload) {
  return apiRequest(`/members/${memberId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchClients() {
  return apiRequest("/clients/");
}

export async function fetchBiometrics(params = {}) {
  return apiRequest(`/biometrics/${buildQuery(params)}`);
}

export async function fetchMyBiometric() {
  return apiRequest("/biometrics/me/");
}

export async function verifyBiometric(payload) {
  return apiRequest("/biometrics/verify/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createBiometric(payload) {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);
  return apiRequest("/biometrics/", {
    method: "POST",
    body,
  });
}

export async function updateBiometric(biometricId, payload) {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);
  return apiRequest(`/biometrics/${biometricId}/`, {
    method: "PATCH",
    body,
  });
}

export async function deleteBiometric(biometricId) {
  return apiRequest(`/biometrics/${biometricId}/`, {
    method: "DELETE",
  });
}

export async function createClient(payload) {
  return apiRequest("/clients/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(clientId, payload) {
  return apiRequest(`/clients/${clientId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchMyLoanRequests() {
  return apiRequest("/loan-requests/me/");
}

export async function fetchLoanRequests(params = {}) {
  return apiRequest(`/loan-requests/${buildQuery(params)}`);
}

export async function exportLoanRequestsPdf(params = {}) {
  return exportPdfFromPath("/loan-requests/export/pdf/", params, "loan_requests_report.pdf");
}

export async function fetchLoanRequestReviewOptions() {
  return apiRequest("/loan-requests/review-options/");
}

export async function fetchLoanRequestFormOptions() {
  return apiRequest("/loan-requests/form-options/");
}

export async function createLoanRequest(payload) {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);
  return apiRequest("/loan-requests/create/", {
    method: "POST",
    body,
  });
}

export async function reviewLoanRequest(requestId, payload) {
  return apiRequest(`/loan-requests/${requestId}/review/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchLoans(params = {}) {
  return apiRequest(`/loans/${buildQuery(params)}`);
}

export async function createLoan(payload) {
  return apiRequest("/loans/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLoan(loanId, payload) {
  return apiRequest(`/loans/${loanId}/update/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchLoanTypes() {
  return apiRequest("/loan-types/");
}

export async function fetchLoanFormOptions() {
  return apiRequest("/loans/form-options/");
}

export async function fetchLoanRepayments(params = {}) {
  return apiRequest(`/loan-repayments/${buildQuery(params)}`);
}

export async function createLoanRepayment(payload) {
  return apiRequest("/loan-repayments/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchLoanRepaymentFormOptions(params = {}) {
  return apiRequest(`/loan-repayments/form-options/${buildQuery(params)}`);
}

export async function fetchSavingCategories(params = {}) {
  return apiRequest(`/saving-categories/${buildQuery(params)}`);
}

export async function fetchMemberSavingCategories(params = {}) {
  return apiRequest(`/saving-categories/member/${buildQuery(params)}`);
}

export async function createSavingCategory(payload) {
  return apiRequest("/saving-categories/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSavingCategory(categoryId, payload) {
  return apiRequest(`/saving-categories/${categoryId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSavingCategory(categoryId) {
  return apiRequest(`/saving-categories/${categoryId}/`, {
    method: "DELETE",
  });
}

export async function fetchSavingChoices(params = {}) {
  return apiRequest(`/saving-choices/${buildQuery(params)}`);
}

export async function createMemberSavingChoice(payload) {
  return apiRequest("/saving-choices/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMySavingChoices(params = {}) {
  return apiRequest(`/saving-choices/me/${buildQuery(params)}`);
}

export async function selectMySavingChoice(payload) {
  return apiRequest("/saving-choices/me/select/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMySavingChoiceChangeRequests(params = {}) {
  return apiRequest(`/saving-choices/me/change-requests/${buildQuery(params)}`);
}

export async function createMySavingChoiceChangeRequest(payload) {
  return apiRequest("/saving-choices/me/change-requests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchSavingChoiceChangeRequests(params = {}) {
  return apiRequest(`/saving-choice-change-requests/${buildQuery(params)}`);
}

export async function createSavingChoiceChangeRequest(payload) {
  return apiRequest("/saving-choice-change-requests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reviewSavingChoiceChangeRequest(requestId, payload) {
  return apiRequest(`/saving-choice-change-requests/${requestId}/review/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMembershipFees(params = {}) {
  return apiRequest(`/membership-fees/${buildQuery(params)}`);
}

export async function exportMembershipFeesPdf(params = {}) {
  return exportPdfFromPath("/membership-fees/export/pdf/", params, "membership_fees_report.pdf");
}

export async function createMembershipFee(payload) {
  return apiRequest("/membership-fees/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMembershipFeeOptions() {
  return apiRequest("/membership-fees/options/");
}

export async function fetchDepartments(params = {}) {
  return apiRequest(`/departments/${buildQuery(params)}`);
}

export async function createDepartment(payload) {
  return apiRequest("/departments/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDepartment(departmentId, payload) {
  return apiRequest(`/departments/${departmentId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDepartment(departmentId) {
  return apiRequest(`/departments/${departmentId}/`, {
    method: "DELETE",
  });
}

export async function fetchEmployees(params = {}) {
  return apiRequest(`/employees/${buildQuery(params)}`);
}

export async function fetchEmployeeOptions() {
  return apiRequest("/employees/options/");
}

export async function createEmployee(payload) {
  return apiRequest("/employees/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEmployee(employeeId, payload) {
  return apiRequest(`/employees/${employeeId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployee(employeeId) {
  return apiRequest(`/employees/${employeeId}/`, {
    method: "DELETE",
  });
}

export async function fetchSalaryPayments(params = {}) {
  return apiRequest(`/salary-payments/${buildQuery(params)}`);
}

export async function exportSalaryPaymentsPdf(params = {}) {
  return exportPdfFromPath("/salary-payments/export/pdf/", params, "salary_payments_report.pdf");
}

export async function fetchSalaryPaymentOptions() {
  return apiRequest("/salary-payments/form-options/");
}

export async function createSalaryPayment(payload) {
  return apiRequest("/salary-payments/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSalaryPayment(paymentId, payload) {
  return apiRequest(`/salary-payments/${paymentId}/update/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSalaryPayment(paymentId) {
  return apiRequest(`/salary-payments/${paymentId}/delete/`, {
    method: "DELETE",
  });
}

export async function fetchMemberExits() {
  return apiRequest("/member-exit/list/");
}

export async function createMemberExit(payload) {
  return apiRequest("/member-exit/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMemberExitOptions() {
  return apiRequest("/member-exit/options/");
}

export async function fetchIncomeCategories() {
  return apiRequest("/income-categories/");
}

export async function createIncomeCategory(payload) {
  return apiRequest("/income-categories/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchIncomes(params = {}) {
  return apiRequest(`/income/${buildQuery(params)}`);
}

export async function exportIncomePdf(params = {}) {
  return exportPdfFromPath("/income/export/pdf/", params, "income_report.pdf");
}

export async function createIncome(payload) {
  return apiRequest("/income/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateIncome(incomeId, payload) {
  return apiRequest(`/income/${incomeId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteIncome(incomeId) {
  return apiRequest(`/income/${incomeId}/`, {
    method: "DELETE",
  });
}

export async function fetchExpenseCategories() {
  return apiRequest("/expense-categories/");
}

export async function createExpenseCategory(payload) {
  return apiRequest("/expense-categories/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchExpenses(params = {}) {
  return apiRequest(`/expenses/${buildQuery(params)}`);
}

export async function exportExpensesPdf(params = {}) {
  return exportPdfFromPath("/expenses/export/pdf/", params, "expenses_report.pdf");
}

export async function createExpense(payload) {
  return apiRequest("/expenses/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateExpense(expenseId, payload) {
  return apiRequest(`/expenses/${expenseId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteExpense(expenseId) {
  return apiRequest(`/expenses/${expenseId}/`, {
    method: "DELETE",
  });
}

export async function fetchExpenseSummary() {
  return apiRequest("/expenses/summary/");
}

export async function fetchFineRules(params = {}) {
  return apiRequest(`/fine-rules/${buildQuery(params)}`);
}

export async function createFineRule(payload) {
  return apiRequest("/fine-rules/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFineRule(ruleId, payload) {
  return apiRequest(`/fine-rules/${ruleId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteFineRule(ruleId) {
  return apiRequest(`/fine-rules/${ruleId}/`, {
    method: "DELETE",
  });
}

export async function fetchFines(params = {}) {
  return apiRequest(`/fines/${buildQuery(params)}`);
}

export async function fetchMyFines(params = {}) {
  return apiRequest(`/fines/me/${buildQuery(params)}`);
}

export async function fetchFineFormOptions() {
  return apiRequest("/fines/form-options/");
}

export async function createFine(payload) {
  return apiRequest("/fines/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFine(fineId, payload) {
  return apiRequest(`/fines/${fineId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function waiveFine(fineId, reason) {
  return apiRequest(`/fines/${fineId}/waive/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function deleteFine(fineId) {
  return apiRequest(`/fines/${fineId}/`, {
    method: "DELETE",
  });
}

export async function createAnnualClosing(payload) {
  return apiRequest("/reports/annual-closing/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAnnualClosings(params = {}) {
  return apiRequest(`/reports/annual-closing/list/${buildQuery(params)}`);
}

export async function fetchMemberProfits(params = {}) {
  return apiRequest(`/reports/member-profits/${buildQuery(params)}`);
}

export async function fetchMemberProfitPayouts(params = {}) {
  return apiRequest(`/reports/member-profit-payouts/${buildQuery(params)}`);
}

export async function createMemberProfitBulkPayout(payload) {
  return apiRequest("/reports/member-profit-payouts/bulk/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMyMemberProfitSummary(params = {}) {
  return apiRequest(`/reports/member-profits/me/summary/${buildQuery(params)}`);
}

export async function exportAnnualClosingPdf(params = {}) {
  return exportPdfFromPath(
    "/reports/annual-closing/export/pdf/",
    params,
    "annual_closing_report.pdf"
  );
}

export async function exportProfitPayoutsPdf(params = {}) {
  return exportPdfFromPath(
    "/reports/member-profit-payouts/export/pdf/",
    params,
    "profit_payouts_report.pdf"
  );
}

export async function fetchMyProfitRequests(params = {}) {
  return apiRequest(`/reports/member-profit-requests/me/${buildQuery(params)}`);
}

export async function createMyProfitRequest(payload) {
  return apiRequest("/reports/member-profit-requests/me/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProfitRequests(params = {}) {
  return apiRequest(`/reports/member-profit-requests/${buildQuery(params)}`);
}

export async function exportProfitRequestsPdf(params = {}) {
  return exportPdfFromPath(
    "/reports/member-profit-requests/export/pdf/",
    params,
    "profit_requests_report.pdf"
  );
}

export async function createProfitRequest(payload) {
  return apiRequest("/reports/member-profit-requests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reviewProfitRequest(requestId, payload) {
  return apiRequest(`/reports/member-profit-requests/${requestId}/review/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMonthlySavings(params = {}) {
  return apiRequest(`/monthly-savings/${buildQuery(params)}`);
}

export async function createMonthlySaving(payload) {
  return apiRequest("/monthly-savings/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createMyLoanRequest(payload) {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);
  return apiRequest("/loan-requests/me/", {
    method: "POST",
    body,
  });
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchMySavings(params = {}) {
  return apiRequest(`/monthly-savings/me/${buildQuery(params)}`);
}

export async function exportMySavingsStatementPdf(params = {}) {
  return exportPdfFromPath(
    "/monthly-savings/me/statement/pdf/",
    params,
    "my_savings_statement.pdf"
  );
}

export async function fetchMyLoans(params = {}) {
  return apiRequest(`/loans/me/${buildQuery(params)}`);
}

export async function fetchMyLoanRepayments(params = {}) {
  return apiRequest(`/loan-repayments/me/${buildQuery(params)}`);
}

export async function fetchMyNotifications(params = {}) {
  return apiRequest(`/notifications/me/${buildQuery(params)}`);
}

export async function fetchNotifications(params = {}) {
  return apiRequest(`/notifications/${buildQuery(params)}`);
}

export async function fetchUnreadNotificationCount() {
  const payload = await fetchMyNotifications({ is_read: "false" });
  if (Array.isArray(payload)) {
    return payload.length;
  }
  if (typeof payload?.count === "number") {
    return payload.count;
  }
  const rows = payload?.results || [];
  return Array.isArray(rows) ? rows.length : 0;
}

export async function markNotificationsRead(notificationId = null) {
  const payload = notificationId ? { notification_id: notificationId } : {};
  return apiRequest("/notifications/read/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function triggerReminderNotifications() {
  return apiRequest("/notifications/trigger-reminders/", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchMyMemberCertificate(params = {}) {
  return apiRequest(`/reports/member-certificate/me/${buildQuery(params)}`);
}

export async function exportMyMemberCertificatePdf(params = {}) {
  return exportPdfFromPath("/reports/member-certificate/me/pdf/", params, "member_certificate.pdf");
}

export async function fetchCertificateApprovals(params = {}) {
  return apiRequest(`/reports/member-certificates/approvals/${buildQuery(params)}`);
}

export async function approveMemberCertificate(payload) {
  return apiRequest("/reports/member-certificates/approvals/approve/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProvinces() {
  return apiRequest("/provinces/");
}

export async function fetchDistricts(provinceId) {
  if (!provinceId) return [];
  return apiRequest(`/districts/?province_id=${provinceId}`);
}

export async function fetchSectors(districtId) {
  if (!districtId) return [];
  return apiRequest(`/sectors/?district_id=${districtId}`);
}

export async function fetchCells(sectorId) {
  if (!sectorId) return [];
  return apiRequest(`/cells/?sector_id=${sectorId}`);
}

export async function fetchVillages(cellId) {
  if (!cellId) return [];
  return apiRequest(`/villages/?cell_id=${cellId}`);
}

export async function createUser(payload) {
  return apiRequest("/users/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(userId, payload) {
  return apiRequest(`/users/${userId}/update/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId) {
  return apiRequest(`/users/${userId}/delete/`, {
    method: "DELETE",
  });
}

export async function resetUserPassword(userId, newPassword) {
  return apiRequest(`/users/${userId}/reset-password/`, {
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function fetchTransactionLogs(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  const path = queryString ? `/transaction-logs/?${queryString}` : "/transaction-logs/";

  return apiRequest(path);
}

export async function exportTransactionLogs(params = {}, format = "csv") {
  const token = getAccessToken();
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  query.set("export_format", String(format));
  query.set("lang", getCurrentLanguageCode());

  const base = API_BASE.replace(/\/+$/, "");
  const withSlash = `${base}/transaction-logs/export/?${query.toString()}`;
  const withoutSlash = `${base}/transaction-logs/export?${query.toString()}`;

  let response;
  try {
    response = await fetch(withSlash, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Accept-Language": getCurrentLanguageCode(),
      },
    });

    // Some deployments are strict on trailing slash; retry once.
    if (response.status === 404) {
      response = await fetch(withoutSlash, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Accept-Language": getCurrentLanguageCode(),
        },
      });
    }
  } catch (_networkError) {
    if (format === "csv" || format === "xlsx") {
      return exportTransactionLogsClientSide(params, format);
    }
    throw new Error("PDF export is unavailable right now.");
  }

  if (!response.ok) {
    let message = `Export failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.error || JSON.stringify(data);
    } catch (_e) {
      // ignore
    }

    // If export endpoint is unavailable, use client-side export fallback.
    const lowerMessage = String(message).toLowerCase();
    if (
      (response.status === 404 || lowerMessage.includes("not found")) &&
      (format === "csv" || format === "xlsx")
    ) {
      return exportTransactionLogsClientSide(params, format);
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const fileName = fileNameMatch ? fileNameMatch[1] : `transaction_logs.${format}`;

  return { blob, fileName };
}

export async function exportMonthlySavingsPdf(params = {}) {
  const token = getAccessToken();
  const query = new URLSearchParams();

  Object.entries({ ...params, lang: getCurrentLanguageCode() }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const base = API_BASE.replace(/\/+$/, "");
  const withSlash = `${base}/monthly-savings/export/pdf/?${query.toString()}`;
  const withoutSlash = `${base}/monthly-savings/export/pdf?${query.toString()}`;

  let response = await fetch(withSlash, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Accept-Language": getCurrentLanguageCode(),
    },
  });

  if (response.status === 404) {
    response = await fetch(withoutSlash, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Accept-Language": getCurrentLanguageCode(),
      },
    });
  }

  if (!response.ok) {
    let message = `Export failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.error || JSON.stringify(data);
    } catch (_e) {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const fileName = fileNameMatch ? fileNameMatch[1] : "monthly_savings_report.pdf";
  return { blob, fileName };
}

async function exportPdfFromPath(path, params = {}, defaultFileName = "report.pdf") {
  const token = getAccessToken();
  const query = new URLSearchParams();

  Object.entries({ ...params, lang: getCurrentLanguageCode() }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const base = API_BASE.replace(/\/+$/, "");
  const cleanedPath = path.replace(/^\/+/, "");
  const withSlash = `${base}/${cleanedPath}${
    cleanedPath.endsWith("/") ? "" : "/"
  }?${query.toString()}`;
  const withoutSlash = `${base}/${cleanedPath.replace(/\/$/, "")}?${query.toString()}`;

  let response = await fetch(withSlash, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Accept-Language": getCurrentLanguageCode(),
    },
  });

  if (response.status === 404) {
    response = await fetch(withoutSlash, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Accept-Language": getCurrentLanguageCode(),
      },
    });
  }

  if (!response.ok) {
    let message = `Export failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.error || JSON.stringify(data);
    } catch (_e) {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const fileName = fileNameMatch ? fileNameMatch[1] : defaultFileName;
  return { blob, fileName };
}

export async function exportLoansPdf(params = {}) {
  return exportPdfFromPath("/loans/export/pdf/", params, "loans_report.pdf");
}

export async function exportLoanRepaymentsPdf(params = {}) {
  return exportPdfFromPath("/loan-repayments/export/pdf/", params, "loan_repayments_report.pdf");
}

export async function exportFinesPdf(params = {}) {
  return exportPdfFromPath("/fines/export/pdf/", params, "fines_report.pdf");
}

async function exportTransactionLogsClientSide(params = {}, format = "csv") {
  const pageSize = 200;
  let page = 1;
  let allRows = [];
  let hasMore = true;

  while (hasMore) {
    const resp = await fetchTransactionLogs({
      ...params,
      page,
      page_size: pageSize,
    });

    const rows = Array.isArray(resp) ? resp : resp.results || [];
    allRows = allRows.concat(rows);

    if (Array.isArray(resp)) {
      hasMore = false;
    } else {
      hasMore = Boolean(resp.next);
      page += 1;
    }
  }

  const headers = [
    "timestamp",
    "user",
    "transaction_type",
    "action",
    "related_model",
    "related_object_id",
    "amount",
    "description",
    "ip_address",
  ];

  const normalized = allRows.map((item) =>
    headers.map((key) => {
      const value = item?.[key];
      return value === null || value === undefined ? "" : String(value);
    })
  );

  if (format === "xlsx") {
    const tsv = [headers.join("\t"), ...normalized.map((row) => row.join("\t"))].join("\n");
    const blob = new Blob([tsv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    return { blob, fileName: "transaction_logs.xls" };
  }

  const escapeCsv = (value) => {
    const escaped = String(value).replace(/"/g, '""');
    return `"${escaped}"`;
  };
  const csv = [headers.join(","), ...normalized.map((row) => row.map(escapeCsv).join(","))].join(
    "\n"
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  return { blob, fileName: "transaction_logs.csv" };
}

export async function updateMyProfile(payload) {
  return apiRequest("/users/profile/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changeMyPassword(oldPassword, newPassword) {
  return apiRequest("/change-password/", {
    method: "POST",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });
}
