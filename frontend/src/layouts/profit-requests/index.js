import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Autocomplete from "@mui/material/Autocomplete";
import Badge from "@mui/material/Badge";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

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
  createProfitRequest,
  createMyProfitRequest,
  exportProfitRequestsPdf,
  fetchCurrentUser,
  fetchMemberOptions,
  fetchMyMemberProfitSummary,
  fetchMyProfitRequests,
  fetchProfitRequests,
  reviewProfitRequest,
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

const INITIAL_FILTERS = {
  search: "",
  member: "",
  status: "ALL",
  request_mode: "__ALL__",
  date_from: "",
  date_to: "",
};

const INITIAL_REQUEST_FORM = {
  member: "",
  request_mode: "ALL",
  requested_amount: "",
  request_notes: "",
};

const INITIAL_REVIEW_FORM = {
  status: "APPROVED",
  approved_amount: "",
  review_notes: "",
};

const REQUEST_MODE_FILTER_ALL = "__ALL__";

function ProfitRequestsPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [requestForm, setRequestForm] = useState(INITIAL_REQUEST_FORM);
  const [reviewForm, setReviewForm] = useState(INITIAL_REVIEW_FORM);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [contextMemberId, setContextMemberId] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const isMember = role === "MEMBER";
  const canReview = ["ADMIN", "FINANCE"].includes(role);
  const canViewStaff = ["ADMIN", "FINANCE", "MANAGER", "AUDITOR"].includes(role);
  const canCreateOnBehalf = ["ADMIN", "FINANCE", "MANAGER"].includes(role);

  const statusOptions = useMemo(
    () => [
      { id: "PENDING", label: t("pending") },
      { id: "APPROVED", label: t("approved") },
      { id: "REJECTED", label: t("rejected") },
    ],
    [t]
  );

  const requestModeOptions = useMemo(
    () => [
      { id: "ALL", label: t("payAllProfits") },
      { id: "PARTIAL", label: t("payPartialProfit") },
    ],
    [t]
  );

  const getStatusLabel = (value) => {
    const normalized = String(value || "").toUpperCase();
    if (normalized === "PENDING") return t("pending");
    if (normalized === "APPROVED") return t("approved");
    if (normalized === "REJECTED") return t("rejected");
    return value || "-";
  };

  const getModeLabel = (value) => {
    const normalized = String(value || "").toUpperCase();
    if (normalized === "ALL") return t("payAllProfits");
    if (normalized === "PARTIAL") return t("payPartialProfit");
    return value || "-";
  };

  const buildRequestParams = (currentFilters = appliedFilters, forMember = isMember) => {
    const params = {
      search: currentFilters.search || undefined,
      status: currentFilters.status !== "ALL" ? currentFilters.status : undefined,
      request_mode:
        currentFilters.request_mode && currentFilters.request_mode !== REQUEST_MODE_FILTER_ALL
          ? currentFilters.request_mode
          : undefined,
      date_from: currentFilters.date_from || undefined,
      date_to: currentFilters.date_to || undefined,
    };

    if (!forMember) {
      params.member = currentFilters.member || undefined;
    }

    return params;
  };

  const loadUser = async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (_error) {
      setUser(null);
    }
  };

  const loadData = async (nextFilters = appliedFilters) => {
    setLoading(true);
    try {
      if (isMember) {
        const [requestRows, profitSummary] = await Promise.all([
          fetchMyProfitRequests(buildRequestParams(nextFilters, true)),
          fetchMyMemberProfitSummary(),
        ]);
        setItems(Array.isArray(requestRows) ? requestRows : requestRows?.results || []);
        setSummary(profitSummary || null);
      } else if (canViewStaff) {
        const payload = await fetchProfitRequests(buildRequestParams(nextFilters, false));
        setItems(Array.isArray(payload) ? payload : payload?.results || []);
        setSummary(null);
      } else {
        setItems([]);
        setSummary(null);
      }
      setAppliedFilters(nextFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
      setItems([]);
      setSummary(null);
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
    if (!canViewStaff) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        const payload = await fetchMemberOptions();
        setMembers(Array.isArray(payload) ? payload : payload?.results || []);
      } catch (_error) {
        setMembers([]);
      }
    };

    loadMembers();
  }, [canViewStaff]);

  useEffect(() => {
    if (!location.state || location.state.action !== "create") return;
    if (isMember) return;

    const memberId = location.state.memberId ? String(location.state.memberId) : "";
    if (memberId) {
      const nextFilters = { ...INITIAL_FILTERS, member: memberId };
      setFilters(nextFilters);
      setContextMemberId(memberId);
      loadData(nextFilters);
    }
    setRequestOpen(true);
    setRequestForm((prev) => ({
      ...prev,
      member: memberId || prev.member,
    }));
    navigate(location.pathname, { replace: true, state: {} });
  }, [isMember, location.pathname, location.state, navigate]);

  const pendingCount = useMemo(
    () => items.filter((item) => String(item.status).toUpperCase() === "PENDING").length,
    [items]
  );
  const approvedCount = useMemo(
    () => items.filter((item) => String(item.status).toUpperCase() === "APPROVED").length,
    [items]
  );
  const rejectedCount = useMemo(
    () => items.filter((item) => String(item.status).toUpperCase() === "REJECTED").length,
    [items]
  );
  const requestedTotal = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.effective_requested_amount || 0), 0),
    [items]
  );

  const openReviewDialog = (item) => {
    setReviewItem(item);
    setReviewForm({
      status: "APPROVED",
      approved_amount: String(item.effective_requested_amount || ""),
      review_notes: "",
    });
  };

  const closeReviewDialog = () => {
    setReviewItem(null);
    setReviewForm(INITIAL_REVIEW_FORM);
  };

  const memberOptions = useMemo(
    () =>
      members
        .filter((item) => item.is_active !== false)
        .map((item) => ({
          id: String(item.id),
          label: `${
            item.full_name || item.user_full_name || item.username || item.national_id || item.id
          } - ${Number(item.unpaid_profit_total || 0).toLocaleString()} ${t("rwf")}`,
          unpaidProfitTotal: Number(item.unpaid_profit_total || 0),
        })),
    [members, t]
  );
  const selectedMemberOption = useMemo(
    () => memberOptions.find((item) => item.id === requestForm.member) || null,
    [memberOptions, requestForm.member]
  );
  const selectedFilterMemberOption = useMemo(
    () =>
      [{ id: "", label: t("all") }, ...memberOptions].find(
        (option) => option.id === filters.member
      ),
    [filters.member, memberOptions, t]
  );

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    setContextMemberId("");
    await loadData(INITIAL_FILTERS);
  };

  const handleSearchChange = async (value) => {
    const nextFilters = { ...appliedFilters, search: value };
    setFilters((prev) => ({ ...prev, search: value }));
    await loadData(nextFilters);
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        request_mode: requestForm.request_mode,
        request_notes: requestForm.request_notes || "",
      };
      if (requestForm.request_mode === "PARTIAL") {
        payload.requested_amount = Number(requestForm.requested_amount || 0);
      }
      if (isMember) {
        await createMyProfitRequest(payload);
      } else {
        payload.member = Number(requestForm.member || 0);
        await createProfitRequest(payload);
      }
      notify("success", t("confirmation"), t("profitRequestCreatedSuccess"));
      setRequestOpen(false);
      setRequestForm(INITIAL_REQUEST_FORM);
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
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
        payload.approved_amount = Number(
          reviewForm.approved_amount || reviewItem.effective_requested_amount || 0
        );
      }
      await reviewProfitRequest(reviewItem.id, payload);
      notify("success", t("confirmation"), t("profitRequestReviewedSuccess"));
      closeReviewDialog();
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadBlob = (blob, fileName) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExport = async (format = "csv") => {
    setExporting(true);
    try {
      const headers = isMember
        ? [
            t("requestedOn"),
            t("requestMode"),
            t("requestedProfit"),
            t("approvedAmount"),
            t("status"),
            t("details"),
          ]
        : [
            t("member"),
            t("requestedBy"),
            t("requestedOn"),
            t("requestMode"),
            t("requestedProfit"),
            t("availableProfit"),
            t("status"),
          ];

      const rows = items.map((item) =>
        isMember
          ? [
              item.requested_on ? new Date(item.requested_on).toLocaleString() : "-",
              getModeLabel(item.request_mode),
              Number(item.effective_requested_amount || 0),
              item.approved_amount ? Number(item.approved_amount || 0) : "",
              getStatusLabel(item.status),
              item.review_notes || "-",
            ]
          : [
              item.member_name || "-",
              item.requested_by_name || "-",
              item.requested_on ? new Date(item.requested_on).toLocaleString() : "-",
              getModeLabel(item.request_mode),
              Number(item.effective_requested_amount || 0),
              Number(item.current_available_profit || 0),
              getStatusLabel(item.status),
            ]
      );

      let blob;
      let fileName;
      if (format === "xlsx") {
        const tsv = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
        blob = new Blob([tsv], { type: "application/vnd.ms-excel;charset=utf-8;" });
        fileName = "profit_requests.xls";
      } else {
        const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = [headers.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join(
          "\n"
        );
        blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        fileName = "profit_requests.csv";
      }

      downloadBlob(blob, fileName);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = buildRequestParams(appliedFilters, isMember);
      const { blob, fileName } = await exportProfitRequestsPdf(params);
      downloadBlob(blob, fileName);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setExporting(false);
    }
  };

  const table = useMemo(() => {
    const columns = isMember
      ? [
          { Header: t("requestedOn"), accessor: "requested_on", align: "left" },
          { Header: t("requestMode"), accessor: "request_mode", align: "left" },
          { Header: t("requestedProfit"), accessor: "requested_amount", align: "left" },
          { Header: t("approvedAmount"), accessor: "approved_amount", align: "left" },
          { Header: t("status"), accessor: "status", align: "left" },
          { Header: t("details"), accessor: "review_notes", align: "left" },
        ]
      : [
          { Header: t("members"), accessor: "member_name", align: "left" },
          { Header: t("requestedBy"), accessor: "requested_by_name", align: "left" },
          { Header: t("requestedOn"), accessor: "requested_on", align: "left" },
          { Header: t("requestMode"), accessor: "request_mode", align: "left" },
          { Header: t("requestedProfit"), accessor: "requested_amount", align: "left" },
          { Header: t("availableProfit"), accessor: "current_available_profit", align: "left" },
          { Header: t("status"), accessor: "status", align: "left" },
          { Header: t("actions"), accessor: "actions", align: "center" },
        ];

    const rows = items.map((item) => {
      const common = {
        requested_on: (
          <MDTypography variant="caption">
            {item.requested_on ? new Date(item.requested_on).toLocaleString() : "-"}
          </MDTypography>
        ),
        request_mode: (
          <MDTypography variant="caption">{getModeLabel(item.request_mode)}</MDTypography>
        ),
        requested_amount: (
          <MDTypography variant="caption">
            {Number(item.effective_requested_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        approved_amount: (
          <MDTypography variant="caption">
            {item.approved_amount ? Number(item.approved_amount).toLocaleString() : "-"}{" "}
            {item.approved_amount ? t("rwf") : ""}
          </MDTypography>
        ),
        status: <MDTypography variant="caption">{getStatusLabel(item.status)}</MDTypography>,
      };

      if (isMember) {
        return {
          ...common,
          review_notes: <MDTypography variant="caption">{item.review_notes || "-"}</MDTypography>,
        };
      }

      return {
        ...common,
        member_name: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
        requested_by_name: (
          <MDTypography variant="caption">{item.requested_by_name || "-"}</MDTypography>
        ),
        current_available_profit: (
          <MDTypography variant="caption">
            {Number(item.current_available_profit || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        actions: canReview ? (
          <Tooltip title={t("reviewProfitRequest")}>
            <span>
              <IconButton
                color="info"
                size="small"
                disabled={String(item.status).toUpperCase() !== "PENDING"}
                onClick={() => openReviewDialog(item)}
              >
                <Icon fontSize="small">fact_check</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <MDTypography variant="caption">-</MDTypography>
        ),
      };
    });

    return { columns, rows };
  }, [items, isMember, t, canReview]);

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
                  mb={2}
                >
                  <MDBox>
                    <MDTypography variant="h5">
                      {isMember ? t("myProfitRequests") : t("profitRequests")}
                    </MDTypography>
                    <MDTypography variant="button" color="text">
                      {isMember ? t("myProfitRequestsSubtitle") : t("profitRequestsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1} flexWrap="wrap" alignItems="center">
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={FORM_ACTION_BUTTON_SX}
                      disabled={loading || exporting || items.length === 0}
                      onClick={handleExportPdf}
                      hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportPdf")}
                    </HintButton>
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={FORM_ACTION_BUTTON_SX}
                      disabled={loading || exporting || items.length === 0}
                      onClick={() => handleExport("csv")}
                      hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportCsv")}
                    </HintButton>
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={FORM_ACTION_BUTTON_SX}
                      disabled={loading || exporting || items.length === 0}
                      onClick={() => handleExport("xlsx")}
                      hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportExcel")}
                    </HintButton>
                    {(isMember || canCreateOnBehalf) && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={FORM_ACTION_BUTTON_SX}
                        onClick={() => setRequestOpen(true)}
                        disabled={
                          isMember
                            ? Number(summary?.unpaid_profit_total || 0) <= 0 || pendingCount > 0
                            : false
                        }
                      >
                        {isMember ? t("requestProfit") : t("requestProfitForMember")}
                      </MDButton>
                    )}
                  </MDBox>
                </MDBox>

                {isMember && (
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("unpaidProfit")}
                          </MDTypography>
                          <MDTypography variant="h5">
                            {Number(summary?.unpaid_profit_total || 0).toLocaleString()} {t("rwf")}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("lifetimeTotal")}
                          </MDTypography>
                          <MDTypography variant="h5">
                            {Number(summary?.total_amount_in_system || 0).toLocaleString()}{" "}
                            {t("rwf")}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("profitRate")}
                          </MDTypography>
                          <MDTypography variant="h5">
                            {Number(summary?.member_profit_rate_percent || 0).toFixed(2)}%
                          </MDTypography>
                          <MDTypography variant="caption" color="text">
                            {summary?.profit_rate_year
                              ? `${t("year")}: ${summary.profit_rate_year}`
                              : "-"}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDBox display="flex" alignItems="center" gap={1}>
                            <MDTypography variant="button" color="text">
                              {t("pendingRequests")}
                            </MDTypography>
                            <Badge color="warning" badgeContent={pendingCount} max={99} />
                          </MDBox>
                          <MDTypography variant="h5">{pendingCount}</MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                  </Grid>
                )}

                {isMember && (
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} md={3}>
                      <TextField
                        select
                        fullWidth
                        label={t("status")}
                        value={filters.status}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, status: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                      >
                        <MenuItem value="ALL">{t("all")}</MenuItem>
                        {statusOptions.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        select
                        fullWidth
                        label={t("requestMode")}
                        value={filters.request_mode}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, request_mode: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                      >
                        <MenuItem value={REQUEST_MODE_FILTER_ALL}>{t("all")}</MenuItem>
                        {requestModeOptions.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label={t("from")}
                        value={filters.date_from}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, date_from: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label={t("to")}
                        value={filters.date_to}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, date_to: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2} display="flex" gap={1}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{ ...FORM_ACTION_BUTTON_SX, flex: 1 }}
                        onClick={handleApplyFilters}
                        disabled={loading}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        sx={{ ...FORM_ACTION_BUTTON_SX, flex: 1 }}
                        onClick={handleClearFilters}
                        disabled={loading}
                      >
                        {t("clear")}
                      </MDButton>
                    </Grid>
                  </Grid>
                )}

                {canViewStaff && !isMember && contextMemberId && selectedFilterMemberOption?.id && (
                  <ContextBanner
                    icon="request_quote"
                    title={t("profitRequests")}
                    subtitle={`${t("member")}: ${selectedFilterMemberOption.label}`}
                    clearLabel={t("clear")}
                    onClear={handleClearFilters}
                    mb={2}
                  />
                )}

                {canViewStaff && !isMember && (
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label={t("search")}
                        value={filters.search}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, search: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Icon fontSize="small" color="info">
                                search
                              </Icon>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        select
                        fullWidth
                        label={t("status")}
                        value={filters.status}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, status: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                      >
                        <MenuItem value="ALL">{t("all")}</MenuItem>
                        {statusOptions.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Autocomplete
                        options={[{ id: "", label: t("all") }, ...memberOptions]}
                        value={selectedFilterMemberOption || { id: "", label: t("all") }}
                        onChange={(_event, value) => {
                          setContextMemberId(value?.id || "");
                          setFilters((prev) => ({ ...prev, member: value?.id || "" }));
                        }}
                        getOptionLabel={(option) => option.label || ""}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        popupIcon={<Icon fontSize="small">expand_more</Icon>}
                        sx={FORM_FIELD_SX}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={t("member")}
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
                      <TextField
                        select
                        fullWidth
                        label={t("requestMode")}
                        value={filters.request_mode}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, request_mode: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                      >
                        <MenuItem value={REQUEST_MODE_FILTER_ALL}>{t("all")}</MenuItem>
                        {requestModeOptions.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label={t("from")}
                        value={filters.date_from}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, date_from: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label={t("to")}
                        value={filters.date_to}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, date_to: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2} display="flex" gap={1}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{ ...FORM_ACTION_BUTTON_SX, flex: 1 }}
                        onClick={handleApplyFilters}
                        disabled={loading}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        sx={{ ...FORM_ACTION_BUTTON_SX, flex: 1 }}
                        onClick={handleClearFilters}
                        disabled={loading}
                      >
                        {t("clear")}
                      </MDButton>
                    </Grid>
                  </Grid>
                )}

                {!isMember && canViewStaff && (
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("pendingRequests")}
                          </MDTypography>
                          <MDTypography variant="h5" color="warning">
                            {pendingCount}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("approvedRequests")}
                          </MDTypography>
                          <MDTypography variant="h5" color="success">
                            {approvedCount}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("rejectedRequests")}
                          </MDTypography>
                          <MDTypography variant="h5" color="error">
                            {rejectedCount}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card>
                        <MDBox p={2.5}>
                          <MDTypography variant="button" color="text">
                            {t("requestedProfit")}
                          </MDTypography>
                          <MDTypography variant="h5" color="info">
                            {requestedTotal.toLocaleString()} {t("rwf")}
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                  </Grid>
                )}

                <DataTable
                  table={table}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch={!canViewStaff || isMember}
                  searchValue={isMember ? filters.search : undefined}
                  onSearchChange={isMember ? handleSearchChange : undefined}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {isMember ? t("requestProfit") : t("requestProfitForMember")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox
            component="form"
            id="member-profit-request-form"
            onSubmit={handleCreateRequest}
            mt={1}
          >
            <Grid container spacing={2}>
              {!isMember && (
                <Grid item xs={12}>
                  <Autocomplete
                    options={memberOptions}
                    value={memberOptions.find((option) => option.id === requestForm.member) || null}
                    onChange={(_event, value) =>
                      setRequestForm((prev) => ({ ...prev, member: value?.id || "" }))
                    }
                    getOptionLabel={(option) => option.label || ""}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    popupIcon={<Icon fontSize="small">expand_more</Icon>}
                    sx={FORM_FIELD_SX}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("member")}
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
                  {selectedMemberOption &&
                    Number(selectedMemberOption.unpaidProfitTotal || 0) <= 0 && (
                      <MDTypography variant="caption" color="warning" mt={0.75} display="block">
                        {t("availableProfit")}: 0 {t("rwf")}
                      </MDTypography>
                    )}
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label={t("requestMode")}
                  value={requestForm.request_mode}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, request_mode: event.target.value }))
                  }
                  sx={FORM_FIELD_SX}
                >
                  {requestModeOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {requestForm.request_mode === "PARTIAL" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t("requestedProfit")}
                    value={requestForm.requested_amount}
                    onChange={(event) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        requested_amount: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                    sx={FORM_FIELD_SX}
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
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label={t("requestNotes")}
                  value={requestForm.request_notes}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, request_notes: event.target.value }))
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.7rem",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
                    },
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
            onClick={() => {
              setRequestOpen(false);
              setRequestForm(INITIAL_REQUEST_FORM);
            }}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="member-profit-request-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={
              saving ||
              (!isMember && !requestForm.member) ||
              (!isMember && Number(selectedMemberOption?.unpaidProfitTotal || 0) <= 0) ||
              (requestForm.request_mode === "PARTIAL" && !Number(requestForm.requested_amount || 0))
            }
          >
            {saving ? t("loading") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(reviewItem)}
        onClose={closeReviewDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {t("reviewProfitRequest")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox
            component="form"
            id="review-profit-request-form"
            onSubmit={handleSubmitReview}
            mt={1}
          >
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label={t("status")}
                  value={reviewForm.status}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  sx={FORM_FIELD_SX}
                >
                  <MenuItem value="APPROVED">{t("approved")}</MenuItem>
                  <MenuItem value="REJECTED">{t("rejected")}</MenuItem>
                </TextField>
              </Grid>
              {reviewForm.status === "APPROVED" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t("approvedAmount")}
                    value={reviewForm.approved_amount}
                    onChange={(event) =>
                      setReviewForm((prev) => ({
                        ...prev,
                        approved_amount: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                    sx={FORM_FIELD_SX}
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
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label={t("reviewNotes")}
                  value={reviewForm.review_notes}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, review_notes: event.target.value }))
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.7rem",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
                    },
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
            onClick={closeReviewDialog}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="review-profit-request-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={saving}
          >
            {saving ? t("loading") : t("save")}
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

export default ProfitRequestsPage;
