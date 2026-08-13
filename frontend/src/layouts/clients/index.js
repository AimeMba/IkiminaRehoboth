/* eslint-disable prettier/prettier */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import PhoneNumberField, { parsePhone } from "components/PhoneNumberField";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createClient,
  fetchCells,
  fetchClients,
  fetchDistricts,
  fetchProvinces,
  fetchSectors,
  fetchUserOptions,
  fetchVillages,
  updateClient,
} from "services/api";
import { useLanguage } from "i18n";

const INITIAL_FORM = {
  national_id: "",
  account_number: "",
  phone: "",
  address: "",
};

const INITIAL_LOCATION = {
  province: "",
  district: "",
  sector: "",
  cell: "",
  village: "",
};
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

const FORM_INPUT_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
  },
  "& .MuiInputBase-input": {
    paddingTop: "16.5px !important",
    paddingBottom: "16.5px !important",
  },
};

const FORM_ACTION_BUTTON_SX = {
  minWidth: 132,
  height: 42,
};

const STATUS_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "ACTIVE", labelKey: "active" },
  { id: "INACTIVE", labelKey: "inactive" },
];

function ClientsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [locationSelection, setLocationSelection] = useState(INITIAL_LOCATION);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [cells, setCells] = useState([]);
  const [villages, setVillages] = useState([]);
  const [clientUsers, setClientUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [countryCode, setCountryCode] = useState("+250");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const openSnackbar = (color, title, content) => {
    setSnackbar({ open: true, color, title, content });
  };
  const loadClientUsers = async () => {
    try {
      const data = await fetchUserOptions("CLIENT", "CLIENT");
      setClientUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    }
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await fetchClients();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    fetchProvinces()
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch((err) => openSnackbar("error", t("information"), err.message));
    loadClientUsers();
  }, []);

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId || !clients.length) return;

    const targetClient = clients.find((item) => String(item.id) === String(editId));
    if (targetClient) {
      handleOpenEdit(targetClient);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [clients, location.pathname, location.state]);

  useEffect(() => {
    if (!locationSelection.province) return setDistricts([]);
    fetchDistricts(locationSelection.province).then((data) =>
      setDistricts(Array.isArray(data) ? data : [])
    );
  }, [locationSelection.province]);

  useEffect(() => {
    if (!locationSelection.district) return setSectors([]);
    fetchSectors(locationSelection.district).then((data) =>
      setSectors(Array.isArray(data) ? data : [])
    );
  }, [locationSelection.district]);

  useEffect(() => {
    if (!locationSelection.sector) return setCells([]);
    fetchCells(locationSelection.sector).then((data) => setCells(Array.isArray(data) ? data : []));
  }, [locationSelection.sector]);

  useEffect(() => {
    if (!locationSelection.cell) return setVillages([]);
    fetchVillages(locationSelection.cell).then((data) =>
      setVillages(Array.isArray(data) ? data : [])
    );
  }, [locationSelection.cell]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setLocationSelection(INITIAL_LOCATION);
    setSelectedUser(null);
    setCountryCode("+250");
    setPhoneLocal("");
  };

  const setVillageFromId = (rawVillageId) => {
    const village = String(rawVillageId || "");
    if (!village) return;
    setLocationSelection({
      province: village.slice(0, 1),
      district: village.slice(0, 2),
      sector: village.slice(0, 4),
      cell: village.slice(0, 6),
      village,
    });
    setForm((prev) => ({ ...prev, address: village }));
  };

  const handleOpenEdit = (client) => {
    const currentUser = client.user
      ? {
          id: client.user,
          username: client.user_username,
          email: client.user_email,
          full_name: client.user_full_name,
        }
      : null;
    setSelectedClient(client);
    setForm({
      national_id: client.national_id || "",
      account_number: client.account_number || "",
      phone: client.phone || "",
      address: String(client.address || ""),
    });
    setSelectedUser(currentUser);
    if (currentUser) {
      setClientUsers((prev) =>
        prev.some((option) => option.id === currentUser.id) ? prev : [currentUser, ...prev]
      );
    }
    const parsedPhone = parsePhone(client.phone);
    setCountryCode(parsedPhone.countryCode);
    setPhoneLocal(parsedPhone.local);
    setVillageFromId(client.address);
    setEditOpen(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!selectedUser?.id) {
      openSnackbar("error", t("information"), t("selectUser"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user: selectedUser?.id,
        national_id: form.national_id,
        phone: form.phone,
        address: Number(form.address),
      };
      await createClient(payload);
      openSnackbar("success", t("confirmation"), t("clientCreatedSuccess"));
      setCreateOpen(false);
      resetForm();
      await loadClients();
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedClient) return;
    if (!selectedUser?.id) {
      openSnackbar("error", t("information"), t("selectUser"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user: selectedUser?.id,
        national_id: form.national_id,
        phone: form.phone,
        address: Number(form.address),
      };
      await updateClient(selectedClient.id, payload);
      openSnackbar("success", t("confirmation"), t("clientUpdatedSuccess"));
      setEditOpen(false);
      setSelectedClient(null);
      resetForm();
      await loadClients();
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const clientsTable = useMemo(() => {
    const columns = [
      { Header: t("fullName"), accessor: "full_name", align: "left" },
      { Header: t("nationalId"), accessor: "national_id", align: "left" },
      { Header: t("account"), accessor: "account_number", align: "left" },
      { Header: t("phone"), accessor: "phone", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("address"), accessor: "address", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const filteredClients = clients.filter((client) => {
      if (statusFilter === "ACTIVE") return Boolean(client.is_active);
      if (statusFilter === "INACTIVE") return !client.is_active;
      return true;
    });

    const rows = filteredClients.map((client) => ({
      full_name: <MDTypography variant="caption">{client.full_name}</MDTypography>,
      national_id: <MDTypography variant="caption">{client.national_id || "-"}</MDTypography>,
      account_number: <MDTypography variant="caption">{client.account_number}</MDTypography>,
      phone: <MDTypography variant="caption">{client.phone}</MDTypography>,
      status: (
        <MDTypography variant="caption" color={client.is_active ? "success" : "error"}>
          {client.is_active ? t("active") : t("inactive")}
        </MDTypography>
      ),
      address: (
        <MDTypography variant="caption">
          {client.address_hierarchy?.name || client.address || "-"}
        </MDTypography>
      ),
      actions: (
        <MDBox display="flex" justifyContent="center" gap={0.5}>
          <Tooltip title={t("view")}>
            <IconButton
              color="dark"
              size="small"
              onClick={() =>
                navigate(`/clients/${client.id}`, {
                  state: {
                    breadcrumbLabel:
                      client.full_name || client.user_full_name || client.national_id || "-",
                  },
                })
              }
            >
              <Icon fontSize="small">visibility</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("edit")}>
            <IconButton color="info" size="small" onClick={() => handleOpenEdit(client)}>
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      ),
    }));

    return { columns, rows };
  }, [clients, statusFilter, t]);

  const handleCountryCodeChange = (nextCode) => {
    const parsed = parsePhone(`${nextCode}${phoneLocal}`);
    const normalizedLocal = parsed.local;
    setCountryCode(nextCode);
    setPhoneLocal(normalizedLocal);
    setForm((prev) => ({ ...prev, phone: `${nextCode}${normalizedLocal}` }));
  };

  const handlePhoneLocalChange = (value) => {
    const parsed = parsePhone(`${countryCode}${value}`);
    const onlyDigits = parsed.local;
    setPhoneLocal(onlyDigits);
    setForm((prev) => ({ ...prev, phone: `${countryCode}${onlyDigits}` }));
  };

  const renderLocationFields = () => (
    <Grid item xs={12}>
      <MDBox
        mt={1}
        p={2}
        sx={{
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
          backgroundColor: "#fafcff",
        }}
      >
        <MDTypography variant="button" fontWeight="bold" color="dark">
          {t("address")}
        </MDTypography>
        <Grid container spacing={2} mt={0.5}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              popupIcon={<Icon fontSize="small">expand_more</Icon>}
              sx={DIALOG_AUTOCOMPLETE_SX}
              options={provinces}
              value={provinces.find((x) => String(x.id) === locationSelection.province) || null}
              onChange={(_e, value) =>
                setLocationSelection({
                  province: value ? String(value.id) : "",
                  district: "",
                  sector: "",
                  cell: "",
                  village: "",
                })
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("province")}
                  placeholder={t("search")}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          public
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              popupIcon={<Icon fontSize="small">expand_more</Icon>}
              sx={DIALOG_AUTOCOMPLETE_SX}
              options={districts}
              value={districts.find((x) => String(x.id) === locationSelection.district) || null}
              onChange={(_e, value) =>
                setLocationSelection((prev) => ({
                  ...prev,
                  district: value ? String(value.id) : "",
                  sector: "",
                  cell: "",
                  village: "",
                }))
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!locationSelection.province}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("district")}
                  placeholder={t("search")}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          location_city
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              popupIcon={<Icon fontSize="small">expand_more</Icon>}
              sx={DIALOG_AUTOCOMPLETE_SX}
              options={sectors}
              value={sectors.find((x) => String(x.id) === locationSelection.sector) || null}
              onChange={(_e, value) =>
                setLocationSelection((prev) => ({
                  ...prev,
                  sector: value ? String(value.id) : "",
                  cell: "",
                  village: "",
                }))
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!locationSelection.district}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("sector")}
                  placeholder={t("search")}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          account_tree
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              popupIcon={<Icon fontSize="small">expand_more</Icon>}
              sx={DIALOG_AUTOCOMPLETE_SX}
              options={cells}
              value={cells.find((x) => String(x.id) === locationSelection.cell) || null}
              onChange={(_e, value) =>
                setLocationSelection((prev) => ({
                  ...prev,
                  cell: value ? String(value.id) : "",
                  village: "",
                }))
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!locationSelection.sector}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("cell")}
                  placeholder={t("search")}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          grid_view
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              popupIcon={<Icon fontSize="small">expand_more</Icon>}
              sx={DIALOG_AUTOCOMPLETE_SX}
              options={villages}
              value={villages.find((x) => String(x.id) === locationSelection.village) || null}
              onChange={(_e, value) => {
                const villageId = value ? String(value.id) : "";
                setLocationSelection((prev) => ({ ...prev, village: villageId }));
                setForm((prev) => ({ ...prev, address: villageId }));
              }}
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!locationSelection.cell}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("village")}
                  placeholder={t("search")}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          cottage
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
    </Grid>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox
                p={3}
                display="flex"
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
                flexDirection={{ xs: "column", md: "row" }}
                gap={2}
              >
                <MDBox>
                  <MDTypography variant="h6">{t("clients")}</MDTypography>
                  <MDTypography variant="button" color="text">
                    {t("manageClientsSubtitle")}
                  </MDTypography>
                </MDBox>
                <MDBox
                  display="flex"
                  gap={2}
                  alignItems={{ xs: "stretch", md: "center" }}
                  flexDirection={{ xs: "column", md: "row" }}
                >
                  <Autocomplete
                    options={STATUS_OPTIONS}
                    value={STATUS_OPTIONS.find((item) => item.id === statusFilter) || null}
                    onChange={(_event, value) => setStatusFilter(value?.id || "ALL")}
                    sx={{ width: { xs: "100%", md: 220 }, ...DIALOG_AUTOCOMPLETE_SX }}
                    popupIcon={<Icon fontSize="small">expand_more</Icon>}
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
                                toggle_on
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
                    onClick={() => {
                      resetForm();
                      loadClientUsers();
                      setCreateOpen(true);
                    }}
                  >
                    {t("addClient")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <DataTable
                  table={clientsTable}
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("addClient")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="create-client-form" onSubmit={handleCreate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  options={clientUsers}
                  value={selectedUser}
                  onChange={(_e, value) => setSelectedUser(value)}
                  getOptionLabel={(option) => `${option.full_name} (${option.username})`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField {...params} label={t("username")} placeholder={t("search")} />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("fullName")}
                  value={selectedUser?.full_name || ""}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  required
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("nationalId")}
                  value={form.national_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      national_id: e.target.value.replace(/\D/g, "").slice(0, 16),
                    }))
                  }
                  inputProps={{ maxLength: 16, inputMode: "numeric" }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("account")}
                  value={form.account_number || t("autoGeneratedAccount")}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <PhoneNumberField
                  required
                  countryCodeLabel={t("countryCode")}
                  phoneLabel={t("phone")}
                  countryCode={countryCode}
                  phoneLocal={phoneLocal}
                  onCountryCodeChange={handleCountryCodeChange}
                  onPhoneLocalChange={handlePhoneLocalChange}
                />
              </Grid>
              {renderLocationFields()}
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions>
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
            form="create-client-form"
            variant="gradient"
            color="info"
            disabled={saving}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {saving ? t("creating") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("editClient")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="edit-client-form" onSubmit={handleUpdate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  options={clientUsers}
                  value={selectedUser}
                  onChange={(_e, value) => setSelectedUser(value)}
                  getOptionLabel={(option) => `${option.full_name} (${option.username})`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField {...params} label={t("username")} placeholder={t("search")} />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("fullName")}
                  value={selectedUser?.full_name || ""}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  required
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("nationalId")}
                  value={form.national_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      national_id: e.target.value.replace(/\D/g, "").slice(0, 16),
                    }))
                  }
                  inputProps={{ maxLength: 16, inputMode: "numeric" }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("account")}
                  value={form.account_number}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <PhoneNumberField
                  required
                  countryCodeLabel={t("countryCode")}
                  phoneLabel={t("phone")}
                  countryCode={countryCode}
                  phoneLocal={phoneLocal}
                  onCountryCodeChange={handleCountryCodeChange}
                  onPhoneLocalChange={handlePhoneLocalChange}
                />
              </Grid>
              {renderLocationFields()}
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions>
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
            form="edit-client-form"
            variant="gradient"
            color="info"
            disabled={saving}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {saving ? t("loading") : t("saveChanges")}
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

export default ClientsPage;
