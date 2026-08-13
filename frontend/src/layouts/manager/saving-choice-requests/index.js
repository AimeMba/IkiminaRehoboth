import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import ContextBanner from "components/ContextBanner";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createSavingChoiceChangeRequest,
  fetchMemberOptions,
  fetchSavingCategories,
  fetchSavingChoiceChangeRequests,
  reviewSavingChoiceChangeRequest,
} from "services/api";
import { useLanguage } from "i18n";

const FIELD_SX = {
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

const STATUS_OPTIONS = [
  { id: "PENDING", labelKey: "pending" },
  { id: "APPROVED", labelKey: "approved" },
  { id: "REJECTED", labelKey: "rejected" },
];

const INITIAL_CREATE_FORM = {
  member: null,
  requested_category: null,
  reason: "",
};

function SavingChoiceRequestsPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = String(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("APPROVE");
  const [reviewNote, setReviewNote] = useState("");
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [saving, setSaving] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");
  const [contextMemberId, setContextMemberId] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const selectedMember = useMemo(
    () => members.find((item) => Number(item.id) === Number(createForm.member)) || null,
    [members, createForm.member]
  );
  const selectedCategory = useMemo(
    () =>
      categories.find((item) => Number(item.id) === Number(createForm.requested_category)) || null,
    [categories, createForm.requested_category]
  );
  const selectedFilterMember = useMemo(
    () => members.find((item) => String(item.id) === String(memberFilter)) || null,
    [memberFilter, members]
  );

  const loadData = async (nextMemberFilter = memberFilter) => {
    setLoading(true);
    try {
      const data = await fetchSavingChoiceChangeRequests({
        year: year || undefined,
        status: statusFilter?.id || undefined,
        member: nextMemberFilter || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      notify("error", t("information"), error.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCreateOptions = async () => {
    try {
      const [memberRows, categoryRows] = await Promise.all([
        fetchMemberOptions(),
        fetchSavingCategories({ year: currentYear }),
      ]);
      const memberList = Array.isArray(memberRows) ? memberRows : memberRows?.results || [];
      const categoryList = Array.isArray(categoryRows) ? categoryRows : categoryRows?.results || [];
      setMembers(memberList.filter((item) => item?.is_active));
      setCategories(categoryList);
    } catch (_error) {
      setMembers([]);
      setCategories([]);
    }
  };

  useEffect(() => {
    loadData();
    loadCreateOptions();
  }, []);

  useEffect(() => {
    const action = location.state?.action;
    const memberId = location.state?.memberId;
    if (action !== "create" || !memberId || !members.length) return;

    setMemberFilter(String(memberId));
    setContextMemberId(String(memberId));
    loadData(String(memberId));
    setCreateForm((prev) => ({
      ...prev,
      member: Number(memberId),
    }));
    setCreateOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, members, navigate]);

  const openReview = (item, nextDecision) => {
    setSelected(item);
    setDecision(nextDecision);
    setReviewNote("");
    setReviewOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setCreateForm(INITIAL_CREATE_FORM);
  };

  const handleReview = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await reviewSavingChoiceChangeRequest(selected.id, {
        decision,
        review_note: reviewNote,
      });
      notify("success", t("confirmation"), t("savingChoiceChangeReviewedSuccess"));
      setReviewOpen(false);
      setSelected(null);
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.member || !createForm.requested_category) {
      notify("error", t("information"), t("selectMemberAndCategory"));
      return;
    }
    setSaving(true);
    try {
      await createSavingChoiceChangeRequest({
        member: Number(createForm.member),
        requested_category: Number(createForm.requested_category),
        reason: createForm.reason,
      });
      notify("success", t("confirmation"), t("savingChoiceChangeRequestedOnBehalfSuccess"));
      closeCreateDialog();
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: t("member"), accessor: "member", align: "left" },
      { Header: t("year"), accessor: "year", align: "left" },
      { Header: t("savingCategories"), accessor: "change", align: "left" },
      { Header: t("requestType"), accessor: "request_type", align: "left" },
      { Header: t("requestedBy"), accessor: "requested_by", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("details"), accessor: "note", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const dataRows = rows.map((item) => ({
      member: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      year: <MDTypography variant="caption">{item.year}</MDTypography>,
      change: (
        <MDTypography variant="caption">
          {item.current_category_name || "-"} {"->"} {item.requested_category_name || "-"}
        </MDTypography>
      ),
      request_type: (
        <MDTypography
          variant="caption"
          color={item.request_origin === "ON_BEHALF" ? "info" : "text"}
          fontWeight="medium"
        >
          {item.request_origin === "ON_BEHALF" ? t("requestedOnBehalf") : t("selfRequested")}
        </MDTypography>
      ),
      requested_by: <MDTypography variant="caption">{item.requested_by_name || "-"}</MDTypography>,
      status: (
        <MDTypography
          variant="caption"
          color={
            item.status === "APPROVED"
              ? "success"
              : item.status === "REJECTED"
              ? "error"
              : "warning"
          }
        >
          {item.status === "APPROVED"
            ? t("approved")
            : item.status === "REJECTED"
            ? t("rejected")
            : t("pending")}
        </MDTypography>
      ),
      note: <MDTypography variant="caption">{item.reason || item.review_note || "-"}</MDTypography>,
      actions:
        item.status === "PENDING" ? (
          <MDBox display="flex" justifyContent="center" gap={0.5}>
            <Tooltip title={t("approve")}>
              <IconButton color="success" size="small" onClick={() => openReview(item, "APPROVE")}>
                <Icon fontSize="small">check_circle</Icon>
              </IconButton>
            </Tooltip>
            <Tooltip title={t("reject")}>
              <IconButton color="error" size="small" onClick={() => openReview(item, "REJECT")}>
                <Icon fontSize="small">cancel</Icon>
              </IconButton>
            </Tooltip>
          </MDBox>
        ) : (
          <MDTypography variant="caption">-</MDTypography>
        ),
    }));

    return { columns, rows: dataRows };
  }, [rows, t]);

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
                  flexDirection={{ xs: "column", lg: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", lg: "center" }}
                  gap={2}
                >
                  <MDBox>
                    <MDTypography variant="h6">{t("savingChoiceRequests")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("savingChoiceRequestsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDButton
                    variant="gradient"
                    color="info"
                    sx={{ minHeight: 56, height: 56, px: 3 }}
                    onClick={() => setCreateOpen(true)}
                  >
                    {t("requestChangeForMember")}
                  </MDButton>
                </MDBox>
                <Grid container spacing={2} mt={1}>
                  {contextMemberId && selectedFilterMember && (
                    <Grid item xs={12}>
                      <ContextBanner
                        icon="tune"
                        title={t("savingChoiceRequests")}
                        subtitle={`${t("member")}: ${
                          selectedFilterMember.full_name ||
                          selectedFilterMember.username ||
                          selectedFilterMember.national_id ||
                          "-"
                        }`}
                        clearLabel={t("clear")}
                        onClear={() => {
                          setMemberFilter("");
                          setContextMemberId("");
                          loadData("");
                        }}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      sx={FIELD_SX}
                      label={t("year")}
                      value={year}
                      onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
                  <Grid item xs={12} md={4}>
                    <Autocomplete
                      options={[{ id: "", full_name: t("all") }, ...members]}
                      value={selectedFilterMember || { id: "", full_name: t("all") }}
                      onChange={(_e, value) => setMemberFilter(value?.id ? String(value.id) : "")}
                      getOptionLabel={(option) =>
                        option?.full_name || option?.username || option?.national_id || ""
                      }
                      isOptionEqualToValue={(option, value) =>
                        String(option.id) === String(value.id)
                      }
                      sx={FIELD_SX}
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("member")}
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
                  <Grid item xs={12} md={2}>
                    <Autocomplete
                      options={STATUS_OPTIONS}
                      value={statusFilter}
                      onChange={(_e, value) => setStatusFilter(value || STATUS_OPTIONS[0])}
                      getOptionLabel={(option) => t(option.labelKey)}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      sx={FIELD_SX}
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
                                  rule
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      sx={{ minHeight: 56, height: 56, width: "100%" }}
                      onClick={loadData}
                      disabled={loading}
                    >
                      {t("apply")}
                    </MDButton>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <DataTable
                  table={table}
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

      <Dialog open={createOpen} onClose={closeCreateDialog} fullWidth maxWidth="md">
        <DialogTitle>{t("requestChangeForMember")}</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={members}
                  value={selectedMember}
                  onChange={(_event, value) =>
                    setCreateForm((prev) => ({ ...prev, member: value?.id || null }))
                  }
                  getOptionLabel={(option) =>
                    option ? option.full_name || option.username || option.national_id || "" : ""
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  sx={FIELD_SX}
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("member")}
                      placeholder={t("search")}
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
                <Autocomplete
                  options={categories}
                  value={selectedCategory}
                  onChange={(_event, value) =>
                    setCreateForm((prev) => ({ ...prev, requested_category: value?.id || null }))
                  }
                  getOptionLabel={(option) =>
                    option
                      ? `${option.name} - ${Number(
                          option.monthly_amount || 0
                        ).toLocaleString()} ${t("rwf")}`
                      : ""
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  sx={FIELD_SX}
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("savingChoice")}
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  sx={FIELD_SX}
                  label={t("reason")}
                  value={createForm.reason}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          description
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={closeCreateDialog}>
            {t("cancel")}
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleCreate}
            disabled={saving || !createForm.member || !createForm.requested_category}
          >
            {saving ? t("loading") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{decision === "APPROVE" ? t("approve") : t("reject")}</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              sx={FIELD_SX}
              label={t("reviewNotes")}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={() => setReviewOpen(false)}>
            {t("cancel")}
          </MDButton>
          <MDButton variant="gradient" color="info" onClick={handleReview} disabled={saving}>
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

export default SavingChoiceRequestsPage;
