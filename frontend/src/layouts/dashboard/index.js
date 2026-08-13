/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import InputAdornment from "@mui/material/InputAdornment";
import Icon from "components/AppIcon";
import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import DefaultDoughnutChart from "examples/Charts/DoughnutCharts/DefaultDoughnutChart";

import { createMyLoanRequest, fetchDashboardData, fetchLoanTypes } from "services/api";
import { useLanguage } from "i18n";

const FORM_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
};

const FORM_BUTTON_SX = { minHeight: 56, height: 56 };
const FILTER_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
};

function Dashboard() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState({
    summary: null,
    members: [],
    clients: [],
    savings: [],
    loans: [],
    profits: [],
    loanRequests: [],
    profile: null,
    role: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestTermMode, setRequestTermMode] = useState("MONTHS");
  const [requestTermMonths, setRequestTermMonths] = useState("1");
  const [requestTermDays, setRequestTermDays] = useState("");
  const [requestPurpose, setRequestPurpose] = useState("");
  const [requestLoanType, setRequestLoanType] = useState(null);
  const [loanTypeOptions, setLoanTypeOptions] = useState([]);
  const [requestApplicationForm, setRequestApplicationForm] = useState(null);
  const [requestIdCopy, setRequestIdCopy] = useState(null);
  const [requestGuaranteeCheque, setRequestGuaranteeCheque] = useState(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [chartFromDraft, setChartFromDraft] = useState("");
  const [chartToDraft, setChartToDraft] = useState("");
  const [chartFrom, setChartFrom] = useState("");
  const [chartTo, setChartTo] = useState("");

  const isMember = data.role === "MEMBER";
  const isClient = data.role === "CLIENT";
  const isAdmin = data.role === "ADMIN";
  const isStaff = !isMember && !isClient;
  const isOperationalStaff = isStaff && !isAdmin;
  const requestAmountNumber = Number(requestAmount || 0);
  const requestTermMonthsNumber = Number(requestTermMonths || 0);
  const requestTermDaysNumber = Number(requestTermDays || 0);
  const isDaysMode = requestTermMode === "DAYS";
  const effectiveTermNumber = isDaysMode ? requestTermDaysNumber : requestTermMonthsNumber;
  const requestRateNumber = Number(requestLoanType?.interest_rate || 0);
  const requestDailyRate = requestRateNumber / 30;
  const estimatedMonthlyInterest = Math.round((requestAmountNumber * requestRateNumber) / 100);
  const estimatedDailyInterest = Math.round((requestAmountNumber * requestDailyRate) / 100);
  const estimatedTotalPayable = Math.round(
    requestAmountNumber +
      (isDaysMode
        ? (requestAmountNumber * requestDailyRate * requestTermDaysNumber) / 100
        : (requestAmountNumber * requestRateNumber * requestTermMonthsNumber) / 100)
  );
  const estimatedInstallment =
    effectiveTermNumber > 0 ? Math.round(estimatedTotalPayable / effectiveTermNumber) : 0;

  const parseDateOnly = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getSavingDate = (item) => {
    if (item?.saved_on) return parseDateOnly(item.saved_on);
    const month = Number(item?.month || 0);
    const year = Number(item?.year || 0);
    if (year > 0 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1);
    }
    return null;
  };

  const getLoanDate = (item) => parseDateOnly(item?.issued_date);

  const inSelectedRange = (date) => {
    if (!date) return !chartFrom && !chartTo;
    const fromDate = chartFrom ? parseDateOnly(chartFrom) : null;
    const toDate = chartTo ? parseDateOnly(chartTo) : null;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetchDashboardData();
      setData(resp);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!isMember && !isClient) return;
    fetchLoanTypes()
      .then((items) => setLoanTypeOptions(Array.isArray(items) ? items : []))
      .catch(() => setLoanTypeOptions([]));
  }, [isMember, isClient]);

  const summary = data.summary || {};
  const adminMemberStats = useMemo(() => {
    const members = Array.isArray(data.members) ? data.members : [];
    const active = members.filter((item) => item?.is_active).length;
    return {
      total: members.length,
      active,
      inactive: members.length - active,
    };
  }, [data.members]);

  const adminClientStats = useMemo(() => {
    const clients = Array.isArray(data.clients) ? data.clients : [];
    const active = clients.filter((item) => item?.is_active).length;
    return {
      total: clients.length,
      active,
      inactive: clients.length - active,
    };
  }, [data.clients]);

  const adminLoanStats = useMemo(() => {
    const loans = Array.isArray(data.loans) ? data.loans : [];
    const ongoing = loans.filter((item) => String(item?.status).toUpperCase() === "ONGOING").length;
    const paid = loans.filter((item) => String(item?.status).toUpperCase() === "PAID").length;
    const defaulted = loans.filter(
      (item) => String(item?.status).toUpperCase() === "DEFAULTED"
    ).length;
    const principalTotal = loans.reduce(
      (acc, item) => acc + Number(item?.principal_amount || 0),
      0
    );
    return { ongoing, paid, defaulted, principalTotal };
  }, [data.loans]);

  const monthLabels = useMemo(() => {
    const locale = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "rw-RW";
    return Array.from({ length: 12 }, (_v, index) =>
      new Date(2026, index, 1).toLocaleString(locale, { month: "short" })
    );
  }, [lang]);

  const filteredSavings = useMemo(() => {
    const savings = Array.isArray(data.savings) ? data.savings : [];
    return savings.filter((item) => inSelectedRange(getSavingDate(item)));
  }, [data.savings, chartFrom, chartTo]);

  const filteredLoans = useMemo(() => {
    const loans = Array.isArray(data.loans) ? data.loans : [];
    return loans.filter((item) => inSelectedRange(getLoanDate(item)));
  }, [data.loans, chartFrom, chartTo]);

  const savingsTrendData = useMemo(() => {
    const records = filteredSavings;
    const totals = Array(12).fill(0);
    records.forEach((item) => {
      const month = Number(item?.month || 0);
      if (month < 1 || month > 12) return;
      totals[month - 1] += Number(item?.amount_paid || 0);
    });

    return {
      labels: monthLabels,
      datasets: {
        label: t("monthlySavings"),
        data: totals,
      },
    };
  }, [filteredSavings, monthLabels, t]);

  const loanStatusChartData = useMemo(() => {
    const records = filteredLoans;
    const counts = {
      ongoing: 0,
      paid: 0,
      defaulted: 0,
    };

    records.forEach((item) => {
      const status = String(item?.status || "").toUpperCase();
      if (status === "PAID") counts.paid += 1;
      else if (status === "DEFAULTED") counts.defaulted += 1;
      else counts.ongoing += 1;
    });

    return {
      labels: [t("ongoingLoans"), t("paidLoans"), t("defaultedLoans")],
      datasets: {
        label: t("loans"),
        data: [counts.ongoing, counts.paid, counts.defaulted],
        backgroundColors: ["info", "success", "error"],
      },
    };
  }, [filteredLoans, t]);

  const loanOwnerDistributionChartData = useMemo(() => {
    const counts = { members: 0, clients: 0 };
    filteredLoans.forEach((item) => {
      const hasMember = Boolean(item?.member || item?.member_id || item?.member_name);
      const hasClient = Boolean(item?.client || item?.client_id || item?.client_name);
      if (hasMember) counts.members += 1;
      else if (hasClient) counts.clients += 1;
    });
    return {
      labels: [t("memberBorrowers"), t("clientBorrowers")],
      datasets: {
        label: t("borrowersDistribution"),
        data: [counts.members, counts.clients],
        backgroundColors: ["info", "dark"],
      },
    };
  }, [filteredLoans, t]);

  const repaymentProgressChartData = useMemo(() => {
    let repaidAmount = 0;
    let remainingAmount = 0;
    filteredLoans.forEach((item) => {
      const total = Number(item?.total_amount || item?.principal_amount || 0);
      const remaining = Number(item?.remaining_balance || 0);
      const paid = Math.max(total - remaining, 0);
      repaidAmount += paid;
      remainingAmount += Math.max(remaining, 0);
    });
    return {
      labels: [t("repaidAmount"), t("remainingAmount")],
      datasets: {
        label: t("repaymentProgress"),
        data: [repaidAmount, remainingAmount],
        backgroundColors: ["success", "warning"],
      },
    };
  }, [filteredLoans, t]);

  const chartRangeStats = useMemo(() => {
    const totalSavingsInRange = filteredSavings.reduce(
      (acc, item) => acc + Number(item?.amount_paid || 0),
      0
    );
    const totalLoanInterestInRange = filteredLoans.reduce((acc, item) => {
      const total = Number(item?.total_amount || 0);
      const principal = Number(item?.principal_amount || 0);
      return acc + Math.max(total - principal, 0);
    }, 0);
    const estimatedProfitInRange = totalSavingsInRange + totalLoanInterestInRange;
    return {
      totalSavingsInRange,
      totalLoanInterestInRange,
      estimatedProfitInRange,
      loansCountInRange: filteredLoans.length,
    };
  }, [filteredSavings, filteredLoans]);

  const profitMixChartData = useMemo(
    () => ({
      labels: [t("totalSavings"), t("loanInterest")],
      datasets: {
        label: t("savingsVsInterest"),
        data: [chartRangeStats.totalSavingsInRange, chartRangeStats.totalLoanInterestInRange],
        backgroundColors: ["info", "success"],
      },
    }),
    [chartRangeStats.totalSavingsInRange, chartRangeStats.totalLoanInterestInRange, t]
  );
  const profitLabel = t("netProfit");
  const rwfLabel = t("rwf");
  const chartProfitDescription = `${profitLabel}: ${chartRangeStats.estimatedProfitInRange.toLocaleString()} ${rwfLabel}`;

  const hasChartData = filteredSavings.length > 0 || filteredLoans.length > 0;

  const recentMembers = useMemo(() => {
    const members = Array.isArray(data.members) ? data.members : [];
    return [...members].slice(0, 5);
  }, [data.members]);

  const recentLoans = useMemo(() => {
    const loans = Array.isArray(data.loans) ? data.loans : [];
    return [...loans].slice(0, 5);
  }, [data.loans]);

  const getLoanStatusLabel = (status) => {
    const normalized = String(status || "").toUpperCase();
    const statusMap = {
      ONGOING: t("ongoing"),
      PAID: t("paid"),
      DEFAULTED: t("defaulted"),
      PENDING: t("pending"),
      APPROVED: t("approved"),
      REJECTED: t("rejected"),
    };
    return statusMap[normalized] || status || "-";
  };

  const loanRows = useMemo(
    () =>
      (data.loans || []).map((loan) => ({
        id: loan.id,
        type: loan.loan_type_name || loan.loan_type,
        principal: loan.principal_amount,
        total: loan.total_amount,
        remaining: loan.remaining_balance,
        status: getLoanStatusLabel(loan.status),
        issued: loan.issued_date || "-",
      })),
    [data.loans, t]
  );

  const submitLoanRequest = async (event) => {
    event.preventDefault();
    setRequestSaving(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("requested_amount", String(Number(requestAmount)));
      if (isDaysMode) {
        payload.append("requested_term_months", "1");
        payload.append("requested_term_days", String(Number(requestTermDays || 0)));
      } else {
        payload.append("requested_term_months", String(Number(requestTermMonths || 1)));
      }
      payload.append("purpose", requestPurpose || "");
      if (requestLoanType?.id) {
        payload.append("requested_loan_type", String(requestLoanType.id));
      }
      if (requestApplicationForm) {
        payload.append("application_form", requestApplicationForm);
      }
      if (requestIdCopy) {
        payload.append("id_copy", requestIdCopy);
      }
      if (requestGuaranteeCheque) {
        payload.append("guarantee_cheque", requestGuaranteeCheque);
      }
      await createMyLoanRequest(payload);
      setRequestOpen(false);
      setRequestAmount("");
      setRequestTermMode("MONTHS");
      setRequestTermMonths("1");
      setRequestTermDays("");
      setRequestPurpose("");
      setRequestLoanType(null);
      setRequestApplicationForm(null);
      setRequestIdCopy(null);
      setRequestGuaranteeCheque(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestSaving(false);
    }
  };

  const applyChartDateRange = () => {
    setChartFrom(chartFromDraft || "");
    setChartTo(chartToDraft || "");
  };

  const clearChartDateRange = () => {
    setChartFromDraft("");
    setChartToDraft("");
    setChartFrom("");
    setChartTo("");
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        {error && (
          <MDBox mb={2}>
            <Alert severity="error">{error}</Alert>
          </MDBox>
        )}

        {loading && (
          <MDBox mb={2}>
            <Alert severity="info">{t("loading")}</Alert>
          </MDBox>
        )}

        {isAdmin ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="info"
                icon="groups"
                title={t("members")}
                count={adminMemberStats.total}
                percentage={{ color: "success", amount: "", label: t("activeMembers") }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="primary"
                icon="person_add"
                title={t("clients")}
                count={adminClientStats.total}
                percentage={{ color: "success", amount: "", label: t("activeClients") }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="success"
                icon="account_balance"
                title={t("loans")}
                count={adminLoanStats.ongoing}
                percentage={{ color: "dark", amount: "", label: t("ongoingLoans") }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="dark"
                icon="paid"
                title={t("netProfit")}
                count={summary.net_profit ?? 0}
                percentage={{ color: "info", amount: "", label: t("rwf") }}
              />
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="dark"
                icon="savings"
                title={t("totalSavings")}
                count={isClient ? 0 : summary.total_savings ?? 0}
                percentage={{ color: "info", amount: "", label: t("rwf") }}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="info"
                icon="groups"
                title={isMember ? t("membersShares") : t("loanCount")}
                count={isMember ? summary.total_shares ?? 0 : summary.loan_count ?? 0}
                percentage={{
                  color: "success",
                  amount: "",
                  label: isMember ? t("shares") : t("loans"),
                }}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="success"
                icon="account_balance"
                title={t("loans")}
                count={summary.loan_count ?? 0}
                percentage={{ color: "dark", amount: "", label: t("active") }}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="primary"
                icon="paid"
                title={isMember ? t("myProfit") : t("loanInterest")}
                count={isMember ? summary.member_profit ?? 0 : summary.loan_interest ?? 0}
                percentage={{ color: "success", amount: "", label: t("rwf") }}
              />
            </Grid>
          </Grid>
        )}

        {(isMember || isClient) && (
          <MDBox mt={4}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" mb={2}>
                  {t("loanDetails")}
                </MDTypography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("loanId")}</TableCell>
                        <TableCell>{t("type")}</TableCell>
                        <TableCell>{t("principal")}</TableCell>
                        <TableCell>{t("amount")}</TableCell>
                        <TableCell>{t("remainingBalance")}</TableCell>
                        <TableCell>{t("status")}</TableCell>
                        <TableCell>{t("joinedOn")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loanRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <MDTypography variant="button" color="text">
                              {t("noRecordsModule")}
                            </MDTypography>
                          </TableCell>
                        </TableRow>
                      )}
                      {loanRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.id}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell>{row.principal}</TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.remaining}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{row.issued}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MDBox>
            </Card>
          </MDBox>
        )}

        <MDBox mt={4}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">{t("chartFilterByDate")}</MDTypography>
              <MDTypography variant="button" color="text">
                {t("chartRangeApplied")}
              </MDTypography>
              <Grid container spacing={2} mt={0.5}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t("from")}
                    value={chartFromDraft}
                    onChange={(event) => setChartFromDraft(event.target.value)}
                    sx={FILTER_FIELD_SX}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t("to")}
                    value={chartToDraft}
                    onChange={(event) => setChartToDraft(event.target.value)}
                    sx={FILTER_FIELD_SX}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <MDBox display="flex" gap={1} height="100%">
                    <MDButton
                      variant="gradient"
                      color="info"
                      sx={{ ...FORM_BUTTON_SX, flex: 1, minWidth: 0 }}
                      onClick={applyChartDateRange}
                    >
                      {t("apply")}
                    </MDButton>
                    <MDButton
                      variant="outlined"
                      color="secondary"
                      sx={{ ...FORM_BUTTON_SX, flex: 1, minWidth: 0 }}
                      onClick={clearChartDateRange}
                    >
                      {t("clear")}
                    </MDButton>
                  </MDBox>
                </Grid>
              </Grid>
            </MDBox>
          </Card>
        </MDBox>

        {hasChartData ? (
          <MDBox mt={4.5}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={7}>
                <ReportsBarChart
                  color="info"
                  title={t("savingsTrendChart")}
                  description={t("savingsTrendChartSubtitle")}
                  date={
                    chartFrom || chartTo
                      ? `${chartFrom || "..."} - ${chartTo || "..."}`
                      : t("chartRolling12Months")
                  }
                  chart={savingsTrendData}
                />
              </Grid>
              <Grid item xs={12} lg={5}>
                <DefaultDoughnutChart
                  icon={{ color: "dark", component: "donut_small" }}
                  title={t("loanStatusDistributionChart")}
                  description={t("loanStatusDistributionChartSubtitle")}
                  chart={loanStatusChartData}
                />
              </Grid>
              <Grid item xs={12} lg={4}>
                <DefaultDoughnutChart
                  icon={{ color: "info", component: "pie_chart" }}
                  title={t("borrowersDistribution")}
                  description={`${t("loans")}: ${chartRangeStats.loansCountInRange}`}
                  chart={loanOwnerDistributionChartData}
                />
              </Grid>
              <Grid item xs={12} lg={4}>
                <DefaultDoughnutChart
                  icon={{ color: "success", component: "payments" }}
                  title={t("repaymentProgress")}
                  description={t("loanRepaymentsSubtitle")}
                  chart={repaymentProgressChartData}
                />
              </Grid>
              <Grid item xs={12} lg={4}>
                <DefaultDoughnutChart
                  icon={{ color: "warning", component: "insights" }}
                  title={t("cooperativeProfitEstimate")}
                  description={chartProfitDescription}
                  chart={profitMixChartData}
                />
              </Grid>
            </Grid>
          </MDBox>
        ) : (
          <MDBox mt={3}>
            <Alert severity="info">{t("noDataInRange")}</Alert>
          </MDBox>
        )}

        {(isMember || isClient) && (
          <MDBox mt={4}>
            <Card>
              <MDBox p={3} display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <MDTypography variant="h6">{t("loanRequests")}</MDTypography>
                <MDButton variant="gradient" color="info" onClick={() => setRequestOpen(true)}>
                  {t("requestLoan")}
                </MDButton>
              </MDBox>
              <MDBox px={3} pb={3}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("time")}</TableCell>
                        <TableCell>{t("amount")}</TableCell>
                        <TableCell>{t("details")}</TableCell>
                        <TableCell>{t("status")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.loanRequests || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <MDTypography variant="button" color="text">
                              {t("noRecordsModule")}
                            </MDTypography>
                          </TableCell>
                        </TableRow>
                      )}
                      {(data.loanRequests || []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.requested_on).toLocaleString()}</TableCell>
                          <TableCell>{item.requested_amount}</TableCell>
                          <TableCell>
                            {(item.requested_loan_type_name || "-") +
                              " | " +
                              (item.effective_term_value ||
                                item.requested_term_days ||
                                item.requested_term_months ||
                                1) +
                              " " +
                              (item.term_mode === "DAYS" || item.requested_term_days
                                ? t("days")
                                : t("months"))}
                          </TableCell>
                          <TableCell>{item.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MDBox>
            </Card>
          </MDBox>
        )}

        {isOperationalStaff && (
          <MDBox mt={4} p={3} borderRadius="lg" bgColor="white">
            <MDTypography variant="h6" mb={1}>
              {t("quickOverview")}
            </MDTypography>
            <MDTypography variant="button" color="text">
              {t("savingsRecords")}: {data.savings.length}
            </MDTypography>
            <br />
            <MDTypography variant="button" color="text">
              {t("loansRecords")}: {data.loans.length}
            </MDTypography>
            <br />
            <MDTypography variant="button" color="text">
              {t("netProfit")}: {summary.net_profit ?? 0} {t("rwf")}
            </MDTypography>
          </MDBox>
        )}

        {isAdmin && (
          <MDBox mt={4}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h6" mb={2}>
                      {t("adminQuickActions")}
                    </MDTypography>
                    <MDBox display="flex" flexWrap="wrap" gap={1}>
                      <MDButton variant="outlined" color="info" onClick={() => navigate("/users")}>
                        {t("users")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="info"
                        onClick={() => navigate("/members")}
                      >
                        {t("members")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="info"
                        onClick={() => navigate("/clients")}
                      >
                        {t("clients")}
                      </MDButton>
                      <MDButton variant="outlined" color="info" onClick={() => navigate("/loans")}>
                        {t("loans")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="info"
                        onClick={() => navigate("/transaction-logs")}
                      >
                        {t("transactionLogs")}
                      </MDButton>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h6">{t("membersClientsOverview")}</MDTypography>
                    <MDTypography variant="button" color="text" display="block" mt={1}>
                      {t("totalMembers")}: {adminMemberStats.total}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block">
                      {t("activeMembers")}: {adminMemberStats.active}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block">
                      {t("inactiveMembers")}: {adminMemberStats.inactive}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block" mt={1}>
                      {t("totalClients")}: {adminClientStats.total}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block">
                      {t("activeClients")}: {adminClientStats.active}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block">
                      {t("inactiveClients")}: {adminClientStats.inactive}
                    </MDTypography>
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h6">{t("loanPortfolio")}</MDTypography>
                    <MDTypography variant="button" color="text" display="block" mt={1}>
                      {t("ongoingLoans")}: {adminLoanStats.ongoing}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block">
                      {t("paidLoans")}: {adminLoanStats.paid}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block">
                      {t("defaultedLoans")}: {adminLoanStats.defaulted}
                    </MDTypography>
                    <MDTypography variant="button" color="text" display="block" mt={1}>
                      {t("principal")}: {adminLoanStats.principalTotal.toLocaleString()} {t("rwf")}
                    </MDTypography>
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h6" mb={1}>
                      {t("recentMembers")}
                    </MDTypography>
                    {recentMembers.length === 0 && (
                      <MDTypography variant="button" color="text">
                        {t("noRecordsModule")}
                      </MDTypography>
                    )}
                    {recentMembers.map((item) => (
                      <MDTypography
                        key={item.id || item.national_id}
                        variant="caption"
                        display="block"
                        color="text"
                      >
                        {(item.national_id || "-") + " | " + (item.account_number || "-")}
                      </MDTypography>
                    ))}
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h6" mb={1}>
                      {t("recentLoans")}
                    </MDTypography>
                    {recentLoans.length === 0 && (
                      <MDTypography variant="button" color="text">
                        {t("noRecordsModule")}
                      </MDTypography>
                    )}
                    {recentLoans.map((item) => (
                      <MDTypography key={item.id} variant="caption" display="block" color="text">
                        {"#" +
                          item.id +
                          " | " +
                          Number(item.principal_amount || 0).toLocaleString() +
                          " " +
                          t("rwf")}
                      </MDTypography>
                    ))}
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
          </MDBox>
        )}
      </MDBox>

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("requestLoan")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="loan-request-form" onSubmit={submitLoanRequest} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={loanTypeOptions}
                  value={requestLoanType}
                  onChange={(_event, value) => setRequestLoanType(value)}
                  getOptionLabel={(option) => option?.name || "-"}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      fullWidth
                      label={t("loanType")}
                      sx={FORM_FIELD_SX}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              account_balance
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  required
                  fullWidth
                  sx={FORM_FIELD_SX}
                  label={t("amount")}
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value.replace(/\D/g, ""))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          payments
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  required
                  select
                  fullWidth
                  sx={FORM_FIELD_SX}
                  label={t("termMode")}
                  value={requestTermMode}
                  onChange={(e) => setRequestTermMode(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          tune
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value="MONTHS">{t("termByMonths")}</MenuItem>
                  <MenuItem value="DAYS">{t("termByDays")}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  required
                  fullWidth
                  sx={FORM_FIELD_SX}
                  label={isDaysMode ? t("termDays") : t("termMonths")}
                  value={isDaysMode ? requestTermDays : requestTermMonths}
                  onChange={(e) =>
                    isDaysMode
                      ? setRequestTermDays(e.target.value.replace(/\D/g, ""))
                      : setRequestTermMonths(e.target.value.replace(/\D/g, ""))
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          schedule
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t("details")}
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  multiline
                  minRows={3}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.7rem",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
                    },
                  }}
                />
              </Grid>
              {requestLoanType && requestAmountNumber > 0 && effectiveTermNumber > 0 && (
                <Grid item xs={12}>
                  <MDBox p={2} borderRadius="lg" bgColor="light">
                    <MDTypography variant="button" display="block">
                      {isDaysMode ? t("dailyInterest") : t("monthlyInterest")}:{" "}
                      {(isDaysMode
                        ? estimatedDailyInterest
                        : estimatedMonthlyInterest
                      ).toLocaleString()}{" "}
                      {t("rwf")}
                    </MDTypography>
                    {isDaysMode && (
                      <MDTypography variant="button" display="block">
                        {t("dailyInterestRate")}: {requestDailyRate.toFixed(4)}%
                      </MDTypography>
                    )}
                    <MDTypography variant="button" display="block">
                      {t("estimatedTotalPayable")}: {estimatedTotalPayable.toLocaleString()}{" "}
                      {t("rwf")}
                    </MDTypography>
                    <MDTypography variant="button" display="block">
                      {isDaysMode
                        ? t("estimatedDailyInstallment")
                        : t("estimatedMonthlyInstallment")}
                      : {estimatedInstallment.toLocaleString()} {t("rwf")}
                    </MDTypography>
                  </MDBox>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="file"
                  sx={FORM_FIELD_SX}
                  inputProps={{ accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" }}
                  onChange={(e) => setRequestApplicationForm(e.target.files?.[0] || null)}
                  InputLabelProps={{ shrink: true }}
                  label={t("loanRequestFormFile")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          description
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="file"
                  sx={FORM_FIELD_SX}
                  inputProps={{ accept: ".pdf,.jpg,.jpeg,.png" }}
                  onChange={(e) => setRequestIdCopy(e.target.files?.[0] || null)}
                  InputLabelProps={{ shrink: true }}
                  label={t("idCopyFile")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          badge
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="file"
                  sx={FORM_FIELD_SX}
                  inputProps={{ accept: ".pdf,.jpg,.jpeg,.png" }}
                  onChange={(e) => setRequestGuaranteeCheque(e.target.files?.[0] || null)}
                  InputLabelProps={{ shrink: true }}
                  label={t("guaranteeChequeFile")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          request_quote
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={FORM_BUTTON_SX}
            onClick={() => setRequestOpen(false)}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="loan-request-form"
            variant="gradient"
            color="info"
            sx={FORM_BUTTON_SX}
            disabled={
              requestSaving ||
              !requestAmount ||
              !requestLoanType ||
              (isDaysMode ? !requestTermDays : !requestTermMonths)
            }
          >
            {requestSaving ? t("loading") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default Dashboard;
