import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import HintButton from "components/HintButton";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import ContextBanner from "components/ContextBanner";
import {
  FORM_ACTION_BUTTON_SX,
  FORM_DIALOG_ACTIONS_SX,
  FORM_DIALOG_CONTENT_SX,
  FORM_DIALOG_PAPER_SX,
  FORM_DIALOG_TITLE_BAR_SX,
  FORM_DIALOG_TITLE_SX,
} from "components/FormDialog/styles";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createLoanRepayment,
  exportLoanRepaymentsPdf,
  fetchCurrentUser,
  fetchLoanFormOptions,
  fetchLoanRepaymentFormOptions,
  fetchLoanRepayments,
  fetchLoanTypes,
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
  "& .MuiInputBase-input": {
    paddingTop: "16.5px !important",
    paddingBottom: "16.5px !important",
  },
};

const HEADER_ACTION_BUTTON_SX = {
  minHeight: 56,
  height: 56,
  px: 2.5,
};

const OWNER_TYPE_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "MEMBER", labelKey: "members" },
  { id: "CLIENT", labelKey: "clients" },
];

const LOAN_STATUS_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "ONGOING", labelKey: "unpaidLoans" },
  { id: "PAID", labelKey: "paidLoans" },
  { id: "DEFAULTED", labelKey: "overdueLoans" },
];

const INITIAL_FORM = {
  loan: null,
  principal_amount: "",
  interest_amount: "",
};

const INITIAL_FILTERS = {
  search: "",
  owner_type: "ALL",
  owner_id: "",
  loan_status: "ALL",
  loan_type: "",
  date_from: "",
  date_to: "",
};

function LoanRepaymentsPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [loanOptions, setLoanOptions] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [contextOwnerId, setContextOwnerId] = useState(null);
  const [contextOwnerType, setContextOwnerType] = useState("");
  const [contextOwnerName, setContextOwnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const currentRole = String(user?.effective_role || user?.role || "").toUpperCase();
  const canCreate = ["ADMIN", "TELLER"].includes(currentRole);

  const selectedLoan = useMemo(
    () => loanOptions.find((item) => Number(item.id) === Number(form.loan)) || null,
    [loanOptions, form.loan]
  );
  const filterOwnerOptions = useMemo(() => {
    if (filters.owner_type === "CLIENT") return clientOptions;
    if (filters.owner_type === "MEMBER") return memberOptions;
    return [];
  }, [clientOptions, filters.owner_type, memberOptions]);
  const selectedFilterOwner = useMemo(
    () => filterOwnerOptions.find((item) => String(item.id) === String(filters.owner_id)) || null,
    [filterOwnerOptions, filters.owner_id]
  );
  const totalAmount = Number(form.principal_amount || 0) + Number(form.interest_amount || 0);

  const summary = useMemo(() => {
    const totalRepayments = items.length;
    const totalRepaid = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const principalRepaid = items.reduce(
      (acc, item) => acc + Number(item.principal_amount || 0),
      0
    );
    const interestIncome = items.reduce((acc, item) => acc + Number(item.interest_amount || 0), 0);
    return { totalRepayments, totalRepaid, principalRepaid, interestIncome };
  }, [items]);

  const resetForm = () => setForm(INITIAL_FORM);

  const loadUser = async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (_err) {
      setUser(null);
    }
  };

  const loadData = async (customFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        search: customFilters.search || undefined,
        owner_type: customFilters.owner_type !== "ALL" ? customFilters.owner_type : undefined,
        owner_id: customFilters.owner_id || undefined,
        loan_status: customFilters.loan_status !== "ALL" ? customFilters.loan_status : undefined,
        loan_type: customFilters.loan_type || undefined,
        date_from: customFilters.date_from || undefined,
        date_to: customFilters.date_to || undefined,
      };
      const [repaymentPayload, optionsPayload, loanTypePayload, ownerOptionsPayload] =
        await Promise.all([
          fetchLoanRepayments(params),
          canCreate
            ? fetchLoanRepaymentFormOptions({
                owner_type: params.owner_type,
                owner_id: params.owner_id,
              })
            : Promise.resolve({ loans: [] }),
          fetchLoanTypes(),
          fetchLoanFormOptions(),
        ]);
      setItems(Array.isArray(repaymentPayload) ? repaymentPayload : []);
      setLoanOptions(Array.isArray(optionsPayload?.loans) ? optionsPayload.loans : []);
      setLoanTypes(Array.isArray(loanTypePayload) ? loanTypePayload : []);
      setMemberOptions(
        Array.isArray(ownerOptionsPayload?.members) ? ownerOptionsPayload.members : []
      );
      setClientOptions(
        Array.isArray(ownerOptionsPayload?.clients) ? ownerOptionsPayload.clients : []
      );
    } catch (err) {
      notify("error", t("information"), err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadData(INITIAL_FILTERS);
  }, [user]);

  useEffect(() => {
    if (!user || location.state?.action !== "create") return;

    const ownerType = String(location.state?.ownerType || "").toUpperCase();
    const ownerId = Number(location.state?.ownerId || 0);
    if (!ownerType || !ownerId) return;

    const nextFilters = {
      ...INITIAL_FILTERS,
      owner_type: ownerType,
      owner_id: String(ownerId),
    };

    setContextOwnerId(ownerId);
    setContextOwnerType(ownerType);
    setContextOwnerName(String(location.state?.ownerName || ""));
    setFilters(nextFilters);
    resetForm();
    setCreateOpen(canCreate);
    loadData(nextFilters);
    navigate(location.pathname, { replace: true, state: {} });
  }, [canCreate, location.pathname, location.state, navigate, user]);

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    setContextOwnerId(null);
    setContextOwnerType("");
    setContextOwnerName("");
    await loadData(INITIAL_FILTERS);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = {
        search: filters.search || undefined,
        owner_type: filters.owner_type !== "ALL" ? filters.owner_type : undefined,
        owner_id: filters.owner_id || undefined,
        loan_status: filters.loan_status !== "ALL" ? filters.loan_status : undefined,
        loan_type: filters.loan_type || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      };
      const { blob, fileName } = await exportLoanRepaymentsPdf(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createLoanRepayment({
        loan: Number(form.loan),
        principal_amount: Number(form.principal_amount),
        interest_amount: Number(form.interest_amount),
        amount: Number(totalAmount),
      });
      notify("success", t("confirmation"), t("loanRepaymentCreatedSuccess"));
      setCreateOpen(false);
      resetForm();
      await loadData(filters);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("loan"), accessor: "loan", align: "left" },
      { Header: t("owner"), accessor: "loan_owner", align: "left" },
      { Header: t("ownerType"), accessor: "loan_owner_type", align: "left" },
      { Header: t("loanType"), accessor: "loan_type_name", align: "left" },
      { Header: t("dueDate"), accessor: "loan_due_date", align: "left" },
      { Header: t("remainingBalance"), accessor: "loan_remaining_balance", align: "left" },
      { Header: t("principalPart"), accessor: "principal_amount", align: "left" },
      { Header: t("interestPart"), accessor: "interest_amount", align: "left" },
      { Header: t("totalPayment"), accessor: "amount", align: "left" },
      { Header: t("paidOn"), accessor: "paid_on", align: "left" },
      { Header: t("status"), accessor: "loan_status", align: "left" },
    ];

    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      loan: <MDTypography variant="caption">#{item.loan}</MDTypography>,
      loan_owner: <MDTypography variant="caption">{item.loan_owner || "-"}</MDTypography>,
      loan_owner_type: <MDTypography variant="caption">{item.loan_owner_type || "-"}</MDTypography>,
      loan_type_name: <MDTypography variant="caption">{item.loan_type_name || "-"}</MDTypography>,
      loan_due_date: <MDTypography variant="caption">{item.loan_due_date || "-"}</MDTypography>,
      loan_remaining_balance: (
        <MDTypography
          variant="caption"
          color={Number(item.loan_remaining_balance || 0) > 0 ? "warning" : "success"}
        >
          {Number(item.loan_remaining_balance || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      principal_amount: (
        <MDTypography variant="caption">
          {Number(item.principal_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      interest_amount: (
        <MDTypography variant="caption">
          {Number(item.interest_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      amount: (
        <MDTypography variant="caption" fontWeight="bold">
          {Number(item.amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      paid_on: <MDTypography variant="caption">{item.paid_on || "-"}</MDTypography>,
      loan_status: <MDTypography variant="caption">{item.loan_status || "-"}</MDTypography>,
    }));

    return { columns, rows };
  }, [items, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox
                  display="flex"
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  flexDirection={{ xs: "column", md: "row" }}
                  gap={2}
                >
                  <MDBox>
                    <MDTypography variant="h6">{t("loanRepayments")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("loanRepaymentsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1.5} flexWrap="wrap">
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={HEADER_ACTION_BUTTON_SX}
                      onClick={handleExportPdf}
                      disabled={exporting || loading || items.length === 0}
                      hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                    >
                      {exporting ? t("loading") : t("exportPdf")}
                    </HintButton>
                    {canCreate && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={HEADER_ACTION_BUTTON_SX}
                        onClick={() => {
                          resetForm();
                          setCreateOpen(true);
                        }}
                      >
                        {t("addLoanRepayment")}
                      </MDButton>
                    )}
                  </MDBox>
                </MDBox>

                <Grid container spacing={2} mt={1}>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("totalRepayments")}</MDTypography>
                      <MDTypography variant="h5">{summary.totalRepayments}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("totalPayment")}</MDTypography>
                      <MDTypography variant="h5">
                        {Number(summary.totalRepaid).toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("principalPart")}</MDTypography>
                      <MDTypography variant="h5">
                        {Number(summary.principalRepaid).toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="success">
                        {t("loanInterest")}
                      </MDTypography>
                      <MDTypography variant="h5" color="success">
                        {Number(summary.interestIncome).toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <Grid container spacing={2} mt={1}>
                  {contextOwnerId && contextOwnerType && (
                    <Grid item xs={12}>
                      <ContextBanner
                        icon="payments"
                        title={t("loanRepayments")}
                        subtitle={`${contextOwnerType === "CLIENT" ? t("client") : t("member")}: ${
                          contextOwnerName || "#"
                        }`}
                        clearLabel={t("clear")}
                        onClear={handleClearFilters}
                        mb={1}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      sx={FORM_FIELD_SX}
                      label={t("search")}
                      value={filters.search}
                      onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={OWNER_TYPE_OPTIONS}
                      value={
                        OWNER_TYPE_OPTIONS.find((item) => item.id === filters.owner_type) || null
                      }
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, owner_type: value?.id || "ALL" }))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label={t("ownerType")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={filterOwnerOptions}
                      value={selectedFilterOwner}
                      disabled={filters.owner_type === "ALL"}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          owner_id: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) =>
                        option.label ||
                        option.full_name ||
                        option.username ||
                        option.national_id ||
                        option.account_number ||
                        "-"
                      }
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label={t("owner")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={LOAN_STATUS_OPTIONS}
                      value={
                        LOAN_STATUS_OPTIONS.find((item) => item.id === filters.loan_status) || null
                      }
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, loan_status: value?.id || "ALL" }))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label={t("status")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={1.5}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={loanTypes}
                      value={
                        loanTypes.find((item) => String(item.id) === String(filters.loan_type)) ||
                        null
                      }
                      onChange={(_event, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          loan_type: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) => option.name || "-"}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label={t("loanType")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <TextField
                      fullWidth
                      type="date"
                      sx={FORM_FIELD_SX}
                      label={t("from")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <TextField
                      fullWidth
                      type="date"
                      sx={FORM_FIELD_SX}
                      label={t("to")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.date_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={2.5}>
                    <MDBox display="flex" gap={1}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{ minHeight: 56, height: 56, flex: 1 }}
                        onClick={handleApplyFilters}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        sx={{ minHeight: 56, height: 56, flex: 1 }}
                        onClick={handleClearFilters}
                      >
                        {t("clear")}
                      </MDButton>
                    </MDBox>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <DataTable
                  table={table}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch={false}
                  noEndBorder
                />
                {loading && (
                  <MDTypography variant="caption" color="text">
                    {t("loading")}
                  </MDTypography>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("addLoanRepayment")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox component="form" id="create-loan-repayment-form" onSubmit={handleCreate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={FORM_FIELD_SX}
                  options={loanOptions}
                  value={selectedLoan}
                  onChange={(_event, value) =>
                    setForm((prev) => ({
                      ...prev,
                      loan: value?.id || null,
                    }))
                  }
                  getOptionLabel={(option) => option.label || "-"}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("loan")}
                      placeholder={t("search")}
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

              {selectedLoan && (
                <Grid item xs={12}>
                  <MDBox
                    p={2}
                    sx={{
                      border: "1px solid #dbe5f0",
                      borderRadius: "0.75rem",
                      backgroundColor: "#f7fbff",
                    }}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <MDTypography variant="button" fontWeight="bold" color="dark">
                          {t("owner")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedLoan.owner_name}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDTypography variant="button" fontWeight="bold" color="dark">
                          {t("loanType")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedLoan.loan_type_name}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDTypography variant="button" fontWeight="bold" color="warning">
                          {t("remainingPrincipal")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="warning">
                          {Number(selectedLoan.remaining_principal || 0).toLocaleString()}{" "}
                          {t("rwf")}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDTypography variant="button" fontWeight="bold" color="text">
                          {t("dueDate")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedLoan.due_date || "-"}
                        </MDTypography>
                      </Grid>
                    </Grid>
                  </MDBox>
                </Grid>
              )}

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label={t("principalPart")}
                  value={form.principal_amount}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      principal_amount: e.target.value.replace(/\D/g, ""),
                    }))
                  }
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
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label={t("interestPart")}
                  value={form.interest_amount}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      interest_amount: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          percent
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  disabled
                  label={t("totalPayment")}
                  value={totalAmount ? `${Number(totalAmount).toLocaleString()} ${t("rwf")}` : ""}
                  sx={FORM_FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          calculate
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={FORM_ACTION_BUTTON_SX}
            onClick={() => setCreateOpen(false)}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="create-loan-repayment-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={saving || !form.loan || !form.principal_amount}
          >
            {saving ? t("creating") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <MDSnackbar
        color={snackbar.color}
        icon="notifications"
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

export default LoanRepaymentsPage;
