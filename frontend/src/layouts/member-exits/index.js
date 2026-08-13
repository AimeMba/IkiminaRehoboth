import { useEffect, useMemo, useState } from "react";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createMemberExit,
  fetchCurrentUser,
  fetchMemberExitOptions,
  fetchMemberExits,
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

function MemberExitsPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member: null, notes: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = role && !["AUDITOR", "MANAGER"].includes(role);
  const selectedMember = useMemo(
    () => memberOptions.find((item) => Number(item.id) === Number(form.member)) || null,
    [memberOptions, form.member]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [exitData, optionsData] = await Promise.all([
        fetchMemberExits(),
        canWrite ? fetchMemberExitOptions() : Promise.resolve({ members: [] }),
      ]);
      setItems(Array.isArray(exitData) ? exitData : exitData?.results || []);
      setMemberOptions(Array.isArray(optionsData?.members) ? optionsData.members : []);
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
  }, [user, canWrite]);

  const submitExit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createMemberExit({
        member: Number(form.member),
        notes: form.notes || "",
      });
      notify("success", t("confirmation"), t("memberExitCreatedSuccess"));
      setOpen(false);
      setForm({ member: null, notes: "" });
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("nationalId"), accessor: "national_id", align: "left" },
      { Header: t("totalSavings"), accessor: "total_savings", align: "left" },
      { Header: t("amount"), accessor: "amount_paid", align: "left" },
      { Header: t("time"), accessor: "exit_date", align: "left" },
      { Header: t("recordedBy"), accessor: "approved_by_name", align: "left" },
    ];
    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      member_name: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      national_id: <MDTypography variant="caption">{item.national_id || "-"}</MDTypography>,
      total_savings: (
        <MDTypography variant="caption">
          {Number(item.total_savings || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      amount_paid: (
        <MDTypography variant="caption" color="success">
          {Number(item.amount_paid || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      exit_date: <MDTypography variant="caption">{item.exit_date || "-"}</MDTypography>,
      approved_by_name: (
        <MDTypography variant="caption">{item.approved_by_name || "-"}</MDTypography>
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
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDBox>
                    <MDTypography variant="h6">{t("memberExits")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("memberExitsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  {canWrite && (
                    <MDButton variant="gradient" color="info" onClick={() => setOpen(true)}>
                      {t("addMemberExit")}
                    </MDButton>
                  )}
                </MDBox>
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
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>{t("addMemberExit")}</DialogTitle>
          <DialogContent>
            <MDBox component="form" id="member-exit-form" onSubmit={submitExit} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Autocomplete
                    options={memberOptions}
                    value={selectedMember}
                    onChange={(_e, value) =>
                      setForm((prev) => ({ ...prev, member: value?.id || null }))
                    }
                    getOptionLabel={(option) => option.label || "-"}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    popupIcon={<Icon fontSize="small">expand_more</Icon>}
                    sx={FORM_FIELD_SX}
                    renderInput={(params) => <TextField {...params} label={t("members")} />}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={t("details")}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
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
              form="member-exit-form"
              variant="gradient"
              color="info"
              sx={{ minHeight: 56, height: 56 }}
              disabled={saving || !form.member}
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

export default MemberExitsPage;
