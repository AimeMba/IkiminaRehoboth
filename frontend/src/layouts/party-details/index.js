import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";

import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  fetchBiometrics,
  fetchClients,
  fetchFines,
  fetchProfitRequests,
  fetchLoanRequests,
  fetchLoanRepayments,
  fetchLoans,
  fetchMemberProfits,
  fetchMembers,
  fetchMembershipFees,
  fetchMonthlySavings,
  fetchSavingChoiceChangeRequests,
} from "services/api";
import { useLanguage } from "i18n";

const SUMMARY_CARD_SX = {
  minHeight: 116,
  borderRadius: "1rem",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
};

const BIOMETRIC_AVATAR_SX = {
  width: 180,
  height: 180,
  borderRadius: "50%",
  objectFit: "cover",
  border: "4px solid #e3f2fd",
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
};

const ENTITY_STATUS_BADGE_SX = {
  px: 1.5,
  py: 0.65,
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  gap: 0.75,
  border: "1px solid",
};

const DETAIL_TABS_CONTAINER_SX = {
  display: "flex",
  gap: 1.25,
  overflowX: "auto",
  overflowY: "hidden",
  pb: 0.5,
  scrollBehavior: "smooth",
  "&::-webkit-scrollbar": {
    height: 8,
  },
  "&::-webkit-scrollbar-track": {
    background: "rgba(148, 163, 184, 0.16)",
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(30, 41, 59, 0.28)",
    borderRadius: 999,
  },
};

const DETAIL_TAB_BUTTON_SX = (isActive) => ({
  flex: "0 0 172px",
  minHeight: 76,
  px: 1.75,
  py: 1.4,
  borderRadius: "1rem",
  border: "1px solid",
  borderColor: isActive ? "rgba(26, 115, 232, 0.28)" : "rgba(15, 23, 42, 0.08)",
  background: isActive
    ? "linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(26, 115, 232, 0.18))"
    : "#f8fafc",
  boxShadow: isActive ? "0 12px 24px rgba(26, 115, 232, 0.14)" : "none",
  color: isActive ? "#1a73e8" : "#344767",
  justifyContent: "flex-start",
  textAlign: "left",
  textTransform: "none",
  whiteSpace: "normal",
  lineHeight: 1.35,
  "&:hover": {
    background: isActive
      ? "linear-gradient(135deg, rgba(33, 150, 243, 0.16), rgba(26, 115, 232, 0.22))"
      : "#ffffff",
    borderColor: isActive ? "rgba(26, 115, 232, 0.3)" : "rgba(15, 23, 42, 0.12)",
  },
});

function InfoLine({ label, value }) {
  return (
    <MDBox mb={1.5}>
      <MDTypography variant="button" color="text" textTransform="uppercase" fontWeight="bold">
        {label}
      </MDTypography>
      <MDTypography variant="body2">{value || "-"}</MDTypography>
    </MDBox>
  );
}

InfoLine.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function translateLoanStatus(status, t) {
  const statusMap = {
    ONGOING: t("ongoing"),
    PAID: t("paid"),
    DEFAULTED: t("defaulted"),
  };

  return statusMap[status] || status || "-";
}

function translateRequestStatus(status, t) {
  const statusMap = {
    PENDING: t("pending"),
    APPROVED: t("approved"),
    REJECTED: t("rejected"),
  };

  return statusMap[status] || status || "-";
}

function translateFineType(type, t) {
  const typeMap = {
    SAVING: t("savingType"),
    LOAN: t("loan"),
    ADMIN: t("administrativeType"),
    OTHER: t("otherType"),
  };

  return typeMap[type] || type || "-";
}

function getDetailTabLabel(tabValue, t) {
  const labelMap = {
    profile: t("tabProfile"),
    savings: t("tabSavings"),
    savingChoiceRequests: t("tabSavingChoiceRequests"),
    profitRequests: t("tabProfitRequests"),
    loans: t("tabLoans"),
    loanRepayments: t("tabLoanRepayments"),
    loanRequests: t("tabLoanRequests"),
    fines: t("tabFines"),
    biometric: t("tabBiometric"),
  };

  return labelMap[tabValue] || "-";
}

function PartyDetailsPage({ kind = "member" }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entity, setEntity] = useState(null);
  const [biometric, setBiometric] = useState(null);
  const [savings, setSavings] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loanRepayments, setLoanRepayments] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);
  const [fines, setFines] = useState([]);
  const [membershipFee, setMembershipFee] = useState(null);
  const [memberProfits, setMemberProfits] = useState([]);
  const [profitRequests, setProfitRequests] = useState([]);
  const [savingChoiceRequests, setSavingChoiceRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("profile");

  const isMember = kind === "member";
  const pageTitle = isMember ? `${t("member")} ${t("details")}` : `${t("client")} ${t("details")}`;
  const entityName = isMember
    ? entity?.user_full_name || entity?.user_username || entity?.national_id
    : entity?.full_name || entity?.user_full_name || entity?.national_id;
  const entityStatus = entity?.is_active ? t("active") : t("inactive");

  useEffect(() => {
    if (!entityName) return;
    const storageKey = isMember ? `breadcrumb:members:${id}` : `breadcrumb:clients:${id}`;
    sessionStorage.setItem(storageKey, entityName);
  }, [entityName, id, isMember]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        if (isMember) {
          const [
            membersPayload,
            savingsPayload,
            loansPayload,
            repaymentsPayload,
            requestsPayload,
            finesPayload,
            feesPayload,
            biometricsPayload,
            profitsPayload,
            profitRequestsPayload,
            savingChoiceRequestsPayload,
          ] = await Promise.all([
            fetchMembers(),
            fetchMonthlySavings(),
            fetchLoans(),
            fetchLoanRepayments({ owner_type: "MEMBER", owner_id: id }),
            fetchLoanRequests(),
            fetchFines(),
            fetchMembershipFees(),
            fetchBiometrics(),
            fetchMemberProfits(),
            fetchProfitRequests({ member: id }),
            fetchSavingChoiceChangeRequests({ member: id }),
          ]);

          if (!isMounted) return;
          const currentMember = (Array.isArray(membersPayload) ? membersPayload : []).find(
            (item) => String(item.id) === String(id)
          );
          setEntity(currentMember || null);
          setSavings(
            (Array.isArray(savingsPayload) ? savingsPayload : []).filter(
              (item) => String(item.member_id) === String(id)
            )
          );
          setLoans(
            (Array.isArray(loansPayload) ? loansPayload : []).filter(
              (item) => String(item.member) === String(id)
            )
          );
          setLoanRepayments(Array.isArray(repaymentsPayload) ? repaymentsPayload : []);
          setLoanRequests(
            (Array.isArray(requestsPayload) ? requestsPayload : []).filter(
              (item) => String(item.member) === String(id)
            )
          );
          setFines(
            (Array.isArray(finesPayload) ? finesPayload : []).filter(
              (item) => String(item.member) === String(id)
            )
          );
          setMembershipFee(
            (Array.isArray(feesPayload) ? feesPayload : []).find(
              (item) => String(item.member) === String(id)
            ) || null
          );
          setMemberProfits(
            (Array.isArray(profitsPayload) ? profitsPayload : []).filter(
              (item) => String(item.member) === String(id)
            )
          );
          setProfitRequests(
            Array.isArray(profitRequestsPayload)
              ? profitRequestsPayload
              : profitRequestsPayload?.results || []
          );
          setSavingChoiceRequests(
            Array.isArray(savingChoiceRequestsPayload)
              ? savingChoiceRequestsPayload
              : savingChoiceRequestsPayload?.results || []
          );
          setBiometric(
            (Array.isArray(biometricsPayload) ? biometricsPayload : []).find(
              (item) => item.owner_type === "MEMBER" && String(item.member) === String(id)
            ) || null
          );
          return;
        }

        const [
          clientsPayload,
          loansPayload,
          repaymentsPayload,
          requestsPayload,
          biometricsPayload,
        ] = await Promise.all([
          fetchClients(),
          fetchLoans(),
          fetchLoanRepayments({ owner_type: "CLIENT", owner_id: id }),
          fetchLoanRequests(),
          fetchBiometrics(),
        ]);

        if (!isMounted) return;
        const currentClient = (Array.isArray(clientsPayload) ? clientsPayload : []).find(
          (item) => String(item.id) === String(id)
        );
        setEntity(currentClient || null);
        setLoans(
          (Array.isArray(loansPayload) ? loansPayload : []).filter(
            (item) => String(item.client) === String(id)
          )
        );
        setLoanRepayments(Array.isArray(repaymentsPayload) ? repaymentsPayload : []);
        setLoanRequests(
          (Array.isArray(requestsPayload) ? requestsPayload : []).filter(
            (item) => String(item.client) === String(id)
          )
        );
        setBiometric(
          (Array.isArray(biometricsPayload) ? biometricsPayload : []).find(
            (item) => item.owner_type === "CLIENT" && String(item.client) === String(id)
          ) || null
        );
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id, isMember]);

  const savingsTable = useMemo(
    () => ({
      columns: [
        { Header: t("savingCategories"), accessor: "category", align: "left" },
        { Header: t("month"), accessor: "month", align: "left" },
        { Header: t("year"), accessor: "year", align: "left" },
        { Header: t("amount"), accessor: "amount", align: "left" },
        { Header: t("savedOn"), accessor: "savedOn", align: "left" },
      ],
      rows: savings.map((item) => ({
        category: <MDTypography variant="caption">{item.category_name || "-"}</MDTypography>,
        month: <MDTypography variant="caption">{item.month || "-"}</MDTypography>,
        year: <MDTypography variant="caption">{item.year || "-"}</MDTypography>,
        amount: (
          <MDTypography variant="caption">
            {Number(item.amount_paid || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        savedOn: <MDTypography variant="caption">{item.saved_on || "-"}</MDTypography>,
      })),
    }),
    [savings, t]
  );

  const loansTable = useMemo(
    () => ({
      columns: [
        { Header: t("loanType"), accessor: "type", align: "left" },
        { Header: t("principal"), accessor: "principal", align: "left" },
        { Header: t("amount"), accessor: "total", align: "left" },
        { Header: t("remainingBalance"), accessor: "remaining", align: "left" },
        { Header: t("status"), accessor: "status", align: "left" },
        { Header: t("dueDate"), accessor: "dueDate", align: "left" },
      ],
      rows: loans.map((item) => ({
        type: <MDTypography variant="caption">{item.loan_type_name || "-"}</MDTypography>,
        principal: (
          <MDTypography variant="caption">
            {Number(item.principal_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        total: (
          <MDTypography variant="caption">
            {Number(item.total_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        remaining: (
          <MDTypography variant="caption">
            {Number(item.remaining_balance || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        status: (
          <MDTypography variant="caption">{translateLoanStatus(item.status, t)}</MDTypography>
        ),
        dueDate: <MDTypography variant="caption">{item.due_date || "-"}</MDTypography>,
      })),
    }),
    [loans, t]
  );

  const loanRequestsTable = useMemo(
    () => ({
      columns: [
        { Header: t("loanType"), accessor: "type", align: "left" },
        { Header: t("requestedAmount"), accessor: "amount", align: "left" },
        { Header: t("repaymentTerm"), accessor: "term", align: "left" },
        { Header: t("status"), accessor: "status", align: "left" },
        { Header: t("requestedOn"), accessor: "requestedOn", align: "left" },
      ],
      rows: loanRequests.map((item) => ({
        type: <MDTypography variant="caption">{item.requested_loan_type_name || "-"}</MDTypography>,
        amount: (
          <MDTypography variant="caption">
            {Number(item.requested_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        term: (
          <MDTypography variant="caption">
            {(item.effective_term_value ||
              item.requested_term_days ||
              item.requested_term_months ||
              "-") +
              " " +
              (item.term_mode === "DAYS" || item.requested_term_days ? t("days") : t("months"))}
          </MDTypography>
        ),
        status: (
          <MDTypography variant="caption">{translateRequestStatus(item.status, t)}</MDTypography>
        ),
        requestedOn: <MDTypography variant="caption">{item.requested_on || "-"}</MDTypography>,
      })),
    }),
    [loanRequests, t]
  );

  const loanRepaymentsTable = useMemo(
    () => ({
      columns: [
        { Header: t("loan"), accessor: "loan", align: "left" },
        { Header: t("loanType"), accessor: "loanType", align: "left" },
        { Header: t("principalPart"), accessor: "principal", align: "left" },
        { Header: t("interestPart"), accessor: "interest", align: "left" },
        { Header: t("totalPayment"), accessor: "amount", align: "left" },
        { Header: t("paidOn"), accessor: "paidOn", align: "left" },
      ],
      rows: loanRepayments.map((item) => ({
        loan: <MDTypography variant="caption">#{item.loan || "-"}</MDTypography>,
        loanType: <MDTypography variant="caption">{item.loan_type_name || "-"}</MDTypography>,
        principal: (
          <MDTypography variant="caption">
            {Number(item.principal_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        interest: (
          <MDTypography variant="caption">
            {Number(item.interest_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        amount: (
          <MDTypography variant="caption" fontWeight="bold">
            {Number(item.amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        paidOn: <MDTypography variant="caption">{item.paid_on || "-"}</MDTypography>,
      })),
    }),
    [loanRepayments, t]
  );

  const finesTable = useMemo(
    () => ({
      columns: [
        { Header: t("name"), accessor: "rule", align: "left" },
        { Header: t("type"), accessor: "type", align: "left" },
        { Header: t("amount"), accessor: "amount", align: "left" },
        { Header: t("status"), accessor: "status", align: "left" },
        { Header: t("time"), accessor: "date", align: "left" },
      ],
      rows: fines.map((item) => ({
        rule: <MDTypography variant="caption">{item.rule_name || "-"}</MDTypography>,
        type: <MDTypography variant="caption">{translateFineType(item.rule_type, t)}</MDTypography>,
        amount: (
          <MDTypography variant="caption">
            {Number(item.amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        status: (
          <MDTypography variant="caption">
            {item.is_waived ? t("waived") : item.is_paid ? t("paid") : t("unread")}
          </MDTypography>
        ),
        date: <MDTypography variant="caption">{item.calculated_on || "-"}</MDTypography>,
      })),
    }),
    [fines, t]
  );

  const profitRequestsTable = useMemo(
    () => ({
      columns: [
        { Header: t("requestedOn"), accessor: "requestedOn", align: "left" },
        { Header: t("requestedBy"), accessor: "requestedBy", align: "left" },
        { Header: t("requestMode"), accessor: "requestMode", align: "left" },
        { Header: t("requestedProfit"), accessor: "requestedAmount", align: "left" },
        { Header: t("approvedAmount"), accessor: "approvedAmount", align: "left" },
        { Header: t("status"), accessor: "status", align: "left" },
        { Header: t("details"), accessor: "notes", align: "left" },
      ],
      rows: profitRequests.map((item) => ({
        requestedOn: (
          <MDTypography variant="caption">
            {item.requested_on ? new Date(item.requested_on).toLocaleString() : "-"}
          </MDTypography>
        ),
        requestedBy: <MDTypography variant="caption">{item.requested_by_name || "-"}</MDTypography>,
        requestMode: (
          <MDTypography variant="caption">
            {String(item.request_mode).toUpperCase() === "ALL"
              ? t("payAllProfits")
              : t("payPartialProfit")}
          </MDTypography>
        ),
        requestedAmount: (
          <MDTypography variant="caption">
            {Number(item.effective_requested_amount || 0).toLocaleString()} {t("rwf")}
          </MDTypography>
        ),
        approvedAmount: (
          <MDTypography variant="caption">
            {item.approved_amount ? Number(item.approved_amount).toLocaleString() : "-"}{" "}
            {item.approved_amount ? t("rwf") : ""}
          </MDTypography>
        ),
        status: (
          <MDTypography variant="caption">{translateRequestStatus(item.status, t)}</MDTypography>
        ),
        notes: (
          <MDTypography variant="caption">
            {item.review_notes || item.request_notes || "-"}
          </MDTypography>
        ),
      })),
    }),
    [profitRequests, t]
  );

  const savingChoiceRequestsTable = useMemo(
    () => ({
      columns: [
        { Header: t("year"), accessor: "year", align: "left" },
        { Header: t("savingCategories"), accessor: "change", align: "left" },
        { Header: t("requestType"), accessor: "requestType", align: "left" },
        { Header: t("requestedBy"), accessor: "requestedBy", align: "left" },
        { Header: t("status"), accessor: "status", align: "left" },
        { Header: t("details"), accessor: "details", align: "left" },
      ],
      rows: savingChoiceRequests.map((item) => ({
        year: <MDTypography variant="caption">{item.year || "-"}</MDTypography>,
        change: (
          <MDTypography variant="caption">
            {item.current_category_name || "-"} {"->"} {item.requested_category_name || "-"}
          </MDTypography>
        ),
        requestType: (
          <MDTypography variant="caption">
            {item.request_origin === "ON_BEHALF" ? t("requestedOnBehalf") : t("selfRequested")}
          </MDTypography>
        ),
        requestedBy: <MDTypography variant="caption">{item.requested_by_name || "-"}</MDTypography>,
        status: (
          <MDTypography variant="caption">{translateRequestStatus(item.status, t)}</MDTypography>
        ),
        details: (
          <MDTypography variant="caption">{item.review_note || item.reason || "-"}</MDTypography>
        ),
      })),
    }),
    [savingChoiceRequests, t]
  );

  const addressText = useMemo(() => {
    if (!entity?.address_hierarchy) return entity?.address || "-";
    const address = entity.address_hierarchy;
    return [
      address.parent_province,
      address.parent_district,
      address.parent_sector,
      address.parent_cell,
      address.name,
    ]
      .filter(Boolean)
      .join(" / ");
  }, [entity]);

  const totalSavingsAmount = useMemo(
    () => savings.reduce((acc, item) => acc + Number(item.amount_paid || 0), 0),
    [savings]
  );

  const totalProfitAmount = useMemo(
    () => memberProfits.reduce((acc, item) => acc + Number(item.profit || 0), 0),
    [memberProfits]
  );
  const pendingProfitRequestCount = useMemo(
    () =>
      profitRequests.filter((item) => String(item.status || "").toUpperCase() === "PENDING").length,
    [profitRequests]
  );

  const memberTotalAmount = totalSavingsAmount + totalProfitAmount;

  const clientLoanTotals = useMemo(() => {
    const granted = loans.reduce((acc, item) => acc + Number(item.principal_amount || 0), 0);
    const repaid = loans.reduce((acc, item) => acc + Number(item.total_paid || 0), 0);
    const remaining = loans.reduce((acc, item) => acc + Number(item.remaining_balance || 0), 0);

    return { granted, repaid, remaining };
  }, [loans]);

  const profileChecks = useMemo(() => {
    const checks = [
      { label: t("fullName"), value: entityName },
      { label: t("phone"), value: entity?.phone },
      { label: t("account"), value: entity?.account_number },
      { label: t("address"), value: addressText && addressText !== "-" ? addressText : "" },
      { label: t("photo"), value: biometric?.photo },
    ];

    if (isMember) {
      checks.splice(1, 0, { label: t("nationalId"), value: entity?.national_id });
      checks.push({ label: t("joinedOn"), value: entity?.joined_date });
    } else {
      checks.splice(1, 0, { label: t("nationalId"), value: entity?.national_id });
    }

    return checks;
  }, [
    addressText,
    biometric?.photo,
    entity?.account_number,
    entity?.joined_date,
    entity?.national_id,
    entity?.phone,
    entityName,
    isMember,
    t,
  ]);

  const missingProfileFields = useMemo(
    () =>
      profileChecks.filter((item) => !String(item.value || "").trim()).map((item) => item.label),
    [profileChecks]
  );

  const profileCompletionPercent = useMemo(() => {
    if (!profileChecks.length) return 0;
    return Math.round(
      ((profileChecks.length - missingProfileFields.length) / profileChecks.length) * 100
    );
  }, [missingProfileFields.length, profileChecks.length]);

  const isProfileComplete = missingProfileFields.length === 0;
  const needsBiometricPhoto = profileChecks.some(
    (item) => item.label === t("photo") && !String(item.value || "").trim()
  );

  const summaryCards = useMemo(() => {
    if (isMember) {
      return [
        {
          key: "savings",
          label: t("lifetimeSavings"),
          value: `${totalSavingsAmount.toLocaleString()} ${t("rwf")}`,
          icon: "savings",
        },
        {
          key: "profit",
          label: t("lifetimeProfit"),
          value: `${totalProfitAmount.toLocaleString()} ${t("rwf")}`,
          icon: "trending_up",
        },
        {
          key: "total",
          label: t("lifetimeTotal"),
          value: `${memberTotalAmount.toLocaleString()} ${t("rwf")}`,
          icon: "account_balance_wallet",
        },
        {
          key: "profileCompletion",
          label: t("profileCompletion"),
          value: `${profileCompletionPercent}%`,
          icon: isProfileComplete ? "verified" : "edit_note",
        },
      ];
    }

    return [
      {
        key: "granted",
        label: t("totalLoans"),
        value: `${clientLoanTotals.granted.toLocaleString()} ${t("rwf")}`,
        icon: "account_balance",
      },
      {
        key: "repaid",
        label: t("totalRepayments"),
        value: `${clientLoanTotals.repaid.toLocaleString()} ${t("rwf")}`,
        icon: "task_alt",
      },
      {
        key: "remaining",
        label: t("remainingBalance"),
        value: `${clientLoanTotals.remaining.toLocaleString()} ${t("rwf")}`,
        icon: "hourglass_bottom",
      },
      {
        key: "profileCompletion",
        label: t("profileCompletion"),
        value: `${profileCompletionPercent}%`,
        icon: isProfileComplete ? "verified" : "edit_note",
      },
    ];
  }, [
    clientLoanTotals.granted,
    clientLoanTotals.remaining,
    clientLoanTotals.repaid,
    isProfileComplete,
    isMember,
    memberTotalAmount,
    profileCompletionPercent,
    t,
    totalProfitAmount,
    totalSavingsAmount,
  ]);

  const detailTabs = useMemo(() => {
    const baseTabs = [
      { value: "profile", label: t("personalInfo"), icon: "badge" },
      { value: "loans", label: t("loans"), icon: "account_balance" },
      { value: "loanRequests", label: t("loanRequests"), icon: "assignment" },
      { value: "biometric", label: t("biometrics"), icon: "fingerprint" },
    ];

    if (isMember) {
      baseTabs.splice(1, 0, {
        value: "savings",
        label: t("monthlySavings"),
        icon: "calendar_month",
      });
      baseTabs.splice(2, 0, {
        value: "savingChoiceRequests",
        label: t("savingChoiceRequests"),
        icon: "tune",
      });
      baseTabs.splice(3, 0, {
        value: "profitRequests",
        label: t("profitRequests"),
        icon: "request_quote",
      });
      baseTabs.splice(5, 0, { value: "fines", label: t("fines"), icon: "gavel" });
    }
    baseTabs.splice(5, 0, {
      value: "loanRepayments",
      label: t("loanRepayments"),
      icon: "payments",
    });

    return baseTabs;
  }, [isMember, t]);

  useEffect(() => {
    if (
      !isMember &&
      ["savings", "fines", "profitRequests", "savingChoiceRequests"].includes(activeTab)
    ) {
      setActiveTab("profile");
    }
  }, [activeTab, isMember]);

  const activeTabAction = useMemo(() => {
    const actions = {
      profile: {
        label: t("completeProfile"),
        onClick: () =>
          navigate(isMember ? "/members" : "/clients", {
            state: { editId: Number(id) },
          }),
      },
      savings: {
        label: t("recordMonthlySaving"),
        onClick: () =>
          navigate("/monthly-savings", {
            state: { action: "create", memberId: Number(id) },
          }),
      },
      savingChoiceRequests: {
        label: t("requestChangeForMember"),
        onClick: () =>
          navigate("/saving-choice-requests", {
            state: { action: "create", memberId: Number(id) },
          }),
      },
      loans: {
        label: t("addLoan"),
        onClick: () =>
          navigate("/loans", {
            state: {
              action: "create",
              ownerType: isMember ? "MEMBER" : "CLIENT",
              ownerId: Number(id),
            },
          }),
      },
      loanRequests: {
        label: t("requestLoan"),
        onClick: () =>
          navigate("/loan-requests", {
            state: {
              action: "create",
              ownerType: isMember ? "MEMBER" : "CLIENT",
              ownerId: Number(id),
            },
          }),
      },
      loanRepayments: {
        label: t("addLoanRepayment"),
        onClick: () =>
          navigate("/loan-repayments", {
            state: {
              action: "create",
              ownerType: isMember ? "MEMBER" : "CLIENT",
              ownerId: Number(id),
              ownerName: entityName,
            },
          }),
      },
      profitRequests: {
        label: t("requestProfitForMember"),
        onClick: () =>
          navigate("/profit-requests", {
            state: {
              action: "create",
              memberId: Number(id),
            },
          }),
      },
      fines: {
        label: t("addFine"),
        onClick: () =>
          navigate("/fines", {
            state: { action: "create", memberId: Number(id) },
          }),
      },
      biometric: {
        label: t("addBiometric"),
        onClick: () =>
          navigate("/biometrics", {
            state: {
              ownerType: isMember ? "MEMBER" : "CLIENT",
              ownerId: Number(id),
            },
          }),
      },
    };

    return actions[activeTab] || null;
  }, [activeTab, entityName, id, isMember, navigate, t]);

  const renderTableContent = (title, table) => (
    <MDBox>
      <MDTypography variant="h6" mb={2}>
        {title}
      </MDTypography>
      <DataTable
        table={table}
        isSorted={false}
        entriesPerPage={false}
        showTotalEntries={false}
        canSearch={false}
        noEndBorder
      />
    </MDBox>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox
                p={3}
                display="flex"
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                flexDirection={{ xs: "column", md: "row" }}
                gap={2}
              >
                <MDBox>
                  <MDTypography variant="h5" fontWeight="bold">
                    {pageTitle}
                  </MDTypography>
                  <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <MDTypography variant="button" color="text">
                      {entityName || t("loading")}
                    </MDTypography>
                    {isMember && pendingProfitRequestCount > 0 && (
                      <Badge color="warning" badgeContent={pendingProfitRequestCount} max={99}>
                        <MDTypography variant="caption" color="warning" fontWeight="medium">
                          {t("pendingRequests")}
                        </MDTypography>
                      </Badge>
                    )}
                  </MDBox>
                </MDBox>
                <MDButton
                  variant="outlined"
                  color="info"
                  startIcon={<Icon>arrow_back</Icon>}
                  onClick={() => navigate(isMember ? "/members" : "/clients")}
                >
                  {isMember ? t("members") : t("clients")}
                </MDButton>
              </MDBox>
            </Card>
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}

          {!error && !entity && !loading && (
            <Grid item xs={12}>
              <Alert severity="warning">{t("noRecordsModule")}</Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={4} lg={3}>
                    <MDBox display="flex" justifyContent="center">
                      {biometric?.photo ? (
                        <MDBox
                          component="img"
                          src={biometric.photo}
                          alt={entityName || t("photo")}
                          sx={BIOMETRIC_AVATAR_SX}
                        />
                      ) : (
                        <MDBox
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          sx={{
                            ...BIOMETRIC_AVATAR_SX,
                            backgroundColor: "#f8fafc",
                          }}
                        >
                          <Icon color="info" sx={{ fontSize: "4rem !important" }}>
                            person
                          </Icon>
                        </MDBox>
                      )}
                    </MDBox>
                  </Grid>
                  <Grid item xs={12} md={8} lg={9}>
                    <MDTypography variant="h4" fontWeight="bold" mb={0.5}>
                      {entityName || "-"}
                    </MDTypography>
                    <MDBox display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                      <MDTypography variant="button" color="info" fontWeight="medium">
                        {isMember ? t("member") : t("client")}
                      </MDTypography>
                      <MDBox
                        sx={{
                          ...ENTITY_STATUS_BADGE_SX,
                          color: entity?.is_active ? "#2e7d32" : "#c62828",
                          backgroundColor: entity?.is_active ? "#edf7ed" : "#ffebee",
                          borderColor: entity?.is_active ? "#a5d6a7" : "#ef9a9a",
                        }}
                      >
                        <Icon fontSize="small">
                          {entity?.is_active ? "verified_user" : "block"}
                        </Icon>
                        <MDTypography variant="caption" fontWeight="medium" color="inherit">
                          {entityStatus}
                        </MDTypography>
                      </MDBox>
                    </MDBox>
                    <MDBox mt={2}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <InfoLine label={t("phone")} value={entity?.phone} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <InfoLine label={t("account")} value={entity?.account_number} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <InfoLine label={t("status")} value={entityStatus} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <InfoLine
                            label={t("profileCompletion")}
                            value={
                              isProfileComplete
                                ? `${t("profileComplete")} (${profileCompletionPercent}%)`
                                : `${t("profileIncomplete")} (${profileCompletionPercent}%)`
                            }
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <InfoLine
                            label={isMember ? t("joinedOn") : t("time")}
                            value={isMember ? entity?.joined_date : entity?.created_on}
                          />
                        </Grid>
                      </Grid>
                    </MDBox>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          {summaryCards.map((card) => (
            <Grid item xs={12} md={6} xl={3} key={card.key}>
              <Card sx={SUMMARY_CARD_SX}>
                <MDBox
                  p={2.5}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <MDBox>
                    <MDTypography variant="button" color="text" textTransform="uppercase">
                      {card.label}
                    </MDTypography>
                    <MDTypography variant="h5" fontWeight="bold" mt={1}>
                      {card.value}
                    </MDTypography>
                  </MDBox>
                  <MDBox
                    width={48}
                    height={48}
                    display="grid"
                    placeItems="center"
                    borderRadius="lg"
                    bgColor="info"
                    color="white"
                    shadow="md"
                  >
                    <Icon>{card.icon}</Icon>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Card>
              <MDBox px={2} pt={2}>
                <MDBox sx={DETAIL_TABS_CONTAINER_SX}>
                  {detailTabs.map((tab) => (
                    <MDButton
                      key={tab.value}
                      variant={activeTab === tab.value ? "gradient" : "outlined"}
                      color={activeTab === tab.value ? "info" : "light"}
                      onClick={() => setActiveTab(tab.value)}
                      sx={DETAIL_TAB_BUTTON_SX(activeTab === tab.value)}
                    >
                      <MDBox display="flex" alignItems="flex-start" gap={1.1} width="100%">
                        <MDBox mt={0.15} display="grid" placeItems="center" minWidth={20}>
                          <Icon fontSize="small">{tab.icon}</Icon>
                        </MDBox>
                        <MDTypography
                          variant="button"
                          fontWeight={activeTab === tab.value ? "bold" : "medium"}
                          color="inherit"
                          sx={{ whiteSpace: "normal", lineHeight: 1.45 }}
                        >
                          {tab.value === "profitRequests" && pendingProfitRequestCount > 0 ? (
                            <Badge
                              color="warning"
                              badgeContent={pendingProfitRequestCount}
                              max={99}
                              sx={{
                                "& .MuiBadge-badge": {
                                  right: -16,
                                  top: 10,
                                },
                              }}
                            >
                              <span>{getDetailTabLabel(tab.value, t)}</span>
                            </Badge>
                          ) : (
                            getDetailTabLabel(tab.value, t)
                          )}
                        </MDTypography>
                      </MDBox>
                    </MDButton>
                  ))}
                </MDBox>
              </MDBox>
              <MDBox p={3}>
                {activeTabAction && (
                  <MDBox mb={2} display="flex" justifyContent="flex-end">
                    <MDButton variant="outlined" color="info" onClick={activeTabAction.onClick}>
                      {activeTabAction.label}
                    </MDButton>
                  </MDBox>
                )}
                {activeTab === "profile" && (
                  <Grid container spacing={3}>
                    <Grid item xs={12} lg={7}>
                      <MDTypography variant="h6" mb={2}>
                        {t("personalInfo")}
                      </MDTypography>
                      <InfoLine label={t("fullName")} value={entityName} />
                      <InfoLine label={t("username")} value={entity?.user_username} />
                      <InfoLine label={t("email")} value={entity?.user_email} />
                      <InfoLine label={t("phone")} value={entity?.phone} />
                      <InfoLine label={t("address")} value={addressText} />
                      <InfoLine label={t("account")} value={entity?.account_number} />
                      {isMember && (
                        <InfoLine
                          label={t("lifetimeProfit")}
                          value={`${totalProfitAmount.toLocaleString()} ${t("rwf")}`}
                        />
                      )}
                      {isMember && membershipFee && (
                        <InfoLine
                          label={t("membershipFees")}
                          value={`${Number(membershipFee.amount || 0).toLocaleString()} ${t(
                            "rwf"
                          )}`}
                        />
                      )}
                    </Grid>
                    <Grid item xs={12} lg={5}>
                      <MDTypography variant="h6" mb={2}>
                        {t("biometrics")}
                      </MDTypography>
                      <MDBox display="flex" justifyContent="center" mb={2.5}>
                        {biometric?.photo ? (
                          <MDBox
                            component="img"
                            src={biometric.photo}
                            alt={entityName || t("photo")}
                            sx={BIOMETRIC_AVATAR_SX}
                          />
                        ) : (
                          <MDBox
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                              ...BIOMETRIC_AVATAR_SX,
                              backgroundColor: "#f8fafc",
                            }}
                          >
                            <Icon color="info" sx={{ fontSize: "4rem !important" }}>
                              person
                            </Icon>
                          </MDBox>
                        )}
                      </MDBox>
                      <MDBox
                        p={2}
                        mt={1}
                        borderRadius="lg"
                        sx={{ backgroundColor: isProfileComplete ? "#ecfdf3" : "#fff7ed" }}
                      >
                        <MDBox display="flex" alignItems="center" gap={1} mb={1}>
                          <Icon color={isProfileComplete ? "success" : "warning"}>
                            {isProfileComplete ? "check_circle" : "error_outline"}
                          </Icon>
                          <MDTypography variant="button" fontWeight="bold">
                            {isProfileComplete ? t("profileComplete") : t("profileIncomplete")}
                          </MDTypography>
                        </MDBox>
                        <MDTypography variant="caption" color="text" display="block" mb={1.5}>
                          {t("profileCompletion")}: {profileCompletionPercent}%
                        </MDTypography>
                        <MDTypography variant="caption" fontWeight="bold" display="block" mb={0.75}>
                          {t("missingProfileFields")}
                        </MDTypography>
                        {missingProfileFields.length ? (
                          missingProfileFields.map((field) => (
                            <MDTypography
                              key={field}
                              variant="caption"
                              color="text"
                              display="block"
                            >
                              - {field}
                            </MDTypography>
                          ))
                        ) : (
                          <MDTypography variant="caption" color="text">
                            {t("noMissingFields")}
                          </MDTypography>
                        )}
                        {!isProfileComplete && (
                          <MDBox mt={2}>
                            <MDButton
                              variant="gradient"
                              color="info"
                              onClick={() => {
                                if (needsBiometricPhoto) {
                                  navigate("/biometrics", {
                                    state: {
                                      ownerType: isMember ? "MEMBER" : "CLIENT",
                                      ownerId: Number(id),
                                    },
                                  });
                                  return;
                                }

                                navigate(isMember ? "/members" : "/clients", {
                                  state: { editId: Number(id) },
                                });
                              }}
                            >
                              {t("completeProfile")}
                            </MDButton>
                          </MDBox>
                        )}
                      </MDBox>
                    </Grid>
                  </Grid>
                )}

                {activeTab === "savings" &&
                  isMember &&
                  renderTableContent(t("monthlySavings"), savingsTable)}
                {activeTab === "savingChoiceRequests" &&
                  isMember &&
                  renderTableContent(t("savingChoiceRequests"), savingChoiceRequestsTable)}
                {activeTab === "profitRequests" && isMember && (
                  <MDBox>
                    <MDTypography variant="h6" mb={2}>
                      {t("profitRequests")}
                    </MDTypography>
                    {profitRequests.length ? (
                      <DataTable
                        table={profitRequestsTable}
                        isSorted={false}
                        entriesPerPage={false}
                        showTotalEntries={false}
                        canSearch={false}
                        noEndBorder
                      />
                    ) : (
                      <Alert severity="info">{t("profitRequestsSubtitle")}</Alert>
                    )}
                  </MDBox>
                )}
                {activeTab === "loans" && renderTableContent(t("loans"), loansTable)}
                {activeTab === "loanRepayments" &&
                  renderTableContent(t("loanRepayments"), loanRepaymentsTable)}
                {activeTab === "loanRequests" &&
                  renderTableContent(t("loanRequests"), loanRequestsTable)}
                {activeTab === "fines" && isMember && renderTableContent(t("fines"), finesTable)}
                {activeTab === "biometric" && (
                  <Grid container spacing={3} justifyContent="center">
                    <Grid item xs={12} md={6}>
                      <MDBox display="flex" flexDirection="column" alignItems="center">
                        {biometric?.photo ? (
                          <MDBox
                            component="img"
                            src={biometric.photo}
                            alt={entityName || t("photo")}
                            sx={BIOMETRIC_AVATAR_SX}
                          />
                        ) : (
                          <MDBox
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                              ...BIOMETRIC_AVATAR_SX,
                              backgroundColor: "#f8fafc",
                            }}
                          >
                            <Icon color="info" sx={{ fontSize: "4rem !important" }}>
                              person
                            </Icon>
                          </MDBox>
                        )}
                        <MDTypography variant="h6" mt={2} mb={0.5}>
                          {entityName || "-"}
                        </MDTypography>
                        <MDTypography variant="button" color="text">
                          {isMember ? t("member") : t("client")}
                        </MDTypography>
                      </MDBox>
                    </Grid>
                  </Grid>
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

export default PartyDetailsPage;

PartyDetailsPage.propTypes = {
  kind: PropTypes.oneOf(["member", "client"]),
};
