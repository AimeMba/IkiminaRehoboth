/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import boxShadows from "assets/theme/base/boxShadows";
import typography from "assets/theme/base/typography";
import colors from "assets/theme/base/colors";
import borders from "assets/theme/base/borders";
import pxToRem from "assets/theme/functions/pxToRem";

const { lg } = boxShadows;
const { size } = typography;
const { text, white, transparent, light, dark, gradients, grey, info } = colors;
const { borderRadius } = borders;

const autocomplete = {
  defaultProps: {
    clearOnEscape: true,
    forcePopupIcon: true,
  },
  styleOverrides: {
    inputRoot: {
      minHeight: pxToRem(56),
      borderRadius: borderRadius.md,
      "& .MuiAutocomplete-input": {
        paddingTop: `${pxToRem(16.5)} !important`,
        paddingBottom: `${pxToRem(16.5)} !important`,
      },
      "&.MuiInputBase-sizeSmall": {
        minHeight: pxToRem(42),
      },
      "&.MuiInputBase-sizeSmall .MuiAutocomplete-input": {
        paddingTop: `${pxToRem(10)} !important`,
        paddingBottom: `${pxToRem(10)} !important`,
      },
    },
    popper: {
      boxShadow: lg,
      padding: pxToRem(8),
      fontSize: size.sm,
      color: text.main,
      textAlign: "left",
      backgroundColor: `${white.main} !important`,
      borderRadius: borderRadius.md,
    },
    paper: {
      boxShadow: "none",
      backgroundColor: transparent.main,
    },
    option: {
      padding: `${pxToRem(4.8)} ${pxToRem(16)}`,
      borderRadius: borderRadius.md,
      fontSize: size.sm,
      color: text.main,
      transition: "background-color 300ms ease, color 300ms ease",
      "&:hover, &:focus, &.Mui-selected, &.Mui-selected:hover, &.Mui-selected:focus": {
        backgroundColor: light.main,
        color: dark.main,
      },
      '&[aria-selected="true"]': {
        backgroundColor: `${light.main} !important`,
        color: `${dark.main} !important`,
      },
    },
    noOptions: {
      fontSize: size.sm,
      color: text.main,
    },
    groupLabel: {
      color: dark.main,
    },
    loading: {
      fontSize: size.sm,
      color: text.main,
    },
    tag: {
      display: "flex",
      alignItems: "center",
      height: "auto",
      padding: pxToRem(4),
      backgroundColor: gradients.dark.state,
      color: white.main,
      "& .MuiChip-label": {
        lineHeight: 1.2,
        padding: `0 ${pxToRem(10)} 0 ${pxToRem(4)}`,
      },
      "& .MuiSvgIcon-root, & .MuiSvgIcon-root:hover, & .MuiSvgIcon-root:focus": {
        color: white.main,
        marginRight: 0,
      },
    },
    popupIndicator: {
      color: grey[600],
      borderLeft: `${pxToRem(1)} solid ${grey[300]}`,
      borderRadius: 0,
      marginRight: pxToRem(4),
      "&:hover": {
        color: info.main,
        backgroundColor: transparent.main,
      },
    },
    clearIndicator: {
      color: grey[500],
      "&:hover": {
        color: info.main,
        backgroundColor: transparent.main,
      },
    },
  },
};

export default autocomplete;
