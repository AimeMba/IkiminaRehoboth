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
import MDButton from "components/MDButton";
import MemberPageHero from "components/MemberPageHero";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createMySavingChoiceChangeRequest,
  fetchMemberSavingCategories,
  fetchMySavingChoiceChangeRequests,
  fetchMySavingChoices,
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
};

const SECTION_CARD_SX = {
  overflow: "hidden",
  border: "1px solid rgba(15, 42, 92, 0.08)",
  boxShadow: "0 18px 38px rgba(15, 42, 92, 0.08)",
};

function MySavingChoicePage() {
  const { t } = useLanguage();
  const currentYear = String(new Date().getFullYear());

  const [year, setYear] = useState(currentYear);
  const [categories, setCategories] = useState([]);
  const [myChoices, setMyChoices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [changeRequests, setChangeRequests] = useState([]);
  const [requesting, setRequesting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const activeChoice = useMemo(() => {
    return myChoices.find((item) => item.is_active) || null;
  }, [myChoices]);
  const pendingRequests = useMemo(
    () =>
      changeRequests.filter((item) => String(item.status || "").toUpperCase() === "PENDING").length,
    [changeRequests]
  );
  const selectedMonthlyAmount = Number(
    selectedCategory?.monthly_amount || activeChoice?.category_monthly_amount || 0
  );
  const heroStats = useMemo(() => {
    return [
      { label: t("year"), value: year || currentYear, tone: "info" },
      {
        label: t("savingChoice"),
        value: selectedCategory?.name || activeChoice?.category_name || "-",
        helper: selectedMonthlyAmount
          ? `${selectedMonthlyAmount.toLocaleString()} ${t("rwf")}`
          : "",
        tone: "success",
      },
      {
        label: t("monthlyAmount"),
        value: `${selectedMonthlyAmount.toLocaleString()} ${t("rwf")}`,
        tone: "dark",
      },
      { label: t("pendingRequests"), value: pendingRequests, tone: "warning" },
    ];
  }, [
    activeChoice?.category_name,
    currentYear,
    pendingRequests,
    selectedCategory?.name,
    selectedMonthlyAmount,
    t,
    year,
  ]);

  const loadData = async (targetYear = year) => {
    setLoading(true);
    try {
      const [categoryRows, choiceRows, requestRows] = await Promise.all([
        fetchMemberSavingCategories({ year: targetYear }),
        fetchMySavingChoices({ year: targetYear }),
        fetchMySavingChoiceChangeRequests({ year: targetYear }),
      ]);
      const categoriesList = Array.isArray(categoryRows) ? categoryRows : [];
      const choicesList = Array.isArray(choiceRows) ? choiceRows : [];
      const requestList = Array.isArray(requestRows) ? requestRows : [];
      setCategories(categoriesList);
      setMyChoices(choicesList);
      setChangeRequests(requestList);

      const activeChoice = choicesList.find((item) => item.is_active);
      if (activeChoice) {
        const chosen = categoriesList.find((item) => item.id === activeChoice.category) || null;
        setSelectedCategory(chosen);
      } else {
        setSelectedCategory(null);
      }
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(currentYear);
  }, []);

  const handleApplyYear = async () => {
    await loadData(year);
  };

  const handleRequestChange = async () => {
    if (!selectedCategory?.id) {
      notify("error", t("information"), t("selectSavingChoice"));
      return;
    }
    setRequesting(true);
    try {
      await createMySavingChoiceChangeRequest({
        requested_category: selectedCategory.id,
        reason: requestReason,
      });
      notify("success", t("confirmation"), t("savingChoiceChangeRequestedSuccess"));
      setRequestOpen(false);
      setRequestReason("");
      await loadData(year);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setRequesting(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: t("year"), accessor: "category_year", align: "left" },
      { Header: t("savingCategories"), accessor: "category_name", align: "left" },
      { Header: t("monthlyAmount"), accessor: "category_monthly_amount", align: "left" },
      { Header: t("status"), accessor: "is_active", align: "left" },
    ];
    const rows = myChoices.map((item) => ({
      category_year: <MDTypography variant="caption">{item.category_year}</MDTypography>,
      category_name: <MDTypography variant="caption">{item.category_name || "-"}</MDTypography>,
      category_monthly_amount: (
        <MDTypography variant="caption">
          {Number(item.category_monthly_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      is_active: (
        <MDTypography variant="caption" color={item.is_active ? "success" : "text"}>
          {item.is_active ? t("active") : t("inactive")}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [myChoices, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <MemberPageHero
              icon="tune"
              title={t("mySavingChoice")}
              subtitle={t("mySavingChoiceSubtitle")}
              notice={t("savingChoiceRequiresApproval")}
              stats={heroStats}
            />
          </Grid>

          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              <MDBox p={3}>
                <Grid container spacing={2}>
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
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      options={categories}
                      value={selectedCategory}
                      onChange={(_e, value) => setSelectedCategory(value)}
                      getOptionLabel={(option) =>
                        option
                          ? `${option.name} - ${Number(option.monthly_amount || 0)} ${t("rwf")}`
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
                  <Grid item xs={12} md={3}>
                    <MDBox display="flex" gap={1}>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        sx={{ minHeight: 56, height: 56, flex: 1 }}
                        onClick={handleApplyYear}
                        disabled={loading}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{ minHeight: 56, height: 56, flex: 1 }}
                        onClick={() => setRequestOpen(true)}
                        disabled={!selectedCategory}
                      >
                        {t("requestChange")}
                      </MDButton>
                    </MDBox>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              <MDBox p={3}>
                <DataTable
                  table={table}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [5, 10, 20] }}
                  showTotalEntries
                  canSearch={false}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              <MDBox p={3}>
                <MDTypography variant="h6">{t("savingChoiceChangeRequests")}</MDTypography>
                <DataTable
                  table={{
                    columns: [
                      { Header: t("year"), accessor: "year", align: "left" },
                      { Header: t("savingCategories"), accessor: "requested", align: "left" },
                      { Header: t("status"), accessor: "status", align: "left" },
                      { Header: t("details"), accessor: "note", align: "left" },
                    ],
                    rows: changeRequests.map((item) => ({
                      year: <MDTypography variant="caption">{item.year}</MDTypography>,
                      requested: (
                        <MDTypography variant="caption">
                          {item.requested_category_name || "-"}
                        </MDTypography>
                      ),
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
                      note: (
                        <MDTypography variant="caption">
                          {item.review_note || item.reason || "-"}
                        </MDTypography>
                      ),
                    })),
                  }}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 5, entries: [5, 10, 20] }}
                  showTotalEntries
                  canSearch={false}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("requestChange")}</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <TextField
              fullWidth
              multiline
              minRows={4}
              label={t("reason")}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
            />
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={() => setRequestOpen(false)}>
            {t("cancel")}
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleRequestChange}
            disabled={requesting || !selectedCategory}
          >
            {requesting ? t("loading") : t("save")}
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

export default MySavingChoicePage;
