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
import MenuItem from "@mui/material/MenuItem";
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
  createFine,
  createFineRule,
  deleteFineRule,
  exportFinesPdf,
  fetchCurrentUser,
  fetchFineFormOptions,
  fetchFineRules,
  fetchFines,
  updateFine,
  updateFineRule,
  waiveFine,
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

const WAIVER_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
};

const INITIAL_RULE_FORM = {
  name: "",
  fine_type: "SAVING",
  percentage: "",
  applies_after_days: "",
  is_active: true,
};

const INITIAL_FINE_FORM = {
  member: "",
  rule: "",
  amount: "",
};

const FINE_TYPES = ["SAVING", "LOAN", "ADMIN", "OTHER"];
const INITIAL_FILTERS = {
  search: "",
  member: "",
  status: "ALL",
  date_from: "",
  date_to: "",
};

function FinesPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [fines, setFines] = useState([]);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [fineOpen, setFineOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [ruleEditing, setRuleEditing] = useState(null);
  const [ruleForm, setRuleForm] = useState(INITIAL_RULE_FORM);
  const [fineForm, setFineForm] = useState(INITIAL_FINE_FORM);
  const [fineOptions, setFineOptions] = useState({ members: [], rules: [] });
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = role && !["AUDITOR", "MANAGER"].includes(role);

  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("all") },
      { value: "PENDING", label: t("pending") },
      { value: "PAID", label: t("paid") },
      { value: "WAIVED", label: t("waived") },
    ],
    [t]
  );

  const buildFilterParams = (currentFilters = appliedFilters) => ({
    search: currentFilters.search || undefined,
    member: currentFilters.member || undefined,
    status: currentFilters.status !== "ALL" ? currentFilters.status : undefined,
    date_from: currentFilters.date_from || undefined,
    date_to: currentFilters.date_to || undefined,
  });

  const loadData = async (currentFilters = appliedFilters) => {
    setLoading(true);
    try {
      const [rulesData, finesData, options] = await Promise.all([
        fetchFineRules(),
        fetchFines(buildFilterParams(currentFilters)),
        fetchFineFormOptions(),
      ]);
      setRules(Array.isArray(rulesData) ? rulesData : rulesData?.results || []);
      setFines(Array.isArray(finesData) ? finesData : finesData?.results || []);
      setFineOptions({
        members: Array.isArray(options?.members) ? options.members : [],
        rules: Array.isArray(options?.rules) ? options.rules : [],
      });
      setAppliedFilters(currentFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await fetchCurrentUser());
      } catch (_error) {
        setUser(null);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadData(INITIAL_FILTERS);
  }, [user]);

  useEffect(() => {
    const action = location.state?.action;
    const memberId = location.state?.memberId;
    if (!canWrite || action !== "create" || !memberId) return;

    const nextFilters = {
      ...INITIAL_FILTERS,
      member: String(memberId),
    };
    setFilters(nextFilters);
    setFineForm({ ...INITIAL_FINE_FORM, member: String(memberId) });
    loadData(nextFilters);
    setFineOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [canWrite, location.pathname, location.state, navigate]);

  const selectedFineRule = useMemo(
    () => fineOptions.rules.find((item) => Number(item.id) === Number(fineForm.rule)) || null,
    [fineOptions.rules, fineForm.rule]
  );
  const selectedFineMember = useMemo(
    () => fineOptions.members.find((item) => Number(item.id) === Number(fineForm.member)) || null,
    [fineOptions.members, fineForm.member]
  );
  const selectedFilterMemberOption = useMemo(
    () =>
      [{ id: "", label: t("all") }, ...fineOptions.members].find(
        (item) => String(item.id) === String(filters.member)
      ) || null,
    [filters.member, fineOptions.members, t]
  );
  const calculatedFineAmount = useMemo(() => {
    if (!selectedFineRule || !selectedFineMember) return "";
    const percentage = Number(selectedFineRule.percentage || 0);
    const monthlyAmount = Number(selectedFineMember.monthly_amount || 0);
    if (!percentage || !monthlyAmount) return "";
    return String(Math.round((monthlyAmount * percentage) / 100));
  }, [selectedFineRule, selectedFineMember]);

  useEffect(() => {
    setFineForm((prev) => ({ ...prev, amount: calculatedFineAmount }));
  }, [calculatedFineAmount]);

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    await loadData(INITIAL_FILTERS);
  };

  const handleClearContextMember = async () => {
    const nextFilters = { ...appliedFilters, member: "" };
    setFilters(nextFilters);
    await loadData(nextFilters);
  };

  const handleSearchChange = async (value) => {
    const nextFilters = { ...appliedFilters, search: value };
    setFilters((prev) => ({ ...prev, search: value }));
    await loadData(nextFilters);
  };

  const submitRule = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: ruleForm.name,
        fine_type: ruleForm.fine_type,
        percentage: Number(ruleForm.percentage),
        applies_after_days: Number(ruleForm.applies_after_days),
        is_active: Boolean(ruleForm.is_active),
      };
      if (ruleEditing) {
        await updateFineRule(ruleEditing.id, payload);
        notify("success", t("confirmation"), t("fineRuleUpdatedSuccess"));
      } else {
        await createFineRule(payload);
        notify("success", t("confirmation"), t("fineRuleCreatedSuccess"));
      }
      setRuleOpen(false);
      setRuleEditing(null);
      setRuleForm(INITIAL_RULE_FORM);
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (rule) => {
    try {
      await deleteFineRule(rule.id);
      notify("success", t("confirmation"), t("fineRuleDeletedSuccess"));
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    }
  };

  const submitFine = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        member: Number(fineForm.member),
        rule: Number(fineForm.rule),
      };
      await createFine(payload);
      notify("success", t("confirmation"), t("fineCreatedSuccess"));
      setFineOpen(false);
      setFineForm(INITIAL_FINE_FORM);
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const markFinePaid = async (fine) => {
    try {
      await updateFine(fine.id, { is_paid: true });
      notify("success", t("confirmation"), t("fineMarkedPaidSuccess"));
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    }
  };

  const submitWaive = async (event) => {
    event.preventDefault();
    if (!waiveTarget) return;
    setSaving(true);
    try {
      await waiveFine(waiveTarget.id, waiveReason.trim());
      notify("success", t("confirmation"), t("fineWaivedSuccess"));
      setWaiveOpen(false);
      setWaiveTarget(null);
      setWaiveReason("");
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
      const params = buildFilterParams(appliedFilters);
      const { blob, fileName } = await exportFinesPdf(params);
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

  const totals = useMemo(() => {
    const paid = fines.filter((item) => item.is_paid);
    const unpaid = fines.filter((item) => !item.is_paid && !item.is_waived);
    return {
      count: fines.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      totalAmount: fines.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    };
  }, [fines]);
  const hasFineRules = rules.length > 0;
  const contextMemberName = useMemo(
    () =>
      fineOptions.members.find((item) => String(item.id) === String(appliedFilters.member))
        ?.label ||
      fines[0]?.member_name ||
      "",
    [appliedFilters.member, fineOptions.members, fines]
  );

  const rulesTable = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("name"), accessor: "name", align: "left" },
      { Header: t("type"), accessor: "fine_type", align: "left" },
      { Header: t("percentage"), accessor: "percentage", align: "left" },
      { Header: t("afterDays"), accessor: "applies_after_days", align: "left" },
      { Header: t("status"), accessor: "is_active", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];
    const rows = rules.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      name: <MDTypography variant="caption">{item.name}</MDTypography>,
      fine_type: <MDTypography variant="caption">{item.fine_type}</MDTypography>,
      percentage: <MDTypography variant="caption">{item.percentage}%</MDTypography>,
      applies_after_days: <MDTypography variant="caption">{item.applies_after_days}</MDTypography>,
      is_active: (
        <MDTypography variant="caption" color={item.is_active ? "success" : "error"}>
          {item.is_active ? t("active") : t("inactive")}
        </MDTypography>
      ),
      actions: canWrite ? (
        <MDBox display="flex" justifyContent="center" gap={0.5}>
          <Tooltip title={t("edit")}>
            <IconButton
              color="info"
              size="small"
              onClick={() => {
                setRuleEditing(item);
                setRuleForm({
                  name: item.name,
                  fine_type: item.fine_type,
                  percentage: String(item.percentage),
                  applies_after_days: String(item.applies_after_days),
                  is_active: item.is_active,
                });
                setRuleOpen(true);
              }}
            >
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("delete")}>
            <IconButton color="error" size="small" onClick={() => removeRule(item)}>
              <Icon fontSize="small">delete</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      ) : (
        <MDTypography variant="caption" color="text">
          -
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [rules, t, canWrite]);

  const finesTable = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("type"), accessor: "rule_type", align: "left" },
      { Header: t("details"), accessor: "rule_name", align: "left" },
      { Header: t("amount"), accessor: "amount", align: "left" },
      { Header: t("time"), accessor: "calculated_on", align: "left" },
      { Header: t("status"), accessor: "is_paid", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];
    const rows = fines.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      member_name: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      rule_type: <MDTypography variant="caption">{item.rule_type || "-"}</MDTypography>,
      rule_name: <MDTypography variant="caption">{item.rule_name || "-"}</MDTypography>,
      amount: (
        <MDTypography variant="caption">
          {Number(item.amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      calculated_on: <MDTypography variant="caption">{item.calculated_on || "-"}</MDTypography>,
      is_paid: (
        <MDTypography
          variant="caption"
          color={item.is_waived ? "info" : item.is_paid ? "success" : "warning"}
        >
          {item.is_waived ? t("waived") : item.is_paid ? t("paid") : t("pending")}
        </MDTypography>
      ),
      actions: canWrite ? (
        <MDBox display="flex" justifyContent="center" gap={1}>
          {!item.is_paid && !item.is_waived && (
            <MDButton
              variant="outlined"
              color="success"
              size="small"
              onClick={() => markFinePaid(item)}
            >
              {t("markAsPaid")}
            </MDButton>
          )}
          {!item.is_paid && !item.is_waived && (
            <MDButton
              variant="outlined"
              color="info"
              size="small"
              onClick={() => {
                setWaiveTarget(item);
                setWaiveReason("");
                setWaiveOpen(true);
              }}
            >
              {t("waiveFine")}
            </MDButton>
          )}
        </MDBox>
      ) : (
        <MDTypography variant="caption" color="text">
          -
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [fines, t, canWrite]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDBox>
                    <MDTypography variant="h6">{t("fines")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("finesSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1} flexWrap="wrap">
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={FORM_BUTTON_SX}
                      disabled={exporting || loading || fines.length === 0}
                      onClick={handleExportPdf}
                      hint={!loading && !exporting && fines.length === 0 ? t("noDataToExport") : ""}
                    >
                      {exporting ? t("loading") : t("exportPdf")}
                    </HintButton>
                    {canWrite && (
                      <MDBox display="flex" gap={1} flexWrap="wrap">
                        <MDButton
                          variant="gradient"
                          color="info"
                          sx={FORM_BUTTON_SX}
                          onClick={() => setRuleOpen(true)}
                        >
                          {t("addFineRule")}
                        </MDButton>
                        <MDButton
                          variant="outlined"
                          color="info"
                          sx={FORM_BUTTON_SX}
                          disabled={!hasFineRules}
                          onClick={() => {
                            if (!hasFineRules) {
                              notify("info", t("information"), t("addFineRuleFirst"));
                              return;
                            }
                            setFineOpen(true);
                          }}
                        >
                          {t("addFine")}
                        </MDButton>
                      </MDBox>
                    )}
                  </MDBox>
                </MDBox>

                {appliedFilters.member && (
                  <ContextBanner
                    icon="gavel"
                    title={t("fines")}
                    subtitle={`${t("member")}: ${contextMemberName || `#${appliedFilters.member}`}`}
                    clearLabel={t("clear")}
                    onClear={handleClearContextMember}
                    mb={2}
                  />
                )}

                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={4}>
                    <Autocomplete
                      options={[{ id: "", label: t("all") }, ...fineOptions.members]}
                      value={selectedFilterMemberOption}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, member: value?.id || "" }))
                      }
                      getOptionLabel={(option) => option?.label || ""}
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
                      label={t("status")}
                      value={filters.status}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, status: event.target.value }))
                      }
                      sx={FORM_FIELD_SX}
                    >
                      {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
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
                      sx={{ ...FORM_BUTTON_SX, flex: 1 }}
                      onClick={handleApplyFilters}
                      disabled={loading}
                    >
                      {t("apply")}
                    </MDButton>
                    <MDButton
                      variant="outlined"
                      color="secondary"
                      sx={{ ...FORM_BUTTON_SX, flex: 1 }}
                      onClick={handleClearFilters}
                      disabled={loading}
                    >
                      {t("clear")}
                    </MDButton>
                  </Grid>
                </Grid>

                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("records")}</MDTypography>
                      <MDTypography variant="h5">{totals.count}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("paid")}</MDTypography>
                      <MDTypography variant="h5">{totals.paidCount}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("pending")}</MDTypography>
                      <MDTypography variant="h5">{totals.unpaidCount}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("amount")}</MDTypography>
                      <MDTypography variant="h5">
                        {totals.totalAmount.toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <MDTypography variant="h6" mb={1}>
                  {t("fineRules")}
                </MDTypography>
                <DataTable
                  table={rulesTable}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 5, entries: [5, 10, 20] }}
                  showTotalEntries
                  canSearch={false}
                  noEndBorder
                />
                <MDBox mt={3}>
                  <MDTypography variant="h6" mb={1}>
                    {t("fines")}
                  </MDTypography>
                  <DataTable
                    table={finesTable}
                    isSorted={false}
                    entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                    showTotalEntries
                    canSearch
                    searchValue={filters.search}
                    onSearchChange={handleSearchChange}
                    noEndBorder
                  />
                </MDBox>
                {loading && <MDTypography variant="caption">{t("loading")}</MDTypography>}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {canWrite && (
        <Dialog open={fineOpen} onClose={() => setFineOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>{t("addFine")}</DialogTitle>
          <DialogContent>
            <MDBox component="form" id="fine-form" onSubmit={submitFine} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("members")}
                    value={fineForm.member}
                    onChange={(e) => setFineForm((prev) => ({ ...prev, member: e.target.value }))}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon fontSize="small" color="info">
                            person
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                  >
                    {fineOptions.members.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("fineRules")}
                    value={fineForm.rule}
                    onChange={(e) =>
                      setFineForm((prev) => ({ ...prev, rule: e.target.value, amount: "" }))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon fontSize="small" color="info">
                            gavel
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                  >
                    {fineOptions.rules.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name} ({item.fine_type} - {item.percentage}%)
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    sx={FORM_FIELD_SX}
                    disabled
                    label={t("amount")}
                    value={fineForm.amount}
                    helperText={t("adminFineAutoCalculated")}
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
              </Grid>
            </MDBox>
          </DialogContent>
          <DialogActions>
            <MDButton
              variant="outlined"
              color="secondary"
              sx={FORM_BUTTON_SX}
              onClick={() => setFineOpen(false)}
            >
              {t("cancel")}
            </MDButton>
            <MDButton
              type="submit"
              form="fine-form"
              variant="gradient"
              color="info"
              sx={FORM_BUTTON_SX}
              disabled={saving || !fineForm.member || !fineForm.rule || !fineForm.amount}
            >
              {saving ? t("loading") : t("save")}
            </MDButton>
          </DialogActions>
        </Dialog>
      )}

      {canWrite && (
        <Dialog open={waiveOpen} onClose={() => setWaiveOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{t("waiveFine")}</DialogTitle>
          <DialogContent>
            <MDBox component="form" id="waive-fine-form" onSubmit={submitWaive} mt={1}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                sx={WAIVER_FIELD_SX}
                label={t("waiverReason")}
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
              />
            </MDBox>
          </DialogContent>
          <DialogActions>
            <MDButton
              variant="outlined"
              color="secondary"
              sx={FORM_BUTTON_SX}
              onClick={() => setWaiveOpen(false)}
            >
              {t("cancel")}
            </MDButton>
            <MDButton
              type="submit"
              form="waive-fine-form"
              variant="gradient"
              color="info"
              sx={FORM_BUTTON_SX}
              disabled={saving || !waiveReason.trim()}
            >
              {saving ? t("loading") : t("save")}
            </MDButton>
          </DialogActions>
        </Dialog>
      )}

      {canWrite && (
        <Dialog open={ruleOpen} onClose={() => setRuleOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>{ruleEditing ? t("editFineRule") : t("addFineRule")}</DialogTitle>
          <DialogContent>
            <MDBox component="form" id="fine-rule-form" onSubmit={submitRule} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("name")}
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
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
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("type")}
                    value={ruleForm.fine_type}
                    onChange={(e) =>
                      setRuleForm((prev) => ({ ...prev, fine_type: e.target.value }))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon fontSize="small" color="info">
                            category
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                  >
                    {FINE_TYPES.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("percentage")}
                    value={ruleForm.percentage}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        percentage: e.target.value.replace(/[^\d.]/g, ""),
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
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("afterDays")}
                    value={ruleForm.applies_after_days}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        applies_after_days: e.target.value.replace(/\D/g, ""),
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
              </Grid>
            </MDBox>
          </DialogContent>
          <DialogActions>
            <MDButton
              variant="outlined"
              color="secondary"
              sx={FORM_BUTTON_SX}
              onClick={() => setRuleOpen(false)}
            >
              {t("cancel")}
            </MDButton>
            <MDButton
              type="submit"
              form="fine-rule-form"
              variant="gradient"
              color="info"
              sx={FORM_BUTTON_SX}
              disabled={
                saving || !ruleForm.name || !ruleForm.percentage || !ruleForm.applies_after_days
              }
            >
              {saving ? t("loading") : t("save")}
            </MDButton>
          </DialogActions>
        </Dialog>
      )}

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

export default FinesPage;
