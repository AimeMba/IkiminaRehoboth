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
import { useNavigate } from "react-router-dom";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import {
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
  createMemberSavingChoice,
  createSavingCategory,
  deleteSavingCategory,
  fetchMembers,
  fetchSavingChoices,
  fetchSavingCategories,
  updateSavingCategory,
} from "services/api";
import { useLanguage } from "i18n";

const INITIAL_FORM = {
  name: "",
  monthly_amount: "",
  year: "",
};

const getCurrentYear = () => String(new Date().getFullYear());
const INITIAL_ASSIGN_FORM = {
  year: getCurrentYear(),
  member_id: null,
  category_id: null,
};

const FORM_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
};

const FORM_ACTION_BUTTON_SX = {
  minWidth: 132,
  minHeight: 42,
  height: 42,
};

const FILTER_BUTTON_SX = {
  minHeight: 56,
  height: 56,
  minWidth: 110,
};

function SavingCategoriesPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [assignForm, setAssignForm] = useState(INITIAL_ASSIGN_FORM);
  const [assignMembers, setAssignMembers] = useState([]);
  const [assignCategories, setAssignCategories] = useState([]);
  const [yearFilter, setYearFilter] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const loadData = async (targetYear = yearFilter) => {
    setLoading(true);
    try {
      const data = await fetchSavingCategories({
        year: targetYear || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    const targetYear = assignForm.year || getCurrentYear();
    const loadAssignData = async () => {
      try {
        const [membersPayload, categoriesPayload, activeChoicesPayload] = await Promise.all([
          fetchMembers(),
          fetchSavingCategories({ year: targetYear }),
          fetchSavingChoices({ year: targetYear, is_active: true }),
        ]);

        const activeMemberIds = new Set(
          (Array.isArray(activeChoicesPayload) ? activeChoicesPayload : []).map((i) =>
            Number(i.member)
          )
        );

        const membersList = (Array.isArray(membersPayload) ? membersPayload : [])
          .filter((item) => item.is_active)
          .filter((item) => !activeMemberIds.has(Number(item.id)))
          .map((item) => ({
            id: item.id,
            label: item.user_full_name || item.user_username || item.national_id || "-",
          }));

        const categoriesList = (Array.isArray(categoriesPayload) ? categoriesPayload : []).map(
          (item) => ({
            id: item.id,
            label: `${item.name} - ${Number(item.monthly_amount || 0).toLocaleString()} ${t(
              "rwf"
            )}`,
          })
        );

        setAssignMembers(membersList);
        setAssignCategories(categoriesList);
      } catch (err) {
        notify("error", t("information"), err.message);
      }
    };

    loadAssignData();
  }, [assignOpen, assignForm.year, t]);

  const resetForm = () => setForm(INITIAL_FORM);

  const handleApplyFilter = async () => {
    await loadData(yearFilter);
  };

  const handleClearFilter = async () => {
    setYearFilter("");
    await loadData("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createSavingCategory({
        ...form,
        monthly_amount: Number(form.monthly_amount),
        year: Number(form.year),
      });
      notify("success", t("confirmation"), t("savingCategoryCreatedSuccess"));
      setCreateOpen(false);
      resetForm();
      await loadData(yearFilter);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item) => {
    setSelectedItem(item);
    setForm({
      name: item.name || "",
      monthly_amount: String(item.monthly_amount || ""),
      year: String(item.year || ""),
    });
    setEditOpen(true);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedItem) return;
    setSaving(true);
    try {
      await updateSavingCategory(selectedItem.id, {
        ...form,
        monthly_amount: Number(form.monthly_amount),
        year: Number(form.year),
      });
      notify("success", t("confirmation"), t("savingCategoryUpdatedSuccess"));
      setEditOpen(false);
      setSelectedItem(null);
      resetForm();
      await loadData(yearFilter);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (item) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await deleteSavingCategory(selectedItem.id);
      notify("success", t("confirmation"), t("savingCategoryDeletedSuccess"));
      setDeleteOpen(false);
      setSelectedItem(null);
      await loadData(yearFilter);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignChoice = async (event) => {
    event.preventDefault();
    if (!assignForm.member_id || !assignForm.category_id) {
      notify("error", t("information"), t("selectSavingChoice"));
      return;
    }
    setAssigning(true);
    try {
      await createMemberSavingChoice({
        member: Number(assignForm.member_id),
        category: Number(assignForm.category_id),
      });
      notify("success", t("confirmation"), t("savingChoiceAssignedSuccess"));
      setAssignOpen(false);
      setAssignForm(INITIAL_ASSIGN_FORM);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setAssigning(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: t("savingCategoryName"), accessor: "name", align: "left" },
      { Header: t("monthlyAmount"), accessor: "monthly_amount", align: "left" },
      { Header: t("year"), accessor: "year", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const rows = items.map((item) => ({
      name: <MDTypography variant="caption">{item.name}</MDTypography>,
      monthly_amount: (
        <MDTypography variant="caption">
          {Number(item.monthly_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      year: <MDTypography variant="caption">{item.year}</MDTypography>,
      actions: (
        <MDBox display="flex" alignItems="center" justifyContent="center" gap={0.5}>
          <Tooltip title={t("edit")}>
            <IconButton color="info" size="small" onClick={() => openEdit(item)}>
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("delete")}>
            <IconButton color="error" size="small" onClick={() => openDelete(item)}>
              <Icon fontSize="small">delete</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      ),
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
                <MDBox>
                  <MDTypography variant="h6">{t("savingCategories")}</MDTypography>
                  <MDTypography variant="button" color="text">
                    {t("savingCategoriesSubtitle")}
                  </MDTypography>
                </MDBox>
                <MDBox mt={2} display="flex" gap={1} flexWrap="wrap">
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      setAssignForm(INITIAL_ASSIGN_FORM);
                      setAssignOpen(true);
                    }}
                  >
                    {t("assignSavingChoice")}
                  </MDButton>
                  <MDButton
                    variant="outlined"
                    color="dark"
                    onClick={() => navigate("/saving-choice-requests")}
                  >
                    {t("savingChoiceRequests")}
                  </MDButton>
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={() => {
                      resetForm();
                      setCreateOpen(true);
                    }}
                  >
                    {t("addSavingCategory")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Grid container spacing={2} alignItems="center" mb={2}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label={t("year")}
                      value={yearFilter}
                      sx={FORM_FIELD_SX}
                      onChange={(e) => setYearFilter(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
                  </Grid>
                  <Grid item xs={12} md={9}>
                    <MDBox
                      display="flex"
                      gap={1}
                      justifyContent={{ xs: "flex-start", md: "flex-end" }}
                    >
                      <MDButton
                        variant="gradient"
                        color="info"
                        onClick={handleApplyFilter}
                        sx={FILTER_BUTTON_SX}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        onClick={handleClearFilter}
                        sx={FILTER_BUTTON_SX}
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
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("addSavingCategory")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox component="form" id="create-saving-category-form" onSubmit={handleCreate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label={t("savingCategoryName")}
                  value={form.name}
                  sx={FORM_FIELD_SX}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          category
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label={t("monthlyAmount")}
                  value={form.monthly_amount}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      monthly_amount: e.target.value.replace(/\D/g, ""),
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
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label={t("year")}
                  value={form.year}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      year: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          calendar_today
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
            onClick={() => setCreateOpen(false)}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="create-saving-category-form"
            variant="gradient"
            color="info"
            disabled={saving}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {saving ? t("creating") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("editSavingCategory")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox component="form" id="edit-saving-category-form" onSubmit={handleUpdate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label={t("savingCategoryName")}
                  value={form.name}
                  sx={FORM_FIELD_SX}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          category
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label={t("monthlyAmount")}
                  value={form.monthly_amount}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      monthly_amount: e.target.value.replace(/\D/g, ""),
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
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label={t("year")}
                  value={form.year}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      year: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          calendar_today
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
            onClick={() => setEditOpen(false)}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="edit-saving-category-form"
            variant="gradient"
            color="info"
            disabled={saving}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {saving ? t("loading") : t("saveChanges")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("assignSavingChoice")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox
            component="form"
            id="assign-saving-choice-form"
            onSubmit={handleAssignChoice}
            mt={1}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  required
                  label={t("year")}
                  value={assignForm.year}
                  sx={FORM_FIELD_SX}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      year: e.target.value.replace(/\D/g, "").slice(0, 4),
                      member_id: null,
                      category_id: null,
                    }))
                  }
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
              </Grid>
              <Grid item xs={12} md={5}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={FORM_FIELD_SX}
                  options={assignMembers}
                  value={assignMembers.find((item) => item.id === assignForm.member_id) || null}
                  onChange={(_e, value) =>
                    setAssignForm((prev) => ({ ...prev, member_id: value?.id || null }))
                  }
                  getOptionLabel={(option) => option.label || "-"}
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
              <Grid item xs={12} md={4}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={FORM_FIELD_SX}
                  options={assignCategories}
                  value={
                    assignCategories.find((item) => item.id === assignForm.category_id) || null
                  }
                  onChange={(_e, value) =>
                    setAssignForm((prev) => ({ ...prev, category_id: value?.id || null }))
                  }
                  getOptionLabel={(option) => option.label || "-"}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("savingCategories")}
                      placeholder={t("search")}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              savings
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton variant="outlined" color="secondary" onClick={() => setAssignOpen(false)}>
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="assign-saving-choice-form"
            variant="gradient"
            color="info"
            disabled={assigning || !assignForm.member_id || !assignForm.category_id}
          >
            {assigning ? t("creating") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("confirmation")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDTypography variant="button">{t("deleteSavingCategoryConfirm")}</MDTypography>
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton variant="outlined" color="secondary" onClick={() => setDeleteOpen(false)}>
            {t("cancel")}
          </MDButton>
          <MDButton variant="gradient" color="error" onClick={handleDelete} disabled={saving}>
            {t("delete")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <MDSnackbar
        color={snackbar.color}
        icon="notifications"
        title={snackbar.title || t("information")}
        dateTime={new Date().toLocaleTimeString(
          lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "rw-RW"
        )}
        content={snackbar.content}
        open={snackbar.open}
        close={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />

      <Footer />
    </DashboardLayout>
  );
}

export default SavingCategoriesPage;
