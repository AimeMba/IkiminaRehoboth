import { useEffect, useMemo, useState } from "react";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  fetchCurrentUser,
  fetchMemberOptions,
  fetchNotifications,
  fetchMyNotifications,
  markNotificationsRead,
  triggerReminderNotifications,
} from "services/api";
import { useLanguage } from "i18n";

const PAGE_SECTION_GAP = 2;
const FIELD_HEIGHT = 56;

const FILTER_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: FIELD_HEIGHT,
    height: FIELD_HEIGHT,
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
  "& .MuiInputBase-input": {
    textOverflow: "ellipsis",
  },
};

const FILTER_AUTOCOMPLETE_SX = {
  ...FILTER_FIELD_SX,
  "& .MuiInputBase-root": {
    minHeight: FIELD_HEIGHT,
  },
};

const FILTER_BUTTON_SX = {
  minHeight: FIELD_HEIGHT,
  height: FIELD_HEIGHT,
  px: 2.5,
};

const SUMMARY_CARD_SX = {
  minHeight: 110,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const RECIPIENT_CELL_SX = {
  maxWidth: 260,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function NotificationsPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    user_id: "",
    notification_type: "",
    is_read: "",
    date_from: "",
    date_to: "",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canTrigger = ["ADMIN", "MANAGER", "FINANCE"].includes(role);
  const canViewRecipients = [
    "ADMIN",
    "MANAGER",
    "FINANCE",
    "AUDITOR",
    "LOAN_OFFICER",
    "TELLER",
  ].includes(role);

  const typeOptions = useMemo(
    () => [
      { id: "", label: t("all") },
      { id: "SAVING_REMINDER", label: t("savingReminder") },
      { id: "LOAN_REMINDER", label: t("loanReminder") },
      { id: "SYSTEM", label: t("systemNotification") },
    ],
    [t]
  );

  const readOptions = useMemo(
    () => [
      { id: "", label: t("all") },
      { id: "false", label: t("unread") },
      { id: "true", label: t("read") },
    ],
    [t]
  );
  const memberOptions = useMemo(
    () => [
      { id: "", label: t("all") },
      ...members.map((item) => ({
        id: String(item.user_id || ""),
        label: item.full_name || item.username || item.national_id || "-",
      })),
    ],
    [members, t]
  );

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const loadUser = async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (_error) {
      setUser(null);
    }
  };

  const loadData = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const payload = canViewRecipients
        ? await fetchNotifications(nextFilters)
        : await fetchMyNotifications(nextFilters);
      setItems(Array.isArray(payload) ? payload : payload?.results || []);
    } catch (error) {
      notify("error", t("information"), error.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (!canViewRecipients) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        const payload = await fetchMemberOptions();
        setMembers(Array.isArray(payload) ? payload : payload?.results || []);
      } catch (_error) {
        setMembers([]);
      }
    };

    loadMembers();
  }, [canViewRecipients]);

  const summary = useMemo(() => {
    const total = items.length;
    const unread = items.filter((item) => !item.is_read).length;
    const read = total - unread;
    return { total, unread, read };
  }, [items]);

  const getTypeLabel = (value) => {
    if (value === "SAVING_REMINDER") return t("savingReminder");
    if (value === "LOAN_REMINDER") return t("loanReminder");
    if (value === "SYSTEM") return t("systemNotification");
    return value || "-";
  };

  const translateNotificationTitle = (value) => {
    if (value === "profit_request_created_title") return t("profitRequestCreatedTitle");
    if (value === "profit_request_approved_title") return t("profitRequestApprovedTitle");
    if (value === "profit_request_rejected_title") return t("profitRequestRejectedTitle");
    return value || "-";
  };

  const translateNotificationMessage = (value) => {
    if (!value) return "-";

    if (value.startsWith("profit_request_created_message|")) {
      const [, requesterName, memberName, amount] = value.split("|");
      return t("profitRequestCreatedMessage")
        .replace("{requester}", requesterName || "-")
        .replace("{member}", memberName || "-")
        .replace("{amount}", amount || "0");
    }

    if (value.startsWith("profit_request_approved_message|")) {
      const [, amount] = value.split("|");
      return t("profitRequestApprovedMessage").replace("{amount}", amount || "0");
    }

    if (value === "profit_request_rejected_message") {
      return t("profitRequestRejectedMessage");
    }

    return value;
  };

  const table = useMemo(() => {
    const columns = [
      { Header: t("time"), accessor: "created_at", align: "left" },
      ...(canViewRecipients
        ? [{ Header: t("username"), accessor: "recipient", align: "left" }]
        : []),
      { Header: t("type"), accessor: "notification_type", align: "left" },
      { Header: t("title"), accessor: "title", align: "left" },
      { Header: t("details"), accessor: "message", align: "left" },
      { Header: t("delivery"), accessor: "delivery", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      ...(canViewRecipients
        ? []
        : [{ Header: t("actions"), accessor: "actions", align: "center" }]),
    ];

    const rows = items.map((item) => ({
      created_at: (
        <MDTypography variant="caption">
          {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
        </MDTypography>
      ),
      recipient: (
        <MDBox sx={RECIPIENT_CELL_SX}>
          <MDTypography variant="caption" sx={RECIPIENT_CELL_SX}>
            {item.username || "-"}
          </MDTypography>
          <MDTypography variant="caption" color="text" sx={RECIPIENT_CELL_SX}>
            {item.user_email || "-"}
          </MDTypography>
        </MDBox>
      ),
      notification_type: (
        <MDTypography variant="caption">{getTypeLabel(item.notification_type)}</MDTypography>
      ),
      title: (
        <MDTypography variant="caption">{translateNotificationTitle(item.title)}</MDTypography>
      ),
      message: (
        <MDTypography variant="caption" sx={{ maxWidth: 420 }}>
          {translateNotificationMessage(item.message)}
        </MDTypography>
      ),
      delivery: (
        <MDTypography variant="caption">
          {item.sent_email ? "Email" : "-"} | {item.sent_sms ? "SMS" : "-"} | App
        </MDTypography>
      ),
      status: (
        <MDTypography variant="caption" color={item.is_read ? "success" : "warning"}>
          {item.is_read ? t("read") : t("unread")}
        </MDTypography>
      ),
      actions: canViewRecipients ? null : (
        <MDBox display="flex" justifyContent="center">
          {!item.is_read ? (
            <Tooltip title={t("markAsRead")}>
              <IconButton
                color="info"
                size="small"
                sx={{ width: 30, height: 30 }}
                onClick={async () => {
                  setProcessing(true);
                  try {
                    await markNotificationsRead(item.id);
                    await loadData(filters);
                  } catch (error) {
                    notify("error", t("information"), error.message);
                  } finally {
                    setProcessing(false);
                  }
                }}
              >
                <Icon fontSize="small">done</Icon>
              </IconButton>
            </Tooltip>
          ) : (
            <MDTypography variant="caption" color="success">
              {t("read")}
            </MDTypography>
          )}
        </MDBox>
      ),
    }));

    return { columns, rows };
  }, [items, t, canViewRecipients]);

  const handleApplyFilters = () => loadData(filters);

  const handleClearFilters = () => {
    const next = {
      search: "",
      user_id: "",
      notification_type: "",
      is_read: "",
      date_from: "",
      date_to: "",
    };
    setFilters(next);
    loadData(next);
  };

  const handleMarkAllRead = async () => {
    setProcessing(true);
    try {
      await markNotificationsRead();
      await loadData(filters);
      notify("success", t("confirmation"), t("notificationsMarkedRead"));
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRunReminder = async () => {
    setProcessing(true);
    try {
      await triggerReminderNotifications();
      await loadData(filters);
      notify("success", t("confirmation"), t("remindersTriggeredSuccess"));
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={PAGE_SECTION_GAP + 1}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox
                  display="flex"
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  flexDirection={{ xs: "column", md: "row" }}
                  gap={2}
                  mb={2}
                >
                  <MDBox>
                    <MDTypography variant="h6">{t("notifications")}</MDTypography>
                    <MDTypography variant="button" color="text" opacity={0.85}>
                      {t("notificationsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1} flexWrap="wrap" alignItems="center">
                    {canTrigger && (
                      <MDButton
                        variant="outlined"
                        color="info"
                        sx={FILTER_BUTTON_SX}
                        disabled={processing || loading}
                        onClick={handleRunReminder}
                      >
                        {t("runRemindersNow")}
                      </MDButton>
                    )}
                    {!canViewRecipients && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={FILTER_BUTTON_SX}
                        disabled={processing || loading || summary.unread === 0}
                        onClick={handleMarkAllRead}
                      >
                        {t("markAllRead")}
                      </MDButton>
                    )}
                  </MDBox>
                </MDBox>

                <Grid container spacing={PAGE_SECTION_GAP} mb={2}>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light" sx={SUMMARY_CARD_SX}>
                      <MDTypography variant="button">{t("records")}</MDTypography>
                      <MDTypography variant="h5">{summary.total}</MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light" sx={SUMMARY_CARD_SX}>
                      <MDTypography variant="button" color="warning">
                        {t("unread")}
                      </MDTypography>
                      <MDTypography variant="h5" color="warning">
                        {summary.unread}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDBox p={2} borderRadius="lg" bgColor="light" sx={SUMMARY_CARD_SX}>
                      <MDTypography variant="button" color="success">
                        {t("read")}
                      </MDTypography>
                      <MDTypography variant="h5" color="success">
                        {summary.read}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <Grid container spacing={PAGE_SECTION_GAP} mb={1}>
                  <Grid item xs={12} md={3}>
                    <MDInput
                      sx={FILTER_FIELD_SX}
                      fullWidth
                      label={t("search")}
                      value={filters.search}
                      onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Autocomplete
                      options={typeOptions}
                      value={
                        typeOptions.find((option) => option.id === filters.notification_type) ||
                        typeOptions[0]
                      }
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, notification_type: value?.id || "" }))
                      }
                      getOptionLabel={(option) => option.label}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FILTER_AUTOCOMPLETE_SX}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("type")}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  notifications
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      options={readOptions}
                      value={
                        readOptions.find((option) => option.id === filters.is_read) ||
                        readOptions[0]
                      }
                      onChange={(_event, value) =>
                        setFilters((prev) => ({ ...prev, is_read: value?.id || "" }))
                      }
                      getOptionLabel={(option) => option.label}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={FILTER_AUTOCOMPLETE_SX}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("status")}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  rule
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <MDInput
                      sx={FILTER_FIELD_SX}
                      type="date"
                      fullWidth
                      label={t("from")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <MDInput
                      sx={FILTER_FIELD_SX}
                      type="date"
                      fullWidth
                      label={t("to")}
                      InputLabelProps={{ shrink: true }}
                      value={filters.date_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={PAGE_SECTION_GAP} mb={2}>
                  {canViewRecipients && (
                    <Grid item xs={12} md={4}>
                      <Autocomplete
                        options={memberOptions}
                        value={
                          memberOptions.find((option) => option.id === filters.user_id) ||
                          memberOptions[0]
                        }
                        onChange={(_event, value) =>
                          setFilters((prev) => ({ ...prev, user_id: value?.id || "" }))
                        }
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        popupIcon={<Icon fontSize="small">expand_more</Icon>}
                        sx={FILTER_AUTOCOMPLETE_SX}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={t("selectedMember")}
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
                  )}
                  <Grid item xs={12}>
                    <MDBox
                      display="flex"
                      justifyContent={{ xs: "stretch", md: "flex-end" }}
                      gap={1}
                    >
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{
                          ...FILTER_BUTTON_SX,
                          width: { xs: "50%", md: "auto" },
                        }}
                        onClick={handleApplyFilters}
                        disabled={loading || processing}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        sx={{
                          ...FILTER_BUTTON_SX,
                          width: { xs: "50%", md: "auto" },
                        }}
                        onClick={handleClearFilters}
                        disabled={loading || processing}
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
                  canSearch={false}
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

export default NotificationsPage;
