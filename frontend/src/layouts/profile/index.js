import { useEffect, useState } from "react";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "components/AppIcon";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import { fetchCurrentUser, updateMyProfile, changeMyPassword } from "services/api";
import { useLanguage } from "i18n";

function Profile() {
  const { t } = useLanguage();

  const [user, setUser] = useState(null);
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    color: "info",
    title: "",
    content: "",
  });

  const openSnackbar = (color, title, content) => {
    setSnackbar({ open: true, color, title, content });
  };

  useEffect(() => {
    let mounted = true;

    const loadMe = async () => {
      setLoading(true);
      try {
        const data = await fetchCurrentUser();
        if (!mounted) return;

        setUser(data);
        setProfileForm({
          username: data.username || "",
          email: data.email || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
        });
      } catch (err) {
        if (mounted) {
          openSnackbar("error", t("information"), err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMe();

    return () => {
      mounted = false;
    };
  }, [t]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateMyProfile(profileForm);
      const refreshed = await fetchCurrentUser();
      setUser(refreshed);
      openSnackbar("success", t("confirmation"), t("profileUpdatedSuccess"));
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      openSnackbar("error", t("information"), t("passwordMismatch"));
      return;
    }

    setSavingPassword(true);
    try {
      await changeMyPassword(passwordForm.old_password, passwordForm.new_password);
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      openSnackbar("success", t("confirmation"), t("passwordChangedSuccess"));
    } catch (err) {
      openSnackbar("error", t("information"), err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={0.5}>
                  {t("profilePageTitle")}
                </MDTypography>
                <MDTypography variant="button" color="text">
                  {t("profilePageSubtitle")}
                </MDTypography>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card>
              <MDBox p={3} component="form" onSubmit={handleProfileSubmit}>
                <MDTypography variant="h6" mb={2}>
                  {t("personalInfo")}
                </MDTypography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      fullWidth
                      label={t("username")}
                      value={profileForm.username}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, username: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      fullWidth
                      label="Email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      fullWidth
                      label={t("firstName")}
                      value={profileForm.first_name}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, first_name: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      fullWidth
                      label={t("lastName")}
                      value={profileForm.last_name}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, last_name: e.target.value }))
                      }
                    />
                  </Grid>
                </Grid>

                <MDBox mt={3} display="flex" justifyContent="flex-end">
                  <MDButton type="submit" variant="gradient" color="info" disabled={savingProfile}>
                    {savingProfile ? t("creating") : t("saveChanges")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" mb={2}>
                  {t("security")}
                </MDTypography>

                <MDBox mb={2}>
                  <MDTypography variant="button" color="text">
                    {t("roleLabel")}: {user?.role || "-"}
                  </MDTypography>
                  <br />
                  <MDTypography variant="button" color="text">
                    {t("joinedOn")}:{" "}
                    {user?.date_joined ? new Date(user.date_joined).toLocaleString() : "-"}
                  </MDTypography>
                </MDBox>

                <MDBox component="form" onSubmit={handlePasswordSubmit}>
                  <MDBox mb={2}>
                    <MDInput
                      fullWidth
                      type="password"
                      label={t("oldPassword")}
                      value={passwordForm.old_password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, old_password: e.target.value }))
                      }
                    />
                  </MDBox>
                  <MDBox mb={2}>
                    <MDInput
                      fullWidth
                      type="password"
                      label={t("newPassword")}
                      value={passwordForm.new_password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                      }
                    />
                  </MDBox>
                  <MDBox mb={2}>
                    <MDInput
                      fullWidth
                      type="password"
                      label={t("confirmPassword")}
                      value={passwordForm.confirm_password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))
                      }
                    />
                  </MDBox>

                  <MDBox display="flex" justifyContent="flex-end">
                    <MDButton
                      type="submit"
                      variant="gradient"
                      color="dark"
                      disabled={savingPassword || loading}
                    >
                      {savingPassword ? t("creating") : t("changePassword")}
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
        icon={<Icon fontSize="small">notifications</Icon>}
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

export default Profile;
