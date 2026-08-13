/* eslint-disable prettier/prettier */
/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Icon from "components/AppIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Breadcrumbs from "examples/Breadcrumbs";
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";
import { useMaterialUIController, setTransparentNavbar, setMiniSidenav } from "context";
import { clearTokens, fetchCurrentUser, fetchUnreadNotificationCount } from "services/api";
import { useLanguage } from "i18n";

const languageOptions = [
  { value: "rw", label: "Kinyarwanda", flag: "\u{1F1F7}\u{1F1FC}" },
  { value: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
  { value: "fr", label: "Francais", flag: "\u{1F1EB}\u{1F1F7}" },
];

const formatRoleLabel = (role) => {
  if (!role) return "";
  return String(role).trim().toUpperCase().replace(/_/g, " ");
};

function DashboardNavbar({ absolute, light, isMini }) {
  const { t, lang, setLang } = useLanguage();
  const [navbarType, setNavbarType] = useState();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userAnchor, setUserAnchor] = useState(null);
  const [languageAnchor, setLanguageAnchor] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, darkMode } = controller;
  const location = useLocation();
  const route = location.pathname.split("/").slice(1);
  const navigate = useNavigate();

  const breadcrumbTitleMap = {
    dashboard: t("dashboard"),
    tables: t("dataTables"),
    authentication: t("signIn"),
    "sign-in": t("signIn"),
    members: t("members"),
    clients: t("clients"),
    biometrics: t("biometrics"),
    "saving-categories": t("savingCategories"),
    "monthly-savings": t("monthlySavings"),
    loans: t("loans"),
    "loan-requests": t("loanRequests"),
    "loan-repayments": t("loanRepayments"),
    "membership-fees": t("membershipFees"),
    "member-exits": t("memberExits"),
    income: t("income"),
    expenses: t("expenses"),
    fines: t("fines"),
    "annual-closing": t("annualClosing"),
    departments: t("departments"),
    employees: t("employees"),
    "salary-payments": t("salaryPayments"),
    users: t("users"),
    "transaction-logs": t("transactionLogs"),
    "certificate-approvals": t("certificateApprovals"),
    "my-savings": t("mySavings"),
    "my-saving-choice": t("mySavingChoice"),
    "saving-choice-requests": t("savingChoiceRequests"),
    "my-loans": t("myLoans"),
    "my-loan-requests": t("myLoanRequests"),
    "my-profit-requests": t("myProfitRequests"),
    "my-repayments": t("myRepayments"),
    "my-fines": t("myFines"),
    "my-certificate": t("myCertificate"),
    "profit-requests": t("profitRequests"),
    notifications: t("notifications"),
    profile: t("profileSettings"),
  };
  const breadcrumbRouteMap = {
    members: t("members"),
    member: t("member"),
    clients: t("clients"),
    client: t("client"),
  };
  const routeKey = route[route.length - 1];
  const detailStorageKey =
    route.length === 2 && ["members", "clients"].includes(route[0])
      ? `breadcrumb:${route[0]}:${route[1]}`
      : "";
  const detailLabel =
    location.state?.breadcrumbLabel ||
    (detailStorageKey ? sessionStorage.getItem(detailStorageKey) : "");
  const baseTitle =
    route.length === 2 && detailLabel ? detailLabel : breadcrumbTitleMap[routeKey] || routeKey;
  const currentRoleLabel = formatRoleLabel(user?.effective_role || user?.role);
  const currentUserLabel =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "-";
  const activeLanguage =
    languageOptions.find((option) => option.value === lang) || languageOptions[0];
  const breadcrumbTitle =
    routeKey === "dashboard"
      ? `${String(baseTitle).toUpperCase()}${currentRoleLabel ? ` (${currentRoleLabel})` : ""}`
      : baseTitle;
  const breadcrumbRoute = route.map((segment, index) => {
    if (route.length === 2 && index === 0 && segment === "members") {
      return { label: t("member"), path: "/members", key: "members-detail" };
    }

    if (route.length === 2 && index === 0 && segment === "clients") {
      return { label: t("client"), path: "/clients", key: "clients-detail" };
    }

    return {
      label: breadcrumbRouteMap[segment] || breadcrumbTitleMap[segment] || segment,
      path: `/${route.slice(0, index + 1).join("/")}`,
      key: `${segment}-${index}`,
    };
  });

  useEffect(() => {
    setNavbarType(fixedNavbar ? "sticky" : "static");

    function handleTransparentNavbar() {
      setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }

    window.addEventListener("scroll", handleTransparentNavbar);
    handleTransparentNavbar();
    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((data) => {
        if (mounted) setUser(data);
      })
      .catch(() => {
        if (mounted) setUser(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadUnread = async () => {
      try {
        const count = await fetchUnreadNotificationCount();
        if (mounted) setUnreadCount(Number(count) || 0);
      } catch (_error) {
        if (mounted) setUnreadCount(0);
      }
    };

    loadUnread();
    const timer = setInterval(loadUnread, 60000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [route.join("/")]);

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);
  const handleLogout = () => {
    clearTokens();
    navigate("/authentication/sign-in", { replace: true });
  };

  const openUserMenu = (event) => setUserAnchor(event.currentTarget);
  const closeUserMenu = () => setUserAnchor(null);

  const iconsStyle = ({ palette: { dark, white, text }, functions: { rgba } }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;
      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }
      return colorValue;
    },
  });

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) => navbar(theme, { transparentNavbar, absolute, light, darkMode })}
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        <MDBox color="inherit" mb={{ xs: 1, md: 0 }} sx={(theme) => navbarRow(theme, { isMini })}>
          <Breadcrumbs icon="home" title={breadcrumbTitle} route={breadcrumbRoute} light={light} />
        </MDBox>
        {!isMini && (
          <MDBox display="flex" alignItems="center" gap={1}>
            <IconButton
              size="small"
              disableRipple
              color="inherit"
              sx={navbarMobileMenu}
              onClick={handleMiniSidenav}
            >
              <Icon sx={iconsStyle} fontSize="medium">
                {miniSidenav ? "menu_open" : "menu"}
              </Icon>
            </IconButton>

            <MDTypography variant="button" color="text">
              {currentUserLabel}
            </MDTypography>
            <IconButton
              onClick={openUserMenu}
              sx={{
                width: 38,
                height: 38,
                border: "1px solid",
                borderColor: "rgba(70, 90, 120, 0.35)",
                borderRadius: "50%",
              }}
              title={user?.username || "User"}
            >
              <Icon fontSize="small">person</Icon>
            </IconButton>
            <IconButton
              onClick={() => navigate("/notifications")}
              sx={{
                width: 38,
                height: 38,
                border: "1px solid",
                borderColor: "rgba(70, 90, 120, 0.35)",
                borderRadius: "50%",
              }}
              title={t("notifications")}
            >
              <Badge
                badgeContent={unreadCount > 99 ? "99+" : unreadCount}
                color="error"
                invisible={unreadCount <= 0}
              >
                <Icon fontSize="small">notifications</Icon>
              </Badge>
            </IconButton>
            <IconButton
              onClick={(event) => setLanguageAnchor(event.currentTarget)}
              sx={{
                width: 38,
                height: 38,
                border: "1px solid",
                borderColor: "rgba(70, 90, 120, 0.35)",
                borderRadius: "50%",
              }}
              title={t("language")}
            >
              <MDTypography variant="button">{activeLanguage.flag}</MDTypography>
            </IconButton>
            <Menu
              anchorEl={languageAnchor}
              open={Boolean(languageAnchor)}
              onClose={() => setLanguageAnchor(null)}
            >
              {languageOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  onClick={() => {
                    setLang(option.value);
                    setLanguageAnchor(null);
                  }}
                >
                  <MDBox display="flex" alignItems="center" gap={1}>
                    <span>{option.flag}</span>
                    <span>{option.label}</span>
                  </MDBox>
                </MenuItem>
              ))}
            </Menu>
            <Menu anchorEl={userAnchor} open={Boolean(userAnchor)} onClose={closeUserMenu}>
              <MenuItem
                onClick={() => {
                  setProfileOpen(true);
                  closeUserMenu();
                }}
              >
                {t("profileSettings")}
              </MenuItem>
              <MenuItem onClick={handleLogout}>{t("logout")}</MenuItem>
            </Menu>
          </MDBox>
        )}
      </Toolbar>

      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("profileSettings")}</DialogTitle>
        <DialogContent dividers>
          <MDTypography variant="button" display="block" mb={1}>
            {t("username")}: {user?.username || "-"}
          </MDTypography>
          <MDTypography variant="button" display="block" mb={1}>
            {t("email")}: {user?.email || "-"}
          </MDTypography>
          <MDTypography variant="button" display="block">
            {t("roleLabel")}: {user?.role || "-"}
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setProfileOpen(false)}>{t("close")}</MDButton>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}

DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
};

DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;
