/*
 * Experiment data schema for the thin-film research notebook.
 * Kept separate from app.js so field names can be reused later for GitHub/API sync.
 */

const LabSchema = (() => {
  const STORAGE_VERSION = 1;

  const FILM_PRESETS = ["SRO", "LMO", "BMO", "STO", "Custom"];

  const GROWTH_FIELDS = [
    {
      key: "sampleId",
      label: "Sample ID",
      type: "text",
      placeholder: "예: SRO-STO-20260710-01",
      required: true,
    },
    {
      key: "filmName",
      label: "박막 이름",
      type: "text",
      placeholder: "예: SRO, LMO",
      required: true,
    },
    {
      key: "substrate",
      label: "증착 기판",
      type: "text",
      placeholder: "예: STO(001), DSO(110)O",
    },
    {
      key: "temperatureC",
      label: "온도",
      type: "number",
      unit: "°C",
      placeholder: "예: 700",
    },
    {
      key: "oxygenPressure",
      label: "산소 압력",
      type: "text",
      unit: "mTorr / Torr",
      placeholder: "예: 100 mTorr, 1e-4 Torr",
    },
    {
      key: "lensPosition",
      label: "렌즈 위치",
      type: "text",
      unit: "mm / stage unit",
      placeholder: "예: 42.5 mm",
    },
    {
      key: "laserEnergy",
      label: "레이저 에너지",
      type: "number",
      unit: "mJ",
      placeholder: "예: 120",
    },
    {
      key: "laserHz",
      label: "레이저 반복률",
      type: "number",
      unit: "Hz",
      placeholder: "예: 2",
    },
    {
      key: "laserShots",
      label: "레이저 샷 수",
      type: "number",
      unit: "shots",
      placeholder: "예: 3000",
    },
    {
      key: "thicknessNm",
      label: "두께",
      type: "number",
      unit: "nm",
      placeholder: "예: 20",
    },
  ];

  const ANALYSIS_FIELDS = [
    {
      key: "xrdSummary",
      label: "XRD 요약",
      placeholder: "예: (00l) peak 확인, Laue oscillation 관측, FWHM 등",
    },
    {
      key: "afmSummary",
      label: "AFM 요약",
      placeholder: "예: RMS roughness 0.25 nm, step-terrace 관측",
    },
  ];

  function makeSampleId(filmName = "TF") {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const prefix = String(filmName || "TF").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "TF";
    return `${prefix}-${y}${m}${d}-${hh}${mm}`;
  }

  function createEmptyExperiment() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      version: STORAGE_VERSION,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      date: today,
      sampleId: makeSampleId(),
      filmName: "",
      substrate: "",
      temperatureC: "",
      oxygenPressure: "",
      lensPosition: "",
      laserEnergy: "",
      laserHz: "",
      laserShots: "",
      thicknessNm: "",
      xrdSummary: "",
      xrdFiles: [],
      afmSummary: "",
      afmFiles: [],
      tags: "",
      notes: "",
    };
  }

  function normalizeExperiment(input) {
    const base = createEmptyExperiment();
    const merged = { ...base, ...input };
    merged.version = STORAGE_VERSION;
    merged.updatedAt = new Date().toISOString();
    merged.xrdFiles = Array.isArray(merged.xrdFiles) ? merged.xrdFiles : [];
    merged.afmFiles = Array.isArray(merged.afmFiles) ? merged.afmFiles : [];
    return merged;
  }

  function fileInputToMetadataList(fileList) {
    return Array.from(fileList || []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : "",
    }));
  }

  return {
    STORAGE_VERSION,
    FILM_PRESETS,
    GROWTH_FIELDS,
    ANALYSIS_FIELDS,
    makeSampleId,
    createEmptyExperiment,
    normalizeExperiment,
    fileInputToMetadataList,
  };
})();
