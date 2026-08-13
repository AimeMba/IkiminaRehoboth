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
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import HintButton from "components/HintButton";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import ContextBanner from "components/ContextBanner";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createLoan,
  exportLoansPdf,
  fetchCurrentUser,
  fetchLoanFormOptions,
  fetchLoans,
  fetchLoanTypes,
  updateLoan,
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

const STATUS_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "PAID", labelKey: "paidLoans" },
  { id: "UNPAID", labelKey: "unpaidLoans" },
  { id: "OVERDUE", labelKey: "overdueLoans" },
  { id: "NEAR_DUE", labelKey: "nearDueLoans" },
];

const OWNER_TYPE_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "MEMBER", labelKey: "members" },
  { id: "CLIENT", labelKey: "clients" },
];

const INITIAL_FILTERS = {
  search: "",
  status_group: "ALL",
  owner_type: "ALL",
  owner_id: "",
  loan_type: "",
  due_from: "",
  due_to: "",
};

const INITIAL_FORM = {
  owner_type: "MEMBER",
  owner_id: null,
  loan_type: null,
  principal_amount: "",
  due_date: "",
};

function LoansPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [contextOwnerId, setContextOwnerId] = useState("");
  const [contextOwnerType, setContextOwnerType] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const currentRole = String(user?.effective_role || user?.role || "").toUpperCase();
  const canManage = ["ADMIN", "LOAN_OFFICER"].includes(currentRole);

  const ownerOptions = form.owner_type === "CLIENT" ? clientOptions : memberOptions;
  const filterOwnerOptions = filters.owner_type === "CLIENT" ? clientOptions : memberOptions;
  const selectedOwner = useMemo(
    () => ownerOptions.find((item) => Number(item.id) === Number(form.owner_id)) || null,
    [ownerOptions, form.owner_id]
  );
  const selectedFilterOwner = useMemo(
    () => filterOwnerOptions.find((item) => String(item.id) === String(filters.owner_id)) || null,
    [filterOwnerOptions, filters.owner_id]
  );
  const selectedLoanType = useMemo(
    () => loanTypes.find((item) => Number(item.id) === Number(form.loan_type)) || null,
    [loanTypes, form.loan_type]
  );
  const ownerDisplayName =
    selectedOwner?.full_name || selectedOwner?.label || selectedOwner?.username || "-";

  const resetForm = () => setForm(INITIAL_FORM);

  const loadUser = async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (_err) {
      setUser(null);
    }
  };

  const buildFilterParams = () => ({
    search: filters.search || undefined,
    status_group: filters.status_group !== "ALL" ? filters.status_group : undefined,
    owner_type: filters.owner_type !== "ALL" ? filters.owner_type : undefined,
    loan_type: filters.loan_type || undefined,
    due_from: filters.due_from || undefined,
    due_to: filters.due_to || undefined,
  });

  const loadData = async (customFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        search: customFilters.search || undefined,
        status_group: customFilters.status_group !== "ALL" ? customFilters.status_group : undefined,
        owner_type: customFilters.owner_type !== "ALL" ? customFilters.owner_type : undefined,
        owner_id: customFilters.owner_id || undefined,
        loan_type: customFilters.loan_type || undefined,
        due_from: customFilters.due_from || undefined,
        due_to: customFilters.due_to || undefined,
      };
      const [loanPayload, loanTypePayload, optionsPayload] = await Promise.all([
        fetchLoans(params),
        fetchLoanTypes(),
        canManage ? fetchLoanFormOptions() : Promise.resolve({ members: [], clients: [] }),
      ]);

      setItems(Array.isArray(loanPayload) ? loanPayload : []);
      setLoanTypes(Array.isArray(loanTypePayload) ? loanTypePayload : []);
      setMemberOptions(Array.isArray(optionsPayload?.members) ? optionsPayload.members : []);
      setClientOptions(Array.isArray(optionsPayload?.clients) ? optionsPayload.clients : []);
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
    const action = location.state?.action;
    const ownerType = location.state?.ownerType;
    const ownerId = location.state?.ownerId;
    if (!canManage || action !== "create" || !ownerType || !ownerId) return;

    const nextFilters = {
      ...INITIAL_FILTERS,
      owner_type: ownerType,
      owner_id: String(ownerId),
    };
    setFilters(nextFilters);
    setContextOwnerType(ownerType);
    setContextOwnerId(String(ownerId));
    loadData(nextFilters);
    setForm({
      ...INITIAL_FORM,
      owner_type: ownerType,
      owner_id: Number(ownerId),
    });
    setCreateOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [canManage, location.pathname, location.state, navigate]);

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    setContextOwnerId("");
    setContextOwnerType("");
    await loadData(INITIAL_FILTERS);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = {
        search: filters.search || undefined,
        status_group: filters.status_group !== "ALL" ? filters.status_group : undefined,
        owner_type: filters.owner_type !== "ALL" ? filters.owner_type : undefined,
        owner_id: filters.owner_id || undefined,
        loan_type: filters.loan_type || undefined,
        due_from: filters.due_from || undefined,
        due_to: filters.due_to || undefined,
      };
      const { blob, fileName } = await exportLoansPdf(params);
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

  const getRequestOriginLabel = (origin) => {
    if (origin === "SELF") return t("selfRequested");
    if (origin === "ON_BEHALF") return t("requestedOnBehalf");
    return t("directEntry");
  };

  const getLoanStatusLabel = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PAID") return t("paid");
    if (normalized === "ONGOING") return t("ongoing");
    if (normalized === "DEFAULTED") return t("defaulted");
    return status || "-";
  };

  const formatLoanTerm = (item) => {
    const isDays = item.term_mode === "DAYS" || Number(item.term_days || 0) > 0;
    const termValue = item.effective_term_value || item.term_days || item.term_months || 1;
    return `${termValue} ${isDays ? t("days") : t("months")}`;
  };

  const openEdit = (item) => {
    setSelectedItem(item);
    setForm({
      owner_type: item.member ? "MEMBER" : "CLIENT",
      owner_id: item.member || item.client || null,
      loan_type: item.loan_type || null,
      principal_amount: String(item.principal_amount || ""),
      due_date: item.due_date || "",
    });
    setEditOpen(true);
  };

  const buildPayload = () => {
    const payload = {
      loan_type: Number(form.loan_type),
      principal_amount: Number(form.principal_amount),
      due_date: form.due_date || null,
    };
    if (form.owner_type === "MEMBER") {
      payload.member = Number(form.owner_id);
      payload.client = null;
    } else {
      payload.client = Number(form.owner_id);
      payload.member = null;
    }
    return payload;
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createLoan(buildPayload());
      notify("success", t("confirmation"), t("loanCreatedSuccess"));
      setCreateOpen(false);
      resetForm();
      await loadData(filters);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedItem) return;
    setSaving(true);
    try {
      await updateLoan(selectedItem.id, buildPayload());
      notify("success", t("confirmation"), t("loanUpdatedSuccess"));
      setEditOpen(false);
      setSelectedItem(null);
      resetForm();
      await loadData(filters);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const total = items.length;
    const paid = items.filter((item) => item.status === "PAID").length;
    const unpaid = items.filter((item) => item.status !== "PAID").length;
    const overdue = items.filter((item) => item.is_overdue).length;
    const nearDue = items.filter((item) => item.is_near_due).length;
    return { total, paid, unpaid, overdue, nearDue };
  }, [items]);

  const loanTypeBreakdown = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.loan_type_name || "-";
      const row = map.get(key) || {
        loan_type_name: key,
        total: 0,
        paid: 0,
        unpaid: 0,
        overdue: 0,
      };
      row.total += 1;
      if (item.status === "PAID") {
        row.paid += 1;
      } else {
        row.unpaid += 1;
      }
      if (item.is_overdue) {
        row.overdue += 1;
      }
      map.set(key, row);
    });
    return Array.from(map.values());
  }, [items]);

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("owner"), accessor: "owner_name", align: "left" },
      { Header: t("ownerType"), accessor: "owner_type", align: "left" },
      { Header: t("loanType"), accessor: "loan_type_name", align: "left" },
      { Header: t("repaymentTerm"), accessor: "repayment_term", align: "left" },
      { Header: t("principalAmount"), accessor: "principal_amount", align: "left" },
      { Header: t("totalPayment"), accessor: "total_amount", align: "left" },
      { Header: t("interestRate"), accessor: "interest_rate", align: "left" },
      { Header: t("requestType"), accessor: "request_origin", align: "left" },
      { Header: t("requestedBy"), accessor: "requested_by_name", align: "left" },
      { Header: t("issuedDate"), accessor: "issued_date", align: "left" },
      { Header: t("dueDate"), accessor: "due_date", align: "left" },
      { Header: t("remainingBalance"), accessor: "remaining_balance", align: "left" },
      { Header: t("loanProgress"), accessor: "progress", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      ...(canManage ? [{ Header: t("actions"), accessor: "actions", align: "center" }] : []),
    ];

    const rows = items.map((item) => {
      const progress =
        item.status === "PAID"
          ? t("paidLoans")
          : item.is_overdue
          ? t("overdueLoans")
          : item.is_near_due
          ? t("nearDueLoans")
          : t("unpaidLoans");
      const progressColor =
        item.status === "PAID"
          ? "success"
          : item.is_overdue
          ? "error"
          : item.is_near_due
          ? "warning"
          : "info";
      const row = {
        id: <MDTypography variant="caption">#{item.id}</MDTypography>,
        owner_name: <MDTypography variant="caption">{item.owner_name || "-"}</MDTypography>,
        owner_type: <MDTypography variant="caption">{item.owner_type || "-"}</MDTypography>,
        loan_type_name: <MDTypography variant="caption">{item.loan_type_name || "-"}</MDTypography>,
        repayment_term: <MDTypography variant="caption">{formatLoanTerm(item)}</MDTypography>,
        principal_amount: (
          <MDTypography variant="caption">
            {Number(item.principal_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        total_amount: (
          <MDTypography variant="caption" color="info">
            {Number(item.total_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        interest_rate: (
          <MDTypography variant="caption">{Number(item.interest_rate || 0)}%</MDTypography>
        ),
        request_origin: (
          <MDTypography
            variant="caption"
            color={
              item.request_origin === "SELF"
                ? "success"
                : item.request_origin === "ON_BEHALF"
                ? "warning"
                : "info"
            }
          >
            {getRequestOriginLabel(item.request_origin)}
          </MDTypography>
        ),
        requested_by_name: (
          <MDTypography variant="caption">{item.requested_by_name || "-"}</MDTypography>
        ),
        issued_date: <MDTypography variant="caption">{item.issued_date || "-"}</MDTypography>,
        due_date: <MDTypography variant="caption">{item.due_date || "-"}</MDTypography>,
        remaining_balance: (
          <MDTypography
            variant="caption"
            color={Number(item.remaining_balance || 0) > 0 ? "warning" : "success"}
          >
            {Number(item.remaining_balance || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        progress: (
          <MDTypography variant="caption" color={progressColor}>
            {progress}
          </MDTypography>
        ),
        status: <MDTypography variant="caption">{getLoanStatusLabel(item.status)}</MDTypography>,
      };

      if (canManage) {
        row.actions = (
          <MDBox display="flex" alignItems="center" justifyContent="center" gap={0.5}>
            <Tooltip title={t("edit")}>
              <IconButton color="info" size="small" onClick={() => openEdit(item)}>
                <Icon fontSize="small">edit</Icon>
              </IconButton>
            </Tooltip>
          </MDBox>
        );
      }

      return row;
    });

    return { columns, rows };
  }, [items, canManage, t]);

  const breakdownTable = useMemo(() => {
    const columns = [
      { Header: t("loanType"), accessor: "loan_type_name", align: "left" },
      { Header: t("totalLoans"), accessor: "total", align: "left" },
      { Header: t("paidLoans"), accessor: "paid", align: "left" },
      { Header: t("unpaidLoans"), accessor: "unpaid", align: "left" },
      { Header: t("overdueLoans"), accessor: "overdue", align: "left" },
    ];
    const rows = loanTypeBreakdown.map((item) => ({
      loan_type_name: <MDTypography variant="caption">{item.loan_type_name}</MDTypography>,
      total: <MDTypography variant="caption">{item.total}</MDTypography>,
      paid: (
        <MDTypography variant="caption" color="success">
          {item.paid}
        </MDTypography>
      ),
      unpaid: (
        <MDTypography variant="caption" color="warning">
          {item.unpaid}
        </MDTypography>
      ),
      overdue: (
        <MDTypography variant="caption" color="error">
          {item.overdue}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [loanTypeBreakdown, t]);

  const renderForm = (formId, onSubmit) => (
    <MDBox component="form" id={formId} onSubmit={onSubmit} mt={1}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Autocomplete
            popupIcon={<Icon fontSize="small">expand_more</Icon>}
            sx={FORM_FIELD_SX}
            options={[
              { id: "MEMBER", label: t("members") },
              { id: "CLIENT", label: t("clients") },
            ]}
            value={[
              { id: "MEMBER", label: t("members") },
              { id: "CLIENT", label: t("clients") },
            ].find((option) => option.id === form.owner_type)}
            onChange={(_event, value) =>
              setForm((prev) => ({
                ...prev,
                owner_type: value?.id || "MEMBER",
                owner_id: null,
              }))
            }
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("ownerType")}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon fontSize="small" color="info">
                        badge
                      </Icon>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            popupIcon={<Icon fontSize="small">expand_more</Icon>}
            sx={FORM_FIELD_SX}
            options={ownerOptions}
            value={selectedOwner}
            onChange={(_event, value) =>
              setForm((prev) => ({
                ...prev,
                owner_id: value?.id || null,
              }))
            }
            getOptionLabel={(option) => option.label || "-"}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("owner")}
                placeholder={t("search")}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon fontSize="small" color="info">
                        person
                      </Icon>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            popupIcon={<Icon fontSize="small">expand_more</Icon>}
            sx={FORM_FIELD_SX}
            options={loanTypes}
            value={selectedLoanType}
            onChange={(_event, value) =>
              setForm((prev) => ({
                ...prev,
                loan_type: value?.id || null,
              }))
            }
            getOptionLabel={(option) => option.name || "-"}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("loanType")}
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
        {selectedOwner && (
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
                    {ownerDisplayName}
                  </MDTypography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <MDTypography variant="button" fontWeight="bold" color="dark">
                    {t("nationalId")}:
                  </MDTypography>
                  <MDTypography variant="button" display="block" color="text">
                    {form.owner_type === "MEMBER"
                      ? selectedOwner?.national_id || "-"
                      : selectedOwner?.national_id || "-"}
                  </MDTypography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <MDTypography variant="button" fontWeight="bold" color="dark">
                    {t("account")}:
                  </MDTypography>
                  <MDTypography variant="button" display="block" color="text">
                    {selectedOwner?.account_number || "-"}
                  </MDTypography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <MDTypography variant="button" fontWeight="bold" color="dark">
                    {t("phone")}:
                  </MDTypography>
                  <MDTypography variant="button" display="block" color="text">
                    {selectedOwner?.phone || "-"}
                  </MDTypography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <MDTypography variant="button" fontWeight="bold" color="dark">
                    {t("address")}:
                  </MDTypography>
                  <MDTypography variant="button" display="block" color="text">
                    {selectedOwner?.address_name || "-"}
                  </MDTypography>
                </Grid>
                {form.owner_type === "MEMBER" && (
                  <Grid item xs={12} md={3}>
                    <MDTypography variant="button" fontWeight="bold" color="dark">
                      {t("joinedOn")}:
                    </MDTypography>
                    <MDTypography variant="button" display="block" color="text">
                      {selectedOwner?.joined_date || "-"}
                    </MDTypography>
                  </Grid>
                )}
                <Grid item xs={12} md={3}>
                  <MDTypography variant="button" fontWeight="bold" color="dark">
                    {t("status")}:
                  </MDTypography>
                  <MDTypography
                    variant="button"
                    display="block"
                    color={selectedOwner?.is_active ? "success" : "error"}
                  >
                    {selectedOwner?.is_active ? t("active") : t("inactive")}
                  </MDTypography>
                </Grid>
                {selectedOwner?.email && (
                  <Grid item xs={12} md={3}>
                    <MDTypography variant="button" fontWeight="bold" color="dark">
                      {t("email")}:
                    </MDTypography>
                    <MDTypography variant="button" display="block" color="text">
                      {selectedOwner.email}
                    </MDTypography>
                  </Grid>
                )}
              </Grid>
            </MDBox>
          </Grid>
        )}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            required
            label={t("principalAmount")}
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
            type="date"
            label={t("dueDate")}
            value={form.due_date}
            sx={FORM_FIELD_SX}
            InputLabelProps={{ shrink: true }}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                due_date: e.target.value,
              }))
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon fontSize="small" color="info">
                    event
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
            label={t("interestRate")}
            value={selectedLoanType ? `${selectedLoanType.interest_rate}%` : ""}
            sx={FORM_FIELD_SX}
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
      </Grid>
    </MDBox>
  );

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
                    <MDTypography variant="h6">{t("loans")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("loansSubtitle")}
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
                    {canManage && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={HEADER_ACTION_BUTTON_SX}
                        onClick={() => {
                          resetForm();
                          setCreateOpen(true);
                        }}
                      >
                        {t("addLoan")}
                      </MDButton>
                    )}
                  </MDBox>
                </MDBox>

                {contextOwnerId && selectedFilterOwner && (
                  <ContextBanner
                    icon="account_balance"
                    title={t("loans")}
                    subtitle={`${contextOwnerType === "CLIENT" ? t("client") : t("member")}: ${
                      selectedFilterOwner.label ||
                      selectedFilterOwner.full_name ||
                      selectedFilterOwner.national_id ||
                      selectedFilterOwner.account_number ||
                      "-"
                    }`}
                    clearLabel={t("clear")}
                    onClear={handleClearFilters}
                    mt={2}
                  />
                )}

                <Grid container spacing={2} mt={1}>
                  <Grid item xs={12} md={2.4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("totalLoans")}</MDTypography>
                      <MDTypography variant="h5">{summary.total}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="success">
                        {t("paidLoans")}
                      </MDTypography>
                      <MDTypography variant="h5" color="success">
                        {summary.paid}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="warning">
                        {t("unpaidLoans")}
                      </MDTypography>
                      <MDTypography variant="h5" color="warning">
                        {summary.unpaid}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="error">
                        {t("overdueLoans")}
                      </MDTypography>
                      <MDTypography variant="h5" color="error">
                        {summary.overdue}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="info">
                        {t("nearDueLoans")}
                      </MDTypography>
                      <MDTypography variant="h5" color="info">
                        {summary.nearDue}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <Grid container spacing={2} mt={1}>
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
                      options={STATUS_OPTIONS}
                      value={
                        STATUS_OPTIONS.find((item) => item.id === filters.status_group) || null
                      }
                      onChange={(_e, value) =>
                        setFilters((prev) => ({ ...prev, status_group: value?.id || "ALL" }))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label={t("status")} />}
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
                      onChange={(_e, value) =>
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
                      options={loanTypes}
                      value={
                        loanTypes.find((item) => String(item.id) === String(filters.loan_type)) ||
                        null
                      }
                      onChange={(_e, value) =>
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
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={filterOwnerOptions}
                      value={selectedFilterOwner}
                      onChange={(_e, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          owner_id: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) =>
                        option?.label ||
                        option?.full_name ||
                        option?.national_id ||
                        option?.account_number ||
                        "-"
                      }
                      isOptionEqualToValue={(option, value) =>
                        String(option.id) === String(value.id)
                      }
                      renderInput={(params) => <TextField {...params} label={t("owner")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <TextField
                      fullWidth
                      type="date"
                      sx={FORM_FIELD_SX}
                      label={t("from")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.due_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, due_from: e.target.value }))
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
                      value={filters.due_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, due_to: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
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
                <MDTypography variant="h6" mb={1}>
                  {t("loansByType")}
                </MDTypography>
                <DataTable
                  table={breakdownTable}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 5, entries: [5, 10, 20] }}
                  showTotalEntries
                  canSearch={false}
                  noEndBorder
                />
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("addLoan")}</DialogTitle>
        <DialogContent>{renderForm("create-loan-form", handleCreate)}</DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={{ minHeight: 56, height: 56 }}
            onClick={() => setCreateOpen(false)}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="create-loan-form"
            variant="gradient"
            color="info"
            sx={{ minHeight: 56, height: 56 }}
            disabled={saving || !form.owner_id || !form.loan_type || !form.principal_amount}
          >
            {saving ? t("creating") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("editLoan")}</DialogTitle>
        <DialogContent>{renderForm("edit-loan-form", handleUpdate)}</DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={{ minHeight: 56, height: 56 }}
            onClick={() => setEditOpen(false)}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="edit-loan-form"
            variant="gradient"
            color="info"
            sx={{ minHeight: 56, height: 56 }}
            disabled={saving || !form.owner_id || !form.loan_type || !form.principal_amount}
          >
            {saving ? t("loading") : t("saveChanges")}
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

export default LoansPage;
