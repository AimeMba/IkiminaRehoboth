import PropTypes from "prop-types";

import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";

import Icon from "components/AppIcon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

const HERO_CARD_SX = {
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(15, 42, 92, 0.08)",
  background:
    "linear-gradient(135deg, rgba(244,250,255,0.98) 0%, rgba(255,255,255,1) 52%, rgba(240,248,241,0.96) 100%)",
  boxShadow: "0 24px 50px rgba(15, 42, 92, 0.09)",
};

const HERO_DECORATION_SX = {
  position: "absolute",
  borderRadius: "999px",
  pointerEvents: "none",
};

const STAT_TONES = {
  info: {
    bg: "rgba(31, 119, 180, 0.08)",
    border: "rgba(31, 119, 180, 0.18)",
    text: "#0f2a5c",
  },
  success: {
    bg: "rgba(76, 175, 80, 0.09)",
    border: "rgba(76, 175, 80, 0.18)",
    text: "#1f5f2a",
  },
  warning: {
    bg: "rgba(255, 167, 38, 0.11)",
    border: "rgba(255, 167, 38, 0.2)",
    text: "#8a4b00",
  },
  dark: {
    bg: "rgba(15, 42, 92, 0.06)",
    border: "rgba(15, 42, 92, 0.12)",
    text: "#0f2a5c",
  },
};

function MemberPageHero({ icon, title, subtitle, notice, actions, stats }) {
  return (
    <Card sx={HERO_CARD_SX}>
      <MDBox
        sx={{
          ...HERO_DECORATION_SX,
          width: 180,
          height: 180,
          top: -60,
          right: -50,
          bgColor: "#dff2e2",
        }}
      />
      <MDBox
        sx={{
          ...HERO_DECORATION_SX,
          width: 130,
          height: 130,
          bottom: -45,
          left: -30,
          background: "rgba(31, 119, 180, 0.08)",
        }}
      />
      <MDBox p={{ xs: 2.5, md: 3 }}>
        <Grid container spacing={2.5} alignItems="stretch">
          <Grid item xs={12} lg={stats.length ? 7 : 12}>
            <MDBox display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
              <MDBox maxWidth="44rem">
                <MDBox
                  width={56}
                  height={56}
                  borderRadius="xl"
                  display="grid"
                  placeItems="center"
                  mb={2}
                  sx={{
                    background:
                      "linear-gradient(135deg, rgba(15,42,92,0.96) 0%, rgba(47,164,124,0.92) 100%)",
                    boxShadow: "0 16px 30px rgba(15, 42, 92, 0.22)",
                  }}
                >
                  <Icon fontSize="medium" sx={{ color: "#ffffff" }}>
                    {icon}
                  </Icon>
                </MDBox>
                <MDTypography variant="h4" fontWeight="bold" color="dark">
                  {title}
                </MDTypography>
                <MDTypography variant="button" color="text" display="block" mt={1}>
                  {subtitle}
                </MDTypography>
                {notice && (
                  <MDBox
                    mt={2.5}
                    px={2}
                    py={1.5}
                    borderRadius="xl"
                    sx={{
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(15, 42, 92, 0.08)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {typeof notice === "string" ? (
                      <MDTypography variant="button" color="text">
                        {notice}
                      </MDTypography>
                    ) : (
                      notice
                    )}
                  </MDBox>
                )}
              </MDBox>
              {actions && (
                <MDBox
                  display="flex"
                  alignItems="flex-start"
                  justifyContent="flex-end"
                  flexWrap="wrap"
                  gap={1}
                >
                  {actions}
                </MDBox>
              )}
            </MDBox>
          </Grid>
          {stats.length > 0 && (
            <Grid item xs={12} lg={5}>
              <Grid container spacing={1.5}>
                {stats.map((stat) => {
                  const tone = STAT_TONES[stat.tone] || STAT_TONES.info;
                  return (
                    <Grid item xs={12} sm={6} key={stat.label}>
                      <MDBox
                        height="100%"
                        px={2}
                        py={1.75}
                        borderRadius="xl"
                        sx={{
                          background: tone.bg,
                          border: `1px solid ${tone.border}`,
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <MDTypography
                          variant="caption"
                          color="text"
                          textTransform="uppercase"
                          fontWeight="medium"
                        >
                          {stat.label}
                        </MDTypography>
                        <MDTypography
                          variant="h5"
                          mt={0.5}
                          sx={{ color: tone.text, wordBreak: "break-word" }}
                        >
                          {stat.value}
                        </MDTypography>
                        {stat.helper ? (
                          <MDTypography variant="caption" color="text" display="block" mt={0.5}>
                            {stat.helper}
                          </MDTypography>
                        ) : null}
                      </MDBox>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>
          )}
        </Grid>
      </MDBox>
    </Card>
  );
}

MemberPageHero.propTypes = {
  icon: PropTypes.string,
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  notice: PropTypes.node,
  actions: PropTypes.node,
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.node.isRequired,
      helper: PropTypes.node,
      tone: PropTypes.oneOf(["info", "success", "warning", "dark"]),
    })
  ),
};

MemberPageHero.defaultProps = {
  icon: "dashboard",
  subtitle: "",
  notice: null,
  actions: null,
  stats: [],
};

export default MemberPageHero;
