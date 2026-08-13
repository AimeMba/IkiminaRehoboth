import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import Icon from "components/AppIcon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import HintButton from "components/HintButton";
import MDInput from "components/MDInput";
import MemberPageHero from "components/MemberPageHero";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createMyLoanRequest,
  exportMySavingsStatementPdf,
  fetchLoanTypes,
  fetchMyFines,
  fetchMyLoanRepayments,
  fetchMyLoanRequests,
  fetchMyLoans,
  fetchMySavings,
} from "services/api";
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
const SECTION_CARD_SX = {
  overflow: "hidden",
  border: "1px solid rgba(15, 42, 92, 0.08)",
  boxShadow: "0 18px 38px rgba(15, 42, 92, 0.08)",
};

function MyRecordsPage({ mode = "savings" }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    date_from: "",
    date_to: "",
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestTermMode, setRequestTermMode] = useState("MONTHS");
  const [requestTermMonths, setRequestTermMonths] = useState("1");
  const [requestTermDays, setRequestTermDays] = useState("");
  const [requestLoanType, setRequestLoanType] = useState(null);
  const [loanTypeOptions, setLoanTypeOptions] = useState([]);
  const [requestPurpose, setRequestPurpose] = useState("");
  const [requestApplicationForm, setRequestApplicationForm] = useState(null);
  const [requestIdCopy, setRequestIdCopy] = useState(null);
  const [requestGuaranteeCheque, setRequestGuaranteeCheque] = useState(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const pageMeta = useMemo(() => {
    if (mode === "loans") {
      return {
        title: t("myLoansHistory"),
        subtitle: t("myLoansHistorySubtitle"),
        icon: "account_balance",
      };
    }
    if (mode === "repayments") {
      return {
        title: t("myRepaymentsHistory"),
        subtitle: t("myRepaymentsHistorySubtitle"),
        icon: "payments",
      };
    }
    if (mode === "loan-requests") {
      return {
        title: t("myLoanRequests"),
        subtitle: t("myLoanRequestsHistorySubtitle"),
        icon: "request_quote",
      };
    }
    if (mode === "fines") {
      return {
        title: t("myFinesHistory"),
        subtitle: t("myFinesHistorySubtitle"),
        icon: "gavel",
      };
    }
    return {
      title: t("mySavingsHistory"),
      subtitle: t("mySavingsHistorySubtitle"),
      icon: "savings",
    };
  }, [mode, t]);
  const canCreateLoanRequest = mode === "loan-requests";
  const canExportSavingsStatement = mode === "savings";
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
  const estimatedMonthlyInstallment =
    effectiveTermNumber > 0 ? Math.round(estimatedTotalPayable / effectiveTermNumber) : 0;

  const loadData = async (nextFilters = filters) => {
    setLoading(true);
    try {
      let data = [];
      if (mode === "loans") {
        data = await fetchMyLoans(nextFilters);
      } else if (mode === "repayments") {
        data = await fetchMyLoanRepayments(nextFilters);
      } else if (mode === "loan-requests") {
        data = await fetchMyLoanRequests();
      } else if (mode === "fines") {
        data = await fetchMyFines(nextFilters);
      } else {
        data = await fetchMySavings(nextFilters);
      }
      setRows(Array.isArray(data) ? data : data?.results || []);
      setAppliedFilters(nextFilters);
    } catch (error) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  useEffect(() => {
    if (mode !== "loan-requests") return;
    fetchLoanTypes()
      .then((items) => setLoanTypeOptions(Array.isArray(items) ? items : []))
      .catch(() => setLoanTypeOptions([]));
  }, [mode]);

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

  const formatCurrency = (value) => `${Number(value || 0).toLocaleString()} ${t("rwf")}`;

  const heroStats = useMemo(() => {
    if (mode === "loans") {
      const totalPayment = rows.reduce((sum, item) => {
        return sum + Number(item.total_amount || 0);
      }, 0);
      const ongoingCount = rows.filter((item) => {
        return String(item.status || "").toUpperCase() === "ONGOING";
      }).length;
      const paidCount = rows.filter((item) => {
        return String(item.status || "").toUpperCase() === "PAID";
      }).length;

      return [
        { label: t("records"), value: rows.length, tone: "info" },
        { label: t("totalPayment"), value: formatCurrency(totalPayment), tone: "success" },
        { label: t("ongoing"), value: ongoingCount, tone: "warning" },
        { label: t("paid"), value: paidCount, tone: "dark" },
      ];
    }

    if (mode === "loan-requests") {
      const requestedAmount = rows.reduce((sum, item) => {
        return sum + Number(item.requested_amount || 0);
      }, 0);
      const pendingCount = rows.filter((item) => {
        return String(item.status || "").toUpperCase() === "PENDING";
      }).length;
      const approvedCount = rows.filter((item) => {
        return String(item.status || "").toUpperCase() === "APPROVED";
      }).length;

      return [
        { label: t("records"), value: rows.length, tone: "info" },
        { label: t("requestedAmount"), value: formatCurrency(requestedAmount), tone: "success" },
        { label: t("pending"), value: pendingCount, tone: "warning" },
        { label: t("approved"), value: approvedCount, tone: "dark" },
      ];
    }

    if (mode === "repayments") {
      const repaidAmount = rows.reduce((sum, item) => {
        return sum + Number(item.amount || 0);
      }, 0);

      return [
        { label: t("records"), value: rows.length, tone: "info" },
        { label: t("repaidAmount"), value: formatCurrency(repaidAmount), tone: "success" },
        { label: t("paid"), value: rows.length, tone: "dark" },
      ];
    }

    if (mode === "fines") {
      const totalAmount = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const pendingCount = rows.filter((item) => {
        return (
          !item.is_paid && !item.is_waived && String(item.status || "").toUpperCase() !== "PAID"
        );
      }).length;
      const waivedCount = rows.filter((item) => item.is_waived).length;
      return [
        { label: t("records"), value: rows.length, tone: "info" },
        { label: t("amount"), value: formatCurrency(totalAmount), tone: "success" },
        { label: t("pending"), value: pendingCount, tone: "warning" },
        { label: t("waived"), value: waivedCount, tone: "dark" },
      ];
    }

    const totalSavings = rows.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    return [
      { label: t("records"), value: rows.length, tone: "info" },
      { label: t("totalSavings"), value: formatCurrency(totalSavings), tone: "success" },
      { label: t("paid"), value: rows.length, tone: "dark" },
    ];
  }, [mode, rows, t]);

  const table = useMemo(() => {
    const columnsCommon =
      mode === "loans"
        ? [
            { Header: t("loanType"), accessor: "loan_type", align: "left" },
            { Header: t("repaymentTerm"), accessor: "repayment_term", align: "left" },
            { Header: t("principalAmount"), accessor: "principal_amount", align: "left" },
            { Header: t("totalPayment"), accessor: "total_amount", align: "left" },
            { Header: t("status"), accessor: "status", align: "left" },
            { Header: t("actions"), accessor: "actions", align: "center" },
          ]
        : [
            { Header: t("time"), accessor: "date", align: "left" },
            { Header: t("details"), accessor: "details", align: "left" },
            { Header: t("amount"), accessor: "amount", align: "left" },
            { Header: t("status"), accessor: "status", align: "left" },
            { Header: t("actions"), accessor: "actions", align: "center" },
          ];

    const mappedRows = rows.map((item) => {
      let dateValue = "-";
      let detailsValue = "-";
      let amountValue = "-";
      let statusValue = "-";

      if (mode === "loans") {
        const isDays = item.term_mode === "DAYS" || Number(item.term_days || 0) > 0;
        const termValue = item.effective_term_value || item.term_days || item.term_months || 1;
        detailsValue = `${termValue} ${isDays ? t("days") : t("months")}`;
        amountValue = `${Number(item.total_amount || 0).toLocaleString()} ${t("rwf")}`;
        statusValue = getLoanStatusLabel(item.status);
      } else if (mode === "loan-requests") {
        dateValue = item.requested_on || "-";
        detailsValue = `${item.requested_loan_type_name || "-"} | ${
          item.effective_term_value || item.requested_term_days || item.requested_term_months || 1
        } ${item.term_mode === "DAYS" || item.requested_term_days ? t("days") : t("months")} | ${
          item.purpose || "-"
        }`;
        amountValue = item.requested_amount ?? "-";
        statusValue = getLoanStatusLabel(item.status);
      } else if (mode === "repayments") {
        dateValue = item.paid_on || "-";
        detailsValue = `${t("loanId")} #${item.loan || "-"}`;
        amountValue = item.amount ?? "-";
        statusValue = t("paid");
      } else if (mode === "fines") {
        dateValue = item.calculated_on || "-";
        detailsValue = `${item.rule_name || t("fines")} | ${item.rule_type || "-"}`;
        amountValue = item.amount ?? "-";
        statusValue = item.is_waived ? t("waived") : item.is_paid ? t("paid") : t("pending");
      } else {
        dateValue = item.saved_on || "-";
        detailsValue = `${t("monthlySavings")} ${item.month || "-"} / ${item.year || "-"}`;
        amountValue = item.amount_paid ?? "-";
        statusValue = t("paid");
      }

      if (mode === "loans") {
        return {
          loan_type: <MDTypography variant="caption">{item.loan_type_name || "-"}</MDTypography>,
          repayment_term: <MDTypography variant="caption">{detailsValue}</MDTypography>,
          principal_amount: (
            <MDTypography variant="caption">
              {Number(item.principal_amount || 0).toLocaleString()} {t("rwf")}
            </MDTypography>
          ),
          total_amount: <MDTypography variant="caption">{amountValue}</MDTypography>,
          status: <MDTypography variant="caption">{statusValue}</MDTypography>,
          actions: (
            <Tooltip title={t("view")}>
              <IconButton color="info" size="small" onClick={() => setSelectedItem(item)}>
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
            </Tooltip>
          ),
        };
      }

      return {
        date: <MDTypography variant="caption">{dateValue}</MDTypography>,
        details: <MDTypography variant="caption">{detailsValue}</MDTypography>,
        amount: <MDTypography variant="caption">{amountValue}</MDTypography>,
        status: <MDTypography variant="caption">{statusValue}</MDTypography>,
        actions: (
          <Tooltip title={t("view")}>
            <IconButton color="info" size="small" onClick={() => setSelectedItem(item)}>
              <Icon fontSize="small">visibility</Icon>
            </IconButton>
          </Tooltip>
        ),
      };
    });

    return { columns: columnsCommon, rows: mappedRows };
  }, [mode, rows, t]);

  const applyFilters = () => {
    loadData(filters);
  };

  const clearFilters = () => {
    const next = { date_from: "", date_to: "" };
    setFilters(next);
    loadData(next);
  };

  const resetLoanRequestForm = () => {
    setRequestAmount("");
    setRequestTermMode("MONTHS");
    setRequestTermMonths("1");
    setRequestTermDays("");
    setRequestLoanType(null);
    setRequestPurpose("");
    setRequestApplicationForm(null);
    setRequestIdCopy(null);
    setRequestGuaranteeCheque(null);
  };

  const submitLoanRequest = async (event) => {
    event.preventDefault();
    setRequestSaving(true);
    try {
      const payload = new FormData();
      payload.append("requested_amount", String(Number(requestAmount || 0)));
      if (isDaysMode) {
        payload.append("requested_term_months", "1");
        payload.append("requested_term_days", String(Number(requestTermDays || 0)));
      } else {
        payload.append("requested_term_months", String(Number(requestTermMonths || 1)));
      }
      if (requestLoanType?.id) {
        payload.append("requested_loan_type", String(requestLoanType.id));
      }
      payload.append("purpose", requestPurpose || "");
      if (requestApplicationForm) payload.append("application_form", requestApplicationForm);
      if (requestIdCopy) payload.append("id_copy", requestIdCopy);
      if (requestGuaranteeCheque) payload.append("guarantee_cheque", requestGuaranteeCheque);
      await createMyLoanRequest(payload);
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: t("loanRequestCreatedSuccess"),
      });
      setRequestOpen(false);
      resetLoanRequestForm();
      await loadData(filters);
    } catch (error) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: error.message,
      });
    } finally {
      setRequestSaving(false);
    }
  };

  const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportSavingsStatement = async () => {
    if (!canExportSavingsStatement || rows.length === 0) return;

    setExporting(true);
    try {
      const { blob, fileName } = await exportMySavingsStatementPdf(appliedFilters);
      downloadBlob(blob, fileName);
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: `${t("exportedFile")}: ${fileName}`,
      });
    } catch (error) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: error.message,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <MemberPageHero
              icon={pageMeta.icon}
              title={pageMeta.title}
              subtitle={pageMeta.subtitle}
              stats={heroStats}
              actions={
                <>
                  {canExportSavingsStatement && (
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={FORM_BUTTON_SX}
                      disabled={loading || exporting || rows.length === 0}
                      onClick={handleExportSavingsStatement}
                      hint={!loading && !exporting && rows.length === 0 ? t("noDataToExport") : ""}
                    >
                      {exporting ? t("loading") : t("exportStatement")}
                    </HintButton>
                  )}
                  {canCreateLoanRequest ? (
                    <MDButton
                      variant="gradient"
                      color="info"
                      sx={FORM_BUTTON_SX}
                      onClick={() => setRequestOpen(true)}
                    >
                      {t("requestLoan")}
                    </MDButton>
                  ) : null}
                </>
              }
            />
          </Grid>
          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              <MDBox p={3}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      label={t("from")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      label={t("to")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.date_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={4} display="flex" alignItems="flex-end" gap={1}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={applyFilters}
                      disabled={loading}
                    >
                      {t("apply")}
                    </MDButton>
                    <MDButton
                      variant="outlined"
                      color="secondary"
                      onClick={clearFilters}
                      disabled={loading}
                    >
                      {t("clear")}
                    </MDButton>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              <MDBox p={3}>
                <DataTable
                  table={table}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("requestLoan")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="my-loan-request-form" onSubmit={submitLoanRequest} mt={1}>
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
                  label={t("requestedAmount")}
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
                      : {estimatedMonthlyInstallment.toLocaleString()} {t("rwf")}
                    </MDTypography>
                  </MDBox>
                </Grid>
              )}
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
            form="my-loan-request-form"
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

      <Dialog
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("details")}</DialogTitle>
        <DialogContent>
          <MDBox
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              fontSize: "0.8rem",
              mb: 0,
              mt: 0,
            }}
          >
            {selectedItem ? JSON.stringify(selectedItem, null, 2) : ""}
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={() => setSelectedItem(null)}>
            {t("cancel")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <MDSnackbar
        color={snackbar.color}
        icon={<Icon fontSize="small">notifications</Icon>}
        title={snackbar.title || t("information")}
        dateTime={new Date().toLocaleTimeString()}
        content={snackbar.content}
        open={snackbar.open}
        close={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />

      <Footer />
    </DashboardLayout>
  );
}

MyRecordsPage.propTypes = {
  mode: PropTypes.oneOf(["savings", "loans", "loan-requests", "repayments", "fines"]),
};

MyRecordsPage.defaultProps = {
  mode: "savings",
};

export default MyRecordsPage;
