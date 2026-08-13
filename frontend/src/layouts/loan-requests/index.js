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
import Link from "@mui/material/Link";

import MDBox from "components/MDBox";
import HintButton from "components/HintButton";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
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
  createLoanRequest,
  exportLoanRequestsPdf,
  fetchCurrentUser,
  fetchLoanRequestFormOptions,
  fetchLoanRequestReviewOptions,
  fetchLoanRequests,
  reviewLoanRequest,
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

const CREATE_DIALOG_FIELD_SX = {
  ...FORM_FIELD_SX,
  "& .MuiInputLabel-root": {
    color: "#4f5d78",
    fontWeight: 500,
  },
  "& .MuiInputLabel-shrink": {
    backgroundColor: "#ffffff",
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: "0.35rem",
  },
};

const STATUS_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "PENDING", labelKey: "pending" },
  { id: "APPROVED", labelKey: "approved" },
  { id: "REJECTED", labelKey: "rejected" },
];

const OWNER_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "MEMBER", labelKey: "members" },
  { id: "CLIENT", labelKey: "clients" },
];

const REVIEW_STATUS_OPTIONS = [
  { id: "APPROVED", labelKey: "approved" },
  { id: "REJECTED", labelKey: "rejected" },
];

const INITIAL_FILTERS = {
  search: "",
  status: "ALL",
  owner_type: "ALL",
  owner_id: "",
  date_from: "",
  date_to: "",
};

const INITIAL_REVIEW_FORM = {
  status: "APPROVED",
  loan_type: null,
  due_date: "",
  review_notes: "",
};

const INITIAL_CREATE_FORM = {
  owner_type: "MEMBER",
  owner_id: null,
  requested_loan_type: null,
  requested_amount: "",
  requested_term_months: "1",
  requested_term_days: "",
  purpose: "",
  application_form: null,
  id_copy: null,
  guarantee_cheque: null,
};

const getStatusColor = (status) => {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "warning";
};

function LoanRequestsPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [reviewForm, setReviewForm] = useState(INITIAL_REVIEW_FORM);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [createOpen, setCreateOpen] = useState(false);
  const [loanTypes, setLoanTypes] = useState([]);
  const [formLoanTypes, setFormLoanTypes] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });
  const [contextOwnerId, setContextOwnerId] = useState("");
  const [contextOwnerType, setContextOwnerType] = useState("");

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const currentRole = String(user?.effective_role || user?.role || "").toUpperCase();
  const canReview = ["ADMIN", "MANAGER", "LOAN_OFFICER"].includes(currentRole);
  const canCreateOnBehalf = ["ADMIN", "MANAGER", "LOAN_OFFICER"].includes(currentRole);

  const selectedLoanType = useMemo(
    () => loanTypes.find((item) => Number(item.id) === Number(reviewForm.loan_type)) || null,
    [loanTypes, reviewForm.loan_type]
  );
  const getStatusLabel = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "APPROVED") return t("approved");
    if (normalized === "REJECTED") return t("rejected");
    if (normalized === "PENDING") return t("pending");
    return status || "-";
  };

  const ownerOptions = createForm.owner_type === "CLIENT" ? clientOptions : memberOptions;
  const selectedOwner = useMemo(
    () => ownerOptions.find((item) => Number(item.id) === Number(createForm.owner_id)) || null,
    [ownerOptions, createForm.owner_id]
  );
  const filterOwnerOptions = filters.owner_type === "CLIENT" ? clientOptions : memberOptions;
  const selectedFilterOwner = useMemo(
    () => filterOwnerOptions.find((item) => String(item.id) === String(filters.owner_id)) || null,
    [filterOwnerOptions, filters.owner_id]
  );
  const selectedCreateLoanType = useMemo(
    () =>
      formLoanTypes.find((item) => Number(item.id) === Number(createForm.requested_loan_type)) ||
      null,
    [formLoanTypes, createForm.requested_loan_type]
  );

  const loadUser = async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (_error) {
      setUser(null);
    }
  };

  const loadReviewOptions = async () => {
    if (!canReview) return;
    try {
      const payload = await fetchLoanRequestReviewOptions();
      setLoanTypes(Array.isArray(payload?.loan_types) ? payload.loan_types : []);
    } catch (_error) {
      setLoanTypes([]);
    }
  };

  const loadCreateOptions = async () => {
    if (!canCreateOnBehalf) return;
    try {
      const payload = await fetchLoanRequestFormOptions();
      setMemberOptions(Array.isArray(payload?.members) ? payload.members : []);
      setClientOptions(Array.isArray(payload?.clients) ? payload.clients : []);
      setFormLoanTypes(Array.isArray(payload?.loan_types) ? payload.loan_types : []);
    } catch (_error) {
      setMemberOptions([]);
      setClientOptions([]);
      setFormLoanTypes([]);
    }
  };

  const loadData = async (customFilters = appliedFilters) => {
    setLoading(true);
    try {
      const params = {
        search: customFilters.search || undefined,
        status: customFilters.status !== "ALL" ? customFilters.status : undefined,
        owner_type: customFilters.owner_type !== "ALL" ? customFilters.owner_type : undefined,
        owner_id: customFilters.owner_id || undefined,
        date_from: customFilters.date_from || undefined,
        date_to: customFilters.date_to || undefined,
      };
      const payload = await fetchLoanRequests(params);
      setItems(Array.isArray(payload) ? payload : payload?.results || []);
      setAppliedFilters(customFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
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
    if (!user) return;
    loadReviewOptions();
  }, [user, canReview]);

  useEffect(() => {
    if (!user) return;
    loadCreateOptions();
  }, [user, canCreateOnBehalf]);

  useEffect(() => {
    const action = location.state?.action;
    const ownerType = location.state?.ownerType;
    const ownerId = location.state?.ownerId;
    if (!canCreateOnBehalf || action !== "create" || !ownerType || !ownerId) return;

    const nextFilters = {
      ...INITIAL_FILTERS,
      owner_type: ownerType,
      owner_id: String(ownerId),
    };
    setFilters(nextFilters);
    setContextOwnerType(ownerType);
    setContextOwnerId(String(ownerId));
    loadData(nextFilters);
    setCreateForm({
      ...INITIAL_CREATE_FORM,
      owner_type: ownerType,
      owner_id: Number(ownerId),
    });
    setCreateOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [canCreateOnBehalf, location.pathname, location.state, navigate]);

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    setContextOwnerId("");
    setContextOwnerType("");
    await loadData(INITIAL_FILTERS);
  };

  const openReviewDialog = (item) => {
    setReviewItem(item);
    setReviewForm({
      ...INITIAL_REVIEW_FORM,
      loan_type: item?.requested_loan_type || null,
    });
  };

  const closeReviewDialog = () => {
    setReviewItem(null);
    setReviewForm(INITIAL_REVIEW_FORM);
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewItem) return;
    setSaving(true);
    try {
      const payload = {
        status: reviewForm.status,
        review_notes: reviewForm.review_notes || "",
      };
      if (reviewForm.status === "APPROVED") {
        payload.loan_type = Number(reviewForm.loan_type);
        payload.due_date = reviewForm.due_date || null;
      }
      await reviewLoanRequest(reviewItem.id, payload);
      notify("success", t("confirmation"), t("loanRequestReviewedSuccess"));
      closeReviewDialog();
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("owner_type", createForm.owner_type);
      payload.append("owner_id", String(createForm.owner_id || ""));
      payload.append("requested_loan_type", String(createForm.requested_loan_type || ""));
      payload.append("requested_amount", String(createForm.requested_amount || ""));
      payload.append("requested_term_months", String(createForm.requested_term_months || "1"));
      if (createForm.requested_term_days) {
        payload.append("requested_term_days", String(createForm.requested_term_days));
      }
      payload.append("purpose", createForm.purpose || "");
      if (createForm.application_form)
        payload.append("application_form", createForm.application_form);
      if (createForm.id_copy) payload.append("id_copy", createForm.id_copy);
      if (createForm.guarantee_cheque)
        payload.append("guarantee_cheque", createForm.guarantee_cheque);

      await createLoanRequest(payload);
      notify("success", t("confirmation"), t("loanCreatedSuccess"));
      setCreateOpen(false);
      setCreateForm(INITIAL_CREATE_FORM);
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = {
        search: appliedFilters.search || undefined,
        status: appliedFilters.status !== "ALL" ? appliedFilters.status : undefined,
        owner_type: appliedFilters.owner_type !== "ALL" ? appliedFilters.owner_type : undefined,
        owner_id: appliedFilters.owner_id || undefined,
        date_from: appliedFilters.date_from || undefined,
        date_to: appliedFilters.date_to || undefined,
      };
      const { blob, fileName } = await exportLoanRequestsPdf(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setExporting(false);
    }
  };

  const summary = useMemo(() => {
    const total = items.length;
    const pending = items.filter((item) => item.status === "PENDING").length;
    const approved = items.filter((item) => item.status === "APPROVED").length;
    const rejected = items.filter((item) => item.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [items]);

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("requestedOn"), accessor: "requested_on", align: "left" },
      { Header: t("owner"), accessor: "owner_name", align: "left" },
      { Header: t("ownerType"), accessor: "owner_type", align: "left" },
      { Header: t("loanType"), accessor: "requested_loan_type_name", align: "left" },
      { Header: t("requestedAmount"), accessor: "requested_amount", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("reviewedBy"), accessor: "reviewed_by", align: "left" },
      { Header: t("approvedLoan"), accessor: "approved_loan_id", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      requested_on: (
        <MDTypography variant="caption">
          {item.requested_on ? new Date(item.requested_on).toLocaleString() : "-"}
        </MDTypography>
      ),
      owner_name: <MDTypography variant="caption">{item.owner_name || "-"}</MDTypography>,
      owner_type: <MDTypography variant="caption">{item.owner_type || "-"}</MDTypography>,
      requested_loan_type_name: (
        <MDTypography variant="caption">{item.requested_loan_type_name || "-"}</MDTypography>
      ),
      requested_amount: (
        <MDTypography variant="caption">
          {Number(item.requested_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      status: (
        <MDTypography variant="caption" color={getStatusColor(item.status)}>
          {getStatusLabel(item.status)}
        </MDTypography>
      ),
      reviewed_by: <MDTypography variant="caption">{item.reviewed_by || "-"}</MDTypography>,
      approved_loan_id: (
        <MDTypography variant="caption">
          {item.approved_loan_id ? `#${item.approved_loan_id}` : "-"}
        </MDTypography>
      ),
      actions: (
        <MDBox display="flex" alignItems="center" justifyContent="center" gap={0.5}>
          <Tooltip title={t("view")}>
            <IconButton color="info" size="small" onClick={() => setSelectedItem(item)}>
              <Icon fontSize="small">visibility</Icon>
            </IconButton>
          </Tooltip>
          {canReview && item.status === "PENDING" && (
            <Tooltip title={t("reviewLoanRequest")}>
              <IconButton color="success" size="small" onClick={() => openReviewDialog(item)}>
                <Icon fontSize="small">fact_check</Icon>
              </IconButton>
            </Tooltip>
          )}
        </MDBox>
      ),
    }));

    return { columns, rows };
  }, [items, canReview, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6">{t("loanRequests")}</MDTypography>
                <MDTypography variant="button" color="text">
                  {t("loanRequestsSubtitle")}
                </MDTypography>
                <MDBox mt={2} display="flex" gap={1} flexWrap="wrap">
                  <HintButton
                    variant="outlined"
                    color="info"
                    onClick={handleExportPdf}
                    disabled={loading || exporting || items.length === 0}
                    hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                  >
                    {exporting ? t("loading") : t("exportPdf")}
                  </HintButton>
                  {canCreateOnBehalf && (
                    <MDButton variant="gradient" color="info" onClick={() => setCreateOpen(true)}>
                      {t("requestLoan")}
                    </MDButton>
                  )}
                </MDBox>

                {contextOwnerId && selectedFilterOwner && (
                  <ContextBanner
                    icon="request_quote"
                    title={t("loanRequests")}
                    subtitle={`${contextOwnerType === "CLIENT" ? t("client") : t("member")}: ${
                      selectedFilterOwner.label ||
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
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("loanRequests")}</MDTypography>
                      <MDTypography variant="h5">{summary.total}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="warning">
                        {t("pendingRequests")}
                      </MDTypography>
                      <MDTypography variant="h5" color="warning">
                        {summary.pending}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="success">
                        {t("approvedRequests")}
                      </MDTypography>
                      <MDTypography variant="h5" color="success">
                        {summary.approved}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button" color="error">
                        {t("rejectedRequests")}
                      </MDTypography>
                      <MDTypography variant="h5" color="error">
                        {summary.rejected}
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
                      value={STATUS_OPTIONS.find((item) => item.id === filters.status) || null}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, status: value?.id || "ALL" }))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("status")}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  tune
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={OWNER_OPTIONS}
                      value={OWNER_OPTIONS.find((item) => item.id === filters.owner_type) || null}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, owner_type: value?.id || "ALL" }))
                      }
                      getOptionLabel={(option) => t(option.labelKey)}
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
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={filterOwnerOptions}
                      value={selectedFilterOwner}
                      onChange={(_event, value) =>
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
                        ""
                      }
                      isOptionEqualToValue={(option, value) =>
                        String(option.id) === String(value.id)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("owner")}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  group
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
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
                <Grid container spacing={2} mt={0.5}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      sx={FORM_FIELD_SX}
                      label={`${t("requestedOn")} (${t("from")})`}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      sx={FORM_FIELD_SX}
                      label={`${t("requestedOn")} (${t("to")})`}
                      value={filters.date_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
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
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {t("details")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent dividers sx={FORM_DIALOG_CONTENT_SX}>
          <MDTypography variant="button" display="block" mb={1}>
            {t("owner")}: {selectedItem?.owner_name || "-"}
          </MDTypography>
          <MDTypography variant="button" display="block" mb={1}>
            {t("ownerType")}: {selectedItem?.owner_type || "-"}
          </MDTypography>
          <MDTypography variant="button" display="block" mb={1}>
            {t("loanType")}: {selectedItem?.requested_loan_type_name || "-"}
          </MDTypography>
          <MDTypography variant="button" display="block" mb={1}>
            {t("requestedAmount")}: {Number(selectedItem?.requested_amount || 0).toLocaleString()}{" "}
            {t("rwf")}
          </MDTypography>
          <MDTypography variant="button" display="block" mb={1}>
            {t("status")}: {getStatusLabel(selectedItem?.status)}
          </MDTypography>
          <MDTypography variant="button" display="block" mb={1}>
            {t("reviewedOn")}:{" "}
            {selectedItem?.reviewed_on ? new Date(selectedItem.reviewed_on).toLocaleString() : "-"}
          </MDTypography>
          <MDTypography variant="button" display="block">
            {t("reviewNotes")}: {selectedItem?.review_notes || "-"}
          </MDTypography>
          <MDTypography variant="button" display="block" mt={1}>
            {t("loanRequestFormFile")}:{" "}
            {selectedItem?.application_form_url ? (
              <Link href={selectedItem.application_form_url} target="_blank" rel="noreferrer">
                {t("view")}
              </Link>
            ) : (
              "-"
            )}
          </MDTypography>
          <MDTypography variant="button" display="block" mt={1}>
            {t("idCopyFile")}:{" "}
            {selectedItem?.id_copy_url ? (
              <Link href={selectedItem.id_copy_url} target="_blank" rel="noreferrer">
                {t("view")}
              </Link>
            ) : (
              "-"
            )}
          </MDTypography>
          <MDTypography variant="button" display="block" mt={1}>
            {t("guaranteeChequeFile")}:{" "}
            {selectedItem?.guarantee_cheque_url ? (
              <Link href={selectedItem.guarantee_cheque_url} target="_blank" rel="noreferrer">
                {t("view")}
              </Link>
            ) : (
              "-"
            )}
          </MDTypography>
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={FORM_ACTION_BUTTON_SX}
            onClick={() => setSelectedItem(null)}
          >
            {t("close")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(reviewItem)}
        onClose={closeReviewDialog}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {t("reviewLoanRequest")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox
            component="form"
            id="review-loan-request-form"
            onSubmit={handleSubmitReview}
            mt={1}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={FORM_FIELD_SX}
                  options={REVIEW_STATUS_OPTIONS}
                  value={
                    REVIEW_STATUS_OPTIONS.find((item) => item.id === reviewForm.status) || null
                  }
                  onChange={(_event, value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      status: value?.id || "APPROVED",
                    }))
                  }
                  getOptionLabel={(option) => t(option.labelKey)}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("status")}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              fact_check
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              {reviewForm.status === "APPROVED" && (
                <>
                  <Grid item xs={12} md={4}>
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      options={loanTypes}
                      value={selectedLoanType}
                      onChange={(_event, value) =>
                        setReviewForm((prev) => ({
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
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="date"
                      sx={FORM_FIELD_SX}
                      label={t("dueDate")}
                      InputLabelProps={{ shrink: true }}
                      value={reviewForm.due_date}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
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
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  sx={FORM_FIELD_SX}
                  label={t("reviewNotes")}
                  value={reviewForm.review_notes}
                  onChange={(e) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      review_notes: e.target.value,
                    }))
                  }
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
            onClick={closeReviewDialog}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="review-loan-request-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={saving || (reviewForm.status === "APPROVED" && !reviewForm.loan_type)}
          >
            {saving ? t("loading") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {t("requestLoan")}
            </MDTypography>
            <MDTypography variant="button" color="white" opacity={0.9}>
              {t("loanRequestsSubtitle")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent dividers sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox
            component="form"
            id="create-loan-request-form"
            onSubmit={handleCreateRequest}
            mt={1}
          >
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={3}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={CREATE_DIALOG_FIELD_SX}
                  options={[
                    { id: "MEMBER", label: t("members") },
                    { id: "CLIENT", label: t("clients") },
                  ]}
                  value={[
                    { id: "MEMBER", label: t("members") },
                    { id: "CLIENT", label: t("clients") },
                  ].find((opt) => opt.id === createForm.owner_type)}
                  onChange={(_e, value) =>
                    setCreateForm((prev) => ({
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
              <Grid item xs={12} md={5}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={CREATE_DIALOG_FIELD_SX}
                  options={ownerOptions}
                  value={selectedOwner}
                  onChange={(_e, value) =>
                    setCreateForm((prev) => ({ ...prev, owner_id: value?.id || null }))
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
                  sx={CREATE_DIALOG_FIELD_SX}
                  options={formLoanTypes}
                  value={selectedCreateLoanType}
                  onChange={(_e, value) =>
                    setCreateForm((prev) => ({ ...prev, requested_loan_type: value?.id || null }))
                  }
                  getOptionLabel={(option) => option.name || "-"}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("loanType")}
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
                      <Grid item xs={12} md={4}>
                        <MDTypography variant="button" color="dark" fontWeight="bold">
                          {t("owner")}
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedOwner.label || "-"}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <MDTypography variant="button" color="dark" fontWeight="bold">
                          {t("nationalId")}
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedOwner.national_id || "-"}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <MDTypography variant="button" color="dark" fontWeight="bold">
                          {t("account")}
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedOwner.account_number || "-"}
                        </MDTypography>
                      </Grid>
                    </Grid>
                  </MDBox>
                </Grid>
              )}

              <Grid item xs={12} md={4}>
                <MDInput
                  fullWidth
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("requestedAmount")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          payments
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  value={createForm.requested_amount}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      requested_amount: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <MDInput
                  fullWidth
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("termMonths")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          calendar_month
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  value={createForm.requested_term_months}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      requested_term_months: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <MDInput
                  fullWidth
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("termDays")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          event
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  value={createForm.requested_term_days}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      requested_term_days: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <MDInput
                  fullWidth
                  multiline
                  rows={3}
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("details")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          description
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  value={createForm.purpose}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, purpose: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="file"
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("loanRequestFormFile")}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      application_form: e.target.files?.[0] || null,
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="file"
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("idCopyFile")}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, id_copy: e.target.files?.[0] || null }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="file"
                  sx={CREATE_DIALOG_FIELD_SX}
                  label={t("guaranteeChequeFile")}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      guarantee_cheque: e.target.files?.[0] || null,
                    }))
                  }
                />
              </Grid>
            </Grid>
            <MDBox mt={2} />
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
            form="create-loan-request-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={
              saving ||
              !createForm.owner_id ||
              !createForm.requested_loan_type ||
              !createForm.requested_amount
            }
          >
            {saving ? t("loading") : t("save")}
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

export default LoanRequestsPage;
