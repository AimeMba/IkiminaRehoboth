import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

import MDBox from "components/MDBox";
import Icon from "components/AppIcon";

export const PHONE_CODES = [
  { code: "+250", flag: "🇷🇼", label: "Rwanda", maxDigits: 9, placeholder: "7XXXXXXXX" },
  { code: "+257", flag: "🇧🇮", label: "Burundi", maxDigits: 8, placeholder: "XXXXXXXX" },
  { code: "+254", flag: "🇰🇪", label: "Kenya", maxDigits: 9, placeholder: "7XXXXXXXX" },
  { code: "+255", flag: "🇹🇿", label: "Tanzania", maxDigits: 9, placeholder: "6XXXXXXXX" },
  { code: "+256", flag: "🇺🇬", label: "Uganda", maxDigits: 9, placeholder: "7XXXXXXXX" },
];

export const parsePhone = (rawPhone) => {
  const value = String(rawPhone || "").trim();
  const match = PHONE_CODES.find((item) => value.startsWith(item.code)) || PHONE_CODES[0];
  const local = value.startsWith(match.code)
    ? value.slice(match.code.length)
    : value.replace(/\D/g, "");

  return {
    countryCode: match.code,
    local: local.replace(/\D/g, "").slice(0, match.maxDigits),
  };
};

function PhoneNumberField({
  countryCodeLabel,
  phoneLabel,
  countryCode,
  phoneLocal,
  onCountryCodeChange,
  onPhoneLocalChange,
  required = false,
  disabled = false,
  sx,
}) {
  const selectedCode = PHONE_CODES.find((item) => item.code === countryCode) || PHONE_CODES[0];

  return (
    <MDBox
      display="flex"
      alignItems="stretch"
      sx={{
        width: "100%",
        "& .MuiOutlinedInput-root": {
          minHeight: 56,
          height: 56,
        },
        ...sx,
      }}
    >
      <TextField
        select
        label={countryCodeLabel}
        value={selectedCode.code}
        onChange={(event) => onCountryCodeChange(event.target.value)}
        disabled={disabled}
        InputLabelProps={{ shrink: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Icon fontSize="small" color="info">
                flag
              </Icon>
            </InputAdornment>
          ),
        }}
        sx={{
          width: 156,
          "& .MuiOutlinedInput-root": {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            backgroundColor: "#ffffff",
            boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
          },
        }}
      >
        {PHONE_CODES.map((item) => (
          <MenuItem key={item.code} value={item.code}>
            {`${item.flag} ${item.code}`}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        required={required}
        fullWidth
        type="tel"
        label={phoneLabel}
        value={phoneLocal}
        onChange={(event) => onPhoneLocalChange(event.target.value)}
        disabled={disabled}
        placeholder={selectedCode.placeholder}
        InputLabelProps={{ shrink: true }}
        inputProps={{
          inputMode: "numeric",
          maxLength: selectedCode.maxDigits,
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            backgroundColor: "#ffffff",
            boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
          },
        }}
      />
    </MDBox>
  );
}

PhoneNumberField.propTypes = {
  countryCodeLabel: PropTypes.string.isRequired,
  phoneLabel: PropTypes.string.isRequired,
  countryCode: PropTypes.string.isRequired,
  phoneLocal: PropTypes.string.isRequired,
  onCountryCodeChange: PropTypes.func.isRequired,
  onPhoneLocalChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  sx: PropTypes.object,
};

export default PhoneNumberField;
