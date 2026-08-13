import { useEffect, useMemo, useState } from "react";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import HintButton from "components/HintButton";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createAnnualClosing,
  exportAnnualClosingPdf,
  exportProfitPayoutsPdf,
  fetchCurrentUser,
  fetchAnnualClosings,
  fetchMemberOptions,
  fetchMemberProfits,
  fetchMemberProfitPayouts,
  createMemberProfitBulkPayout,
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
};

const INITIAL_PAYOUT_FILTERS = {
  search: "",
  member: "",
  date_from: "",
  date_to: "",
};

function AnnualClosingPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [filterYear, setFilterYear] = useState("");
  const [appliedYearFilter, setAppliedYearFilter] = useState("");
  const [closings, setClosings] = useState([]);
  const [profits, setProfits] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [members, setMembers] = useState([]);
  const [lastClosingMetrics, setLastClosingMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [payoutFilters, setPayoutFilters] = useState(INITIAL_PAYOUT_FILTERS);
  const [appliedPayoutFilters, setAppliedPayoutFilters] = useState(INITIAL_PAYOUT_FILTERS);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payAll, setPayAll] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });
  const role = String(user?.effective_role || user?.role || "").toUpperCase();
  const canWrite = ["ADMIN", "FINANCE"].includes(role);

  const buildAnnualClosingParams = (yearFilter = appliedYearFilter) => ({
    year: yearFilter || undefined,
  });

  const buildPayoutParams = (
    nextPayoutFilters = appliedPayoutFilters,
    yearFilter = appliedYearFilter
  ) => ({
    year: yearFilter || undefined,
    search: nextPayoutFilters.search || undefined,
    member: nextPayoutFilters.member || undefined,
    date_from: nextPayoutFilters.date_from || undefined,
    date_to: nextPayoutFilters.date_to || undefined,
  });

  const loadData = async (
    yearFilter = appliedYearFilter,
    nextPayoutFilters = appliedPayoutFilters
  ) => {
    setLoading(true);
    try {
      const [closingData, profitData, payoutData] = await Promise.all([
        fetchAnnualClosings(buildAnnualClosingParams(yearFilter)),
        fetchMemberProfits(yearFilter ? { year: yearFilter } : {}),
        fetchMemberProfitPayouts(buildPayoutParams(nextPayoutFilters, yearFilter)),
      ]);
      setClosings(Array.isArray(closingData) ? closingData : closingData?.results || []);
      setProfits(Array.isArray(profitData) ? profitData : profitData?.results || []);
      setPayouts(Array.isArray(payoutData) ? payoutData : payoutData?.results || []);
      setAppliedYearFilter(yearFilter);
      setAppliedPayoutFilters(nextPayoutFilters);
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
    if (!user) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        const memberData = await fetchMemberOptions();
        setMembers(Array.isArray(memberData) ? memberData : memberData?.results || []);
      } catch (_error) {
        setMembers([]);
      }
    };

    loadMembers();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadData("", INITIAL_PAYOUT_FILTERS);
  }, [user]);

  const onCreateClosing = async () => {
    setSaving(true);
    try {
      const response = await createAnnualClosing({ year: Number(year) });
      setLastClosingMetrics(response || null);
      notify("success", t("confirmation"), t("annualClosingCreatedSuccess"));
      await loadData(appliedYearFilter, appliedPayoutFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const memberOptions = useMemo(
    () =>
      members.map((item) => ({
        id: String(item.id),
        label:
          item.full_name || item.user_full_name || item.username || item.national_id || item.id,
      })),
    [members]
  );
  const selectedPayoutFilterMemberOption = useMemo(
    () => memberOptions.find((item) => item.id === payoutFilters.member) || null,
    [memberOptions, payoutFilters.member]
  );

  const selectedMemberProfitRows = useMemo(() => {
    if (!selectedMemberId) return [];
    return profits.filter((item) => String(item.member) === String(selectedMemberId));
  }, [profits, selectedMemberId]);

  const selectedMemberUnpaidProfit = useMemo(
    () =>
      selectedMemberProfitRows.reduce(
        (acc, item) => acc + Number(item.unpaid_amount || item.profit || 0),
        0
      ),
    [selectedMemberProfitRows]
  );

  const onCreatePayout = async () => {
    if (!selectedMemberId) {
      notify("error", t("information"), t("selectMemberForPayout"));
      return;
    }

    setPaying(true);
    try {
      await createMemberProfitBulkPayout({
        member: Number(selectedMemberId),
        pay_all: payAll,
        amount: payAll ? undefined : Number(payoutAmount || 0),
      });
      notify("success", t("confirmation"), t("memberProfitPayoutCreatedSuccess"));
      setPayoutAmount("");
      setPayAll(true);
      await loadData(appliedYearFilter, appliedPayoutFilters);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setPaying(false);
    }
  };

  const downloadBlob = (blob, fileName) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExportAnnualClosingPdf = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await exportAnnualClosingPdf(
        buildAnnualClosingParams(appliedYearFilter)
      );
      downloadBlob(blob, fileName);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setExporting(false);
    }
  };

  const exportPayouts = async (format = "csv") => {
    setExporting(true);
    try {
      const headers = [t("member"), t("year"), t("amount"), t("paidOn"), t("recordedBy")];
      const rows = payouts.map((item) => [
        item.member_name || "-",
        item.annual_profit_year || "-",
        Number(item.amount || 0),
        item.paid_on || "-",
        item.approved_by_name || "-",
      ]);

      let blob;
      let fileName;
      if (format === "xlsx") {
        const tsv = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
        blob = new Blob([tsv], { type: "application/vnd.ms-excel;charset=utf-8;" });
        fileName = "profit_payouts.xls";
      } else {
        const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = [headers.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join(
          "\n"
        );
        blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        fileName = "profit_payouts.csv";
      }

      downloadBlob(blob, fileName);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setExporting(false);
    }
  };

  const exportPayoutsPdf = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await exportProfitPayoutsPdf(
        buildPayoutParams(appliedPayoutFilters, appliedYearFilter)
      );
      downloadBlob(blob, fileName);
      notify("success", t("confirmation"), `${t("exportedFile")}: ${fileName}`);
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleApplyPayoutFilters = async () => {
    await loadData(appliedYearFilter, payoutFilters);
  };

  const handleClearPayoutFilters = async () => {
    setPayoutFilters(INITIAL_PAYOUT_FILTERS);
    await loadData(appliedYearFilter, INITIAL_PAYOUT_FILTERS);
  };

  const handlePayoutSearchChange = async (value) => {
    const nextPayoutFilters = { ...appliedPayoutFilters, search: value };
    setPayoutFilters((prev) => ({ ...prev, search: value }));
    await loadData(appliedYearFilter, nextPayoutFilters);
  };

  const closingsTable = useMemo(() => {
    const columns = [
      { Header: t("year"), accessor: "year", align: "left" },
      { Header: t("totalSavings"), accessor: "total_savings", align: "left" },
      { Header: t("totalAdjustedCapital"), accessor: "total_adjusted_capital", align: "left" },
      { Header: t("profitRate"), accessor: "profit_rate", align: "left" },
      { Header: t("loanInterest"), accessor: "loan_interest", align: "left" },
      { Header: t("fines"), accessor: "fines", align: "left" },
      { Header: t("expenses"), accessor: "expenses", align: "left" },
      { Header: t("netProfit"), accessor: "net_profit", align: "left" },
    ];
    const rows = closings.map((item) => ({
      year: <MDTypography variant="caption">{item.year}</MDTypography>,
      total_savings: (
        <MDTypography variant="caption">
          {Number(item.total_savings || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      total_adjusted_capital: (
        <MDTypography variant="caption">
          {Number(item.total_adjusted_capital || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      profit_rate: (
        <MDTypography variant="caption" color="info">
          {Number(item.total_adjusted_capital || 0) > 0
            ? `${Number(item.profit_rate_percent || 0).toFixed(2)}%`
            : "-"}
        </MDTypography>
      ),
      loan_interest: (
        <MDTypography variant="caption">
          {Number(item.loan_interest || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      fines: (
        <MDTypography variant="caption">
          {Number(item.fines || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      expenses: (
        <MDTypography variant="caption">
          {Number(item.expenses || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      net_profit: (
        <MDTypography variant="caption" color="success">
          {Number(item.net_profit || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [closings, t]);

  const latestClosingSummary = useMemo(() => {
    if (lastClosingMetrics) {
      return {
        year: lastClosingMetrics.year || "-",
        totalAdjustedCapital: Number(lastClosingMetrics.total_adjusted_capital || 0),
        profitRatePercent: Number(lastClosingMetrics.profit_rate_percent || 0),
      };
    }
    if (!closings.length) return null;
    const latest = [...closings].sort((a, b) => Number(b.year) - Number(a.year))[0];
    return {
      year: latest.year,
      totalAdjustedCapital: Number(latest.total_adjusted_capital || 0),
      profitRatePercent: Number(latest.profit_rate_percent || 0),
    };
  }, [lastClosingMetrics, closings]);

  const profitsTable = useMemo(() => {
    const columns = [
      { Header: t("members"), accessor: "member", align: "left" },
      { Header: t("year"), accessor: "year", align: "left" },
      { Header: t("totalSavings"), accessor: "total_amount", align: "left" },
      { Header: t("shares"), accessor: "shares", align: "left" },
      { Header: t("profitRate"), accessor: "profit_rate", align: "left" },
      { Header: t("myProfit"), accessor: "profit", align: "left" },
      { Header: t("paid"), accessor: "paid_amount", align: "left" },
      { Header: t("unpaidProfit"), accessor: "unpaid_amount", align: "left" },
    ];
    const rows = profits.map((item) => ({
      member: <MDTypography variant="caption">{item.member_name || item.member}</MDTypography>,
      year: <MDTypography variant="caption">{item.closing_year || "-"}</MDTypography>,
      total_amount: (
        <MDTypography variant="caption">
          {Number(item.total_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      shares: <MDTypography variant="caption">{item.shares}</MDTypography>,
      profit_rate: (
        <MDTypography variant="caption" color="info">
          {Number(item.profit_rate_percent || 0).toFixed(2)}%
        </MDTypography>
      ),
      profit: (
        <MDTypography variant="caption" color="success">
          {Number(item.profit || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      paid_amount: (
        <MDTypography variant="caption">
          {Number(item.paid_amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      unpaid_amount: (
        <MDTypography variant="caption" color="warning">
          {Number(item.unpaid_amount || item.profit || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
    }));
    return { columns, rows };
  }, [profits, t]);

  const payoutsTable = useMemo(() => {
    const columns = [
      { Header: t("members"), accessor: "member", align: "left" },
      { Header: t("year"), accessor: "year", align: "left" },
      { Header: t("amount"), accessor: "amount", align: "left" },
      { Header: t("paidOn"), accessor: "paid_on", align: "left" },
      { Header: t("recordedBy"), accessor: "approved_by", align: "left" },
    ];
    const rows = payouts.map((item) => ({
      member: <MDTypography variant="caption">{item.member_name || "-"}</MDTypography>,
      year: <MDTypography variant="caption">{item.annual_profit_year || "-"}</MDTypography>,
      amount: (
        <MDTypography variant="caption" color="info">
          {Number(item.amount || 0).toLocaleString()} {t("rwf")}
        </MDTypography>
      ),
      paid_on: <MDTypography variant="caption">{item.paid_on || "-"}</MDTypography>,
      approved_by: <MDTypography variant="caption">{item.approved_by_name || "-"}</MDTypography>,
    }));
    return { columns, rows };
  }, [payouts, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6">{t("annualClosing")}</MDTypography>
                <MDTypography variant="button" color="text">
                  {t("annualClosingSubtitle")}
                </MDTypography>

                <MDBox mt={2} p={2} borderRadius="lg" bgColor="light">
                  <MDTypography variant="caption">{t("annualClosingPolicyNote")}</MDTypography>
                </MDBox>

                {latestClosingSummary && (
                  <Grid container spacing={2} mt={1}>
                    <Grid item xs={12} md={4}>
                      <MDBox p={2} borderRadius="lg" bgColor="light">
                        <MDTypography variant="button">{t("year")}</MDTypography>
                        <MDTypography variant="h6">{latestClosingSummary.year}</MDTypography>
                      </MDBox>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDBox p={2} borderRadius="lg" bgColor="light">
                        <MDTypography variant="button">{t("totalAdjustedCapital")}</MDTypography>
                        <MDTypography variant="h6">
                          {latestClosingSummary.totalAdjustedCapital.toLocaleString()} {t("rwf")}
                        </MDTypography>
                      </MDBox>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <MDBox p={2} borderRadius="lg" bgColor="light">
                        <MDTypography variant="button">{t("profitRate")}</MDTypography>
                        <MDTypography variant="h6" color="success">
                          {latestClosingSummary.profitRatePercent.toFixed(2)}%
                        </MDTypography>
                      </MDBox>
                    </Grid>
                  </Grid>
                )}

                <Grid container spacing={2} mt={1}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      sx={FORM_FIELD_SX}
                      label={t("year")}
                      value={year}
                      onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                    />
                  </Grid>
                  <Grid item xs={12} md={3} display="flex" alignItems="center">
                    {canWrite && (
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{ minHeight: 56, height: 56 }}
                        onClick={onCreateClosing}
                        disabled={saving || !year}
                      >
                        {saving ? t("loading") : t("annualCloseNow")}
                      </MDButton>
                    )}
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      sx={FORM_FIELD_SX}
                      label={t("filterYear")}
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value.replace(/\D/g, ""))}
                    />
                  </Grid>
                  <Grid item xs={12} md={3} display="flex" alignItems="center" gap={1}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      sx={{ minHeight: 56, height: 56 }}
                      onClick={() => loadData(filterYear, appliedPayoutFilters)}
                    >
                      {t("apply")}
                    </MDButton>
                    <MDButton
                      variant="outlined"
                      color="secondary"
                      sx={{ minHeight: 56, height: 56 }}
                      onClick={() => {
                        setFilterYear("");
                        loadData("", appliedPayoutFilters);
                      }}
                    >
                      {t("clear")}
                    </MDButton>
                    <HintButton
                      variant="outlined"
                      color="info"
                      sx={{ minHeight: 56, height: 56 }}
                      disabled={exporting || loading || closings.length === 0}
                      onClick={handleExportAnnualClosingPdf}
                      hint={
                        !loading && !exporting && closings.length === 0 ? t("noDataToExport") : ""
                      }
                    >
                      {t("exportPdf")}
                    </HintButton>
                  </Grid>
                </Grid>

                {canWrite && (
                  <MDBox mt={3} p={2} borderRadius="lg" bgColor="light">
                    <MDTypography variant="h6">{t("memberProfitPayouts")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("memberProfitPayoutsSubtitle")}
                    </MDTypography>
                    <Grid container spacing={2} mt={0.5}>
                      <Grid item xs={12} md={4}>
                        <Autocomplete
                          options={memberOptions}
                          value={
                            memberOptions.find((option) => option.id === selectedMemberId) || null
                          }
                          onChange={(_event, value) => setSelectedMemberId(value?.id || "")}
                          getOptionLabel={(option) => option.label || ""}
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
                                      group
                                    </Icon>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          select
                          fullWidth
                          sx={FORM_FIELD_SX}
                          label={t("payoutMode")}
                          value={payAll ? "ALL" : "PARTIAL"}
                          onChange={(e) => setPayAll(e.target.value === "ALL")}
                        >
                          <MenuItem value="ALL">{t("payAllProfits")}</MenuItem>
                          <MenuItem value="PARTIAL">{t("payPartialProfit")}</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          sx={FORM_FIELD_SX}
                          label={t("amount")}
                          value={payAll ? selectedMemberUnpaidProfit : payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value.replace(/\D/g, ""))}
                          disabled={payAll}
                        />
                      </Grid>
                      <Grid item xs={12} md={2} display="flex" alignItems="center">
                        <MDButton
                          variant="gradient"
                          color="info"
                          sx={{ minHeight: 56, height: 56, width: "100%" }}
                          onClick={onCreatePayout}
                          disabled={paying || !selectedMemberId || (!payAll && !payoutAmount)}
                        >
                          {paying ? t("loading") : t("payProfit")}
                        </MDButton>
                      </Grid>
                    </Grid>
                  </MDBox>
                )}

                <MDBox mt={3}>
                  <MDTypography variant="h6" mb={1}>
                    {t("annualClosing")}
                  </MDTypography>
                  <DataTable
                    table={closingsTable}
                    isSorted={false}
                    entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                    showTotalEntries
                    canSearch={false}
                    noEndBorder
                  />
                </MDBox>

                <MDBox mt={3}>
                  <MDTypography variant="h6" mb={1}>
                    {t("membersShares")}
                  </MDTypography>
                  <DataTable
                    table={profitsTable}
                    isSorted={false}
                    entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                    showTotalEntries
                    canSearch
                    noEndBorder
                  />
                </MDBox>

                <MDBox mt={3}>
                  <MDBox
                    mb={1}
                    display="flex"
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    flexDirection={{ xs: "column", md: "row" }}
                    gap={1}
                  >
                    <MDTypography variant="h6">{t("memberProfitPayoutsHistory")}</MDTypography>
                    <MDBox display="flex" gap={1} flexWrap="wrap">
                      <HintButton
                        variant="outlined"
                        color="info"
                        sx={{ minHeight: 56, height: 56 }}
                        disabled={exporting || loading || payouts.length === 0}
                        onClick={exportPayoutsPdf}
                        hint={
                          !loading && !exporting && payouts.length === 0 ? t("noDataToExport") : ""
                        }
                      >
                        {t("exportPdf")}
                      </HintButton>
                      <HintButton
                        variant="outlined"
                        color="info"
                        sx={{ minHeight: 56, height: 56 }}
                        disabled={exporting || loading || payouts.length === 0}
                        onClick={() => exportPayouts("csv")}
                        hint={
                          !loading && !exporting && payouts.length === 0 ? t("noDataToExport") : ""
                        }
                      >
                        {t("exportCsv")}
                      </HintButton>
                      <HintButton
                        variant="outlined"
                        color="info"
                        sx={{ minHeight: 56, height: 56 }}
                        disabled={exporting || loading || payouts.length === 0}
                        onClick={() => exportPayouts("xlsx")}
                        hint={
                          !loading && !exporting && payouts.length === 0 ? t("noDataToExport") : ""
                        }
                      >
                        {t("exportExcel")}
                      </HintButton>
                    </MDBox>
                  </MDBox>
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} md={4}>
                      <Autocomplete
                        options={memberOptions}
                        value={selectedPayoutFilterMemberOption}
                        onChange={(_event, value) =>
                          setPayoutFilters((prev) => ({ ...prev, member: value?.id || "" }))
                        }
                        getOptionLabel={(option) => option.label || ""}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        popupIcon={<Icon fontSize="small">expand_more</Icon>}
                        sx={FORM_FIELD_SX}
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
                      <TextField
                        fullWidth
                        type="date"
                        label={t("from")}
                        value={payoutFilters.date_from}
                        onChange={(event) =>
                          setPayoutFilters((prev) => ({ ...prev, date_from: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label={t("to")}
                        value={payoutFilters.date_to}
                        onChange={(event) =>
                          setPayoutFilters((prev) => ({ ...prev, date_to: event.target.value }))
                        }
                        sx={FORM_FIELD_SX}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4} display="flex" gap={1}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        sx={{ minHeight: 56, height: 56, flex: 1 }}
                        onClick={handleApplyPayoutFilters}
                        disabled={loading}
                      >
                        {t("apply")}
                      </MDButton>
                      <MDButton
                        variant="outlined"
                        color="secondary"
                        sx={{ minHeight: 56, height: 56, flex: 1 }}
                        onClick={handleClearPayoutFilters}
                        disabled={loading}
                      >
                        {t("clear")}
                      </MDButton>
                    </Grid>
                  </Grid>
                  <DataTable
                    table={payoutsTable}
                    isSorted={false}
                    entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                    showTotalEntries
                    canSearch
                    searchValue={payoutFilters.search}
                    onSearchChange={handlePayoutSearchChange}
                    noEndBorder
                  />
                </MDBox>

                {loading && <MDTypography variant="caption">{t("loading")}</MDTypography>}
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

export default AnnualClosingPage;
