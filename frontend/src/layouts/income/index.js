import { useEffect, useMemo, useState } from "react";

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

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createIncome,
  createIncomeCategory,
  deleteIncome,
  exportIncomePdf,
  fetchCurrentUser,
  fetchIncomeCategories,
  fetchIncomes,
  updateIncome,
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

const INITIAL_FORM = { category: null, amount: "", description: "" };
const INITIAL_FILTERS = {
  search: "",
  category: "",
  date_from: "",
  date_to: "",
};

function IncomePage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [categoryName, setCategoryName] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = role && !["AUDITOR", "MANAGER"].includes(role);

  const selectedFormCategory = useMemo(
    () => categories.find((item) => Number(item.id) === Number(form.category)) || null,
    [categories, form.category]
  );
  const selectedFilterCategory = useMemo(
    () => categories.find((item) => String(item.id) === String(filters.category)) || null,
    [categories, filters.category]
  );

  const buildFilterParams = (currentFilters = appliedFilters) => ({
    search: currentFilters.search || undefined,
    category: currentFilters.category || undefined,
    date_from: currentFilters.date_from || undefined,
    date_to: currentFilters.date_to || undefined,
  });

  const loadData = async (currentFilters = appliedFilters) => {
    setLoading(true);
    try {
      const [incomeData, categoryData] = await Promise.all([
        fetchIncomes(buildFilterParams(currentFilters)),
        fetchIncomeCategories(),
      ]);
      setItems(Array.isArray(incomeData) ? incomeData : incomeData?.results || []);
      setCategories(Array.isArray(categoryData) ? categoryData : categoryData?.results || []);
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

  const totalIncome = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    [items]
  );

  const submitIncome = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        category: Number(form.category),
        amount: Number(form.amount),
        description: form.description || "",
      };
      if (editing) {
        await updateIncome(editing.id, payload);
        notify("success", t("confirmation"), t("incomeUpdatedSuccess"));
      } else {
        await createIncome(payload);
        notify("success", t("confirmation"), t("incomeCreatedSuccess"));
      }
      setOpen(false);
      setEditing(null);
      setForm(INITIAL_FORM);
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    try {
      await deleteIncome(item.id);
      notify("success", t("confirmation"), t("incomeDeletedSuccess"));
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    }
  };

  const submitCategory = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createIncomeCategory({ name: categoryName });
      setCategoryName("");
      setCategoryOpen(false);
      notify("success", t("confirmation"), t("incomeCategoryCreatedSuccess"));
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchChange = async (value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    await loadData({ ...appliedFilters, search: value });
  };

  const handleApplyFilters = async () => {
    await loadData(filters);
  };

  const handleClearFilters = async () => {
    setFilters(INITIAL_FILTERS);
    await loadData(INITIAL_FILTERS);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await exportIncomePdf(buildFilterParams(appliedFilters));
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

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("type"), accessor: "category_name", align: "left" },
      { Header: t("amount"), accessor: "amount", align: "left" },
      { Header: t("details"), accessor: "description", align: "left" },
      { Header: t("time"), accessor: "income_date", align: "left" },
      { Header: t("recordedBy"), accessor: "recorded_by_name", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];
    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      category_name: <MDTypography variant="caption">{item.category_name || "-"}</MDTypography>,
      amount: (
        <MDTypography variant="caption">
          {Number(item.amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      description: <MDTypography variant="caption">{item.description || "-"}</MDTypography>,
      income_date: <MDTypography variant="caption">{item.income_date || "-"}</MDTypography>,
      recorded_by_name: (
        <MDTypography variant="caption">{item.recorded_by_name || "-"}</MDTypography>
      ),
      actions: canWrite ? (
        <MDBox display="flex" justifyContent="center" gap={0.5}>
          <Tooltip title={t("edit")}>
            <IconButton
              color="info"
              size="small"
              onClick={() => {
                setEditing(item);
                setForm({
                  category: item.category || null,
                  amount: String(item.amount || ""),
                  description: item.description || "",
                });
                setOpen(true);
              }}
            >
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("delete")}>
            <IconButton color="error" size="small" onClick={() => onDelete(item)}>
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
  }, [items, t, canWrite]);

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
                    <MDTypography variant="h6">{t("income")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("incomeSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1}>
                    <HintButton
                      variant="outlined"
                      color="info"
                      onClick={handleExportPdf}
                      disabled={loading || exporting || items.length === 0}
                      hint={!loading && !exporting && items.length === 0 ? t("noDataToExport") : ""}
                    >
                      {exporting ? t("loading") : t("exportPdf")}
                    </HintButton>
                    {canWrite && (
                      <>
                        <MDButton
                          variant="outlined"
                          color="info"
                          onClick={() => setCategoryOpen(true)}
                        >
                          {t("addIncomeCategory")}
                        </MDButton>
                        <MDButton variant="gradient" color="info" onClick={() => setOpen(true)}>
                          {t("addIncome")}
                        </MDButton>
                      </>
                    )}
                  </MDBox>
                </MDBox>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("records")}</MDTypography>
                      <MDTypography variant="h5">{items.length}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("totalSavings")}</MDTypography>
                      <MDTypography variant="h5">
                        {totalIncome.toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={3}>
                    <Autocomplete
                      options={categories}
                      value={selectedFilterCategory}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          category: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) => option.name || "-"}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      renderInput={(params) => <TextField {...params} label={t("type")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      label={`${t("time")} (${t("from")})`}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      sx={FORM_FIELD_SX}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      label={`${t("time")} (${t("to")})`}
                      value={filters.date_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      sx={FORM_FIELD_SX}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
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
                {loading && <MDTypography variant="caption">{t("loading")}</MDTypography>}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {canWrite && (
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>{editing ? t("editIncome") : t("addIncome")}</DialogTitle>
          <DialogContent>
            <MDBox component="form" id="income-form" onSubmit={submitIncome} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={categories}
                    value={selectedFormCategory}
                    onChange={(_e, value) =>
                      setForm((prev) => ({ ...prev, category: value?.id || null }))
                    }
                    getOptionLabel={(option) => option.name || "-"}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    popupIcon={<Icon fontSize="small">expand_more</Icon>}
                    sx={FORM_FIELD_SX}
                    renderInput={(params) => <TextField {...params} label={t("type")} />}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t("amount")}
                    value={form.amount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amount: e.target.value.replace(/\D/g, "") }))
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
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={t("details")}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </MDBox>
          </DialogContent>
          <DialogActions>
            <MDButton
              variant="outlined"
              color="secondary"
              sx={{ minHeight: 56, height: 56 }}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </MDButton>
            <MDButton
              type="submit"
              form="income-form"
              variant="gradient"
              color="info"
              sx={{ minHeight: 56, height: 56 }}
              disabled={saving || !form.category || !form.amount}
            >
              {saving ? t("loading") : t("save")}
            </MDButton>
          </DialogActions>
        </Dialog>
      )}

      {canWrite && (
        <Dialog open={categoryOpen} onClose={() => setCategoryOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{t("addIncomeCategory")}</DialogTitle>
          <DialogContent>
            <MDBox component="form" id="income-category-form" onSubmit={submitCategory} mt={1}>
              <TextField
                fullWidth
                sx={FORM_FIELD_SX}
                label={t("type")}
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </MDBox>
          </DialogContent>
          <DialogActions>
            <MDButton
              variant="outlined"
              color="secondary"
              sx={{ minHeight: 56, height: 56 }}
              onClick={() => setCategoryOpen(false)}
            >
              {t("cancel")}
            </MDButton>
            <MDButton
              type="submit"
              form="income-category-form"
              variant="gradient"
              color="info"
              sx={{ minHeight: 56, height: 56 }}
              disabled={saving || !categoryName.trim()}
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

export default IncomePage;
