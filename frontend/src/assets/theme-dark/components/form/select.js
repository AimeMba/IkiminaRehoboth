/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import colors from "assets/theme-dark/base/colors";
import borders from "assets/theme-dark/base/borders";
import boxShadows from "assets/theme-dark/base/boxShadows";
import typography from "assets/theme-dark/base/typography";
import rgba from "assets/theme-dark/functions/rgba";
import pxToRem from "assets/theme-dark/functions/pxToRem";

const { transparent, grey, white, info, background } = colors;
const { borderRadius } = borders;
const { md } = boxShadows;
const { size, fontWeightRegular, fontWeightBold } = typography;

const select = {
  defaultProps: {
    variant: "outlined",
    displayEmpty: true,
  },
  styleOverrides: {
    select: {
      display: "grid",
      alignItems: "center",
      padding: `${pxToRem(12)} ${pxToRem(14)} !important`,
      paddingRight: `${pxToRem(36)} !important`,
      fontSize: size.sm,
      fontWeight: fontWeightRegular,
      borderRadius: borderRadius.md,
      backgroundColor: rgba(background.card, 0.6),
      transition: "all 180ms ease",
      "&:focus": {
        backgroundColor: rgba(background.card, 0.75),
      },
      "& .Mui-selected": {
        backgroundColor: transparent.main,
      },
      "&.MuiSelect-select.MuiInputBase-inputSizeSmall": {
        minHeight: pxToRem(42),
        padding: `${pxToRem(10)} ${pxToRem(12)} !important`,
      },

      // Keep select height aligned with text fields inside dialogs.
      ".MuiDialogContent-root &": {
        minHeight: pxToRem(56),
        padding: `${pxToRem(16)} ${pxToRem(14)} !important`,
      },
    },
    selectMenu: {
      background: "none",
      minHeight: "none",
      overflow: "unset",
    },
    icon: {
      display: "block",
      right: pxToRem(10),
      color: grey[400],
      fontSize: pxToRem(20),
      pointerEvents: "none",
      transition: "color 180ms ease",
    },
    outlined: {
      borderRadius: borderRadius.md,
      boxShadow: "none",
      "&.Mui-focused .MuiSelect-select": {
        fontWeight: fontWeightBold,
      },
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: rgba(white.main, 0.2),
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: rgba(white.main, 0.35),
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: info.main,
        boxShadow: md,
      },
      "&.Mui-focused .MuiSelect-icon": {
        color: info.main,
      },
    },
  },
};

export default select;
