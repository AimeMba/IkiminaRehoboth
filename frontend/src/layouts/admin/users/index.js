import { useCallback, useEffect, useMemo, useState } from "react";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Icon from "components/AppIcon";
import InputAdornment from "@mui/material/InputAdornment";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDSnackbar from "components/MDSnackbar";
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
  fetchUsers,
  fetchCurrentRoleHolders,
  fetchStaffAccountHolderHistory,
  fetchRoleAssignmentHistory,
  createUser,
  updateUser,
  resetUserPassword,
} from "services/api";
import { useLanguage } from "i18n";

const ROLE_OPTIONS = [
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "TELLER",
  "LOAN_OFFICER",
  "FINANCE",
  "AUDITOR",
  "CLIENT",
];
const ACCOUNT_CATEGORY_OPTIONS = ["MEMBER_ACCOUNT", "CLIENT_ACCOUNT", "STAFF_ACCOUNT"];
const STAFF_ROLE_OPTIONS = ["ADMIN", "MANAGER", "TELLER", "LOAN_OFFICER", "FINANCE", "AUDITOR"];

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

const ROLE_AUTOCOMPLETE_SX = {
  ...FORM_FIELD_SX,
  "& .MuiInputLabel-root": {
    color: "#4f5d78",
    fontWeight: 500,
  },
  "& .MuiInputLabel-shrink": {
    backgroundColor: "#ffffff",
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: "0.35rem",
  },
};

const TABLE_ROLE_SELECT_SX = {
  minWidth: 148,
  "& .MuiOutlinedInput-root": {
    minHeight: 34,
    height: 34,
  },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    py: 0.5,
    fontSize: "0.8rem",
  },
};

const ROLE_COLUMN_ICON = "badge";
const USER_STATUS_OPTIONS = ["ALL", "ACTIVE", "INACTIVE"];

function AdminUsers() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [currentRoleHolders, setCurrentRoleHolders] = useState([]);
  const [roleHistory, setRoleHistory] = useState([]);
  const [staffHolderHistory, setStaffHolderHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const [form, setForm] = useState({
    account_category: "STAFF_ACCOUNT",
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "MANAGER",
    password: "",
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersPayload, holdersPayload, historyPayload, staffHolderPayload] = await Promise.all([
        fetchUsers(),
        fetchCurrentRoleHolders(),
        fetchRoleAssignmentHistory(),
        fetchStaffAccountHolderHistory(),
      ]);
      setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      setCurrentRoleHolders(Array.isArray(holdersPayload) ? holdersPayload : []);
      setRoleHistory(Array.isArray(historyPayload) ? historyPayload : []);
      setStaffHolderHistory(Array.isArray(staffHolderPayload) ? staffHolderPayload : []);
    } catch (err) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setCreating(true);

    try {
      await createUser(form);
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: t("userCreatedSuccess"),
      });
      setForm({
        account_category: "STAFF_ACCOUNT",
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        role: "MANAGER",
        password: "",
      });
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: err.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: `${t("userUpdatedSuccess")}: ${user.username}`,
      });
      await loadUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: err.message,
      });
    }
  };

  const handleRoleChange = async (user, role) => {
    if (role === user.role) return;
    try {
      await updateUser(user.id, { role });
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: `${t("roleUpdatedSuccess")}: ${user.username}`,
      });
      await loadUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: err.message,
      });
    }
  };

  const handleOpenResetPassword = (user) => {
    setSelectedUser(user);
    setNewPassword("");
    setResetPasswordOpen(true);
  };

  const handleUnlockUser = async (user, openResetAfter = false) => {
    try {
      await updateUser(user.id, { is_active: true });
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: `${t("accountUnlockedSuccess")}: ${user.username}`,
      });
      await loadUsers();
      if (openResetAfter) {
        handleOpenResetPassword(user);
      }
    } catch (err) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: err.message,
      });
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    try {
      await resetUserPassword(selectedUser.id, newPassword);
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: `${t("passwordResetSuccess")}: ${selectedUser.username}`,
      });
      setResetPasswordOpen(false);
      setSelectedUser(null);
      setNewPassword("");
    } catch (err) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: err.message,
      });
    }
  };

  const filteredUsers = useMemo(() => {
    if (userStatusFilter === "ACTIVE") {
      return users.filter((user) => user.is_active);
    }
    if (userStatusFilter === "INACTIVE") {
      return users.filter((user) => !user.is_active);
    }
    return users;
  }, [users, userStatusFilter]);

  const roleOptionsForCategory = useMemo(() => {
    if (form.account_category === "MEMBER_ACCOUNT") return ["MEMBER"];
    if (form.account_category === "CLIENT_ACCOUNT") return ["CLIENT"];
    return STAFF_ROLE_OPTIONS;
  }, [form.account_category]);

  const getHolderTypeLabel = useCallback(
    (holderType) => {
      if (holderType === "MEMBER") return t("member");
      if (holderType === "CLIENT") return t("client");
      if (holderType === "EXTERNAL") return t("externalHolder");
      return t("staffAccount");
    },
    [t]
  );

  const getAccountCategoryLabel = useCallback(
    (category) => {
      if (category === "MEMBER_ACCOUNT") return t("memberAccount");
      if (category === "CLIENT_ACCOUNT") return t("clientAccount");
      return t("staffAccount");
    },
    [t]
  );

  const usersTable = useMemo(() => {
    const columns = [
      { Header: t("username"), accessor: "username", align: "left" },
      { Header: t("holder"), accessor: "holder", align: "left" },
      { Header: "Email", accessor: "email", align: "left" },
      { Header: "Role", accessor: "role", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("security"), accessor: "security", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "left" },
    ];

    const rows = filteredUsers.map((user) => ({
      username: (
        <MDBox>
          <MDTypography variant="button">{user.full_name || user.username}</MDTypography>
          <MDTypography variant="caption" color="text" display="block">
            @{user.username}
          </MDTypography>
        </MDBox>
      ),
      holder: (
        <MDBox>
          <MDTypography variant="button">
            {user.holder_name || user.full_name || user.username}
          </MDTypography>
          <MDTypography variant="caption" color="info" display="block">
            {getHolderTypeLabel(user.holder_type)}
          </MDTypography>
        </MDBox>
      ),
      email: <MDTypography variant="caption">{user.email || "-"}</MDTypography>,
      role: (
        <MDInput
          select
          size="small"
          value={user.role}
          onChange={(e) => handleRoleChange(user, e.target.value)}
          sx={TABLE_ROLE_SELECT_SX}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0.5 }}>
                <Icon fontSize="small" color="info">
                  {ROLE_COLUMN_ICON}
                </Icon>
              </InputAdornment>
            ),
          }}
        >
          {ROLE_OPTIONS.map((role) => (
            <MenuItem key={role} value={role}>
              <MDTypography variant="caption">{role}</MDTypography>
            </MenuItem>
          ))}
        </MDInput>
      ),
      status: (
        <Tooltip title={user.is_active ? t("active") : t("inactive")}>
          <IconButton
            color={user.is_active ? "success" : "default"}
            onClick={() => handleToggleActive(user)}
            size="medium"
            sx={{ p: 0.75 }}
          >
            <Icon fontSize="medium">{user.is_active ? "toggle_on" : "toggle_off"}</Icon>
          </IconButton>
        </Tooltip>
      ),
      security: (
        <MDBox>
          <MDTypography variant="caption" color={user.locked_by_system ? "error" : "success"}>
            {user.locked_by_system ? t("accountLocked") : t("accountNormal")}
          </MDTypography>
          <MDTypography variant="caption" color="text" display="block">
            {`${t("attempts")}: ${Number(user.failed_login_attempts || 0)}`}
          </MDTypography>
        </MDBox>
      ),
      actions: (
        <Stack direction="row" spacing={1}>
          {user.locked_by_system && (
            <Tooltip title={t("unlockAccount")}>
              <IconButton color="success" onClick={() => handleUnlockUser(user, true)} size="small">
                <Icon fontSize="small">lock_open</Icon>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t("passwordReset")}>
            <IconButton color="info" onClick={() => handleOpenResetPassword(user)} size="small">
              <Icon fontSize="small">lock_reset</Icon>
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    }));

    return { columns, rows };
  }, [filteredUsers, getHolderTypeLabel, t]);

  const currentRoleHolderCards = useMemo(() => {
    const staffRoles = ["ADMIN", "MANAGER", "TELLER", "LOAN_OFFICER", "FINANCE", "AUDITOR"];
    return staffRoles.map((role) => ({
      role,
      holders: currentRoleHolders.filter((item) => item.role === role),
    }));
  }, [currentRoleHolders]);

  const roleHistoryTable = useMemo(() => {
    const columns = [
      { Header: t("role"), accessor: "role", align: "left" },
      { Header: t("holder"), accessor: "holder", align: "left" },
      { Header: t("assignedBy"), accessor: "assignedBy", align: "left" },
      { Header: t("startedAt"), accessor: "startedAt", align: "left" },
      { Header: t("endedAt"), accessor: "endedAt", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
    ];

    const rows = roleHistory.map((item) => ({
      role: <MDTypography variant="caption">{item.role || "-"}</MDTypography>,
      holder: (
        <MDBox>
          <MDTypography variant="caption" fontWeight="medium">
            {item.holder_name || item.full_name || item.username || "-"}
          </MDTypography>
          <MDTypography variant="caption" color="text" display="block">
            @{item.username || "-"}
          </MDTypography>
          <MDTypography variant="caption" color="info" display="block">
            {getHolderTypeLabel(item.holder_type)}
          </MDTypography>
        </MDBox>
      ),
      assignedBy: <MDTypography variant="caption">{item.assigned_by_name || "-"}</MDTypography>,
      startedAt: (
        <MDTypography variant="caption">
          {item.started_at ? new Date(item.started_at).toLocaleString() : "-"}
        </MDTypography>
      ),
      endedAt: (
        <MDTypography variant="caption">
          {item.ended_at ? new Date(item.ended_at).toLocaleString() : "-"}
        </MDTypography>
      ),
      status: (
        <MDTypography variant="caption" color={item.is_current ? "success" : "text"}>
          {item.is_current ? t("current") : t("inactive")}
        </MDTypography>
      ),
    }));

    return { columns, rows };
  }, [getHolderTypeLabel, roleHistory, t]);

  const staffHolderHistoryTable = useMemo(() => {
    const columns = [
      { Header: t("account"), accessor: "account", align: "left" },
      { Header: t("holder"), accessor: "holder", align: "left" },
      { Header: t("role"), accessor: "role", align: "left" },
      { Header: t("assignedBy"), accessor: "assignedBy", align: "left" },
      { Header: t("startedAt"), accessor: "startedAt", align: "left" },
      { Header: t("endedAt"), accessor: "endedAt", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
    ];

    const rows = staffHolderHistory.map((item) => ({
      account: (
        <MDBox>
          <MDTypography variant="caption" fontWeight="medium">
            @{item.account_username || "-"}
          </MDTypography>
        </MDBox>
      ),
      holder: (
        <MDBox>
          <MDTypography variant="caption" fontWeight="medium">
            {item.holder_name || "-"}
          </MDTypography>
          <MDTypography variant="caption" color="info" display="block">
            {getHolderTypeLabel(item.holder_type)}
          </MDTypography>
        </MDBox>
      ),
      role: <MDTypography variant="caption">{item.role || "-"}</MDTypography>,
      assignedBy: <MDTypography variant="caption">{item.assigned_by_name || "-"}</MDTypography>,
      startedAt: (
        <MDTypography variant="caption">
          {item.started_at ? new Date(item.started_at).toLocaleString() : "-"}
        </MDTypography>
      ),
      endedAt: (
        <MDTypography variant="caption">
          {item.ended_at ? new Date(item.ended_at).toLocaleString() : "-"}
        </MDTypography>
      ),
      status: (
        <MDTypography variant="caption" color={item.is_current ? "success" : "text"}>
          {item.is_current ? t("current") : t("inactive")}
        </MDTypography>
      ),
    }));

    return { columns, rows };
  }, [getHolderTypeLabel, staffHolderHistory, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" alignItems="center" justifyContent="space-between">
                  <MDBox>
                    <MDTypography variant="h6">{t("usersAdministration")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("manageUsersSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={() => {
                      setForm({
                        account_category: "STAFF_ACCOUNT",
                        username: "",
                        email: "",
                        first_name: "",
                        last_name: "",
                        role: "MANAGER",
                        password: "",
                      });
                      setCreateOpen(true);
                    }}
                  >
                    {t("createUser")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" mb={2}>
                  {t("currentRoleHolders")}
                </MDTypography>
                <Grid container spacing={2}>
                  {currentRoleHolderCards.map(({ role, holders }) => (
                    <Grid item xs={12} md={6} lg={4} key={role}>
                      <MDBox p={2} borderRadius="lg" bgColor="light" height="100%">
                        <MDBox display="flex" alignItems="center" gap={1} mb={1}>
                          <Icon color="info">badge</Icon>
                          <MDTypography variant="button" fontWeight="bold">
                            {role}
                          </MDTypography>
                        </MDBox>
                        {holders.length ? (
                          holders.map((holder) => (
                            <MDBox key={holder.id} mb={1.25}>
                              <MDTypography variant="button" display="block">
                                {holder.holder_name || holder.full_name || holder.username || "-"}
                              </MDTypography>
                              <MDTypography variant="caption" color="info" display="block">
                                {getHolderTypeLabel(holder.holder_type)}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {`${t("account")}: @${holder.username || "-"}`}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {holder.email || "-"}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {holder.started_at
                                  ? `${t("startedAt")}: ${new Date(
                                      holder.started_at
                                    ).toLocaleDateString()}`
                                  : "-"}
                              </MDTypography>
                            </MDBox>
                          ))
                        ) : (
                          <MDTypography variant="button" display="block">
                            {t("noCurrentHolder")}
                          </MDTypography>
                        )}
                      </MDBox>
                    </Grid>
                  ))}
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox
                  mb={2}
                  display="flex"
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                  flexDirection={{ xs: "column", md: "row" }}
                  gap={2}
                >
                  <MDTypography variant="h6">{t("users")}</MDTypography>
                  <Autocomplete
                    options={USER_STATUS_OPTIONS}
                    value={userStatusFilter}
                    onChange={(_event, value) => setUserStatusFilter(value || "ALL")}
                    sx={{ width: { xs: "100%", md: 220 }, ...ROLE_AUTOCOMPLETE_SX }}
                    popupIcon={<Icon fontSize="small">expand_more</Icon>}
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
                    getOptionLabel={(option) =>
                      option === "ACTIVE"
                        ? t("active")
                        : option === "INACTIVE"
                        ? t("inactive")
                        : t("all")
                    }
                    isOptionEqualToValue={(option, value) => option === value}
                  />
                </MDBox>
                <DataTable
                  table={usersTable}
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

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" mb={2}>
                  {t("roleAssignmentHistory")}
                </MDTypography>
                <DataTable
                  table={roleHistoryTable}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" mb={2}>
                  {t("staffAccountHolderHistory")}
                </MDTypography>
                <DataTable
                  table={staffHolderHistoryTable}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("createNewUser")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox component="form" id="create-user-form" onSubmit={handleCreateUser}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <MDBox sx={FORM_SECTION_SX}>
                  <MDBox mb={2}>
                    <MDTypography variant="button" fontWeight="medium" color="dark">
                      {t("account")}
                    </MDTypography>
                  </MDBox>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        options={ACCOUNT_CATEGORY_OPTIONS}
                        value={form.account_category}
                        sx={ROLE_AUTOCOMPLETE_SX}
                        popupIcon={<Icon fontSize="small">expand_more</Icon>}
                        onChange={(_event, value) =>
                          setForm((prev) => ({
                            ...prev,
                            account_category: value || "STAFF_ACCOUNT",
                            role:
                              value === "MEMBER_ACCOUNT"
                                ? "MEMBER"
                                : value === "CLIENT_ACCOUNT"
                                ? "CLIENT"
                                : STAFF_ROLE_OPTIONS.includes(prev.role)
                                ? prev.role
                                : "MANAGER",
                          }))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={t("accountCategory")}
                            fullWidth
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Icon fontSize="small" color="info">
                                    manage_accounts
                                  </Icon>
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                        getOptionLabel={(option) => getAccountCategoryLabel(option)}
                        isOptionEqualToValue={(option, value) => option === value}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <MDInput
                        required
                        fullWidth
                        sx={FORM_FIELD_SX}
                        label={t("username")}
                        value={form.username}
                        onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
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
                      <MDInput
                        required
                        fullWidth
                        sx={FORM_FIELD_SX}
                        label={t("password")}
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Icon fontSize="small" color="info">
                                lock
                              </Icon>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <MDInput
                        fullWidth
                        sx={FORM_FIELD_SX}
                        label={t("email")}
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
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
                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        options={roleOptionsForCategory}
                        value={form.role}
                        sx={ROLE_AUTOCOMPLETE_SX}
                        popupIcon={<Icon fontSize="small">expand_more</Icon>}
                        onChange={(_event, value) => {
                          if (value) {
                            setForm((prev) => ({ ...prev, role: value }));
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={t("role")}
                            placeholder={t("searchRole")}
                            fullWidth
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
                  </Grid>
                </MDBox>
              </Grid>
              <Grid item xs={12}>
                <MDBox sx={FORM_SECTION_SX}>
                  <MDBox mb={2}>
                    <MDTypography variant="button" fontWeight="medium" color="dark">
                      {t("profileSettings")}
                    </MDTypography>
                  </MDBox>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <MDInput
                        fullWidth
                        sx={FORM_FIELD_SX}
                        label={t("firstName")}
                        value={form.first_name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, first_name: e.target.value }))
                        }
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
                      <MDInput
                        fullWidth
                        sx={FORM_FIELD_SX}
                        label={t("lastName")}
                        value={form.last_name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, last_name: e.target.value }))
                        }
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
                  </Grid>
                </MDBox>
              </Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <Divider />
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={() => setCreateOpen(false)}
            disabled={creating}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="create-user-form"
            variant="gradient"
            color="info"
            disabled={creating}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {creating ? t("creating") : t("createUser")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={resetPasswordOpen}
        onClose={() => setResetPasswordOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h6" color="white">
              {t("passwordReset")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox mt={1}>
            <MDBox sx={FORM_SECTION_SX}>
              <MDBox mb={2}>
                <MDTypography variant="button" fontWeight="medium" color="dark">
                  {t("account")}
                </MDTypography>
              </MDBox>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <MDInput
                    fullWidth
                    sx={FORM_FIELD_SX}
                    label={t("username")}
                    value={selectedUser?.username || "-"}
                    disabled
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
                <Grid item xs={12}>
                  <MDInput
                    fullWidth
                    type="password"
                    sx={FORM_FIELD_SX}
                    label={t("password")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon fontSize="small" color="info">
                            lock
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </MDBox>
          </MDBox>
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={() => setResetPasswordOpen(false)}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleConfirmResetPassword}
            sx={FORM_ACTION_BUTTON_SX}
          >
            {t("passwordReset")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <MDSnackbar
        color={snackbar.color}
        icon={<Icon fontSize="small">notifications</Icon>}
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

export default AdminUsers;
