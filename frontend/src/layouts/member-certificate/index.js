import { useEffect, useState } from "react";

import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import InputAdornment from "@mui/material/InputAdornment";
import PropTypes from "prop-types";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MemberPageHero from "components/MemberPageHero";
import MDTypography from "components/MDTypography";
import MDSnackbar from "components/MDSnackbar";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import { exportMyMemberCertificatePdf, fetchMyMemberCertificate } from "services/api";
import { useLanguage } from "i18n";

const SECTION_CARD_SX = {
  overflow: "hidden",
  border: "1px solid rgba(15, 42, 92, 0.08)",
  boxShadow: "0 18px 38px rgba(15, 42, 92, 0.08)",
};

function Currency({ value }) {
  return (
    <MDTypography component="span" variant="button" fontWeight="medium">
      {Number(value || 0).toLocaleString()} RWF
    </MDTypography>
  );
}

Currency.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

Currency.defaultProps = {
  value: 0,
};

function MemberCertificatePage() {
  const { t } = useLanguage();
  const [year, setYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const heroStats = useMemo(
    () => [
      {
        label: t("certificateYear"),
        value: year || certificate?.certificate_year || "-",
        tone: "info",
      },
      {
        label: t("totalSavings"),
        value: `${Number(certificate?.year_savings || 0).toLocaleString()} ${t("rwf")}`,
        tone: "success",
      },
      {
        label: t("myProfit"),
        value: `${Number(certificate?.year_profit || 0).toLocaleString()} ${t("rwf")}`,
        tone: "warning",
      },
      {
        label: t("lifetimeTotal"),
        value: `${Number(certificate?.lifetime_total || 0).toLocaleString()} ${t("rwf")}`,
        tone: "dark",
      },
    ],
    [
      certificate?.certificate_year,
      certificate?.lifetime_total,
      certificate?.year_profit,
      certificate?.year_savings,
      t,
      year,
    ]
  );

  const loadCertificate = async (targetYear = year) => {
    setLoading(true);
    try {
      const params = targetYear ? { year: targetYear } : {};
      const data = await fetchMyMemberCertificate(params);
      setCertificate(data);
      const years = Array.isArray(data?.available_years) ? data.available_years : [];
      setAvailableYears(years);
      if (!targetYear && years.length > 0) {
        setYear(String(data.certificate_year || years[0]));
      }
    } catch (error) {
      setCertificate(null);
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificate();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (!certificate) return;
    setExporting(true);
    try {
      const { blob, fileName } = await exportMyMemberCertificatePdf({
        year: year || certificate.certificate_year,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({
        open: true,
        color: "success",
        title: t("confirmation"),
        content: `${t("exportedFile")}: ${fileName}`,
      });
    } catch (error) {
      setSnackbar({
        open: true,
        color: "error",
        title: t("information"),
        content: error.message,
      });
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
            <MemberPageHero
              icon="workspace_premium"
              title={t("memberCertificateTitle")}
              subtitle={t("memberCertificateSubtitle")}
              stats={heroStats}
            />
          </Grid>

          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              <MDBox
                p={3}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={2}
              >
                <MDBox>
                  <MDTypography variant="h6">{t("certificate")}</MDTypography>
                  <MDTypography variant="button" color="text">
                    {certificate?.member_name || t("memberCertificateSubtitle")}
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
                    onClick={() => loadCertificate(year)}
                    disabled={loading || !year}
                  >
                    {loading ? t("loading") : t("apply")}
                  </MDButton>
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={handleExportPdf}
                    disabled={!certificate || exporting}
                  >
                    {exporting ? t("loading") : t("exportPdf")}
                  </MDButton>
                  <MDButton
                    variant="outlined"
                    color="dark"
                    onClick={handlePrint}
                    disabled={!certificate}
                  >
                    {t("printCertificate")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={SECTION_CARD_SX}>
              {!certificate && (
                <MDBox p={3}>
                  <Alert severity="info">{t("noCertificateYears")}</Alert>
                </MDBox>
              )}

              {certificate && (
                <MDBox
                  p={4}
                  sx={{
                    m: 3,
                    borderRadius: "0.9rem",
                    border: "3px solid #c79d3b",
                    background:
                      "linear-gradient(180deg, rgba(255,250,235,0.95) 0%, rgba(255,255,255,1) 100%)",
                    boxShadow: "inset 0 0 0 2px #0f2a5c",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <MDBox
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "10px",
                      background: "linear-gradient(90deg, #0f2a5c, #c79d3b, #0f2a5c)",
                    }}
                  />
                  <MDTypography
                    variant="h3"
                    textAlign="center"
                    textTransform="uppercase"
                    fontWeight="bold"
                    color="dark"
                  >
                    {t("certificate")}
                  </MDTypography>
                  <MDTypography variant="h6" textAlign="center" mt={1}>
                    IKIMINA REHOBOTH
                  </MDTypography>

                  <MDBox mt={4}>
                    <MDTypography variant="button">
                      {t("certifyMemberText")} <strong>{certificate.member_name}</strong>
                    </MDTypography>
                  </MDBox>

                  <MDBox mt={2}>
                    <MDTypography variant="button">
                      {t("memberSince")}: <strong>{certificate.joined_date || "-"}</strong>
                    </MDTypography>
                  </MDBox>

                  <MDBox mt={2}>
                    <MDTypography variant="button">
                      {t("certificateYear")}: <strong>{certificate.certificate_year}</strong>
                    </MDTypography>
                  </MDBox>

                  <MDBox mt={3}>
                    <MDTypography variant="h6">{t("yearSummary")}</MDTypography>
                    <MDTypography variant="button" display="block" mt={1}>
                      {t("totalSavings")}: <Currency value={certificate.year_savings} />
                    </MDTypography>
                    <MDTypography variant="button" display="block" mt={0.5}>
                      {t("myProfit")}: <Currency value={certificate.year_profit} />
                    </MDTypography>
                  </MDBox>

                  <MDBox mt={3}>
                    <MDTypography variant="h6">{t("lifetimeSummary")}</MDTypography>
                    <MDTypography variant="button" display="block" mt={1}>
                      {t("lifetimeSavings")}: <Currency value={certificate.lifetime_savings} />
                    </MDTypography>
                    <MDTypography variant="button" display="block" mt={0.5}>
                      {t("lifetimeProfit")}: <Currency value={certificate.lifetime_profit} />
                    </MDTypography>
                    <MDTypography variant="button" display="block" mt={0.5} fontWeight="bold">
                      {t("lifetimeTotal")}: <Currency value={certificate.lifetime_total} />
                    </MDTypography>
                  </MDBox>

                  <MDBox mt={4} display="flex" justifyContent="space-between">
                    <MDTypography variant="button">
                      {t("issuedDate")}: <strong>{certificate.issued_date}</strong>
                    </MDTypography>
                    <MDTypography variant="button">
                      {t("authorizedBy")}: <strong>{certificate.authorized_by || "-"}</strong>
                    </MDTypography>
                  </MDBox>
                </MDBox>
              )}
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

export default MemberCertificatePage;
