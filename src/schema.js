/*
 * Experiment data schema for the thin-film research notebook.
 * Kept separate from app.js so field names can be reused later for GitHub/API sync.
 */

const LabSchema = (() => {
  const STORAGE_VERSION = 1;
  const SAMPLE_ID_PAD_WIDTH = 3;
  const XRD_WAVELENGTH_ANGSTROM = 1.5406;

  const NUMERIC_FIELDS = ["temperatureC", "laserEnergy", "laserHz", "laserShots"];
  const NON_NEGATIVE_FIELDS = ["temperatureC", "laserEnergy", "laserHz", "laserShots"];
  const XRD_ANGLE_FIELDS = ["xrdBragg2Theta", "xrdFringe1_2Theta", "xrdFringe2_2Theta"];

  const FIELD_PRESETS = {
    filmName: [
      { label: "SRO", value: "SRO" },
      { label: "LMO", value: "LMO" },
    ],
    growthChamber: [
      { label: "L chamber", value: "L chamber" },
      { label: "K chamber", value: "K chamber" },
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
      placeholder: "예: 001",
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
      key: "growthChamber",
      label: "Growth chamber",
      type: "text",
      placeholder: "예: L chamber, K chamber",
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
  ];

  const ANALYSIS_FIELDS = [
    {
      key: "xrdSummary",
      label: "XRD 분석 결과",
      placeholder: "Laue oscillation 계산 결과와 peak, FWHM 등의 분석 내용을 기록",
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

  function degreesToRadians(value) {
    return value * Math.PI / 180;
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
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function parseSequentialSampleId(value) {
    const text = String(value ?? "").trim();
    if (!/^\d+$/.test(text)) return null;

    const number = Number(text);
    if (!Number.isSafeInteger(number) || number < 0) return null;
    return number;
  }

  function formatSequentialSampleId(number) {
    const safeNumber = Number.isSafeInteger(number) && number > 0 ? number : 1;
    return String(safeNumber).padStart(SAMPLE_ID_PAD_WIDTH, "0");
  }

  function getNextSampleId(records = []) {
    const maxId = records.reduce((max, record) => {
      const parsed = parseSequentialSampleId(record?.sampleId);
      return parsed === null ? max : Math.max(max, parsed);
    }, 0);

    return formatSequentialSampleId(maxId + 1);
  }

  function makeSampleId(records = []) {
    return getNextSampleId(records);
  }

  function makeDuplicateSampleId(records = []) {
    return getNextSampleId(records);
  }

  function calculateLaueThickness(bragg2ThetaDeg, fringe1_2ThetaDeg, fringe2_2ThetaDeg) {
    const bragg2Theta = Number(bragg2ThetaDeg);
    const fringe1 = Number(fringe1_2ThetaDeg);
    const fringe2 = Number(fringe2_2ThetaDeg);

    if (![bragg2Theta, fringe1, fringe2].every(Number.isFinite)) {
      throw new Error("2θ Bragg와 두 fringe의 2θ 값을 숫자로 입력하세요.");
    }

    if (![bragg2Theta, fringe1, fringe2].every((value) => value > 0 && value < 180)) {
      throw new Error("2θ 값은 0°보다 크고 180°보다 작아야 합니다.");
    }

    const delta2ThetaDeg = Math.abs(fringe2 - fringe1);
    if (delta2ThetaDeg === 0) {
      throw new Error("두 fringe의 2θ 값은 서로 달라야 합니다.");
    }

    const thetaBraggDeg = bragg2Theta / 2;
    const delta2ThetaRad = degreesToRadians(delta2ThetaDeg);
    const thetaBraggRad = degreesToRadians(thetaBraggDeg);
    const cosine = Math.cos(thetaBraggRad);

    if (!Number.isFinite(cosine) || cosine <= 0) {
      throw new Error("Bragg 각도에서 cos θ 값을 계산할 수 없습니다.");
    }

    const thicknessAngstrom = XRD_WAVELENGTH_ANGSTROM / (delta2ThetaRad * cosine);
    const thicknessNm = thicknessAngstrom / 10;

    return {
      wavelengthAngstrom: XRD_WAVELENGTH_ANGSTROM,
      bragg2ThetaDeg: bragg2Theta,
      thetaBraggDeg,
      fringe1_2ThetaDeg: fringe1,
      fringe2_2ThetaDeg: fringe2,
      delta2ThetaDeg,
      delta2ThetaRad,
      thicknessAngstrom,
      thicknessNm,
    };
  }

  function createEmptyExperiment(overrides = {}) {
    const now = getIsoTimestamp();
    return {
      version: STORAGE_VERSION,
      id: createId(),
      createdAt: now,
      updatedAt: now,
      date: getLocalDateString(),
      sampleId: "001",
      filmName: "",
      growthChamber: "",
      substrate: "",
      temperatureC: "",
      oxygenPressure: "",
      lensPosition: "",
      laserEnergy: "",
      laserHz: "",
      laserShots: "",
      xrdBragg2Theta: "",
      xrdFringe1_2Theta: "",
      xrdFringe2_2Theta: "",
      xrdThicknessNm: "",
      xrdSummary: "",
      xrdFiles: [],
      afmSummary: "",
      afmFiles: [],
      tags: "",
      notes: "",
      ...overrides,
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
    if (!isFilled(record.sampleId)) {
      errors.push("Sample ID를 입력하세요.");
    } else if (parseSequentialSampleId(record.sampleId) === null) {
      errors.push("Sample ID는 001, 002, 003처럼 숫자만 입력하세요.");
    }
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

    const xrdValues = XRD_ANGLE_FIELDS.map((key) => record[key]);
    const hasAnyXrdAngle = xrdValues.some(isFilled);
    const hasAllXrdAngles = xrdValues.every(isFilled);

    if (hasAnyXrdAngle && !hasAllXrdAngles) {
      errors.push("Laue oscillation 계산을 위해 2θ Bragg, 1st fringe, 2nd fringe 값을 모두 입력하세요.");
    } else if (hasAllXrdAngles) {
      try {
        calculateLaueThickness(...xrdValues);
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (!isFilled(record.growthChamber)) warnings.push("Growth chamber가 비어 있습니다.");
    if (!isFilled(record.substrate)) warnings.push("증착 기판이 비어 있습니다.");
    if (!isFilled(record.oxygenPressure)) warnings.push("산소 압력이 비어 있습니다.");

    return { errors, warnings };
  }

  return {
    STORAGE_VERSION,
    SAMPLE_ID_PAD_WIDTH,
    XRD_WAVELENGTH_ANGSTROM,
    FIELD_PRESETS,
    GROWTH_FIELDS,
    ANALYSIS_FIELDS,
    NUMERIC_FIELDS,
    getLocalDateString,
    getLocalDateTimeFileStamp,
    getIsoTimestamp,
    createId,
    parseSequentialSampleId,
    formatSequentialSampleId,
    getNextSampleId,
    makeSampleId,
    makeDuplicateSampleId,
    calculateLaueThickness,
    createEmptyExperiment,
    normalizeExperiment,
    fileInputToMetadataList,
    validateExperiment,
  };
})();
