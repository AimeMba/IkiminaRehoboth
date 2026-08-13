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

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useLanguage } from "i18n";

function Footer() {
  const { t } = useLanguage();
  return (
    <MDBox width="100%" display="flex" justifyContent="center" alignItems="center" px={1.5} py={2}>
      <MDTypography variant="button" color="text" fontWeight="regular">
        &copy; {new Date().getFullYear()} {t("ikiminaRehoboth")}. {t("allRights")}
      </MDTypography>
    </MDBox>
  );
}

export default Footer;
