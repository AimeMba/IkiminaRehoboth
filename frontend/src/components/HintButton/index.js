import PropTypes from "prop-types";
import Tooltip from "@mui/material/Tooltip";

import MDButton from "components/MDButton";

function HintButton({ hint = "", children, ...buttonProps }) {
  const button = <MDButton {...buttonProps}>{children}</MDButton>;

  if (!hint) {
    return button;
  }

  return (
    <Tooltip title={hint}>
      <span style={{ display: "inline-flex" }}>{button}</span>
    </Tooltip>
  );
}

HintButton.propTypes = {
  hint: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default HintButton;
