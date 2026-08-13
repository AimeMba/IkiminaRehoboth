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

import { useState } from "react";

// react-router-dom components
import { useNavigate } from "react-router-dom";

// @mui material components
import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Icon from "components/AppIcon";
import InputAdornment from "@mui/material/InputAdornment";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// Authentication layout components
import BasicLayout from "layouts/authentication/components/BasicLayout";

// Images
import bgImage from "assets/images/bg-sign-in-basic.jpeg";
import logoPrimary from "assets/images/logos/IkiminaRehoboth_logos.png";
import { login } from "services/api";
import { useLanguage } from "i18n";

const languageOptions = [
  { value: "rw", label: "Kinyarwanda", flag: "\u{1F1F7}\u{1F1FC}" },
  { value: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
  { value: "fr", label: "Francais", flag: "\u{1F1EB}\u{1F1F7}" },
];

const AUTH_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
    borderRadius: "0.85rem",
    backgroundColor: "rgba(255,255,255,0.98)",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
  },
};

const AUTH_BUTTON_SX = {
  minHeight: 56,
  height: 56,
  borderRadius: "0.85rem",
};

function Basic() {
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logoSrc] = useState(logoPrimary);
  const [languageAnchor, setLanguageAnchor] = useState(null);
  const activeLanguage =
    languageOptions.find((option) => option.value === lang) || languageOptions[0];

  const handleSignIn = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BasicLayout image={bgImage}>
      <MDBox
        position="fixed"
        top={14}
        left={{ xs: 12, sm: 18 }}
        right={{ xs: 12, sm: 18 }}
        zIndex={1300}
        px={{ xs: 1.5, sm: 2.5 }}
        py={1}
        sx={{
          borderRadius: "0.9rem",
          backgroundColor: "rgba(255,255,255,0.96)",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
          backdropFilter: "blur(16px)",
        }}
      >
        <MDBox display="flex" alignItems="center" justifyContent="space-between">
          <MDBox display="flex" alignItems="center" gap={1}>
            <MDBox
              component="img"
              src={logoSrc}
              alt="Ikimina Rehoboth"
              sx={{ height: { xs: "5.4rem", sm: "6.4rem" }, width: "auto", display: "block" }}
            />
          </MDBox>
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
        </MDBox>
      </MDBox>
      <Card
        sx={{
          overflow: "visible",
          borderRadius: "1.35rem",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
          backdropFilter: "blur(10px)",
          background: "rgba(255,255,255,0.98)",
        }}
      >
        <MDBox
          variant="gradient"
          bgColor="info"
          borderRadius="xl"
          coloredShadow="info"
          mx={2}
          mt={-3}
          px={3}
          py={2.5}
          mb={1}
          sx={{
            background:
              "linear-gradient(135deg, rgba(30,136,229,1) 0%, rgba(26,115,232,1) 52%, rgba(17,82,147,1) 100%)",
          }}
        >
          <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <MDBox>
              <MDTypography variant="h3" fontWeight="bold" color="white">
                {t("ikiminaRehoboth")}
              </MDTypography>
              <MDTypography variant="button" color="white" sx={{ opacity: 0.92 }}>
                {t("signInSubtitle")}
              </MDTypography>
            </MDBox>
            <MDBox
              display={{ xs: "none", md: "flex" }}
              alignItems="center"
              justifyContent="center"
              sx={{
                width: 56,
                height: 56,
                borderRadius: "1rem",
                backgroundColor: "rgba(255,255,255,0.16)",
              }}
            >
              <Icon sx={{ color: "#fff !important", fontSize: "2rem !important" }}>shield</Icon>
            </MDBox>
          </MDBox>
        </MDBox>

        <MDBox pt={4} pb={3.5} px={{ xs: 2.5, sm: 3.5 }}>
          <MDBox component="form" role="form" onSubmit={handleSignIn}>
            <MDBox mb={2.2}>
              <MDInput
                type="text"
                label={t("username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                sx={AUTH_FIELD_SX}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon fontSize="small" color="info">
                        person
                      </Icon>
                    </InputAdornment>
                  ),
                }}
              />
            </MDBox>
            <MDBox mb={2.2}>
              <MDInput
                type="password"
                label={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                sx={AUTH_FIELD_SX}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon fontSize="small" color="info">
                        lock
                      </Icon>
                    </InputAdornment>
                  ),
                }}
              />
            </MDBox>
            {error && (
              <MDBox mb={2}>
                <Alert severity="error">{error}</Alert>
              </MDBox>
            )}
            <MDBox mt={3}>
              <MDButton
                type="submit"
                variant="gradient"
                color="info"
                fullWidth
                disabled={loading}
                sx={AUTH_BUTTON_SX}
              >
                {loading ? t("signingIn") : t("signIn")}
              </MDButton>
            </MDBox>
            <MDBox mt={2.5} textAlign="center">
              <MDTypography variant="button" color="text">
                {t("userCreatedByAdmin")}
              </MDTypography>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}

export default Basic;
