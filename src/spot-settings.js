/* global LabSchema, LabStorage */

const SpotSettingsApp = (() => {
  const SETTINGS_KEY = "thin-film-spot-calibrations-v1";
  const SETTINGS_APP_ID = "thin-film-spot-calibrations";

  const state = {
    calibrations: [],
    editingCalibrationId: null,
    suppressSpotInput: false,
    statusTimer: null,
  };

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDecimal(value, digits = 4) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number.toFixed(digits).replace(/\.?0+$/, "");
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `spot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeChamber(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function normalizeLensPosition(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/mm$/, "");
  }

  function normalizeCalibration(input = {}) {
    const spotArea = Number(input.spotAreaMm2);
    return {
      id: input.id || createId(),
      chamber: String(input.chamber || "").trim(),
      lensPosition: String(input.lensPosition || "").trim(),
      spotAreaMm2: Number.isFinite(spotArea) && spotArea > 0 ? spotArea : "",
      updatedAt: input.updatedAt || new Date().toISOString(),
    };
  }

  function loadCalibrations() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeCalibration)
        .filter((item) => item.chamber && item.lensPosition && Number(item.spotAreaMm2) > 0);
    } catch (error) {
      console.error("Failed to load spot calibrations", error);
      return [];
    }
  }

  function saveCalibrations(calibrations) {
    state.calibrations = calibrations.map(normalizeCalibration);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.calibrations, null, 2));
    return state.calibrations;
  }

  function calculateLaserFluence(energyMj, spotAreaMm2) {
    const energy = Number(energyMj);
    const area = Number(spotAreaMm2);
    if (!Number.isFinite(energy) || energy < 0) return null;
    if (!Number.isFinite(area) || area <= 0) return null;

    // 1 mJ = 0.001 J, 1 mm² = 0.01 cm²
    // F[J/cm²] = E[mJ] × 0.1 / A[mm²]
    return (energy * 0.1) / area;
  }

  function findCalibration(chamber, lensPosition) {
    const chamberKey = normalizeChamber(chamber);
    const lensKey = normalizeLensPosition(lensPosition);
    if (!chamberKey || !lensKey) return null;

    return state.calibrations.find(
      (item) => normalizeChamber(item.chamber) === chamberKey && normalizeLensPosition(item.lensPosition) === lensKey
    ) || null;
  }

  function renderInterface() {
    const headerActions = $(".header-actions");
    if (headerActions && !$("#spotSettingsBtn")) {
      headerActions.insertAdjacentHTML(
        "afterbegin",
        '<button type="button" class="secondary" id="spotSettingsBtn">Spot 설정</button>'
      );
    }

    const growthSection = Array.from(document.querySelectorAll(".section-block")).find(
      (section) => section.querySelector("h3")?.textContent.trim() === "PLD growth 조건"
    );
    const growthGrid = growthSection?.querySelector(".field-grid");

    if (growthGrid && !$("#spotAreaMm2")) {
      growthGrid.insertAdjacentHTML(
        "beforeend",
        `
          <label>
            <span>Spot area</span>
            <div class="with-unit">
              <input type="number" step="any" min="0" inputmode="decimal" name="spotAreaMm2" id="spotAreaMm2" placeholder="예: 9.907">
              <small>mm²</small>
            </div>
            <small id="spotCalibrationHint">Chamber와 렌즈 위치에 맞는 설정값을 자동으로 불러옵니다.</small>
            <button type="button" class="tiny spot-inline-button" id="loadSpotCalibrationBtn">설정값 불러오기</button>
          </label>
          <label>
            <span>Laser fluence</span>
            <div class="with-unit">
              <input type="text" name="laserFluenceJcm2" id="laserFluenceJcm2" readonly placeholder="자동 계산">
              <small>J/cm²</small>
            </div>
            <small>F = E(mJ) × 0.1 ÷ spot area(mm²)</small>
          </label>
        `
      );
    }

    if (!$("#spotSettingsModal")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
          <div class="spot-settings-modal" id="spotSettingsModal" hidden>
            <section class="spot-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="spotSettingsTitle">
              <div class="spot-settings-header">
                <div>
                  <p class="eyebrow">PLD Calibration</p>
                  <h2 id="spotSettingsTitle">Spot size 설정</h2>
                  <p>미리 측정한 chamber·렌즈 위치별 spot 면적을 저장합니다.</p>
                </div>
                <button type="button" class="ghost" id="closeSpotSettingsBtn">닫기</button>
              </div>

              <div id="spotSettingsStatus" class="status-message info" hidden></div>

              <form id="spotCalibrationForm" class="spot-calibration-form">
                <input type="hidden" id="spotCalibrationId">
                <label>
                  <span>Chamber</span>
                  <input type="text" id="spotSettingChamber" list="spotChamberOptions" placeholder="예: L chamber" required>
                  <datalist id="spotChamberOptions">
                    <option value="L chamber"></option>
                    <option value="K chamber"></option>
                  </datalist>
                </label>
                <label>
                  <span>렌즈 위치</span>
                  <input type="text" id="spotSettingLensPosition" placeholder="예: 140 mm" required>
                </label>
                <label>
                  <span>측정된 spot area</span>
                  <div class="with-unit">
                    <input type="number" step="any" min="0" inputmode="decimal" id="spotSettingArea" placeholder="예: 9.907" required>
                    <small>mm²</small>
                  </div>
                </label>
                <div class="form-actions spot-calibration-actions">
                  <button type="submit" class="primary" id="saveSpotCalibrationBtn">설정 저장</button>
                  <button type="button" class="secondary" id="cancelSpotCalibrationEditBtn">입력 초기화</button>
                </div>
              </form>

              <div class="spot-settings-tools">
                <button type="button" class="secondary" id="exportSpotSettingsBtn">설정 JSON 내보내기</button>
                <label class="button-like secondary" for="importSpotSettingsInput">설정 JSON 가져오기</label>
                <input type="file" id="importSpotSettingsInput" accept="application/json,.json" hidden>
              </div>

              <div class="spot-calibration-list" id="spotCalibrationList"></div>
              <p class="muted spot-settings-note">설정값은 이 브라우저의 localStorage에 저장됩니다. 실제로 측정한 면적만 입력하세요.</p>
            </section>
          </div>
        `
      );
    }
  }

  function setSettingsStatus(message, type = "info") {
    const element = $("#spotSettingsStatus");
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.hidden = false;

    if (state.statusTimer) clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      element.hidden = true;
    }, 5000);
  }

  function showAppStatus(message, type = "info") {
    const element = $("#statusMessage");
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.hidden = false;
  }

  function renderCalibrationList() {
    const list = $("#spotCalibrationList");
    if (!list) return;

    const sorted = [...state.calibrations].sort((a, b) => {
      const chamberCompare = a.chamber.localeCompare(b.chamber, "ko");
      if (chamberCompare) return chamberCompare;
      return a.lensPosition.localeCompare(b.lensPosition, "ko", { numeric: true });
    });

    if (!sorted.length) {
      list.innerHTML = `
        <div class="empty-state spot-settings-empty">
          <h3>저장된 spot 설정이 없습니다.</h3>
          <p>Chamber, 렌즈 위치, 측정한 spot area를 입력해 첫 설정을 저장하세요.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = sorted
      .map(
        (item) => `
          <article class="spot-calibration-row">
            <div>
              <strong>${escapeHtml(item.chamber)} · ${escapeHtml(item.lensPosition)}</strong>
              <span>${escapeHtml(formatDecimal(item.spotAreaMm2, 5))} mm²</span>
            </div>
            <div class="record-actions">
              <button type="button" class="tiny" data-spot-action="edit" data-spot-id="${escapeHtml(item.id)}">수정</button>
              <button type="button" class="tiny danger-text" data-spot-action="delete" data-spot-id="${escapeHtml(item.id)}">삭제</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function resetCalibrationForm() {
    state.editingCalibrationId = null;
    $("#spotCalibrationForm")?.reset();
    if ($("#spotCalibrationId")) $("#spotCalibrationId").value = "";
    if ($("#saveSpotCalibrationBtn")) $("#saveSpotCalibrationBtn").textContent = "설정 저장";
  }

  function openSettings() {
    renderCalibrationList();
    const modal = $("#spotSettingsModal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("spot-settings-open");
    $("#spotSettingChamber")?.focus();
  }

  function closeSettings() {
    const modal = $("#spotSettingsModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("spot-settings-open");
    resetCalibrationForm();
  }

  function handleCalibrationSubmit(event) {
    event.preventDefault();

    const chamber = $("#spotSettingChamber")?.value.trim() || "";
    const lensPosition = $("#spotSettingLensPosition")?.value.trim() || "";
    const spotAreaMm2 = Number($("#spotSettingArea")?.value);

    if (!chamber || !lensPosition || !Number.isFinite(spotAreaMm2) || spotAreaMm2 <= 0) {
      setSettingsStatus("Chamber, 렌즈 위치, 0보다 큰 spot area를 모두 입력하세요.", "error");
      return;
    }

    const sameKey = state.calibrations.find(
      (item) =>
        item.id !== state.editingCalibrationId &&
        normalizeChamber(item.chamber) === normalizeChamber(chamber) &&
        normalizeLensPosition(item.lensPosition) === normalizeLensPosition(lensPosition)
    );

    const targetId = state.editingCalibrationId || sameKey?.id || createId();
    const nextCalibration = normalizeCalibration({
      id: targetId,
      chamber,
      lensPosition,
      spotAreaMm2,
      updatedAt: new Date().toISOString(),
    });

    const next = state.calibrations.filter((item) => item.id !== targetId);
    next.push(nextCalibration);
    saveCalibrations(next);
    renderCalibrationList();
    resetCalibrationForm();
    autoLoadCalibration({ force: true });
    decorateRecordCards();
    setSettingsStatus(sameKey ? "같은 chamber·렌즈 위치의 설정을 업데이트했습니다." : "Spot 설정을 저장했습니다.", "success");
  }

  function handleCalibrationListClick(event) {
    const button = event.target.closest("button[data-spot-action]");
    if (!button) return;
    const calibration = state.calibrations.find((item) => item.id === button.dataset.spotId);
    if (!calibration) return;

    if (button.dataset.spotAction === "edit") {
      state.editingCalibrationId = calibration.id;
      $("#spotCalibrationId").value = calibration.id;
      $("#spotSettingChamber").value = calibration.chamber;
      $("#spotSettingLensPosition").value = calibration.lensPosition;
      $("#spotSettingArea").value = calibration.spotAreaMm2;
      $("#saveSpotCalibrationBtn").textContent = "수정 저장";
      $("#spotSettingChamber").focus();
    }

    if (button.dataset.spotAction === "delete") {
      const ok = confirm(`${calibration.chamber} · ${calibration.lensPosition} spot 설정을 삭제할까요?`);
      if (!ok) return;
      saveCalibrations(state.calibrations.filter((item) => item.id !== calibration.id));
      renderCalibrationList();
      autoLoadCalibration({ force: true });
      setSettingsStatus("Spot 설정을 삭제했습니다.", "warning");
    }
  }

  function updateFluence() {
    const energyInput = $("#laserEnergy");
    const areaInput = $("#spotAreaMm2");
    const fluenceInput = $("#laserFluenceJcm2");
    if (!energyInput || !areaInput || !fluenceInput) return;

    const fluence = calculateLaserFluence(energyInput.value, areaInput.value);
    fluenceInput.value = fluence === null ? "" : formatDecimal(fluence, 4);
  }

  function updateCalibrationHint(message) {
    const hint = $("#spotCalibrationHint");
    if (hint) hint.textContent = message;
  }

  function autoLoadCalibration(options = {}) {
    const { force = false, announce = false } = options;
    const chamber = $("#growthChamber")?.value || "";
    const lensPosition = $("#lensPosition")?.value || "";
    const spotInput = $("#spotAreaMm2");
    if (!spotInput) return null;

    const match = findCalibration(chamber, lensPosition);
    if (match) {
      state.suppressSpotInput = true;
      spotInput.value = formatDecimal(match.spotAreaMm2, 5);
      spotInput.dataset.source = "calibration";
      spotInput.dataset.calibrationId = match.id;
      spotInput.dataset.calibrationLabel = `${match.chamber} / ${match.lensPosition}`;
      state.suppressSpotInput = false;
      updateCalibrationHint(`설정 자동 적용: ${match.chamber} · ${match.lensPosition}`);
      updateFluence();
      if (announce) showAppStatus(`Spot 설정 적용: ${formatDecimal(match.spotAreaMm2, 5)} mm²`, "success");
      return match;
    }

    if (force || spotInput.dataset.source === "calibration") {
      state.suppressSpotInput = true;
      spotInput.value = "";
      delete spotInput.dataset.source;
      delete spotInput.dataset.calibrationId;
      delete spotInput.dataset.calibrationLabel;
      state.suppressSpotInput = false;
      updateFluence();
    }

    if (chamber && lensPosition) {
      updateCalibrationHint("일치하는 설정이 없습니다. Spot 설정에서 측정값을 추가하거나 면적을 직접 입력하세요.");
      if (announce) showAppStatus("현재 chamber·렌즈 위치와 일치하는 spot 설정이 없습니다.", "warning");
    } else {
      updateCalibrationHint("Chamber와 렌즈 위치를 입력하면 저장된 spot 설정을 자동으로 찾습니다.");
    }
    return null;
  }

  function handleManualSpotInput() {
    if (state.suppressSpotInput) return;
    const spotInput = $("#spotAreaMm2");
    if (!spotInput) return;

    if (spotInput.value) {
      spotInput.dataset.source = "manual";
      delete spotInput.dataset.calibrationId;
      delete spotInput.dataset.calibrationLabel;
      updateCalibrationHint("수동으로 입력한 spot area입니다.");
    } else {
      delete spotInput.dataset.source;
      updateCalibrationHint("Chamber와 렌즈 위치를 입력하면 저장된 spot 설정을 자동으로 찾습니다.");
    }
    updateFluence();
  }

  function resetSpotFields() {
    const spotInput = $("#spotAreaMm2");
    const fluenceInput = $("#laserFluenceJcm2");
    if (spotInput) {
      spotInput.value = "";
      delete spotInput.dataset.source;
      delete spotInput.dataset.calibrationId;
      delete spotInput.dataset.calibrationLabel;
    }
    if (fluenceInput) fluenceInput.value = "";
    updateCalibrationHint("Chamber와 렌즈 위치를 입력하면 저장된 spot 설정을 자동으로 찾습니다.");
  }

  function populateSpotFields(record) {
    const spotInput = $("#spotAreaMm2");
    const fluenceInput = $("#laserFluenceJcm2");
    if (!spotInput || !fluenceInput) return;

    state.suppressSpotInput = true;
    spotInput.value = record.spotAreaMm2 || "";
    fluenceInput.value = record.laserFluenceJcm2 || "";
    if (record.spotCalibrationId) {
      spotInput.dataset.source = "calibration";
      spotInput.dataset.calibrationId = record.spotCalibrationId;
      spotInput.dataset.calibrationLabel = record.spotCalibrationLabel || "";
      updateCalibrationHint(`저장 당시 설정: ${record.spotCalibrationLabel || "calibration"}`);
    } else if (record.spotAreaMm2) {
      spotInput.dataset.source = "manual";
      updateCalibrationHint("저장된 수동 spot area입니다.");
    } else {
      delete spotInput.dataset.source;
      delete spotInput.dataset.calibrationId;
      delete spotInput.dataset.calibrationLabel;
      updateCalibrationHint("저장된 spot area가 없습니다.");
    }
    state.suppressSpotInput = false;
    updateFluence();
  }

  function validateSpotBeforeSubmit(event) {
    const areaText = $("#spotAreaMm2")?.value.trim() || "";
    if (!areaText) return;

    const area = Number(areaText);
    if (!Number.isFinite(area) || area <= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAppStatus("Spot area는 0보다 큰 숫자로 입력하세요.", "error");
      return;
    }
    updateFluence();
  }

  function patchStorageMethods() {
    const originalUpsert = LabStorage.upsertRecord.bind(LabStorage);
    LabStorage.upsertRecord = (record, options = {}) => {
      const currentFormId = $("#recordId")?.value || "";
      const isFormSave = Boolean(record?.id && currentFormId && record.id === currentFormId);
      let nextRecord = record;

      if (isFormSave) {
        const spotInput = $("#spotAreaMm2");
        const fluenceInput = $("#laserFluenceJcm2");
        nextRecord = {
          ...record,
          spotAreaMm2: spotInput?.value || "",
          laserFluenceJcm2: fluenceInput?.value || "",
          spotCalibrationId: spotInput?.dataset.calibrationId || "",
          spotCalibrationLabel: spotInput?.dataset.calibrationLabel || "",
          spotAreaSource: spotInput?.dataset.source || "",
        };
      }

      const saved = originalUpsert(nextRecord, options);
      if (isFormSave) setTimeout(resetSpotFields, 0);
      return saved;
    };

    LabStorage.exportCsv = (records) => {
      const headers = [
        "date",
        "sampleId",
        "filmName",
        "growthChamber",
        "substrate",
        "temperatureC",
        "oxygenPressure",
        "lensPosition",
        "laserEnergy",
        "spotAreaMm2",
        "laserFluenceJcm2",
        "spotAreaSource",
        "spotCalibrationId",
        "spotCalibrationLabel",
        "laserHz",
        "laserShots",
        "xrdBragg2Theta",
        "xrdReflectionL",
        "xrdDSpacingAngstrom",
        "xrdLatticeParameterAngstrom",
        "xrdFringe1Status",
        "xrdFringe2Status",
        "xrdFringe1_2Theta",
        "xrdFringe2_2Theta",
        "xrdThicknessNm",
        "xrdSummary",
        "xrdFiles",
        "afmSummary",
        "afmFiles",
        "tags",
        "notes",
        "createdAt",
        "updatedAt",
      ];

      const escapeCsv = (value) => {
        const text = value === undefined || value === null ? "" : String(value);
        return `"${text.replaceAll('"', '""')}"`;
      };

      const lines = [headers.join(",")];
      records.forEach((record) => {
        const normalized = LabSchema.normalizeExperiment(record, { touchUpdatedAt: false });
        lines.push(
          headers
            .map((header) => {
              if (header === "xrdFiles" || header === "afmFiles") {
                return escapeCsv((normalized[header] || []).map((file) => file.name).join("; "));
              }
              return escapeCsv(normalized[header]);
            })
            .join(",")
        );
      });

      const exportedAt = LabSchema.getIsoTimestamp();
      const filename = `thin-film-records-${LabSchema.getLocalDateTimeFileStamp()}.csv`;
      downloadText(filename, lines.join("\n"), "text/csv;charset=utf-8");
      const backupMeta = LabStorage.saveBackupMeta({
        lastExportedAt: exportedAt,
        lastExportType: "CSV",
        lastCsvExportedAt: exportedAt,
        lastCsvFilename: filename,
      });
      return { filename, exportedAt, backupMeta };
    };
  }

  function decorateRecordCards() {
    const records = LabStorage.loadRecords();
    const recordMap = new Map(records.map((record) => [record.id, record]));

    document.querySelectorAll("#recordList .record-card").forEach((card) => {
      const id = card.querySelector('button[data-action="edit"]')?.dataset.id;
      const record = recordMap.get(id);
      const grid = card.querySelector(".condition-grid");
      if (!record || !grid) return;

      const decorationKey = [record.updatedAt, record.spotAreaMm2, record.laserFluenceJcm2].join("|");
      if (grid.dataset.spotDecorationKey === decorationKey) return;

      grid.querySelectorAll(".spot-condition-item").forEach((item) => item.remove());
      grid.insertAdjacentHTML(
        "beforeend",
        `
          <div class="condition-item spot-condition-item">
            <span>Spot area</span>
            <strong>${record.spotAreaMm2 ? `${escapeHtml(record.spotAreaMm2)} mm²` : "-"}</strong>
          </div>
          <div class="condition-item spot-condition-item">
            <span>Fluence</span>
            <strong>${record.laserFluenceJcm2 ? `${escapeHtml(record.laserFluenceJcm2)} J/cm²` : "-"}</strong>
          </div>
        `
      );
      grid.dataset.spotDecorationKey = decorationKey;
    });
  }

  function downloadText(filename, text, mimeType = "application/json") {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportSettings() {
    const exportedAt = new Date().toISOString();
    const payload = {
      app: SETTINGS_APP_ID,
      version: 1,
      exportedAt,
      calibrations: state.calibrations,
    };
    const filename = `spot-calibrations-${LabSchema.getLocalDateTimeFileStamp()}.json`;
    downloadText(filename, JSON.stringify(payload, null, 2));
    setSettingsStatus(`설정 내보내기 완료: ${filename}`, "success");
  }

  async function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed) ? parsed : parsed.calibrations;
      if (!Array.isArray(incoming)) throw new Error("calibrations 배열이 없습니다.");

      const valid = incoming
        .map(normalizeCalibration)
        .filter((item) => item.chamber && item.lensPosition && Number(item.spotAreaMm2) > 0);
      if (!valid.length && incoming.length) throw new Error("유효한 spot 설정이 없습니다.");

      const byKey = new Map(
        state.calibrations.map((item) => [`${normalizeChamber(item.chamber)}|${normalizeLensPosition(item.lensPosition)}`, item])
      );
      valid.forEach((item) => {
        byKey.set(`${normalizeChamber(item.chamber)}|${normalizeLensPosition(item.lensPosition)}`, item);
      });
      saveCalibrations(Array.from(byKey.values()));
      renderCalibrationList();
      autoLoadCalibration({ force: true });
      setSettingsStatus(`설정 가져오기 완료: ${valid.length}개 반영`, "success");
    } catch (error) {
      setSettingsStatus(`설정 가져오기 실패: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  }

  function bindEvents() {
    $("#spotSettingsBtn")?.addEventListener("click", openSettings);
    $("#closeSpotSettingsBtn")?.addEventListener("click", closeSettings);
    $("#spotSettingsModal")?.addEventListener("click", (event) => {
      if (event.target.id === "spotSettingsModal") closeSettings();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !$("#spotSettingsModal")?.hidden) closeSettings();
    });

    $("#spotCalibrationForm")?.addEventListener("submit", handleCalibrationSubmit);
    $("#cancelSpotCalibrationEditBtn")?.addEventListener("click", resetCalibrationForm);
    $("#spotCalibrationList")?.addEventListener("click", handleCalibrationListClick);
    $("#exportSpotSettingsBtn")?.addEventListener("click", exportSettings);
    $("#importSpotSettingsInput")?.addEventListener("change", importSettings);

    ["growthChamber", "lensPosition"].forEach((id) => {
      $(`#${id}`)?.addEventListener("input", () => autoLoadCalibration());
      $(`#${id}`)?.addEventListener("change", () => autoLoadCalibration());
    });
    $("#laserEnergy")?.addEventListener("input", updateFluence);
    $("#laserEnergy")?.addEventListener("change", updateFluence);
    $("#spotAreaMm2")?.addEventListener("input", handleManualSpotInput);
    $("#loadSpotCalibrationBtn")?.addEventListener("click", () => autoLoadCalibration({ force: true, announce: true }));

    $("#experimentForm")?.addEventListener("submit", validateSpotBeforeSubmit, true);
    ["newRecordBtn", "resetBtn"].forEach((id) => {
      $(`#${id}`)?.addEventListener("click", () => setTimeout(resetSpotFields, 0));
    });

    $("#recordList")?.addEventListener("click", (event) => {
      const button = event.target.closest('button[data-action="edit"]');
      if (!button) return;
      const record = LabStorage.loadRecords().find((item) => item.id === button.dataset.id);
      if (record) populateSpotFields(record);
    });
  }

  function observeRecordList() {
    const list = $("#recordList");
    if (!list) return;
    const observer = new MutationObserver(() => decorateRecordCards());
    observer.observe(list, { childList: true, subtree: true });
  }

  function init() {
    state.calibrations = loadCalibrations();
    renderInterface();
    patchStorageMethods();
    bindEvents();
    observeRecordList();
    renderCalibrationList();
    decorateRecordCards();
    autoLoadCalibration();
  }

  return { init, calculateLaserFluence };
})();

document.addEventListener("DOMContentLoaded", SpotSettingsApp.init);
