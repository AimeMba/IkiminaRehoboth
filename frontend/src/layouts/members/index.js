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
  createMember,
  fetchCells,
  fetchDistricts,
  fetchMembers,
  fetchProvinces,
  fetchSectors,
  fetchUserOptions,
  fetchVillages,
  updateMember,
} from "services/api";
import { useLanguage } from "i18n";

const INITIAL_FORM = {
  enrollment_type: "NEW",
  national_id: "",
  account_number: "",
  phone: "",
  joined_date: "",
  address: "",
};
const INITIAL_LOC = { province: "", district: "", sector: "", cell: "", village: "" };
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

const MEMBER_STATUS_OPTIONS = [
  { id: "active", labelKey: "active" },
  { id: "exited", labelKey: "memberExits" },
  { id: "all", labelKey: "all" },
];

function MembersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loc, setLoc] = useState(INITIAL_LOC);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [cells, setCells] = useState([]);
  const [villages, setVillages] = useState([]);
  const [memberUsers, setMemberUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [countryCode, setCountryCode] = useState("+250");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("active");
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const loadMemberUsers = async () => {
    try {
      const data = await fetchUserOptions("MEMBER", "MEMBER");
      setMemberUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      notify("error", t("information"), err.message);
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await fetchMembers({ status: memberStatusFilter });
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    fetchProvinces()
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch((err) => notify("error", t("information"), err.message));
  }, [memberStatusFilter]);

  useEffect(() => {
    loadMemberUsers();
  }, []);

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId || !members.length) return;

    const targetMember = members.find((item) => String(item.id) === String(editId));
    if (targetMember) {
      handleOpenEdit(targetMember);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, members]);

  useEffect(() => {
    if (!loc.province) return setDistricts([]);
    fetchDistricts(loc.province).then((data) => setDistricts(Array.isArray(data) ? data : []));
  }, [loc.province]);

  useEffect(() => {
    if (!loc.district) return setSectors([]);
    fetchSectors(loc.district).then((data) => setSectors(Array.isArray(data) ? data : []));
  }, [loc.district]);

  useEffect(() => {
    if (!loc.sector) return setCells([]);
    fetchCells(loc.sector).then((data) => setCells(Array.isArray(data) ? data : []));
  }, [loc.sector]);

  useEffect(() => {
    if (!loc.cell) return setVillages([]);
    fetchVillages(loc.cell).then((data) => setVillages(Array.isArray(data) ? data : []));
  }, [loc.cell]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setLoc(INITIAL_LOC);
    setSelectedUser(null);
    setCountryCode("+250");
    setPhoneLocal("");
  };

  const setVillageFromId = (rawVillageId) => {
    const village = String(rawVillageId || "");
    if (!village) return;
    setLoc({
      province: village.slice(0, 1),
      district: village.slice(0, 2),
      sector: village.slice(0, 4),
      cell: village.slice(0, 6),
      village,
    });
    setForm((prev) => ({ ...prev, address: village }));
  };

  const handleOpenEdit = (member) => {
    const currentUser = member.user
      ? {
          id: member.user,
          username: member.user_username,
          email: member.user_email,
          full_name: member.user_full_name,
        }
      : null;
    setSelectedMember(member);
    setForm({
      user: member.user,
      enrollment_type: member.enrollment_type || "NEW",
      national_id: member.national_id || "",
      account_number: member.account_number || "",
      phone: member.phone || "",
      joined_date: member.joined_date || "",
      address: String(member.address || ""),
    });
    setSelectedUser(currentUser);
    if (currentUser) {
      setMemberUsers((prev) =>
        prev.some((option) => option.id === currentUser.id) ? prev : [currentUser, ...prev]
      );
    }
    const parsedPhone = parsePhone(member.phone);
    setCountryCode(parsedPhone.countryCode);
    setPhoneLocal(parsedPhone.local);
    setVillageFromId(member.address);
    setEditOpen(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!selectedUser?.id) {
      notify("error", t("information"), t("selectUser"));
      return;
    }
    setSaving(true);
    try {
      await createMember({ ...form, user: selectedUser?.id, address: Number(form.address) });
      notify("success", t("confirmation"), t("memberCreatedSuccess"));
      setCreateOpen(false);
      resetForm();
      await loadMembers();
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedMember) return;
    if (!selectedUser?.id) {
      notify("error", t("information"), t("selectUser"));
      return;
    }
    setSaving(true);
    try {
      await updateMember(selectedMember.id, {
        ...form,
        user: selectedUser?.id,
        address: Number(form.address),
      });
      notify("success", t("confirmation"), t("memberUpdatedSuccess"));
      setEditOpen(false);
      setSelectedMember(null);
      resetForm();
      await loadMembers();
    } catch (err) {
      notify("error", t("information"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const membersTable = useMemo(() => {
    const columns = [
      { Header: t("enrollmentType"), accessor: "enrollment_type", align: "left" },
      { Header: t("nationalId"), accessor: "national_id", align: "left" },
      { Header: t("username"), accessor: "user", align: "left" },
      { Header: t("account"), accessor: "account_number", align: "left" },
      { Header: t("phone"), accessor: "phone", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("joined"), accessor: "joined_date", align: "left" },
      { Header: t("address"), accessor: "address", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];
    const rows = members.map((m) => ({
      enrollment_type: (
        <MDTypography variant="caption">
          {m.enrollment_type === "FOUNDER" ? t("founderMember") : t("newMember")}
        </MDTypography>
      ),
      national_id: <MDTypography variant="caption">{m.national_id}</MDTypography>,
      user: (
        <MDTypography variant="caption">{m.user_full_name || m.user_username || "-"}</MDTypography>
      ),
      account_number: <MDTypography variant="caption">{m.account_number}</MDTypography>,
      phone: <MDTypography variant="caption">{m.phone}</MDTypography>,
      status: (
        <MDTypography variant="caption" color={m.is_active ? "success" : "error"}>
          {m.is_active ? t("active") : t("memberExits")}
        </MDTypography>
      ),
      joined_date: <MDTypography variant="caption">{m.joined_date || "-"}</MDTypography>,
      address: (
        <MDTypography variant="caption">
          {m.address_hierarchy?.name || m.address || "-"}
        </MDTypography>
      ),
      actions: (
        <MDBox display="flex" justifyContent="center" gap={0.5}>
          <Tooltip title={t("view")}>
            <IconButton
              color="dark"
              size="small"
              onClick={() =>
                navigate(`/members/${m.id}`, {
                  state: {
                    breadcrumbLabel: m.user_full_name || m.user_username || m.national_id || "-",
                  },
                })
              }
            >
              <Icon fontSize="small">visibility</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("edit")}>
            <IconButton color="info" size="small" onClick={() => handleOpenEdit(m)}>
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      ),
    }));
    return { columns, rows };
  }, [members, t]);

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

  const locationFields = (
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
              value={provinces.find((x) => String(x.id) === loc.province) || null}
              onChange={(_e, value) =>
                setLoc({
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
              value={districts.find((x) => String(x.id) === loc.district) || null}
              onChange={(_e, value) =>
                setLoc((p) => ({
                  ...p,
                  district: value ? String(value.id) : "",
                  sector: "",
                  cell: "",
                  village: "",
                }))
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!loc.province}
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
              value={sectors.find((x) => String(x.id) === loc.sector) || null}
              onChange={(_e, value) =>
                setLoc((p) => ({
                  ...p,
                  sector: value ? String(value.id) : "",
                  cell: "",
                  village: "",
                }))
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!loc.district}
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
              value={cells.find((x) => String(x.id) === loc.cell) || null}
              onChange={(_e, value) =>
                setLoc((p) => ({ ...p, cell: value ? String(value.id) : "", village: "" }))
              }
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!loc.sector}
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
          <Grid item xs={12}>
            <Autocomplete
              popupIcon={<Icon fontSize="small">expand_more</Icon>}
              sx={DIALOG_AUTOCOMPLETE_SX}
              options={villages}
              value={villages.find((x) => String(x.id) === loc.village) || null}
              onChange={(_e, value) => {
                const id = value ? String(value.id) : "";
                setLoc((p) => ({ ...p, village: id }));
                setForm((p) => ({ ...p, address: id }));
              }}
              getOptionLabel={(option) => option?.name || ""}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              disabled={!loc.cell}
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
              <MDBox p={3} display="flex" justifyContent="space-between" alignItems="center">
                <MDBox>
                  <MDTypography variant="h6">{t("members")}</MDTypography>
                  <MDTypography variant="button" color="text">
                    {t("manageMembersSubtitle")}
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" gap={2} alignItems={{ xs: "stretch", md: "center" }} flexDirection={{ xs: "column", md: "row" }}>
                  <Autocomplete
                    options={MEMBER_STATUS_OPTIONS}
                    value={MEMBER_STATUS_OPTIONS.find((item) => item.id === memberStatusFilter) || null}
                    onChange={(_event, value) => setMemberStatusFilter(value?.id || "active")}
                    sx={{ width: { xs: "100%", md: 240 }, ...DIALOG_AUTOCOMPLETE_SX }}
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
                      loadMemberUsers();
                      setCreateOpen(true);
                    }}
                  >
                    {t("addMember")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <DataTable
                  table={membersTable}
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
        <DialogTitle>{t("addMember")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="create-member-form" onSubmit={handleCreate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  options={memberUsers}
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
                <TextField
                  select
                  fullWidth
                  label={t("enrollmentType")}
                  value={form.enrollment_type}
                  onChange={(e) => setForm((p) => ({ ...p, enrollment_type: e.target.value }))}
                  sx={FORM_INPUT_SX}
                >
                  <MenuItem value="NEW">{t("newMember")}</MenuItem>
                  <MenuItem value="FOUNDER">{t("founderMember")}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  required
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("nationalId")}
                  value={form.national_id}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
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
              <Grid item xs={12} md={6}>
                <MDInput
                  fullWidth
                  type="date"
                  sx={FORM_INPUT_SX}
                  label={t("joinedOn")}
                  InputLabelProps={{ shrink: true }}
                  value={form.joined_date}
                  onChange={(e) => setForm((p) => ({ ...p, joined_date: e.target.value }))}
                />
              </Grid>
              {locationFields}
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
            form="create-member-form"
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
        <DialogTitle>{t("editMember")}</DialogTitle>
        <DialogContent>
          <MDBox component="form" id="edit-member-form" onSubmit={handleUpdate} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  sx={DIALOG_AUTOCOMPLETE_SX}
                  options={memberUsers}
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
                <TextField
                  select
                  fullWidth
                  label={t("enrollmentType")}
                  value={form.enrollment_type}
                  onChange={(e) => setForm((p) => ({ ...p, enrollment_type: e.target.value }))}
                  sx={FORM_INPUT_SX}
                >
                  <MenuItem value="NEW">{t("newMember")}</MenuItem>
                  <MenuItem value="FOUNDER">{t("founderMember")}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  required
                  fullWidth
                  sx={FORM_INPUT_SX}
                  label={t("nationalId")}
                  value={form.national_id}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
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
              <Grid item xs={12} md={6}>
                <MDInput
                  fullWidth
                  type="date"
                  sx={FORM_INPUT_SX}
                  label={t("joinedOn")}
                  InputLabelProps={{ shrink: true }}
                  value={form.joined_date}
                  onChange={(e) => setForm((p) => ({ ...p, joined_date: e.target.value }))}
                />
              </Grid>
              {locationFields}
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
            form="edit-member-form"
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
        close={() => setSnackbar((p) => ({ ...p, open: false }))}
      />
      <Footer />
    </DashboardLayout>
  );
}

export default MembersPage;
