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
  createMonthlySaving,
  fetchCurrentUser,
  fetchMonthlySavings,
  fetchSavingChoices,
  exportMonthlySavingsPdf,
} from "services/api";
import { useLanguage } from "i18n";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_v, idx) => ({
  id: idx + 1,
  label: String(idx + 1),
}));

const INITIAL_FILTERS = {
  search: "",
  year: "",
  month: "",
  member_id: "",
  date_from: "",
  date_to: "",
};

const getCurrentYear = () => String(new Date().getFullYear());
const getCurrentMonth = () => String(new Date().getMonth() + 1);
const getInitialForm = () => ({
  year: getCurrentYear(),
  member_id: null,
  saving_choice: null,
  month: "",
  amount_paid: "",
  saved_on: "",
});

const DIALOG_AUTOCOMPLETE_SX = {
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

const FILTER_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
    borderRadius: "0.7rem",
  },
};

const FILTER_AUTOCOMPLETE_SX = {
  ...FILTER_FIELD_SX,
  "& .MuiOutlinedInput-root": {
    ...FILTER_FIELD_SX["& .MuiOutlinedInput-root"],
    backgroundColor: "#ffffff",
  },
};

const FILTER_BUTTON_SX = {
  minHeight: 56,
  height: 56,
  minWidth: 0,
  flex: 1,
  px: 2,
};

function MonthlySavingsPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [savingChoices, setSavingChoices] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [form, setForm] = useState(getInitialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });
  const [contextMemberId, setContextMemberId] = useState("");
  const [statusPeriod, setStatusPeriod] = useState({
    year: getCurrentYear(),
    month: getCurrentMonth(),
  });
  const [statusRecords, setStatusRecords] = useState([]);
  const [statusChoices, setStatusChoices] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const canCreate = ["ADMIN", "TELLER"].includes(String(user?.effective_role || user?.role || ""));

  const loadUser = async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (_err) {
      setUser(null);
    }
  };

  const loadChoices = async (targetYear) => {
    try {
      const payload = await fetchSavingChoices({
        is_active: true,
        year: targetYear || undefined,
      });
      setSavingChoices(Array.isArray(payload) ? payload : []);
    } catch (err) {
      notify("error", t("information"), err.message);
      setSavingChoices([]);
    }
  };

  const loadData = async (currentFilters = appliedFilters) => {
    setLoading(true);
    try {
      const payload = await fetchMonthlySavings(currentFilters);
      setItems(Array.isArray(payload) ? payload : []);
      setAppliedFilters(currentFilters);
      setContextMemberId(currentFilters.member_id || "");
    } catch (err) {
      notify("error", t("information"), err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStatusBoard = async (period = statusPeriod) => {
    if (!period?.year || !period?.month) {
      setStatusRecords([]);
      setStatusChoices([]);
      return;
    }
    setStatusLoading(true);
    try {
      const [recordsPayload, choicesPayload] = await Promise.all([
        fetchMonthlySavings({
          year: period.year,
          month: period.month,
        }),
        fetchSavingChoices({
          is_active: true,
          year: period.year,
        }),
      ]);
      setStatusRecords(Array.isArray(recordsPayload) ? recordsPayload : []);
      setStatusChoices(Array.isArray(choicesPayload) ? choicesPayload : []);
    } catch (err) {
      notify("error", t("information"), err.message);
      setStatusRecords([]);
      setStatusChoices([]);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    loadChoices(form.year);
  }, [createOpen, form.year]);

  useEffect(() => {
    const action = location.state?.action;
    const memberId = location.state?.memberId;
    if (!canCreate || action !== "create" || !memberId) return;

    const nextFilters = {
      ...INITIAL_FILTERS,
      member_id: String(memberId),
    };
    setFilters(nextFilters);
    loadData(nextFilters);
    setForm({
      ...getInitialForm(),
      member_id: Number(memberId),
    });
    setCreateOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [canCreate, location.pathname, location.state, navigate]);

  useEffect(() => {
    loadData(INITIAL_FILTERS);
  }, []);

  useEffect(() => {
    loadStatusBoard();
  }, []);

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    await loadData(INITIAL_FILTERS);
  };

  const handleApplyStatusPeriod = async () => {
    await loadStatusBoard(statusPeriod);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await exportMonthlySavingsPdf(appliedFilters);
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
    if (!form.saving_choice) {
      notify("error", t("information"), t("selectSavingChoice"));
      return;
    }
    setSaving(true);
    try {
      await createMonthlySaving({
        saving_choice: form.saving_choice,
        month: Number(form.month),
        amount_paid: Number(form.amount_paid),
        saved_on: form.saved_on || null,
      });
      notify("success", t("confirmation"), t("monthlySavingCreatedSuccess"));
      setCreateOpen(false);
      setForm(getInitialForm());
      await loadData(appliedFilters);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("savingCategories"), accessor: "category_name", align: "left" },
      { Header: t("month"), accessor: "month", align: "left" },
      { Header: t("year"), accessor: "year", align: "left" },
      { Header: t("amount"), accessor: "amount_paid", align: "left" },
      { Header: t("savedOn"), accessor: "saved_on", align: "left" },
      { Header: t("lateFine"), accessor: "late_fine_amount", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
    ];

    const rows = items.map((item) => ({
      member_name: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      category_name: <MDTypography variant="caption">{item.category_name || "-"}</MDTypography>,
      month: <MDTypography variant="caption">{item.month}</MDTypography>,
      year: <MDTypography variant="caption">{item.year}</MDTypography>,
      amount_paid: (
        <MDTypography variant="caption">
          {Number(item.amount_paid || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      saved_on: <MDTypography variant="caption">{item.saved_on || "-"}</MDTypography>,
      late_fine_amount: (
        <MDTypography variant="caption" color={item.late_fine_amount ? "error" : "text"}>
          {Number(item.late_fine_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      status: (
        <MDTypography
          variant="caption"
          color={item.committee_review_required ? "error" : item.is_late ? "warning" : "success"}
        >
          {item.committee_review_required
            ? t("committeeReviewRequired")
            : item.is_late
            ? t("late")
            : t("onTime")}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [items, t]);

  const selectedChoice = useMemo(
    () => savingChoices.find((item) => item.id === form.saving_choice) || null,
    [savingChoices, form.saving_choice]
  );

  const memberOptions = useMemo(() => {
    const map = new Map();
    savingChoices.forEach((item) => {
      if (!map.has(item.member)) {
        map.set(item.member, {
          id: item.member,
          name: item.member_name || "-",
        });
      }
    });
    return Array.from(map.values());
  }, [savingChoices]);

  const selectedMember = useMemo(
    () => memberOptions.find((item) => item.id === form.member_id) || null,
    [memberOptions, form.member_id]
  );

  useEffect(() => {
    if (!form.member_id) {
      setForm((prev) => ({ ...prev, saving_choice: null, amount_paid: "" }));
      return;
    }
    const memberChoice = savingChoices.find((item) => item.member === form.member_id) || null;
    setForm((prev) => ({
      ...prev,
      saving_choice: memberChoice?.id || null,
      amount_paid: memberChoice ? String(memberChoice.category_monthly_amount || "") : "",
    }));
  }, [form.member_id, savingChoices]);

  const selectedFinePreview = useMemo(() => {
    if (!form.amount_paid) return 0;
    const amount = Number(form.amount_paid || 0);
    return Math.round(amount * 0.1);
  }, [form.amount_paid]);

  const paidMembers = useMemo(() => {
    const seenMembers = new Set();
    return statusRecords
      .filter((item) => {
        const memberId = Number(item.member_id || 0);
        if (!memberId || seenMembers.has(memberId)) return false;
        seenMembers.add(memberId);
        return true;
      })
      .map((item) => ({
        member_id: item.member_id,
        member_name: item.member_name || "-",
        category_name: item.category_name || "-",
        amount_paid: item.amount_paid || 0,
        saved_on: item.saved_on || "-",
        payment_status: item.is_late ? t("late") : t("onTime"),
        payment_status_color: item.is_late ? "warning" : "success",
      }));
  }, [statusRecords, t]);

  const paidMemberIdSet = useMemo(
    () => new Set(paidMembers.map((item) => Number(item.member_id || 0))),
    [paidMembers]
  );

  const unpaidMembers = useMemo(
    () =>
      statusChoices
        .filter((choice) => !paidMemberIdSet.has(Number(choice.member || 0)))
        .map((choice) => ({
          member_id: choice.member,
          member_name: choice.member_name || "-",
          category_name: choice.category_name || "-",
          expected_amount: choice.category_monthly_amount || 0,
        })),
    [paidMemberIdSet, statusChoices]
  );
  const contextMemberName = useMemo(() => {
    const matchFromItems = items.find((item) => String(item.member_id) === String(contextMemberId));
    if (matchFromItems?.member_name) return matchFromItems.member_name;
    const matchFromStatus =
      paidMembers.find((item) => String(item.member_id) === String(contextMemberId)) ||
      unpaidMembers.find((item) => String(item.member_id) === String(contextMemberId));
    return matchFromStatus?.member_name || "";
  }, [contextMemberId, items, paidMembers, unpaidMembers]);

  const handleSearchChange = async (value) => {
    const nextFilters = { ...appliedFilters, search: value };
    setFilters((prev) => ({ ...prev, search: value }));
    await loadData(nextFilters);
  };

  const paidTable = useMemo(() => {
    const columns = [
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("savingCategories"), accessor: "category_name", align: "left" },
      { Header: t("amount"), accessor: "amount_paid", align: "left" },
      { Header: t("savedOn"), accessor: "saved_on", align: "left" },
      { Header: t("status"), accessor: "payment_status", align: "left" },
    ];
    const rows = paidMembers.map((item) => ({
      member_name: <MDTypography variant="caption">{item.member_name}</MDTypography>,
      category_name: <MDTypography variant="caption">{item.category_name}</MDTypography>,
      amount_paid: (
        <MDTypography variant="caption">
          {Number(item.amount_paid).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      saved_on: <MDTypography variant="caption">{item.saved_on}</MDTypography>,
      payment_status: (
        <MDTypography variant="caption" color={item.payment_status_color}>
          {item.payment_status}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [paidMembers, t]);

  const unpaidTable = useMemo(() => {
    const columns = [
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("savingCategories"), accessor: "category_name", align: "left" },
      { Header: t("expectedAmount"), accessor: "expected_amount", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
    ];
    const rows = unpaidMembers.map((item) => ({
      member_name: <MDTypography variant="caption">{item.member_name}</MDTypography>,
      category_name: <MDTypography variant="caption">{item.category_name}</MDTypography>,
      expected_amount: (
        <MDTypography variant="caption">
          {Number(item.expected_amount).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      status: (
        <MDTypography variant="caption" color="error">
          {t("unpaidMembers")}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [unpaidMembers, t]);

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
                    <MDTypography variant="h6">{t("monthlySavings")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("monthlySavingsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1.5} flexWrap="wrap">
                    <HintButton
                      variant="outlined"
                      color="info"
                      disabled={exporting || loading || items.length === 0}
                      onClick={handleExportPdf}
                      sx={FILTER_BUTTON_SX}
                      hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportPdf")}
                    </HintButton>
                    {canCreate && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        onClick={() => {
                          setForm(getInitialForm());
                          setCreateOpen(true);
                        }}
                        sx={FILTER_BUTTON_SX}
                      >
                        {t("recordMonthlySaving")}
                      </MDButton>
                    )}
                  </MDBox>
                </MDBox>

                {contextMemberId && (
                  <ContextBanner
                    icon="calendar_month"
                    title={t("monthlySavings")}
                    subtitle={`${t("member")}: ${contextMemberName || `#${contextMemberId}`}`}
                    clearLabel={t("clear")}
                    onClear={handleClearFilters}
                    mt={2}
                  />
                )}

                <MDBox mt={2} p={2} borderRadius="lg" bgColor="light">
                  <MDTypography variant="button" fontWeight="bold" color="error">
                    {t("article7Title")}
                  </MDTypography>
                  <MDTypography variant="caption" display="block" color="text">
                    {t("article7Rule1")}
                  </MDTypography>
                  <MDTypography variant="caption" display="block" color="text">
                    {t("article7Rule2")}
                  </MDTypography>
                  <MDTypography variant="caption" display="block" color="text" fontWeight="regular">
                    {t("decemberPolicyNote")}
                  </MDTypography>
                </MDBox>

                <MDBox mt={3}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={2}>
                      <MDInput
                        sx={FILTER_FIELD_SX}
                        fullWidth
                        label={t("year")}
                        value={filters.year}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            year: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Autocomplete
                        popupIcon={<Icon fontSize="small">expand_more</Icon>}
                        sx={FILTER_AUTOCOMPLETE_SX}
                        options={MONTH_OPTIONS}
                        value={
                          MONTH_OPTIONS.find((item) => String(item.id) === String(filters.month)) ||
                          null
                        }
                        onChange={(_event, value) =>
                          setFilters((prev) => ({
                            ...prev,
                            month: value?.id ? String(value.id) : "",
                          }))
                        }
                        getOptionLabel={(option) => option.label || ""}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={t("month")}
                            placeholder={t("search")}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Icon fontSize="small" color="info">
                                    event
                                  </Icon>
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <MDInput
                        sx={FILTER_FIELD_SX}
                        fullWidth
                        label={t("memberId")}
                        value={filters.member_id}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            member_id: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <MDInput
                        sx={FILTER_FIELD_SX}
                        fullWidth
                        type="date"
                        label={t("from")}
                        InputLabelProps={{ shrink: true }}
                        value={filters.date_from}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <MDInput
                        sx={FILTER_FIELD_SX}
                        fullWidth
                        type="date"
                        label={t("to")}
                        InputLabelProps={{ shrink: true }}
                        value={filters.date_to}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, date_to: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <MDBox
                        display="flex"
                        width="100%"
                        alignItems="stretch"
                        justifyContent="stretch"
                        gap={1}
                      >
                        <MDButton
                          variant="gradient"
                          color="info"
                          onClick={handleApplyFilters}
                          sx={FILTER_BUTTON_SX}
                        >
                          {t("apply")}
                        </MDButton>
                        <MDButton
                          variant="outlined"
                          color="secondary"
                          onClick={handleClearFilters}
                          sx={FILTER_BUTTON_SX}
                        >
                          {t("clear")}
                        </MDButton>
                      </MDBox>
                    </Grid>
                  </Grid>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

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
                    <MDTypography variant="h6">{t("paymentStatusOverview")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {`${t("month")}: ${statusPeriod.month} - ${t("year")}: ${statusPeriod.year}`}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1} flexWrap="wrap">
                    <TextField
                      label={t("year")}
                      value={statusPeriod.year}
                      onChange={(e) =>
                        setStatusPeriod((prev) => ({
                          ...prev,
                          year: e.target.value.replace(/\D/g, "").slice(0, 4),
                        }))
                      }
                      sx={{ ...DIALOG_AUTOCOMPLETE_SX, width: { xs: "100%", md: 130 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              calendar_month
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Autocomplete
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={{ ...DIALOG_AUTOCOMPLETE_SX, width: { xs: "100%", md: 130 } }}
                      options={MONTH_OPTIONS}
                      value={
                        MONTH_OPTIONS.find(
                          (item) => String(item.id) === String(statusPeriod.month)
                        ) || null
                      }
                      onChange={(_event, value) =>
                        setStatusPeriod((prev) => ({
                          ...prev,
                          month: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) => option.label || ""}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("month")}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  event
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={handleApplyStatusPeriod}
                      sx={{ height: 56, minWidth: 110 }}
                    >
                      {t("apply")}
                    </MDButton>
                  </MDBox>
                </MDBox>

                <Grid container spacing={2} mt={0.5}>
                  <Grid item xs={12} md={6}>
                    <MDBox
                      p={2}
                      borderRadius="lg"
                      sx={{
                        background: "linear-gradient(135deg, #1d8cf8 0%, #3358f4 100%)",
                        color: "#fff",
                      }}
                    >
                      <MDTypography variant="button" color="white">
                        {t("paidMembers")}
                      </MDTypography>
                      <MDTypography variant="h4" color="white" fontWeight="bold">
                        {paidMembers.length}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDBox
                      p={2}
                      borderRadius="lg"
                      sx={{
                        background: "linear-gradient(135deg, #ef5350 0%, #e53935 100%)",
                        color: "#fff",
                      }}
                    >
                      <MDTypography variant="button" color="white">
                        {t("unpaidMembers")}
                      </MDTypography>
                      <MDTypography variant="h4" color="white" fontWeight="bold">
                        {unpaidMembers.length}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <Grid container spacing={2} mt={0.5}>
                  <Grid item xs={12} md={6}>
                    <DataTable
                      table={paidTable}
                      isSorted={false}
                      entriesPerPage={{ defaultValue: 5, entries: [5, 10, 20] }}
                      showTotalEntries
                      canSearch
                      noEndBorder
                    />
                    {!statusLoading && paidMembers.length === 0 && (
                      <MDTypography variant="caption" color="text">
                        {t("noPaidMembers")}
                      </MDTypography>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <DataTable
                      table={unpaidTable}
                      isSorted={false}
                      entriesPerPage={{ defaultValue: 5, entries: [5, 10, 20] }}
                      showTotalEntries
                      canSearch
                      noEndBorder
                    />
                    {!statusLoading && unpaidMembers.length === 0 && (
                      <MDTypography variant="caption" color="text">
                        {t("noUnpaidMembers")}
                      </MDTypography>
                    )}
                  </Grid>
                </Grid>

                {statusLoading && (
                  <MDTypography variant="caption" color="text">
                    {t("loading")}
                  </MDTypography>
                )}
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
                  canSearch
                  searchValue={filters.search}
                  onSearchChange={handleSearchChange}
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
            <MDTypography variant="h5" color="white">
              {t("recordMonthlySaving")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox component="form" id="create-monthly-saving-form" onSubmit={handleCreate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label={t("year")}
                  value={form.year}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          calendar_month
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      year: e.target.value.replace(/\D/g, "").slice(0, 4),
                      member_id: null,
                    }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  options={memberOptions}
                  value={selectedMember}
                  onChange={(_event, value) =>
                    setForm((prev) => ({
                      ...prev,
                      member_id: value?.id || null,
                    }))
                  }
                  getOptionLabel={(option) => option.name || "-"}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("members")}
                      placeholder={t("search")}
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
              {selectedChoice && (
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
                      <Grid item xs={12} md={6}>
                        <MDTypography variant="button" fontWeight="bold" color="dark">
                          {t("selectedMember")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedChoice.member_name || "-"}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <MDTypography variant="button" fontWeight="bold" color="dark">
                          {t("selectedPlan")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {selectedChoice.category_name || "-"} (
                          {selectedChoice.category_year || "-"})
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <MDTypography variant="button" fontWeight="bold" color="dark">
                          {t("amount")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="text">
                          {Number(selectedChoice.category_monthly_amount || 0).toLocaleString()}{" "}
                          {t("rwf")}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <MDTypography variant="button" fontWeight="bold" color="error">
                          {t("lateFinePreview")}:
                        </MDTypography>
                        <MDTypography variant="button" display="block" color="error">
                          {selectedFinePreview.toLocaleString()} {t("rwf")}
                        </MDTypography>
                      </Grid>
                    </Grid>
                  </MDBox>
                </Grid>
              )}
              {form.member_id && !selectedChoice && (
                <Grid item xs={12}>
                  <MDBox p={2} borderRadius="lg" bgColor="error" opacity={0.1}>
                    <MDTypography variant="button" color="error">
                      {t("noSavingChoiceForYear")}
                    </MDTypography>
                  </MDBox>
                </Grid>
              )}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  options={MONTH_OPTIONS}
                  value={
                    MONTH_OPTIONS.find((item) => String(item.id) === String(form.month)) || null
                  }
                  onChange={(_event, value) =>
                    setForm((prev) => ({
                      ...prev,
                      month: value?.id ? String(value.id) : "",
                    }))
                  }
                  getOptionLabel={(option) => option.label || ""}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("month")}
                      placeholder={t("search")}
                      required
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              event
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
                  label={t("amount")}
                  disabled
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          payments
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  value={
                    form.amount_paid
                      ? `${Number(form.amount_paid).toLocaleString()} ${t("rwf")}`
                      : ""
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label={t("savedOn")}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          today
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  value={form.saved_on}
                  onChange={(e) => setForm((prev) => ({ ...prev, saved_on: e.target.value }))}
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
            form="create-monthly-saving-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={saving || !form.saving_choice || !form.member_id || !form.month}
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

export default MonthlySavingsPage;
