import { useEffect, useMemo, useState } from "react";

import Card from "@mui/material/Card";
import Autocomplete from "@mui/material/Autocomplete";
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

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import { approveMemberCertificate, fetchCertificateApprovals } from "services/api";
import { useLanguage } from "i18n";

function CertificateApprovalsPage() {
  const { t } = useLanguage();
  const [year, setYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const notify = (color, content, title = t("information")) => {
    setSnackbar({ open: true, color, title, content });
  };

  const loadData = async (selectedYear = year) => {
    setLoading(true);
    try {
      const params = selectedYear ? { year: selectedYear } : {};
      const data = await fetchCertificateApprovals(params);
      const years = Array.isArray(data.available_years) ? data.available_years : [];
      setAvailableYears(years);
      if (!selectedYear && years.length > 0) {
        setYear(String(data.year || years[0]));
      }
      setRows(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      notify("error", error.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (item) => {
    try {
      await approveMemberCertificate({ member_id: item.member_id, year: item.year });
      notify("success", t("certificateApprovedSuccess"), t("confirmation"));
      await loadData(year);
    } catch (error) {
      notify("error", error.message);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: t("members"), accessor: "member", align: "left" },
      { Header: t("year"), accessor: "year", align: "center" },
      { Header: t("totalSavings"), accessor: "saved", align: "left" },
      { Header: t("requiredSavings"), accessor: "required", align: "left" },
      { Header: t("eligibility"), accessor: "eligibility", align: "left" },
      { Header: t("status"), accessor: "status", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];

    const mapped = rows.map((item) => {
      const eligibleLabel = item.eligible ? t("eligible") : t("notEligible");
      const statusLabel = item.approved ? t("approved") : t("pending");
      return {
        member: (
          <MDBox>
            <MDTypography variant="caption" fontWeight="medium">
              {item.member_name}
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block">
              {item.national_id}
            </MDTypography>
          </MDBox>
        ),
        year: <MDTypography variant="caption">{item.year}</MDTypography>,
        saved: (
          <MDTypography variant="caption">
            {Number(item.total_savings || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        required: (
          <MDTypography variant="caption">
            {Number(item.expected_savings || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        eligibility: (
          <MDTypography variant="caption" color={item.eligible ? "success" : "error"}>
            {eligibleLabel}
          </MDTypography>
        ),
        status: (
          <MDTypography variant="caption" color={item.approved ? "success" : "warning"}>
            {statusLabel}
          </MDTypography>
        ),
        actions: item.approved ? (
          <MDTypography variant="caption" color="success">
            {t("approved")}
          </MDTypography>
        ) : (
          <Tooltip title={item.eligible ? t("approveCertificate") : t("notEligible")}>
            <span>
              <IconButton
                color="info"
                size="small"
                onClick={() => handleApprove(item)}
                disabled={!item.eligible}
              >
                <Icon fontSize="small">verified</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ),
      };
    });

    return { columns, rows: mapped };
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
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={2}
                >
                  <MDBox>
                    <MDTypography variant="h6">{t("certificateApprovals")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("certificateApprovalsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
                    <Autocomplete
                      size="small"
                      options={availableYears.map((item) => String(item))}
                      value={year || null}
                      onChange={(_event, value) => setYear(value || "")}
                      popupIcon={<Icon fontSize="small">expand_more</Icon>}
                      sx={{
                        minWidth: 190,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "0.7rem",
                          backgroundColor: "#ffffff",
                          boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
                        },
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("year")}
                          placeholder={t("selectYear")}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  calendar_month
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
                      onClick={() => loadData(year)}
                      disabled={loading || !year}
                    >
                      {loading ? t("loading") : t("apply")}
                    </MDButton>
                  </MDBox>
                </MDBox>

                <MDBox mt={2}>
                  <DataTable
                    table={table}
                    isSorted={false}
                    entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                    showTotalEntries
                    canSearch
                    noEndBorder
                  />
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <MDSnackbar
        color={snackbar.color}
        icon="notifications"
        title={snackbar.title}
        dateTime={new Date().toLocaleTimeString()}
        content={snackbar.content}
        open={snackbar.open}
        close={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />

      <Footer />
    </DashboardLayout>
  );
}

export default CertificateApprovalsPage;
