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
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import PhoneNumberField, { parsePhone } from "components/PhoneNumberField";
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
  createEmployee,
  deleteEmployee,
  fetchCurrentUser,
  fetchEmployeeOptions,
  fetchEmployees,
  updateEmployee,
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

const FORM_SECTION_SX = {
  p: 2,
  borderRadius: "lg",
  border: "1px solid #e5e7eb",
  backgroundColor: "#f8fafc",
};

const STATUS_OPTIONS = [
  { id: "ALL", labelKey: "all" },
  { id: "ACTIVE", labelKey: "active" },
  { id: "INACTIVE", labelKey: "inactive" },
];

const INITIAL_FORM = {
  employee_type: "MEMBER",
  user: null,
  member: null,
  external_full_name: "",
  external_national_id: "",
  external_phone: "",
  external_email: "",
  department: null,
  salary: "",
  hired_date: "",
  is_active: true,
};

function EmployeesPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });
  const [options, setOptions] = useState({ users: [], members: [], departments: [] });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [externalCountryCode, setExternalCountryCode] = useState("+250");
  const [externalPhoneLocal, setExternalPhoneLocal] = useState("");

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = role && !["AUDITOR", "MANAGER"].includes(role);
  const canDelete = role === "ADMIN";

  const selectedUser = useMemo(
    () => options.users.find((item) => Number(item.id) === Number(form.user)) || null,
    [options.users, form.user]
  );

  const selectedMember = useMemo(
    () => options.members.find((item) => Number(item.id) === Number(form.member)) || null,
    [options.members, form.member]
  );

  const selectedDepartment = useMemo(
    () => options.departments.find((item) => Number(item.id) === Number(form.department)) || null,
    [options.departments, form.department]
  );
  const isMemberType = form.employee_type === "MEMBER";

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesData, optionsData] = await Promise.all([
        fetchEmployees(),
        fetchEmployeeOptions(),
      ]);
      setItems(Array.isArray(employeesData) ? employeesData : employeesData?.results || []);
      setOptions({
        users: Array.isArray(optionsData?.users) ? optionsData.users : [],
        members: Array.isArray(optionsData?.members) ? optionsData.members : [],
        departments: Array.isArray(optionsData?.departments) ? optionsData.departments : [],
      });
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

  const resetForm = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
    setExternalCountryCode("+250");
    setExternalPhoneLocal("");
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === "ACTIVE") {
      return items.filter((item) => Boolean(item.is_active));
    }
    if (statusFilter === "INACTIVE") {
      return items.filter((item) => !item.is_active);
    }
    return items;
  }, [items, statusFilter]);

  const totalSalary = useMemo(
    () => filteredItems.reduce((acc, item) => acc + Number(item.salary || 0), 0),
    [filteredItems]
  );

  const activeCount = useMemo(
    () => filteredItems.filter((item) => Boolean(item.is_active)).length,
    [filteredItems]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        user: form.user ? Number(form.user) : null,
        member: isMemberType ? (form.member ? Number(form.member) : null) : null,
        external_full_name: isMemberType ? "" : form.external_full_name?.trim() || "",
        external_national_id: isMemberType ? "" : form.external_national_id?.trim() || "",
        external_phone: isMemberType ? "" : form.external_phone?.trim() || "",
        external_email: isMemberType ? "" : form.external_email?.trim() || "",
        department: Number(form.department),
        salary: Number(form.salary),
        hired_date: form.hired_date || null,
        is_active: Boolean(form.is_active),
      };

      if (editing) {
        await updateEmployee(editing.id, payload);
        notify("success", t("confirmation"), t("employeeUpdatedSuccess"));
      } else {
        await createEmployee(payload);
        notify("success", t("confirmation"), t("employeeCreatedSuccess"));
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
      await deleteEmployee(item.id);
      notify("success", t("confirmation"), t("employeeDeletedSuccess"));
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("username"), accessor: "user_name", align: "left" },
      { Header: t("members"), accessor: "member_name", align: "left" },
      { Header: t("departments"), accessor: "department_name", align: "left" },
      { Header: t("salary"), accessor: "salary", align: "left" },
      { Header: t("joinedOn"), accessor: "hired_date", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const rows = filteredItems.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      user_name: <MDTypography variant="caption">{item.user_name || "-"}</MDTypography>,
      member_name: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      department_name: <MDTypography variant="caption">{item.department_name || "-"}</MDTypography>,
      salary: (
        <MDTypography variant="caption">
          {Number(item.salary || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      hired_date: <MDTypography variant="caption">{item.hired_date || "-"}</MDTypography>,
      status: (
        <MDTypography
          variant="caption"
          color={item.is_active ? "success" : "error"}
          fontWeight="medium"
        >
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
                setEditing(item);
                setForm({
                  employee_type: item.member ? "MEMBER" : "EXTERNAL",
                  user: item.user || null,
                  member: item.member || null,
                  external_full_name: item.external_full_name || "",
                  external_national_id: item.external_national_id || "",
                  external_phone: item.external_phone || "",
                  external_email: item.external_email || "",
                  department: item.department || null,
                  salary: String(item.salary || ""),
                  hired_date: item.hired_date || "",
                  is_active: Boolean(item.is_active),
                });
                if (item.member) {
                  setExternalCountryCode("+250");
                  setExternalPhoneLocal("");
                } else {
                  const parsedPhone = parsePhone(item.external_phone);
                  setExternalCountryCode(parsedPhone.countryCode);
                  setExternalPhoneLocal(parsedPhone.local);
                }
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
  }, [filteredItems, t, canWrite, canDelete]);

  const handleExternalCountryCodeChange = (nextCode) => {
    const parsed = parsePhone(`${nextCode}${externalPhoneLocal}`);
    setExternalCountryCode(nextCode);
    setExternalPhoneLocal(parsed.local);
    setForm((prev) => ({ ...prev, external_phone: `${nextCode}${parsed.local}` }));
  };

  const handleExternalPhoneLocalChange = (value) => {
    const parsed = parsePhone(`${externalCountryCode}${value}`);
    setExternalPhoneLocal(parsed.local);
    setForm((prev) => ({ ...prev, external_phone: `${externalCountryCode}${parsed.local}` }));
  };

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
                  alignItems={{ xs: "stretch", md: "center" }}
                  flexDirection={{ xs: "column", md: "row" }}
                  gap={2}
                  mb={2}
                >
                  <MDBox>
                    <MDTypography variant="h6">{t("employees")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("employeesSubtitle")}
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
                      sx={{ width: { xs: "100%", md: 220 }, ...FORM_FIELD_SX }}
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
                    {canWrite && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        onClick={() => {
                          resetForm();
                          setOpen(true);
                        }}
                      >
                        {t("addEmployee")}
                      </MDButton>
                    )}
                  </MDBox>
                </MDBox>

                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("records")}</MDTypography>
                      <MDTypography variant="h5">{filteredItems.length}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("active")}</MDTypography>
                      <MDTypography variant="h5">{activeCount}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light">
                      <MDTypography variant="button">{t("totalSalary")}</MDTypography>
                      <MDTypography variant="h5">
                        {totalSalary.toLocaleString()} {t("rwf")}
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
          maxWidth="lg"
          PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
        >
          <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
            <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
              <MDTypography variant="h5" color="white">
                {editing ? t("editEmployee") : t("addEmployee")}
              </MDTypography>
            </MDBox>
          </DialogTitle>
          <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
            <MDBox component="form" id="employee-form" onSubmit={onSubmit} mt={1}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <MDBox sx={FORM_SECTION_SX}>
                    <MDBox mb={2}>
                      <MDTypography variant="button" fontWeight="medium" color="dark">
                        {t("employeeType")}
                      </MDTypography>
                    </MDBox>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          select
                          label={t("employeeType")}
                          value={form.employee_type}
                          onChange={(e) => {
                            const value = e.target.value;
                            const nextExternalPhone =
                              value === "EXTERNAL" ? form.external_phone || "" : "";
                            setForm((prev) => ({
                              ...prev,
                              employee_type: value,
                              user: prev.user,
                              member: value === "MEMBER" ? prev.member : null,
                              external_full_name:
                                value === "EXTERNAL" ? prev.external_full_name : "",
                              external_national_id:
                                value === "EXTERNAL" ? prev.external_national_id : "",
                              external_phone: value === "EXTERNAL" ? prev.external_phone : "",
                              external_email: value === "EXTERNAL" ? prev.external_email : "",
                            }));
                            if (value === "MEMBER") {
                              setExternalCountryCode("+250");
                              setExternalPhoneLocal("");
                            } else {
                              const parsedPhone = parsePhone(nextExternalPhone);
                              setExternalCountryCode(parsedPhone.countryCode);
                              setExternalPhoneLocal(parsedPhone.local);
                            }
                          }}
                          sx={FORM_FIELD_SX}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  badge
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        >
                          <MenuItem value="MEMBER">{t("memberEmployee")}</MenuItem>
                          <MenuItem value="EXTERNAL">{t("externalEmployee")}</MenuItem>
                        </TextField>
                      </Grid>
                      {isMemberType && (
                        <>
                          <Grid item xs={12} md={4}>
                            <Autocomplete
                              options={options.members}
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
                                  label={t("members")}
                                  InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        <Icon fontSize="small" color="info">
                                          groups
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
                              options={options.users}
                              value={selectedUser}
                              onChange={(_e, value) =>
                                setForm((prev) => ({ ...prev, user: value?.id || null }))
                              }
                              getOptionLabel={(option) => option.label || "-"}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                              popupIcon={<Icon fontSize="small">expand_more</Icon>}
                              sx={FORM_FIELD_SX}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label={t("username")}
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
                        </>
                      )}
                    </Grid>
                  </MDBox>
                </Grid>

                {!isMemberType && (
                  <Grid item xs={12}>
                    <MDBox sx={FORM_SECTION_SX}>
                      <MDBox mb={2}>
                        <MDTypography variant="button" fontWeight="medium" color="dark">
                          {t("employeeExternalProfile")}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block" mt={0.75}>
                          {t("employeeExternalProfileNote")}
                        </MDTypography>
                      </MDBox>
                      <MDBox
                        mb={2}
                        px={2}
                        py={1.5}
                        borderRadius="lg"
                        sx={{
                          background:
                            "linear-gradient(135deg, rgba(33, 150, 243, 0.08), rgba(33, 203, 243, 0.05))",
                          border: "1px solid rgba(33, 150, 243, 0.18)",
                        }}
                      >
                        <MDBox display="flex" alignItems="center" gap={1}>
                          <Icon color="info" fontSize="small">
                            badge
                          </Icon>
                          <MDTypography variant="caption" fontWeight="medium" color="dark">
                            {t("externalEmployee")}
                          </MDTypography>
                        </MDBox>
                      </MDBox>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Autocomplete
                            options={options.users}
                            value={selectedUser}
                            onChange={(_e, value) =>
                              setForm((prev) => ({ ...prev, user: value?.id || null }))
                            }
                            getOptionLabel={(option) => option.label || "-"}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            popupIcon={<Icon fontSize="small">expand_more</Icon>}
                            sx={FORM_FIELD_SX}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label={t("employeeWorkAccount")}
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
                            label={t("fullName")}
                            value={form.external_full_name}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, external_full_name: e.target.value }))
                            }
                            sx={FORM_FIELD_SX}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Icon fontSize="small" color="info">
                                    person
                                  </Icon>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label={t("nationalId")}
                            value={form.external_national_id}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                external_national_id: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 16),
                              }))
                            }
                            sx={FORM_FIELD_SX}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Icon fontSize="small" color="info">
                                    badge
                                  </Icon>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <PhoneNumberField
                            countryCodeLabel={t("countryCode")}
                            phoneLabel={t("phone")}
                            countryCode={externalCountryCode}
                            phoneLocal={externalPhoneLocal}
                            onCountryCodeChange={handleExternalCountryCodeChange}
                            onPhoneLocalChange={handleExternalPhoneLocalChange}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label={t("email")}
                            value={form.external_email}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, external_email: e.target.value }))
                            }
                            sx={FORM_FIELD_SX}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Icon fontSize="small" color="info">
                                    email
                                  </Icon>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                      </Grid>
                    </MDBox>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <MDBox sx={FORM_SECTION_SX}>
                    <MDBox mb={2}>
                      <MDTypography variant="button" fontWeight="medium" color="dark">
                        {t("employeesSubtitle")}
                      </MDTypography>
                    </MDBox>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Autocomplete
                          options={options.departments}
                          value={selectedDepartment}
                          onChange={(_e, value) => {
                            setForm((prev) => ({
                              ...prev,
                              department: value?.id || null,
                              salary: String(value?.base_salary || ""),
                            }));
                          }}
                          getOptionLabel={(option) => option.name || "-"}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          popupIcon={<Icon fontSize="small">expand_more</Icon>}
                          sx={FORM_FIELD_SX}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={t("departments")}
                              InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <Icon fontSize="small" color="info">
                                      apartment
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
                          label={t("salary")}
                          value={form.salary}
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
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          type="date"
                          label={t("joinedOn")}
                          value={form.hired_date}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, hired_date: e.target.value }))
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={FORM_FIELD_SX}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          select
                          label={t("status")}
                          value={form.is_active ? "active" : "inactive"}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, is_active: e.target.value === "active" }))
                          }
                          sx={FORM_FIELD_SX}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  verified_user
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        >
                          <MenuItem value="active">{t("active")}</MenuItem>
                          <MenuItem value="inactive">{t("inactive")}</MenuItem>
                        </TextField>
                      </Grid>
                    </Grid>
                  </MDBox>
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
              form="employee-form"
              variant="gradient"
              color="info"
              sx={FORM_ACTION_BUTTON_SX}
              disabled={
                saving ||
                !form.department ||
                !form.salary ||
                (isMemberType ? !form.member : !form.user || !form.external_full_name.trim())
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

export default EmployeesPage;
