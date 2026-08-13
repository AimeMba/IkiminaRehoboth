import { useEffect, useMemo, useState } from "react";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import HintButton from "components/HintButton";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import { fetchTransactionLogs, exportTransactionLogs } from "services/api";
import { useLanguage } from "i18n";

const FIELD_HEIGHT = 56;

const FILTER_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: FIELD_HEIGHT,
    height: FIELD_HEIGHT,
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
};

const FILTER_AUTOCOMPLETE_SX = {
  ...FILTER_FIELD_SX,
  "& .MuiInputBase-root": {
    minHeight: FIELD_HEIGHT,
  },
};

const BUTTON_SX = {
  minHeight: FIELD_HEIGHT,
  height: FIELD_HEIGHT,
  px: 2.5,
};

const SUMMARY_CARD_SX = {
  minHeight: 112,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const DETAIL_TEXT_SX = {
  maxWidth: 360,
};

function TransactionLogs() {
  const { t } = useLanguage();
  const transactionTypeOptions = useMemo(
    () => [
      { label: t("all"), value: "" },
      { label: "SYSTEM", value: "SYSTEM" },
      { label: "SAVING", value: "SAVING" },
      { label: "LOAN", value: "LOAN" },
      { label: "REPAYMENT", value: "REPAYMENT" },
      { label: "FINE", value: "FINE" },
      { label: "EXPENSE", value: "EXPENSE" },
      { label: "MEMBERSHIP", value: "MEMBERSHIP" },
    ],
    [t]
  );
  const actionOptions = useMemo(
    () => [
      { label: t("all"), value: "" },
      { label: "CREATE", value: "CREATE" },
      { label: "UPDATE", value: "UPDATE" },
      { label: "DELETE", value: "DELETE" },
      { label: "PAY", value: "PAY" },
    ],
    [t]
  );

  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    transaction_type: "",
    action: "",
    date_from: "",
    date_to: "",
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const openSnackbar = (color, title, content) => {
    setSnackbar({ open: true, color, title, content });
  };

  const loadLogs = async (targetPage = 1, currentFilters = filters) => {
    setLoading(true);
    try {
      const resp = await fetchTransactionLogs({
        ...currentFilters,
        page: targetPage,
        page_size: pageSize,
      });

      if (Array.isArray(resp)) {
        setLogs(resp);
        setCount(resp.length);
      } else {
        setLogs(resp.results || []);
        setCount(resp.count || 0);
      }
      setPage(targetPage);
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    loadLogs(1, filters);
  };

  const handleClearFilters = () => {
    const next = {
      search: "",
      transaction_type: "",
      action: "",
      date_from: "",
      date_to: "",
    };
    setFilters(next);
    loadLogs(1, next);
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const summary = useMemo(() => {
    const totalAmount = logs.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const systemCount = logs.filter((item) => item.transaction_type === "SYSTEM").length;
    const paymentCount = logs.filter((item) => item.action === "PAY").length;
    return {
      total: count,
      totalAmount,
      systemCount,
      paymentCount,
    };
  }, [logs, count]);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const { blob, fileName } = await exportTransactionLogs(filters, format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      openSnackbar("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setExporting(false);
    }
  };

  const logsTable = useMemo(() => {
    const columns = [
      { Header: t("time"), accessor: "timestamp", align: "left" },
      { Header: t("users"), accessor: "user", align: "left" },
      { Header: t("type"), accessor: "type", align: "left" },
      { Header: t("actions"), accessor: "action", align: "left" },
      { Header: t("model"), accessor: "model", align: "left" },
      { Header: t("details"), accessor: "details", align: "left" },
      { Header: t("amount"), accessor: "amount", align: "left" },
    ];

    const rows = logs.map((log) => ({
      timestamp: (
        <MDTypography variant="caption">
          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}
        </MDTypography>
      ),
      user: <MDTypography variant="caption">{log.user || "-"}</MDTypography>,
      type: (
        <MDBox display="inline-flex" px={1.5} py={0.6} borderRadius="lg" bgColor="info">
          <MDTypography variant="caption" color="white" fontWeight="medium">
            {log.transaction_type || "-"}
          </MDTypography>
        </MDBox>
      ),
      action: (
        <MDBox display="inline-flex" px={1.5} py={0.6} borderRadius="lg" bgColor="light">
          <MDTypography variant="caption" color="dark" fontWeight="medium">
            {log.action || "-"}
          </MDTypography>
        </MDBox>
      ),
      model: <MDTypography variant="caption">{log.related_model || "-"}</MDTypography>,
      details: (
        <MDTypography variant="caption" sx={DETAIL_TEXT_SX}>
          {log.description || "-"}
        </MDTypography>
      ),
      amount: (
        <MDTypography variant="caption" fontWeight="medium">
          {log.amount ?? "-"}
        </MDTypography>
      ),
    }));

    return { columns, rows };
  }, [logs, t]);

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
                  alignItems={{ xs: "flex-start", lg: "center" }}
                  flexDirection={{ xs: "column", lg: "row" }}
                  gap={2}
                  mb={3}
                >
                  <MDBox>
                    <MDTypography variant="h5" fontWeight="bold">
                      {t("transactionLogs")}
                    </MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("notificationsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={1.5} flexWrap="wrap">
                    <HintButton
                      variant="outlined"
                      color="info"
                      disabled={exporting || loading || logs.length === 0}
                      onClick={() => handleExport("pdf")}
                      sx={BUTTON_SX}
                      hint={!loading && !exporting && logs.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportPdf")}
                    </HintButton>
                    <HintButton
                      variant="outlined"
                      color="success"
                      disabled={exporting || loading || logs.length === 0}
                      onClick={() => handleExport("csv")}
                      sx={BUTTON_SX}
                      hint={!loading && !exporting && logs.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportCsv")}
                    </HintButton>
                    <HintButton
                      variant="gradient"
                      color="success"
                      disabled={exporting || loading || logs.length === 0}
                      onClick={() => handleExport("xlsx")}
                      sx={BUTTON_SX}
                      hint={!loading && !exporting && logs.length === 0 ? t("noDataToExport") : ""}
                    >
                      {t("exportExcel")}
                    </HintButton>
                  </MDBox>
                </MDBox>

                <Grid container spacing={2} mb={3}>
                  <Grid item xs={12} md={6} xl={3}>
                    <Card sx={SUMMARY_CARD_SX}>
                      <MDBox p={2.5}>
                        <MDTypography variant="button" color="text" textTransform="uppercase">
                          {t("records")}
                        </MDTypography>
                        <MDTypography variant="h4" fontWeight="bold">
                          {summary.total}
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6} xl={3}>
                    <Card sx={SUMMARY_CARD_SX}>
                      <MDBox p={2.5}>
                        <MDTypography variant="button" color="text" textTransform="uppercase">
                          {t("systemNotification")}
                        </MDTypography>
                        <MDTypography variant="h4" fontWeight="bold">
                          {summary.systemCount}
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6} xl={3}>
                    <Card sx={SUMMARY_CARD_SX}>
                      <MDBox p={2.5}>
                        <MDTypography variant="button" color="text" textTransform="uppercase">
                          {t("actions")}
                        </MDTypography>
                        <MDTypography variant="h4" fontWeight="bold">
                          {summary.paymentCount}
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6} xl={3}>
                    <Card sx={SUMMARY_CARD_SX}>
                      <MDBox p={2.5}>
                        <MDTypography variant="button" color="text" textTransform="uppercase">
                          {t("amount")}
                        </MDTypography>
                        <MDTypography variant="h4" fontWeight="bold">
                          {summary.totalAmount.toLocaleString()} {t("rwf")}
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                </Grid>

                <Card sx={{ overflow: "visible", mb: 3 }}>
                  <MDBox p={2.5}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6} xl={3}>
                        <MDInput
                          fullWidth
                          label={t("search")}
                          value={filters.search}
                          onChange={(e) => handleFilterChange("search", e.target.value)}
                          sx={FILTER_FIELD_SX}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  search
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} xl={2}>
                        <Autocomplete
                          options={transactionTypeOptions}
                          value={
                            transactionTypeOptions.find(
                              (option) => option.value === filters.transaction_type
                            ) || transactionTypeOptions[0]
                          }
                          isOptionEqualToValue={(option, value) => option.value === value.value}
                          getOptionLabel={(option) => option.label}
                          onChange={(_event, value) =>
                            handleFilterChange("transaction_type", value?.value ?? "")
                          }
                          popupIcon={<Icon fontSize="small">expand_more</Icon>}
                          sx={FILTER_AUTOCOMPLETE_SX}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              fullWidth
                              label={t("type")}
                              InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                  <>
                                    <InputAdornment position="start">
                                      <Icon fontSize="small" color="info">
                                        category
                                      </Icon>
                                    </InputAdornment>
                                    {params.InputProps.startAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} xl={2}>
                        <Autocomplete
                          options={actionOptions}
                          value={
                            actionOptions.find((option) => option.value === filters.action) ||
                            actionOptions[0]
                          }
                          isOptionEqualToValue={(option, value) => option.value === value.value}
                          getOptionLabel={(option) => option.label}
                          onChange={(_event, value) =>
                            handleFilterChange("action", value?.value ?? "")
                          }
                          popupIcon={<Icon fontSize="small">expand_more</Icon>}
                          sx={FILTER_AUTOCOMPLETE_SX}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              fullWidth
                              label={t("actions")}
                              InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                  <>
                                    <InputAdornment position="start">
                                      <Icon fontSize="small" color="info">
                                        bolt
                                      </Icon>
                                    </InputAdornment>
                                    {params.InputProps.startAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} xl={2}>
                        <MDInput
                          type="date"
                          fullWidth
                          label={t("from")}
                          InputLabelProps={{ shrink: true }}
                          value={filters.date_from}
                          onChange={(e) => handleFilterChange("date_from", e.target.value)}
                          sx={FILTER_FIELD_SX}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  event
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} xl={2}>
                        <MDInput
                          type="date"
                          fullWidth
                          label={t("to")}
                          InputLabelProps={{ shrink: true }}
                          value={filters.date_to}
                          onChange={(e) => handleFilterChange("date_to", e.target.value)}
                          sx={FILTER_FIELD_SX}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Icon fontSize="small" color="info">
                                  event_available
                                </Icon>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} xl={1}>
                        <MDBox
                          display="flex"
                          flexDirection={{ xs: "row", xl: "column" }}
                          gap={1}
                          height="100%"
                        >
                          <MDButton
                            variant="gradient"
                            color="info"
                            onClick={handleApplyFilters}
                            sx={{ ...BUTTON_SX, flex: 1, minWidth: 0 }}
                          >
                            {t("apply")}
                          </MDButton>
                          <MDButton
                            variant="outlined"
                            color="secondary"
                            onClick={handleClearFilters}
                            sx={{ ...BUTTON_SX, flex: 1, minWidth: 0 }}
                          >
                            {t("clear")}
                          </MDButton>
                        </MDBox>
                      </Grid>
                    </Grid>
                  </MDBox>
                </Card>

                <MDBox sx={{ overflowX: "auto", width: "100%" }}>
                  <DataTable
                    table={logsTable}
                    isSorted={false}
                    entriesPerPage={false}
                    showTotalEntries={false}
                    canSearch={false}
                    noEndBorder
                  />
                </MDBox>

                <MDBox mt={2} display="flex" justifyContent="space-between" alignItems="center">
                  <MDTypography variant="button" color="text">
                    {loading ? t("loading") : `${count} ${t("records")}`}
                  </MDTypography>
                  <MDBox display="flex" gap={1} alignItems="center">
                    <MDButton
                      variant="outlined"
                      color="secondary"
                      disabled={page <= 1 || loading}
                      onClick={() => loadLogs(page - 1)}
                    >
                      {t("prev")}
                    </MDButton>
                    <MDTypography variant="button" color="text">
                      {page} / {totalPages}
                    </MDTypography>
                    <MDButton
                      variant="outlined"
                      color="secondary"
                      disabled={page >= totalPages || loading}
                      onClick={() => loadLogs(page + 1)}
                    >
                      {t("next")}
                    </MDButton>
                  </MDBox>
                </MDBox>
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

export default TransactionLogs;
