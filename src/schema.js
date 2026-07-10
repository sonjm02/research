/*
 * Experiment data schema for the thin-film research notebook.
 * Kept separate from app.js so field names can be reused later for GitHub/API sync.
 */

const LabSchema = (() => {
  const STORAGE_VERSION = 1;

  const NUMERIC_FIELDS = ["temperatureC", "laserEnergy", "laserHz", "laserShots", "thicknessNm"];
  const NON_NEGATIVE_FIELDS = ["temperatureC", "laserEnergy", "laserHz", "laserShots", "thicknessNm"];

  const FIELD_PRESETS = {
    filmName: [
      { label: "SRO", value: "SRO" },
      { label: "LMO", value: "LMO" },
    ],
    substrate: [
      { label: "STO(001)", value: "STO(001)" },
      { label: "DSO(110)o", value: "DSO(110)o" },
    ],
    temperatureC: [
      { label: "650°C", value: "650" },
      { label: "700°C", value: "700" },
      { label: "750°C", value: "750" },
      { label: "800°C", value: "800" },
    ],
    oxygenPressure: [
      { label: "100 mTorr", value: "100 mTorr" },
    ],
    lensPosition: [
      { label: "140 mm", value: "140 mm" },
    ],
    laserEnergy: [
      { label: "80 mJ", value: "80" },
      { label: "90 mJ", value: "90" },
      { label: "100 mJ", value: "100" },
      { label: "110 mJ", value: "110" },
      { label: "120 mJ", value: "120" },
    ],
    laserHz: [
      { label: "5 Hz", value: "5" },
      { label: "10 Hz", value: "10" },
    ],
    laserShots: [
      { label: "1500 shots", value: "1500" },
      { label: "3000 shots", value: "3000" },
      { label: "6000 shots", value: "6000" },
    ],
  };

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
      placeholder: "예: STO(001), DSO(110)o",
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
      placeholder: "예: 140 mm",
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
      placeholder: "예: 5",
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

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function getLocalDateString(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function getLocalDateTimeFileStamp(date = new Date()) {
    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;
  }

  function getIsoTimestamp(date = new Date()) {
    return date.toISOString();
  }

  function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function makeSampleId(filmName = "TF") {
    const now = new Date();
    const y = now.getFullYear();
    const m = pad2(now.getMonth() + 1);
    const d = pad2(now.getDate());
    const hh = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const prefix = String(filmName || "TF").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "TF";
    return `${prefix}-${y}${m}${d}-${hh}${mm}`;
  }

  function makeDuplicateSampleId(sampleId = "sample") {
    const base = String(sampleId || "sample").trim() || "sample";
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base}-copy-${getLocalDateTimeFileStamp()}-${suffix}`;
  }

  function createEmptyExperiment() {
    const now = getIsoTimestamp();
    return {
      version: STORAGE_VERSION,
      id: createId(),
      createdAt: now,
      updatedAt: now,
      date: getLocalDateString(),
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

  function normalizeExperiment(input = {}, options = {}) {
    const { touchUpdatedAt = false } = options;
    const now = getIsoTimestamp();
    const base = createEmptyExperiment();
    const merged = { ...base, ...input };

    merged.version = STORAGE_VERSION;
    merged.id = merged.id || createId();
    merged.date = merged.date || getLocalDateString();
    merged.createdAt = merged.createdAt || merged.updatedAt || now;
    merged.updatedAt = touchUpdatedAt ? now : (merged.updatedAt || merged.createdAt || now);
    merged.xrdFiles = Array.isArray(merged.xrdFiles) ? merged.xrdFiles : [];
    merged.afmFiles = Array.isArray(merged.afmFiles) ? merged.afmFiles : [];

    return merged;
  }

  function fileInputToMetadataList(fileList) {
    return Array.from(fileList || []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      lastModified: file.lastModified ? getIsoTimestamp(new Date(file.lastModified)) : "",
    }));
  }

  function isFilled(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function validateExperiment(record) {
    const errors = [];
    const warnings = [];

    if (!isFilled(record.date)) errors.push("실험 날짜를 입력하세요.");
    if (!isFilled(record.sampleId)) errors.push("Sample ID를 입력하세요.");
    if (!isFilled(record.filmName)) errors.push("박막 이름을 입력하세요.");

    NUMERIC_FIELDS.forEach((key) => {
      const value = record[key];
      if (!isFilled(value)) return;
      const numericValue = Number(value);
      const field = GROWTH_FIELDS.find((item) => item.key === key);
      const label = field?.label || key;

      if (!Number.isFinite(numericValue)) {
        errors.push(`${label}은 숫자로 입력하세요.`);
        return;
      }

      if (NON_NEGATIVE_FIELDS.includes(key) && numericValue < 0) {
        errors.push(`${label}은 음수가 될 수 없습니다.`);
      }
    });

    if (!isFilled(record.substrate)) warnings.push("증착 기판이 비어 있습니다.");
    if (!isFilled(record.oxygenPressure)) warnings.push("산소 압력이 비어 있습니다.");

    return { errors, warnings };
  }

  return {
    STORAGE_VERSION,
    FIELD_PRESETS,
    GROWTH_FIELDS,
    ANALYSIS_FIELDS,
    NUMERIC_FIELDS,
    getLocalDateString,
    getLocalDateTimeFileStamp,
    getIsoTimestamp,
    createId,
    makeSampleId,
    makeDuplicateSampleId,
    createEmptyExperiment,
    normalizeExperiment,
    fileInputToMetadataList,
    validateExperiment,
  };
})();
