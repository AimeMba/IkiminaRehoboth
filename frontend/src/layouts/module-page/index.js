import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import MDBox from "components/MDBox";
import MDBadge from "components/MDBadge";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import { apiRequest } from "services/api";
import { useLanguage } from "i18n";

function ModulePage({ title, subtitle, titleKey, subtitleKey, infoNoteKey, endpoint }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const resolvedTitle = titleKey ? t(titleKey) : title;
  const resolvedSubtitle = subtitleKey ? t(subtitleKey) : subtitle;
  const resolvedInfoNote = infoNoteKey ? t(infoNoteKey) : "";

  const loadData = async () => {
    if (!endpoint) {
      setLoading(false);
      setItems([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await apiRequest(endpoint);
      if (Array.isArray(payload)) {
        setItems(payload);
      } else if (Array.isArray(payload?.results)) {
        setItems(payload.results);
      } else if (payload && typeof payload === "object") {
        setItems([payload]);
      } else {
        setItems([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load data");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [endpoint]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(query));
  }, [items, search]);

  const table = useMemo(() => {
    const first = filteredItems[0];
    if (!first || typeof first !== "object") {
      return { columns: [], rows: [] };
    }

    const keys = Object.keys(first).slice(0, 6);
    const columns = keys.map((key) => ({
      Header: key.replace(/_/g, " ").toUpperCase(),
      accessor: key,
      align: "left",
    }));

    const toText = (value) => {
      if (value === null || value === undefined || value === "") return "-";
      if (typeof value === "boolean") return value ? t("active") : t("inactive");
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    };

    const rows = filteredItems.map((item) => {
      const row = {};
      keys.forEach((key) => {
        row[key] = <MDTypography variant="caption">{toText(item[key])}</MDTypography>;
      });
      return row;
    });

    return { columns, rows };
  }, [filteredItems, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <MDBox>
                    <MDTypography variant="h5">{resolvedTitle}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {resolvedSubtitle}
                    </MDTypography>
                  </MDBox>
                  <Stack direction="row" spacing={1}>
                    <MDBadge
                      badgeContent={endpoint ? t("apiConnected") : t("uiReady")}
                      color={endpoint ? "success" : "warning"}
                      variant="gradient"
                      size="sm"
                    />
                    <MDBadge
                      badgeContent={`${filteredItems.length} ${t("records")}`}
                      color="info"
                      variant="gradient"
                      size="sm"
                    />
                  </Stack>
                </Stack>
                {resolvedInfoNote ? (
                  <MDBox mt={2} p={2} borderRadius="lg" bgColor="light">
                    <MDTypography variant="caption" color="text" display="block">
                      {resolvedInfoNote}
                    </MDTypography>
                  </MDBox>
                ) : null}

                <MDBox mt={3} mb={2}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                      <MDInput
                        fullWidth
                        label={t("search")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent={{ xs: "flex-start", md: "flex-end" }}
                      >
                        <MDButton
                          variant="outlined"
                          color="info"
                          onClick={loadData}
                          disabled={loading}
                        >
                          {loading ? t("loading") : t("refresh")}
                        </MDButton>
                      </Stack>
                    </Grid>
                  </Grid>
                </MDBox>

                {!endpoint && <Alert severity="info">{t("endpointNotConnected")}</Alert>}
                {error && <Alert severity="error">{error}</Alert>}

                {table.columns.length > 0 ? (
                  <MDBox mt={2}>
                    <DataTable
                      table={table}
                      isSorted={false}
                      entriesPerPage={false}
                      showTotalEntries={false}
                      canSearch={false}
                      noEndBorder
                    />
                  </MDBox>
                ) : (
                  <MDBox mt={2}>
                    <Alert severity="info">{loading ? t("loading") : t("noRecordsModule")}</Alert>
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

ModulePage.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  titleKey: PropTypes.string,
  subtitleKey: PropTypes.string,
  infoNoteKey: PropTypes.string,
  endpoint: PropTypes.string,
};

ModulePage.defaultProps = {
  title: "",
  subtitle: "",
  titleKey: "",
  subtitleKey: "",
  infoNoteKey: "",
  endpoint: null,
};

export default ModulePage;
