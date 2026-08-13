import { useEffect, useMemo, useState } from "react";

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
  createDepartment,
  deleteDepartment,
  fetchCurrentUser,
  fetchDepartments,
  updateDepartment,
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
  name: "",
  base_salary: "",
};

function DepartmentsPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = role && !["AUDITOR", "MANAGER"].includes(role);
  const canDelete = role === "ADMIN";

  const loadData = async () => {
    setLoading(true);
    try {
      const payload = await fetchDepartments();
      setItems(Array.isArray(payload) ? payload : payload?.results || []);
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
    loadData();
  }, [user]);

  const totalBaseSalary = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.base_salary || 0), 0),
    [items]
  );

  const resetForm = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        base_salary: Number(form.base_salary),
      };

      if (editing) {
        await updateDepartment(editing.id, payload);
        notify("success", t("confirmation"), t("departmentUpdatedSuccess"));
      } else {
        await createDepartment(payload);
        notify("success", t("confirmation"), t("departmentCreatedSuccess"));
      }

      setOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    try {
      await deleteDepartment(item.id);
      notify("success", t("confirmation"), t("departmentDeletedSuccess"));
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("name"), accessor: "name", align: "left" },
      { Header: t("baseSalary"), accessor: "base_salary", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      name: <MDTypography variant="caption">{item.name || "-"}</MDTypography>,
      base_salary: (
        <MDTypography variant="caption">
          {Number(item.base_salary || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
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
                  name: item.name || "",
                  base_salary: String(item.base_salary || ""),
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
                    <MDTypography variant="h6">{t("departments")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("departmentsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  {canWrite && (
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={() => {
                        resetForm();
                        setOpen(true);
                      }}
                    >
                      {t("addDepartment")}
                    </MDButton>
                  )}
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
                      <MDTypography variant="button">{t("totalBaseSalary")}</MDTypography>
                      <MDTypography variant="h5">
                        {totalBaseSalary.toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <DataTable
                  table={table}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch
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
                {editing ? t("editDepartment") : t("addDepartment")}
              </MDTypography>
            </MDBox>
          </DialogTitle>
          <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
            <MDBox component="form" id="department-form" onSubmit={onSubmit} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t("name")}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    sx={FORM_FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon fontSize="small" color="info">
                            apartment
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={t("baseSalary")}
                    value={form.base_salary}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        base_salary: e.target.value.replace(/\D/g, ""),
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
              </Grid>
            </MDBox>
          </DialogContent>
          <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
            <MDButton
              variant="outlined"
              color="secondary"
              sx={FORM_ACTION_BUTTON_SX}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </MDButton>
            <MDButton
              type="submit"
              form="department-form"
              variant="gradient"
              color="info"
              sx={FORM_ACTION_BUTTON_SX}
              disabled={saving || !form.name.trim() || !form.base_salary}
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

export default DepartmentsPage;
