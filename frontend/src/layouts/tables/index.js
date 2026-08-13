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

import { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import { fetchTableData } from "services/api";
import { useLanguage } from "i18n";

function Tables() {
  const { t } = useLanguage();
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchTableData()
      .then((resp) => {
        if (!mounted) return;
        setMembers(resp.members || []);
        setLoans(resp.loans || []);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const membersTable = useMemo(() => {
    const columns = [
      { Header: t("nationalId"), accessor: "national_id", align: "left" },
      { Header: t("account"), accessor: "account", align: "left" },
      { Header: t("phone"), accessor: "phone", align: "left" },
      { Header: t("status"), accessor: "status", align: "center" },
    ];

    const rows = members.map((member) => ({
      national_id: (
        <MDTypography variant="button" fontWeight="medium">
          {member.national_id}
        </MDTypography>
      ),
      account: <MDTypography variant="caption">{member.account_number}</MDTypography>,
      phone: <MDTypography variant="caption">{member.phone}</MDTypography>,
      status: (
        <MDBadge
          badgeContent={member.is_active ? t("active") : t("inactive")}
          color={member.is_active ? "success" : "dark"}
          variant="gradient"
          size="sm"
        />
      ),
    }));

    return { columns, rows };
  }, [members, t]);

  const loansTable = useMemo(() => {
    const columns = [
      { Header: t("loanId"), accessor: "loan_id", align: "left" },
      { Header: t("type"), accessor: "type", align: "left" },
      { Header: t("principal"), accessor: "principal", align: "left" },
      { Header: t("interest"), accessor: "interest", align: "center" },
      { Header: t("status"), accessor: "status", align: "center" },
    ];

    const rows = loans.map((loan) => ({
      loan_id: <MDTypography variant="button">#{loan.id}</MDTypography>,
      type: <MDTypography variant="caption">{loan.loan_type}</MDTypography>,
      principal: (
        <MDTypography variant="caption">
          {loan.principal_amount} {t("rwf")}
        </MDTypography>
      ),
      interest: <MDTypography variant="caption">{loan.interest_rate}%</MDTypography>,
      status: (
        <MDBadge
          badgeContent={loan.status}
          color={loan.status === "PAID" ? "success" : "info"}
          variant="gradient"
          size="sm"
        />
      ),
    }));

    return { columns, rows };
  }, [loans, t]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        {error && (
          <MDBox mb={3}>
            <Alert severity="error">{error}</Alert>
          </MDBox>
        )}
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2}
                mt={-3}
                py={3}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
              >
                <MDTypography variant="h6" color="white">
                  {t("membersTable")}
                </MDTypography>
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={membersTable}
                  isSorted={false}
                  entriesPerPage={false}
                  showTotalEntries={false}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2}
                mt={-3}
                py={3}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
              >
                <MDTypography variant="h6" color="white">
                  {t("loansTable")}
                </MDTypography>
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={loansTable}
                  isSorted={false}
                  entriesPerPage={false}
                  showTotalEntries={false}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Tables;
