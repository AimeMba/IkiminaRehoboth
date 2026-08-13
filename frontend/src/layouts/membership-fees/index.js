import { useEffect, useMemo, useState } from "react";

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
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createMembershipFee,
  exportMembershipFeesPdf,
  fetchCurrentUser,
  fetchMembershipFeeOptions,
  fetchMembershipFees,
  fetchMemberOptions,
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
  date_from: "",
  date_to: "",
};

function MembershipFeesPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [paymentMemberOptions, setPaymentMemberOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({ member: null, amount: "" });
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canCreate = role === "ADMIN";

  const selectedMember = useMemo(
    () => paymentMemberOptions.find((item) => Number(item.id) === Number(form.member)) || null,
    [paymentMemberOptions, form.member]
  );
  const selectedFilterMember = useMemo(
    () => memberOptions.find((item) => String(item.id) === String(filters.member)) || null,
    [memberOptions, filters.member]
  );

  const buildFilterParams = (currentFilters = appliedFilters) => ({
    search: currentFilters.search || undefined,
    member: currentFilters.member || undefined,
    date_from: currentFilters.date_from || undefined,
    date_to: currentFilters.date_to || undefined,
  });

  const loadUser = async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch (_e) {
      setUser(null);
    }
  };

  const loadData = async (currentFilters = appliedFilters) => {
    setLoading(true);
    try {
      const [fees, filterOptions, paymentOptions] = await Promise.all([
        fetchMembershipFees(buildFilterParams(currentFilters)),
        fetchMemberOptions(),
        canCreate ? fetchMembershipFeeOptions() : Promise.resolve({ members: [] }),
      ]);
      setItems(Array.isArray(fees) ? fees : fees?.results || []);
      setMemberOptions(Array.isArray(filterOptions) ? filterOptions : []);
      setPaymentMemberOptions(Array.isArray(paymentOptions?.members) ? paymentOptions.members : []);
      setAppliedFilters(currentFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
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
  }, [user, canCreate]);

  const totalFees = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    [items]
  );

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("nationalId"), accessor: "national_id", align: "left" },
      { Header: t("account"), accessor: "account_number", align: "left" },
      { Header: t("amount"), accessor: "amount", align: "left" },
      { Header: t("paidOn"), accessor: "paid_on", align: "left" },
      { Header: t("status"), accessor: "payment_status", align: "left" },
      { Header: t("recordedBy"), accessor: "received_by_name", align: "left" },
    ];

    const rows = items.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      member_name: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      national_id: <MDTypography variant="caption">{item.national_id || "-"}</MDTypography>,
      account_number: <MDTypography variant="caption">{item.account_number || "-"}</MDTypography>,
      amount: (
        <MDTypography variant="caption">
          {Number(item.amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      paid_on: <MDTypography variant="caption">{item.paid_on || "-"}</MDTypography>,
      payment_status: (
        <MDTypography variant="caption" color="success" fontWeight="medium">
          {t("paid")}
        </MDTypography>
      ),
      received_by_name: (
        <MDTypography variant="caption">{item.received_by_name || "-"}</MDTypography>
      ),
    }));

    return { columns, rows };
  }, [items, t]);

  const submitCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createMembershipFee({
        member: Number(form.member),
        amount: Number(form.amount),
      });
      notify("success", t("confirmation"), t("membershipFeeCreatedSuccess"));
      setOpen(false);
      setForm({ member: null, amount: "" });
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
      const { blob, fileName } = await exportMembershipFeesPdf(buildFilterParams(appliedFilters));
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
                    <MDTypography variant="h6">{t("membershipFees")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("membershipFeesSubtitle")}
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
                    {canCreate && (
                      <MDButton variant="gradient" color="info" onClick={() => setOpen(true)}>
                        {t("addMembershipFee")}
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
                        {totalFees.toLocaleString()} {t("rwf")}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={3}>
                    <Autocomplete
                      options={memberOptions}
                      value={selectedFilterMember}
                      onChange={(_event, value) =>
                        setFilters((prev) => ({
                          ...prev,
                          member: value?.id ? String(value.id) : "",
                        }))
                      }
                      getOptionLabel={(option) =>
                        option?.full_name || option?.username || option?.national_id || ""
                      }
                      isOptionEqualToValue={(option, value) =>
                        String(option.id) === String(value.id)
                      }
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FORM_FIELD_SX}
                      renderInput={(params) => <TextField {...params} label={t("members")} />}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
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
                  <Grid item xs={12} md={3}>
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("addMembershipFee")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="membership-fee-form" onSubmit={submitCreate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={paymentMemberOptions}
                  value={selectedMember}
                  onChange={(_e, value) =>
                    setForm((prev) => ({ ...prev, member: value?.id || null }))
                  }
                  getOptionLabel={(option) => option.label || "-"}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={FORM_FIELD_SX}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("newMembers")}
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
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t("amount")}
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: e.target.value.replace(/\D/g, "") }))
                  }
                  sx={FORM_FIELD_SX}
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
            form="membership-fee-form"
            variant="gradient"
            color="info"
            sx={{ minHeight: 56, height: 56 }}
            disabled={saving || !form.member || !form.amount}
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

export default MembershipFeesPage;
