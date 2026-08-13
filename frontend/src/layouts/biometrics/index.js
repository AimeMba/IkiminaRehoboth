import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "components/AppIcon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDTypography from "components/MDTypography";
import {
  FORM_ACTION_BUTTON_SX,
  FORM_DIALOG_ACTIONS_SX,
  FORM_DIALOG_CONTENT_SX,
  FORM_DIALOG_PAPER_SX,
  FORM_DIALOG_TITLE_BAR_SX,
  FORM_DIALOG_TITLE_SX,
} from "components/FormDialog/styles";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  createBiometric,
  deleteBiometric,
  fetchBiometrics,
  fetchClients,
  fetchMembers,
  updateBiometric,
} from "services/api";
import { useLanguage } from "i18n";

const OWNER_TYPES = [{ id: "MEMBER" }, { id: "CLIENT" }];

const FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    minHeight: 56,
    height: 56,
    borderRadius: "0.7rem",
    backgroundColor: "#ffffff",
    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
  },
};

function BiometricsPage() {
  const { t, lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    owner_type: "MEMBER",
    owner_id: null,
    photo: null,
    fingerprint_template: "",
  });
  const [snackbar, setSnackbar] = useState({ open: false, color: "info", title: "", content: "" });
  const [captureState, setCaptureState] = useState({
    status: "idle",
    message: "",
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const photoObjectUrlRef = useRef("");

  const notify = (color, title, content) => setSnackbar({ open: true, color, title, content });

  const setPreviewFromFile = (file) => {
    if (photoObjectUrlRef.current) {
      URL.revokeObjectURL(photoObjectUrlRef.current);
      photoObjectUrlRef.current = "";
    }
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      photoObjectUrlRef.current = objectUrl;
      setPhotoPreviewUrl(objectUrl);
    } else {
      setPhotoPreviewUrl("");
    }
  };

  const ownerOptions = form.owner_type === "CLIENT" ? clients : members;

  const loadData = async () => {
    setLoading(true);
    try {
      const [biometricsPayload, membersPayload, clientsPayload] = await Promise.all([
        fetchBiometrics(),
        fetchMembers(),
        fetchClients(),
      ]);
      setRows(Array.isArray(biometricsPayload) ? biometricsPayload : []);
      setMembers(Array.isArray(membersPayload) ? membersPayload : []);
      setClients(Array.isArray(clientsPayload) ? clientsPayload : []);
    } catch (error) {
      notify("error", t("information"), error.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const ownerType = location.state?.ownerType;
    const ownerId = location.state?.ownerId;
    if (!ownerType || !ownerId) return;

    const existing = rows.find(
      (item) =>
        item.owner_type === ownerType &&
        String(ownerType === "CLIENT" ? item.client : item.member) === String(ownerId)
    );

    if (existing) {
      openEdit(existing);
    } else {
      setEditTarget(null);
      setForm({
        owner_type: ownerType,
        owner_id: ownerId,
        photo: null,
        fingerprint_template: "",
      });
      setOpen(true);
      setCaptureState({ status: "idle", message: "" });
      setCameraError("");
      setPhotoPreviewUrl("");
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, rows]);

  useEffect(
    () => () => {
      stopCameraStream();
      if (photoObjectUrlRef.current) {
        URL.revokeObjectURL(photoObjectUrlRef.current);
      }
    },
    []
  );

  const resetForm = () =>
    setForm({
      owner_type: "MEMBER",
      owner_id: null,
      photo: null,
      fingerprint_template: "",
    });

  const getOwnerName = (item) => item.member_name || item.client_name || "-";
  const getOwnerTypeLabel = (ownerType) =>
    ownerType === "CLIENT" ? t("clients") : ownerType === "MEMBER" ? t("members") : ownerType;
  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const locale = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "rw-RW";
    return date.toLocaleString(locale);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      owner_type: item.owner_type || "MEMBER",
      owner_id: item.owner_type === "CLIENT" ? item.client : item.member,
      photo: null,
      fingerprint_template: "",
    });
    setOpen(true);
    setCaptureState({ status: "idle", message: "" });
    setCameraError("");
    setPhotoPreviewUrl(item?.photo || "");
  };

  const stopCameraStream = () => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null;
    }
  };

  const openCameraDialog = () => {
    setCameraError("");
    setCameraOpen(true);
  };

  const closeCameraDialog = () => {
    setCameraOpen(false);
    setCameraError("");
    stopCameraStream();
  };

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;

    const startCamera = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error(t("cameraUnavailable"));
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (error) {
        const message = error?.message || t("cameraUnavailable");
        setCameraError(message);
        notify("error", t("information"), message);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraOpen, t]);

  const capturePhotoFromCamera = async () => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        throw new Error(t("cameraCaptureFailed"));
      }
      const width = videoRef.current.videoWidth || 640;
      const height = videoRef.current.videoHeight || 480;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) {
        throw new Error(t("cameraCaptureFailed"));
      }
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      const blob = await new Promise((resolve) =>
        canvasRef.current.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) {
        throw new Error(t("cameraCaptureFailed"));
      }
      const file = new File([blob], `biometric_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      setForm((prev) => ({ ...prev, photo: file }));
      setPreviewFromFile(file);
      notify("success", t("confirmation"), t("photoCaptured"));
      closeCameraDialog();
    } catch (error) {
      const message = error?.message || t("cameraCaptureFailed");
      setCameraError(message);
      notify("error", t("information"), message);
    }
  };

  const captureFingerprintFromDevice = async () => {
    setCaptureState({ status: "capturing", message: t("capturingFingerprint") });
    try {
      let template = "";
      const provider = window?.IkiminaFingerprint || window?.FingerprintBridge;
      if (provider?.captureTemplate) {
        const result = await provider.captureTemplate();
        template = typeof result === "string" ? result : result?.template || "";
      } else {
        const localEndpoints = [
          "http://127.0.0.1:8765/capture",
          "http://localhost:8765/capture",
          "http://127.0.0.1:5005/capture",
          "http://localhost:5005/capture",
        ];

        for (let index = 0; index < localEndpoints.length; index += 1) {
          const endpoint = localEndpoints[index];
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ format: "template" }),
            });
            if (!response.ok) continue;
            const data = await response.json();
            template = typeof data === "string" ? data : data?.template || "";
            if (template) break;
          } catch (_error) {
            // try next local endpoint
          }
        }
      }

      if (!template) {
        throw new Error(t("fingerprintDeviceUnavailable"));
      }

      setForm((prev) => ({ ...prev, fingerprint_template: template }));
      setCaptureState({ status: "success", message: t("fingerprintCaptured") });
      notify("success", t("confirmation"), t("fingerprintCaptured"));
    } catch (error) {
      setCaptureState({
        status: "error",
        message: error?.message || t("fingerprintCaptureFailed"),
      });
      notify("error", t("information"), error?.message || t("fingerprintCaptureFailed"));
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.owner_id) {
      notify("error", t("information"), t("selectUser"));
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("owner_type", form.owner_type);
      if (form.owner_type === "CLIENT") {
        payload.append("client", String(form.owner_id));
      } else {
        payload.append("member", String(form.owner_id));
      }
      if (form.photo) payload.append("photo", form.photo);
      if (form.fingerprint_template)
        payload.append("fingerprint_template", form.fingerprint_template);

      if (editTarget?.id) {
        await updateBiometric(editTarget.id, payload);
      } else {
        await createBiometric(payload);
      }

      notify("success", t("confirmation"), t("saveChanges"));
      setOpen(false);
      setEditTarget(null);
      resetForm();
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBiometric(id);
      notify("success", t("confirmation"), t("delete"));
      await loadData();
    } catch (error) {
      notify("error", t("information"), error.message);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "ID", accessor: "id", align: "left" },
      { Header: t("ownerType"), accessor: "owner_type", align: "left" },
      { Header: t("owner"), accessor: "owner", align: "left" },
      { Header: t("photo"), accessor: "photo", align: "left" },
      { Header: t("time"), accessor: "created_at", align: "left" },
      { Header: t("actions"), accessor: "actions", align: "center" },
    ];
    const dataRows = rows.map((item) => ({
      id: <MDTypography variant="caption">#{item.id}</MDTypography>,
      owner_type: (
        <MDTypography variant="caption">{getOwnerTypeLabel(item.owner_type)}</MDTypography>
      ),
      owner: <MDTypography variant="caption">{getOwnerName(item)}</MDTypography>,
      photo: item.photo ? (
        <img
          src={item.photo}
          alt="biometric"
          style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }}
        />
      ) : (
        <MDTypography variant="caption">-</MDTypography>
      ),
      created_at: <MDTypography variant="caption">{formatDateTime(item.created_at)}</MDTypography>,
      actions: (
        <MDBox display="flex" justifyContent="center" gap={0.5}>
          <Tooltip title={t("edit")}>
            <IconButton color="info" size="small" onClick={() => openEdit(item)}>
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("delete")}>
            <IconButton color="error" size="small" onClick={() => handleDelete(item.id)}>
              <Icon fontSize="small">delete</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      ),
    }));
    return { columns, rows: dataRows };
  }, [rows, t, lang]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={4} pb={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center">
                  <MDBox>
                    <MDTypography variant="h6">{t("biometrics")}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {t("biometricsSubtitle")}
                    </MDTypography>
                  </MDBox>
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={() => {
                      setEditTarget(null);
                      resetForm();
                      setCaptureState({ status: "idle", message: "" });
                      setPreviewFromFile(null);
                      setOpen(true);
                    }}
                  >
                    {t("addBiometric")}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <DataTable
                  table={table}
                  isSorted={false}
                  entriesPerPage={{ defaultValue: 10, entries: [10, 20, 50] }}
                  showTotalEntries
                  canSearch
                  noEndBorder
                />
                {loading && <MDTypography variant="caption">{t("loading")}</MDTypography>}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {editTarget ? t("editBiometric") : t("addBiometric")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox component="form" id="biometric-form" onSubmit={handleSave} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={OWNER_TYPES}
                  value={OWNER_TYPES.find((i) => i.id === form.owner_type) || null}
                  onChange={(_e, value) =>
                    setForm((prev) => ({
                      ...prev,
                      owner_type: value?.id || "MEMBER",
                      owner_id: null,
                    }))
                  }
                  getOptionLabel={(option) =>
                    option.id === "CLIENT" ? t("clients") : t("members")
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  sx={FIELD_SX}
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("ownerType")}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              badge
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Autocomplete
                  options={ownerOptions}
                  value={ownerOptions.find((i) => i.id === form.owner_id) || null}
                  onChange={(_e, value) =>
                    setForm((prev) => ({ ...prev, owner_id: value?.id || null }))
                  }
                  getOptionLabel={(option) =>
                    option.full_name ||
                    option.user_full_name ||
                    option.username ||
                    option.user_username ||
                    option.national_id ||
                    "-"
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  sx={FIELD_SX}
                  popupIcon={<Icon fontSize="small">expand_more</Icon>}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("owner")}
                      placeholder={t("search")}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Icon fontSize="small" color="info">
                              person
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="file"
                  label={t("photo")}
                  sx={FIELD_SX}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setForm((prev) => ({ ...prev, photo: file }));
                    setPreviewFromFile(file);
                  }}
                  inputProps={{ accept: ".jpg,.jpeg,.png,.webp" }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small" color="info">
                          image
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                />
                <MDBox mt={1} display="flex" gap={1} flexWrap="wrap">
                  <MDButton
                    variant="outlined"
                    color="info"
                    sx={FORM_ACTION_BUTTON_SX}
                    onClick={openCameraDialog}
                  >
                    {t("capturePhoto")}
                  </MDButton>
                  <MDButton
                    variant="text"
                    color="secondary"
                    sx={FORM_ACTION_BUTTON_SX}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, photo: null }));
                      setPreviewFromFile(null);
                      setPhotoPreviewUrl(editTarget?.photo || "");
                    }}
                  >
                    {t("clear")}
                  </MDButton>
                </MDBox>
                {!!photoPreviewUrl && (
                  <MDBox mt={1}>
                    <img
                      src={photoPreviewUrl}
                      alt="biometric-preview"
                      style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10 }}
                    />
                  </MDBox>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <MDBox
                  sx={{
                    minHeight: 56,
                    border: "1px solid rgba(15, 42, 92, 0.2)",
                    borderRadius: "0.7rem",
                    px: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#fff",
                    boxShadow: "0 6px 14px rgba(15, 42, 92, 0.08)",
                  }}
                >
                  <MDBox display="flex" alignItems="center" gap={1}>
                    <Icon fontSize="small" color="info">
                      fingerprint
                    </Icon>
                    <MDBox>
                      <MDTypography variant="caption" color="text">
                        {t("fingerprintTemplate")}
                      </MDTypography>
                      <MDTypography
                        variant="button"
                        color={
                          captureState.status === "error"
                            ? "error"
                            : captureState.status === "success"
                            ? "success"
                            : "text"
                        }
                        sx={{ display: "block" }}
                      >
                        {captureState.message ||
                          (form.fingerprint_template
                            ? t("fingerprintCaptured")
                            : t("noFingerprintCaptured"))}
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={captureFingerprintFromDevice}
                    disabled={captureState.status === "capturing"}
                    sx={FORM_ACTION_BUTTON_SX}
                  >
                    {captureState.status === "capturing" ? t("capturing") : t("captureFingerprint")}
                  </MDButton>
                </MDBox>
              </Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={FORM_ACTION_BUTTON_SX}
            onClick={() => setOpen(false)}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            type="submit"
            form="biometric-form"
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            disabled={saving}
          >
            {saving ? t("loading") : t("save")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cameraOpen}
        onClose={closeCameraDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: FORM_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={FORM_DIALOG_TITLE_SX}>
          <MDBox sx={FORM_DIALOG_TITLE_BAR_SX} variant="gradient" bgColor="info">
            <MDTypography variant="h5" color="white">
              {t("capturePhoto")}
            </MDTypography>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={FORM_DIALOG_CONTENT_SX}>
          <MDBox
            sx={{
              borderRadius: "0.75rem",
              overflow: "hidden",
              border: "1px solid rgba(15, 42, 92, 0.2)",
              background: "#111827",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }}
            />
          </MDBox>
          {cameraError && (
            <MDTypography variant="caption" color="error" mt={1} display="block">
              {cameraError}
            </MDTypography>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </DialogContent>
        <DialogActions sx={FORM_DIALOG_ACTIONS_SX}>
          <MDButton
            variant="outlined"
            color="secondary"
            sx={FORM_ACTION_BUTTON_SX}
            onClick={closeCameraDialog}
          >
            {t("cancel")}
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            sx={FORM_ACTION_BUTTON_SX}
            onClick={capturePhotoFromCamera}
          >
            {t("capturePhoto")}
          </MDButton>
        </DialogActions>
      </Dialog>

      <MDSnackbar
        color={snackbar.color}
        icon="notifications"
        title={snackbar.title || t("information")}
        dateTime={new Date().toLocaleTimeString(
          lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "rw-RW"
        )}
        content={snackbar.content}
        open={snackbar.open}
        close={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
      <Footer />
    </DashboardLayout>
  );
}

export default BiometricsPage;
