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
  createSalaryPayment,
  deleteSalaryPayment,
  exportSalaryPaymentsPdf,
  fetchCurrentUser,
  fetchDepartments,
  fetchEmployees,
  fetchSalaryPaymentOptions,
  fetchSalaryPayments,
  updateSalaryPayment,
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

const INITIAL_FORM = {
  employee: null,
  amount: "",
  paid_on: "",
};
const INITIAL_FILTERS = {
  search: "",
  employee: "",
  department: "",
  date_from: "",
  date_to: "",
};

function SalaryPaymentsPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeFilterOptions, setEmployeeFilterOptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = role && !["AUDITOR", "MANAGER"].includes(role);
  const canDelete = role === "ADMIN";

  const selectedEmployee = useMemo(
    () => employees.find((item) => Number(item.id) === Number(form.employee)) || null,
    [employees, form.employee]
  );
  const selectedFilterEmployee = useMemo(
    () =>
      employeeFilterOptions.find((item) => String(item.id) === String(filters.employee)) || null,
    [employeeFilterOptions, filters.employee]
  );
  const selectedDepartment = useMemo(
    () => departments.find((item) => String(item.id) === String(filters.department)) || null,
    [departments, filters.department]
  );

  const buildFilterParams = (currentFilters = appliedFilters) => ({
    search: currentFilters.search || undefined,
    employee: currentFilters.employee || undefined,
    department: currentFilters.department || undefined,
    date_from: currentFilters.date_from || undefined,
    date_to: currentFilters.date_to || undefined,
  });

  const loadData = async (currentFilters = appliedFilters) => {
    setLoading(true);
    try {
      const [paymentsData, optionsData, employeesData, departmentsData] = await Promise.all([
        fetchSalaryPayments(buildFilterParams(currentFilters)),
        canWrite ? fetchSalaryPaymentOptions() : Promise.resolve({ employees: [] }),
        fetchEmployees(),
        fetchDepartments(),
      ]);
      setItems(Array.isArray(paymentsData) ? paymentsData : paymentsData?.results || []);
      setEmployees(Array.isArray(optionsData?.employees) ? optionsData.employees : []);
      const employeeList = Array.isArray(employeesData)
        ? employeesData
        : employeesData?.results || [];
      setEmployeeFilterOptions(
        employeeList.map((item) => ({
          id: item.id,
          label:
            item.user_name || item.member_name || item.external_full_name || `Employee #${item.id}`,
          department_name: item.department_name || "",
        }))
      );
      setDepartments(
        Array.isArray(departmentsData) ? departmentsData : departmentsData?.results || []
      );
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
  }, [user, canWrite]);

  const resetForm = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
  };

  const totalPaid = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    [items]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateSalaryPayment(editing.id, {
          amount: Number(form.amount),
          paid_on: form.paid_on || null,
        });
        notify("success", t("confirmation"), t("salaryPaymentUpdatedSuccess"));
      } else {
        await createSalaryPayment({
          employee: Number(form.employee),
          amount: Number(form.amount),
        });
        notify("success", t("confirmation"), t("salaryPaymentCreatedSuccess"));
      }

      setOpen(false);
      resetForm();
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    try {
      await deleteSalaryPayment(item.id);
      notify("success", t("confirmation"), t("salaryPaymentDeletedSuccess"));
      await loadData(appliedFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
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
      const { blob, fileName } = await exportSalaryPaymentsPdf(buildFilterParams(appliedFilters));
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
      { Header: t("employees"), accessor: "employee_name", align: "left" },
      { Header: t("departments"), accessor: "department_name", align: "left" },
      { Header: t("amount"), accessor: "amount", align: "left" },
      { Header: t("paidOn"), accessor: "paid_on", align: "left" },
      { Header: t("recordedBy"), accessor: "paid_by_name", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      employee_name: <MDTypography variant="caption">{item.employee_name || "-"}</MDTypography>,
      department_name: <MDTypography variant="caption">{item.department_name || "-"}</MDTypography>,
      amount: (
        <MDTypography variant="caption">
          {Number(item.amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      paid_on: <MDTypography variant="caption">{item.paid_on || "-"}</MDTypography>,
      paid_by_name: <MDTypography variant="caption">{item.paid_by_name || "-"}</MDTypography>,
      actions: canWrite ? (
        <MDBox display="flex" justifyContent="center" gap={0.5}>
          <Tooltip title={t("edit")}>
            <IconButton
              color="info"
              size="small"
              onClick={() => {
                setEditing(item);
                setForm({
                  employee: item.employee || null,
                  amount: String(item.amount || ""),
                  paid_on: item.paid_on || "",
                });
                setOpen(true);
              }}
            >
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
          {canDelete && (
            <Tooltip title={t("delete")}>
              <IconButton color="error" size="small" onClick={() => onDelete(item)}>
                <Icon fontSize="small">delete</Icon>
              </IconButton>
            </Tooltip>
          )}
        </MDBox>
      ) : (
        <MDTypography variant="caption" color="text">
          -
        </MDTypography>
      ),
    }));

    return { columns, rows };
  }, [items, t, canWrite, canDelete]);

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
                    <MDTypography variant="h6">{t("salaryPayments")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("salaryPaymentsSubtitle")}
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
                      <MDButton
                        variant="gradient"
                        color="info"
                        onClick={() => {
                          resetForm();
                          setOpen(true);
                        }}
                      >
                        {t("addSalaryPayment")}
                      </MDButton>
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
                      <MDTypography variant="button">{t("amount")}</MDTypography>
                      <MDTypography variant="h5">
                        {totalPaid.toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={3}>
                    <Autocomplete
                      options={employeeFilterOptions}
                      value={selectedFilterEmployee}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          employee: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) =>
                        option?.department_name
                          ? `${option.label} - ${option.department_name}`
                          : option?.label || ""
                      }
                      isOptionEqualToValue={(option, value) =>
                        String(option.id) === String(value.id)
                      }
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      renderInput={(params) => <TextField {...params} label={t("employees")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      options={departments}
                      value={selectedDepartment}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          department: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) => option.name || "-"}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      renderInput={(params) => <TextField {...params} label={t("departments")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="date"
                      label={`${t("paidOn")} (${t("from")})`}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      sx={FORM_FIELD_SX}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="date"
                      label={`${t("paidOn")} (${t("to")})`}
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
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
        >
          <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
            <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
              <MDTypography variant="h6" color="white">
                {editing ? t("editSalaryPayment") : t("addSalaryPayment")}
              </MDTypography>
            </MDBox>
          </DialogTitle>
          <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
            <MDBox component="form" id="salary-payment-form" onSubmit={onSubmit} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={editing ? 4 : 6}>
                  <Autocomplete
                    options={employees}
                    value={selectedEmployee}
                    onChange={(_e, value) => {
                      setForm((prev) => ({
                        ...prev,
                        employee: value?.id || null,
                        amount: String(value?.salary || prev.amount || ""),
                      }));
                    }}
                    getOptionLabel={(option) => option.label || "-"}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    popupIcon={<Icon fontSize="small">expand_more</Icon>}
                    disabled={Boolean(editing)}
                    sx={FORM_FIELD_SX}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("employees")}
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
                <Grid item xs={12} md={editing ? 4 : 6}>
                  <TextField
                    fullWidth
                    label={t("amount")}
                    value={form.amount}
                    disabled
                    sx={FORM_FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon fontSize="small" color="info">
                            paid
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                {editing && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label={t("paidOn")}
                      value={form.paid_on}
                      onChange={(e) => setForm((prev) => ({ ...prev, paid_on: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      sx={FORM_FIELD_SX}
                    />
                  </Grid>
                )}
              </Grid>
            </MDBox>
          </DialogContent>
          <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
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
              form="salary-payment-form"
              variant="gradient"
              color="info"
              sx={{ minHeight: 56, height: 56 }}
              disabled={saving || !form.employee || !form.amount}
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

export default SalaryPaymentsPage;
