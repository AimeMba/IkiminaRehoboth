/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useState, useEffect, useMemo } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Sidenav from "examples/Sidenav";
import theme from "assets/theme";
import themeRTL from "assets/theme/theme-rtl";
import themeDark from "assets/theme-dark";
import themeDarkRTL from "assets/theme-dark/theme-rtl";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import routes, { USER_ROLES } from "routes";
import { useMaterialUIController, setMiniSidenav } from "context";
import { getAccessToken, fetchCurrentUser, clearTokens } from "services/api";
import ikiminaLogo from "assets/images/logos/IkiminaRehoboth_logos.png";

const defaultPathByRole = {
  [USER_ROLES.ADMIN]: "/dashboard",
  [USER_ROLES.MANAGER]: "/dashboard",
  [USER_ROLES.TELLER]: "/dashboard",
  [USER_ROLES.LOAN_OFFICER]: "/dashboard",
  [USER_ROLES.FINANCE]: "/dashboard",
  [USER_ROLES.AUDITOR]: "/dashboard",
  [USER_ROLES.MEMBER]: "/dashboard",
  [USER_ROLES.CLIENT]: "/dashboard",
};

const normalizeRole = (rawRole) => {
  if (!rawRole) return "";
  return String(rawRole).trim().toUpperCase().replace(/\s+/g, "_");
};

const isRoleAllowed = (route, role) => {
  if (!route.allowedRoles) {
    return true;
  }
  return Boolean(role) && route.allowedRoles.includes(role);
};

const filterRoutesByRole = (allRoutes, role) =>
  allRoutes
    .map((route) => {
      if (route.collapse) {
        const nested = filterRoutesByRole(route.collapse, role);
        return nested.length ? { ...route, collapse: nested } : null;
      }

      return isRoleAllowed(route, role) ? route : null;
    })
    .filter(Boolean);

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, direction, layout, transparentSidenav, whiteSidenav, darkMode } = controller;

  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const { pathname } = useLocation();
  const isAuthenticated = Boolean(getAccessToken());

  const [currentUser, setCurrentUser] = useState(null);
  const [isUserLoading, setIsUserLoading] = useState(isAuthenticated);

  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });
    setRtlCache(cacheRtl);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      if (!isAuthenticated) {
        if (isMounted) {
          setCurrentUser(null);
          setIsUserLoading(false);
        }
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (isMounted) {
          setCurrentUser(user);
        }
      } catch (_error) {
        clearTokens();
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsUserLoading(false);
        }
      }
    };

    setIsUserLoading(isAuthenticated);
    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const currentRole = normalizeRole(currentUser?.effective_role || currentUser?.role);
  const defaultPath = defaultPathByRole[currentRole] || "/dashboard";

  const handleOnMouseEnter = () => {
    if (miniSidenav && !onMouseEnter) {
      setMiniSidenav(dispatch, false);
      setOnMouseEnter(true);
    }
  };

  const handleOnMouseLeave = () => {
    if (onMouseEnter) {
      setMiniSidenav(dispatch, true);
      setOnMouseEnter(false);
    }
  };

  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  useEffect(() => {
    document.title = "IKIMINA REHOBOTH";
    let favicon = document.querySelector("link[rel='shortcut icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "shortcut icon");
      document.head.appendChild(favicon);
    }
    favicon.setAttribute("href", ikiminaLogo);
  }, []);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) return getRoutes(route.collapse);
      if (!route.route) return null;

      let element = route.component;

      if (route.key !== "sign-in" && !isAuthenticated) {
        element = <Navigate to="/authentication/sign-in" replace />;
      }

      if (route.key === "sign-in" && isAuthenticated) {
        element = <Navigate to={defaultPath} replace />;
      }

      if (isAuthenticated && route.key !== "sign-in" && !isRoleAllowed(route, currentRole)) {
        element = <Navigate to={defaultPath} replace />;
      }

      return <Route exact path={route.route} element={element} key={route.key} />;
    });

  const sidenavRoutes = isAuthenticated
    ? filterRoutesByRole(
        routes.filter((route) => route.key !== "sign-in"),
        currentRole
      )
    : routes.filter((route) => route.key === "sign-in");

  const fallbackPath = isAuthenticated ? defaultPath : "/authentication/sign-in";

  if (isAuthenticated && isUserLoading) {
    return null;
  }

  return direction === "rtl" ? (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={darkMode ? themeDarkRTL : themeRTL}>
        <CssBaseline />
        {layout === "dashboard" && (
          <Sidenav
            brand={ikiminaLogo}
            brandName=""
            routes={sidenavRoutes}
            onMouseEnter={handleOnMouseEnter}
            onMouseLeave={handleOnMouseLeave}
          />
        )}
        <Routes>
          {getRoutes(routes)}
          <Route path="*" element={<Navigate to={fallbackPath} />} />
        </Routes>
      </ThemeProvider>
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {layout === "dashboard" && (
        <Sidenav
          brand={ikiminaLogo}
          brandName=""
          routes={sidenavRoutes}
          onMouseEnter={handleOnMouseEnter}
          onMouseLeave={handleOnMouseLeave}
        />
      )}
      <Routes>
        {getRoutes(routes)}
        <Route path="*" element={<Navigate to={fallbackPath} />} />
      </Routes>
    </ThemeProvider>
  );
}
