import PropTypes from "prop-types";

import Icon from "components/AppIcon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

function ContextBanner({ icon, title, subtitle, onClear, clearLabel = "Clear", mt = 0, mb = 0 }) {
  return (
    <MDBox
      mt={mt}
      mb={mb}
      px={2.5}
      py={2}
      borderRadius="xl"
      sx={{
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
        border: "1px solid rgba(59,130,246,0.18)",
      }}
    >
      <MDBox
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        flexDirection={{ xs: "column", md: "row" }}
        gap={1.5}
      >
        <MDBox display="flex" alignItems="center" gap={1.25}>
          <Icon color="info">{icon}</Icon>
          <MDBox>
            <MDTypography variant="button" fontWeight="bold" color="info">
              {title}
            </MDTypography>
            {subtitle ? (
              <MDTypography variant="caption" color="text" display="block">
                {subtitle}
              </MDTypography>
            ) : null}
          </MDBox>
        </MDBox>
        <MDButton variant="text" color="info" sx={{ minHeight: 36, height: 36 }} onClick={onClear}>
          {clearLabel}
        </MDButton>
      </MDBox>
    </MDBox>
  );
}

ContextBanner.propTypes = {
  icon: PropTypes.string,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  onClear: PropTypes.func.isRequired,
  clearLabel: PropTypes.string,
  mt: PropTypes.number,
  mb: PropTypes.number,
};

export default ContextBanner;
