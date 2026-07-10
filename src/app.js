/* global LabSchema, LabStorage */

const ThinFilmApp = (() => {
  const state = {
    records: [],
    backupMeta: {},
    editingId: null,
    searchText: "",
    filmFilter: "all",
    sortMode: "sample-desc",
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

  function formatDateTime(isoString) {
    if (!isoString) return "기록 없음";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getLatestUpdatedAt(records) {
    const timestamps = records
      .map((record) => Date.parse(record.updatedAt))
      .filter((time) => Number.isFinite(time));
    if (!timestamps.length) return "";
    return new Date(Math.max(...timestamps)).toISOString();
  }

  function getNextSampleId() {
    return LabSchema.getNextSampleId(state.records);
  }

  function renderLayout() {
    $("#app").innerHTML = `
      <header class="app-header">
        <div>
          <p class="eyebrow">Oxide Thin Film Research</p>
          <h1>박막 실험 기록 앱</h1>
          <p class="subtitle">PLD growth 조건과 XRD/AFM 분석 메모를 한 곳에 정리합니다.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="secondary" id="exportJsonBtn">JSON 내보내기</button>
          <button type="button" class="secondary" id="exportCsvBtn">CSV 내보내기</button>
          <label class="button-like secondary" for="importJsonInput">JSON 가져오기</label>
          <input type="file" id="importJsonInput" accept="application/json,.json" hidden>
        </div>
      </header>

      <main class="page-grid">
        <section class="panel form-panel" aria-labelledby="formTitle">
          <div class="panel-title-row">
            <div>
              <h2 id="formTitle">새 실험 기록</h2>
              <p>Sample ID, 박막 이름, PLD 조건, 분석 결과를 입력하세요.</p>
            </div>
            <button type="button" class="ghost" id="newRecordBtn">새 기록</button>
          </div>

          <div id="statusMessage" class="status-message" aria-live="polite" hidden></div>

          <form id="experimentForm">
            <input type="hidden" name="id" id="recordId">
            <input type="hidden" name="createdAt" id="createdAt">

            <div class="section-block">
              <h3>기본 정보</h3>
              <div class="field-grid two-cols">
                <label>
                  <span>실험 날짜 <b>*</b></span>
                  <input type="date" name="date" id="date" required>
                </label>
                <label>
                  <span>Sample ID <b>*</b></span>
                  <div class="inline-control">
                    <input type="text" name="sampleId" id="sampleId" placeholder="예: 001" required>
                    <button type="button" class="tiny" id="generateIdBtn">자동</button>
                  </div>
                  <small>숫자형 Sample ID 중 가장 큰 값보다 1 큰 번호를 자동으로 사용합니다.</small>
                </label>
              </div>
            </div>

            <div class="section-block">
              <h3>PLD growth 조건</h3>
              <p class="section-help">자주 쓰는 조건은 입력칸 아래 프리셋 버튼을 누르면 바로 채워집니다.</p>
              <div class="field-grid">
                ${LabSchema.GROWTH_FIELDS.filter((field) => field.key !== "sampleId").map(renderField).join("")}
              </div>
            </div>

            <div class="section-block">
              <h3>분석 자료 데이터</h3>
              <div class="analysis-grid">
                <label>
                  <span>XRD 요약</span>
                  <textarea name="xrdSummary" id="xrdSummary" rows="4" placeholder="예: (00l) peak 확인, Laue oscillation 관측, FWHM 등"></textarea>
                </label>
                <label>
                  <span>XRD 파일 메모</span>
                  <input type="file" id="xrdFiles" multiple accept=".txt,.csv,.dat,.xy,.ras,.xrd,.xlsx,.xls,.pdf,image/*">
                  <small>원본 파일 내용이 아니라 파일명/크기 메타데이터만 기록됩니다.</small>
                </label>
                <label>
                  <span>AFM 요약</span>
                  <textarea name="afmSummary" id="afmSummary" rows="4" placeholder="예: RMS roughness 0.25 nm, step-terrace 관측"></textarea>
                </label>
                <label>
                  <span>AFM 파일 메모</span>
                  <input type="file" id="afmFiles" multiple accept=".txt,.csv,.spm,.ibw,.nid,.tiff,.tif,.png,.jpg,.jpeg,.pdf,image/*">
                  <small>원본 파일 내용이 아니라 파일명/크기 메타데이터만 기록됩니다.</small>
                </label>
              </div>
            </div>

            <div class="section-block">
              <h3>추가 메모</h3>
              <div class="field-grid two-cols">
                <label>
                  <span>태그</span>
                  <input type="text" name="tags" id="tags" placeholder="예: recipe-test, LMO001, Raman-target">
                </label>
                <label>
                  <span>비고</span>
                  <textarea name="notes" id="notes" rows="3" placeholder="타겟 상태, pre-ablation, cooldown 조건, 특이사항 등"></textarea>
                </label>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="primary" id="saveBtn">기록 저장</button>
              <button type="button" class="secondary" id="resetBtn">입력 초기화</button>
              <button type="button" class="danger" id="clearAllBtn">전체 삭제</button>
            </div>
          </form>
        </section>

        <section class="panel records-panel" aria-labelledby="recordsTitle">
          <div class="panel-title-row">
            <div>
              <h2 id="recordsTitle">실험 기록</h2>
              <p id="statsText">저장된 기록 0개</p>
            </div>
          </div>

          <div id="trustSummary" class="trust-summary"></div>

          <div class="toolbar">
            <input type="search" id="searchInput" placeholder="예: 001, SRO, L chamber, STO, roughness">
            <select id="filmFilter" aria-label="박막 필터">
              <option value="all">전체 박막</option>
            </select>
            <select id="sortMode" aria-label="정렬 방식">
              <option value="sample-desc">Sample ID 큰 번호 먼저</option>
              <option value="sample-asc">Sample ID 작은 번호 먼저</option>
            </select>
          </div>

          <div id="recordList" class="record-list"></div>
        </section>
      </main>
    `;
  }

  function renderField(field) {
    const unit = field.unit ? `<small>${escapeHtml(field.unit)}</small>` : "";
    const required = field.required ? "required" : "";
    const requiredMark = field.required ? " <b>*</b>" : "";
    const presets = LabSchema.FIELD_PRESETS?.[field.key] || [];

    return `
      <label>
        <span>${escapeHtml(field.label)}${requiredMark}</span>
        <div class="with-unit">
          <input
            type="${escapeHtml(field.type || "text")}"
            name="${escapeHtml(field.key)}"
            id="${escapeHtml(field.key)}"
            placeholder="${escapeHtml(field.placeholder || "")}"
            ${required}
          >
          ${unit}
        </div>
        ${renderPresetButtons(field.key, presets)}
      </label>
    `;
  }

  function renderPresetButtons(targetKey, presets) {
    if (!presets.length) return "";
    return `
      <div class="preset-row condition-presets" aria-label="${escapeHtml(targetKey)} 프리셋">
        ${presets
          .map(
            (preset) => `
              <button
                type="button"
                class="chip preset-chip"
                data-preset-target="${escapeHtml(targetKey)}"
                data-preset-value="${escapeHtml(preset.value)}"
              >${escapeHtml(preset.label)}</button>
            `
          )
          .join("")}
      </div>
    `;
  }

  function bindEvents() {
    $("#experimentForm").addEventListener("submit", handleSubmit);
    $("#experimentForm").addEventListener("click", handlePresetClick);
    $("#resetBtn").addEventListener("click", resetForm);
    $("#newRecordBtn").addEventListener("click", resetForm);
    $("#clearAllBtn").addEventListener("click", handleClearAll);
    $("#generateIdBtn").addEventListener("click", () => {
      $("#sampleId").value = getNextSampleId();
    });

    $("#exportJsonBtn").addEventListener("click", handleExportJson);
    $("#exportCsvBtn").addEventListener("click", handleExportCsv);
    $("#importJsonInput").addEventListener("change", handleImportJson);

    $("#searchInput").addEventListener("input", (event) => {
      state.searchText = event.target.value.trim().toLowerCase();
      renderRecords();
    });

    $("#filmFilter").addEventListener("change", (event) => {
      state.filmFilter = event.target.value;
      renderRecords();
    });

    $("#sortMode").addEventListener("change", (event) => {
      state.sortMode = event.target.value;
      renderRecords();
    });

    $("#recordList").addEventListener("click", handleRecordAction);
  }

  function showStatus(message, type = "success") {
    const element = $("#statusMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `status-message ${type}`;
    element.hidden = false;

    if (state.statusTimer) clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      element.hidden = true;
    }, 6000);
  }

  function handlePresetClick(event) {
    const button = event.target.closest("[data-preset-target]");
    if (!button) return;

    const target = document.getElementById(button.dataset.presetTarget);
    if (!target) return;

    target.value = button.dataset.presetValue;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
  }

  function collectFormData() {
    const previous = state.editingId ? state.records.find((record) => record.id === state.editingId) : null;
    const formData = new FormData($("#experimentForm"));
    const base = previous || LabSchema.createEmptyExperiment({ sampleId: getNextSampleId() });

    const xrdFileInput = $("#xrdFiles");
    const afmFileInput = $("#afmFiles");

    return {
      ...base,
      id: formData.get("id") || base.id,
      createdAt: formData.get("createdAt") || base.createdAt,
      date: formData.get("date") || LabSchema.getLocalDateString(),
      sampleId: formData.get("sampleId"),
      filmName: formData.get("filmName"),
      growthChamber: formData.get("growthChamber"),
      substrate: formData.get("substrate"),
      temperatureC: formData.get("temperatureC"),
      oxygenPressure: formData.get("oxygenPressure"),
      lensPosition: formData.get("lensPosition"),
      laserEnergy: formData.get("laserEnergy"),
      laserHz: formData.get("laserHz"),
      laserShots: formData.get("laserShots"),
      thicknessNm: formData.get("thicknessNm"),
      xrdSummary: formData.get("xrdSummary"),
      xrdFiles: xrdFileInput.files.length ? LabSchema.fileInputToMetadataList(xrdFileInput.files) : (previous?.xrdFiles || []),
      afmSummary: formData.get("afmSummary"),
      afmFiles: afmFileInput.files.length ? LabSchema.fileInputToMetadataList(afmFileInput.files) : (previous?.afmFiles || []),
      tags: formData.get("tags"),
      notes: formData.get("notes"),
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const record = collectFormData();
    const validation = LabSchema.validateExperiment(record);
    const duplicate = state.records.find((item) => item.id !== record.id && item.sampleId === record.sampleId);

    if (duplicate) {
      validation.errors.push(`Sample ID ${record.sampleId}는 이미 사용 중입니다. 자동 버튼을 눌러 다음 번호를 사용하세요.`);
    }

    if (validation.errors.length) {
      showStatus(validation.errors.join(" "), "error");
      return;
    }

    const wasEditing = Boolean(state.editingId);
    LabStorage.upsertRecord(record, { touchUpdatedAt: true });
    state.records = LabStorage.loadRecords();
    state.editingId = null;
    resetForm({ keepRenderedRecords: true });
    renderRecords();

    const warningText = validation.warnings.length ? ` 참고: ${validation.warnings.join(" ")}` : "";
    showStatus(`${wasEditing ? "수정" : "저장"} 완료. 다음 Sample ID는 ${getNextSampleId()}입니다. JSON 백업을 권장합니다.${warningText}`, validation.warnings.length ? "warning" : "success");
  }

  function resetForm(options = {}) {
    const empty = LabSchema.createEmptyExperiment({ sampleId: getNextSampleId() });
    state.editingId = null;
    $("#experimentForm").reset();
    $("#recordId").value = empty.id;
    $("#createdAt").value = empty.createdAt;
    $("#date").value = empty.date;
    $("#sampleId").value = empty.sampleId;
    $("#formTitle").textContent = "새 실험 기록";
    $("#saveBtn").textContent = "기록 저장";

    if (!options.keepRenderedRecords) renderRecords();
  }

  function populateForm(record) {
    state.editingId = record.id;
    $("#recordId").value = record.id;
    $("#createdAt").value = record.createdAt || LabSchema.getIsoTimestamp();
    [
      "date",
      "sampleId",
      "filmName",
      "growthChamber",
      "substrate",
      "temperatureC",
      "oxygenPressure",
      "lensPosition",
      "laserEnergy",
      "laserHz",
      "laserShots",
      "thicknessNm",
      "xrdSummary",
      "afmSummary",
      "tags",
      "notes",
    ].forEach((key) => {
      const element = document.getElementById(key);
      if (element) element.value = record[key] || "";
    });

    $("#xrdFiles").value = "";
    $("#afmFiles").value = "";
    $("#formTitle").textContent = `기록 수정: ${record.sampleId}`;
    $("#saveBtn").textContent = "수정 저장";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRecordAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const record = state.records.find((item) => item.id === id);
    if (!record) return;

    if (button.dataset.action === "edit") {
      populateForm(record);
    }

    if (button.dataset.action === "duplicate") {
      const now = LabSchema.getIsoTimestamp();
      const duplicated = LabSchema.normalizeExperiment({
        ...record,
        id: LabSchema.createId(),
        sampleId: LabSchema.makeDuplicateSampleId(state.records),
        createdAt: now,
        updatedAt: now,
        tags: [record.tags, "duplicated"].filter(Boolean).join(", "),
        notes: [record.notes, `복제 기록: 원본 Sample ID ${record.sampleId}, 복제 시각 ${formatDateTime(now)}`]
          .filter(Boolean)
          .join("\n"),
      }, { touchUpdatedAt: false });

      LabStorage.upsertRecord(duplicated, { touchUpdatedAt: false });
      state.records = LabStorage.loadRecords();
      renderRecords();
      showStatus(`복제 완료: ${duplicated.sampleId}. JSON 백업을 권장합니다.`, "success");
    }

    if (button.dataset.action === "delete") {
      const ok = confirm(`${record.sampleId} 기록을 삭제할까요?`);
      if (!ok) return;
      LabStorage.deleteRecord(id);
      state.records = LabStorage.loadRecords();
      renderRecords();
      if (state.editingId === id) resetForm({ keepRenderedRecords: true });
      showStatus(`삭제 완료: ${record.sampleId}. 다음 Sample ID는 ${getNextSampleId()}입니다. JSON 백업을 권장합니다.`, "warning");
    }
  }

  function handleClearAll() {
    if (!state.records.length) {
      showStatus("삭제할 기록이 없습니다.", "info");
      return;
    }

    const input = prompt("전체 삭제 전 JSON 백업을 권장합니다. 모든 기록을 삭제하려면 DELETE 또는 전체삭제를 직접 입력하세요.");
    if (input !== "DELETE" && input !== "전체삭제") {
      showStatus("전체 삭제가 취소되었습니다.", "info");
      return;
    }

    LabStorage.clearRecords();
    state.records = [];
    resetForm({ keepRenderedRecords: true });
    renderRecords();
    showStatus("전체 삭제 완료. 다음 Sample ID는 001입니다. 백업 파일이 없다면 복구할 수 없습니다.", "warning");
  }

  function handleExportJson() {
    try {
      const result = LabStorage.exportJson(state.records);
      state.backupMeta = result.backupMeta;
      renderTrustSummary();
      showStatus(`JSON 내보내기 완료: ${result.filename}`, "success");
    } catch (error) {
      console.error(error);
      showStatus("JSON 내보내기 중 오류가 발생했습니다.", "error");
    }
  }

  function handleExportCsv() {
    try {
      const result = LabStorage.exportCsv(state.records);
      state.backupMeta = result.backupMeta;
      renderTrustSummary();
      showStatus(`CSV 내보내기 완료: ${result.filename}`, "success");
    } catch (error) {
      console.error(error);
      showStatus("CSV 내보내기 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleImportJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const result = await LabStorage.importJsonFile(file);
      state.records = result.records;
      resetForm({ keepRenderedRecords: true });
      renderRecords();
      const { added, updated, skipped, invalid } = result.summary;
      showStatus(`JSON 가져오기 완료: 추가 ${added}개, 업데이트 ${updated}개, 건너뜀 ${skipped}개, 무효 ${invalid}개. 다음 Sample ID는 ${getNextSampleId()}입니다.`, invalid ? "warning" : "success");
    } catch (error) {
      alert(`가져오기 실패: ${error.message}\n기존 기록은 유지되었습니다.`);
      showStatus("JSON 가져오기 실패. 기존 기록은 유지되었습니다.", "error");
    } finally {
      event.target.value = "";
    }
  }

  function updateFilmFilterOptions() {
    const select = $("#filmFilter");
    const selected = state.filmFilter;
    const films = Array.from(
      new Set(state.records.map((record) => record.filmName).filter(Boolean).map((name) => name.toUpperCase()))
    ).sort();

    select.innerHTML = `<option value="all">전체 박막</option>${films
      .map((film) => `<option value="${escapeHtml(film)}">${escapeHtml(film)}</option>`)
      .join("")}`;
    select.value = films.includes(selected) ? selected : "all";
    state.filmFilter = select.value;
  }

  function getSampleSortValue(record) {
    return LabSchema.parseSequentialSampleId(record.sampleId);
  }

  function compareRecordsBySampleId(a, b) {
    const aId = getSampleSortValue(a);
    const bId = getSampleSortValue(b);

    if (aId === null && bId === null) {
      return Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0);
    }
    if (aId === null) return 1;
    if (bId === null) return -1;

    return state.sortMode === "sample-asc" ? aId - bId : bId - aId;
  }

  function getFilteredRecords() {
    const filtered = state.records.filter((record) => {
      const filmOk = state.filmFilter === "all" || String(record.filmName).toUpperCase() === state.filmFilter;
      const haystack = [
        record.sampleId,
        record.filmName,
        record.growthChamber,
        record.substrate,
        record.temperatureC,
        record.oxygenPressure,
        record.lensPosition,
        record.xrdSummary,
        record.afmSummary,
        record.tags,
        record.notes,
      ]
        .join(" ")
        .toLowerCase();
      const searchOk = !state.searchText || haystack.includes(state.searchText);
      return filmOk && searchOk;
    });

    return filtered.sort(compareRecordsBySampleId);
  }

  function renderTrustSummary() {
    const summary = $("#trustSummary");
    if (!summary) return;

    const latestUpdatedAt = getLatestUpdatedAt(state.records);
    summary.innerHTML = `
      <div class="trust-item">
        <span>저장된 기록</span>
        <strong>${state.records.length}개</strong>
      </div>
      <div class="trust-item">
        <span>다음 Sample ID</span>
        <strong>${escapeHtml(getNextSampleId())}</strong>
      </div>
      <div class="trust-item">
        <span>마지막 기록 수정</span>
        <strong>${escapeHtml(formatDateTime(latestUpdatedAt))}</strong>
      </div>
      <div class="trust-item">
        <span>마지막 JSON 백업</span>
        <strong>${escapeHtml(formatDateTime(state.backupMeta.lastJsonExportedAt))}</strong>
      </div>
      <div class="trust-item">
        <span>마지막 CSV 백업</span>
        <strong>${escapeHtml(formatDateTime(state.backupMeta.lastCsvExportedAt))}</strong>
      </div>
    `;
  }

  function renderRecords() {
    updateFilmFilterOptions();
    renderTrustSummary();
    const filtered = getFilteredRecords();
    $("#statsText").textContent = `저장된 기록 ${state.records.length}개 · 현재 표시 ${filtered.length}개`;

    if (!filtered.length) {
      $("#recordList").innerHTML = `
        <div class="empty-state">
          <h3>아직 표시할 기록이 없습니다.</h3>
          <p>왼쪽 폼에 SRO, LMO 등의 growth 조건과 XRD/AFM 분석 메모를 입력해보세요.</p>
        </div>
      `;
      return;
    }

    $("#recordList").innerHTML = filtered.map(renderRecordCard).join("");
  }

  function renderFileList(files) {
    if (!files || !files.length) return `<span class="muted">기록 없음</span>`;
    return `
      <ul class="file-list">
        ${files
          .map((file) => `<li>${escapeHtml(file.name)} <span>${Math.round((file.size || 0) / 1024)} KB</span></li>`)
          .join("")}
      </ul>
    `;
  }

  function renderRecordCard(record) {
    return `
      <article class="record-card">
        <div class="record-card-header">
          <div>
            <p class="record-date">${escapeHtml(record.date)}</p>
            <h3>${escapeHtml(record.sampleId)}</h3>
            <p class="record-subtitle">${escapeHtml(record.filmName || "-")} · ${escapeHtml(record.growthChamber || "chamber 미기록")} · ${escapeHtml(record.substrate || "기판 미기록")}</p>
          </div>
          <div class="record-actions">
            <button type="button" class="tiny" data-action="edit" data-id="${record.id}">수정</button>
            <button type="button" class="tiny" data-action="duplicate" data-id="${record.id}">복제</button>
            <button type="button" class="tiny danger-text" data-action="delete" data-id="${record.id}">삭제</button>
          </div>
        </div>

        <div class="condition-grid">
          ${renderCondition("Chamber", record.growthChamber, "")}
          ${renderCondition("온도", record.temperatureC, "°C")}
          ${renderCondition("산소 압력", record.oxygenPressure, "")}
          ${renderCondition("렌즈", record.lensPosition, "")}
          ${renderCondition("에너지", record.laserEnergy, "mJ")}
          ${renderCondition("Hz", record.laserHz, "Hz")}
          ${renderCondition("Shots", record.laserShots, "")}
          ${renderCondition("두께", record.thicknessNm, "nm")}
        </div>

        <details>
          <summary>분석 자료 및 메모 보기</summary>
          <div class="details-grid">
            <div>
              <h4>XRD</h4>
              <p>${escapeHtml(record.xrdSummary || "기록 없음")}</p>
              ${renderFileList(record.xrdFiles)}
            </div>
            <div>
              <h4>AFM</h4>
              <p>${escapeHtml(record.afmSummary || "기록 없음")}</p>
              ${renderFileList(record.afmFiles)}
            </div>
          </div>
          <div class="memo-block">
            <h4>태그 / 비고</h4>
            <p><b>태그:</b> ${escapeHtml(record.tags || "-")}</p>
            <p>${escapeHtml(record.notes || "")}</p>
            <p class="muted">마지막 수정: ${escapeHtml(formatDateTime(record.updatedAt))}</p>
          </div>
        </details>
      </article>
    `;
  }

  function renderCondition(label, value, unit) {
    const display = value || "-";
    return `
      <div class="condition-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(display)}${value && unit ? ` ${escapeHtml(unit)}` : ""}</strong>
      </div>
    `;
  }

  function init() {
    renderLayout();
    bindEvents();
    state.records = LabStorage.loadRecords();
    state.backupMeta = LabStorage.getBackupMeta();
    resetForm({ keepRenderedRecords: true });
    renderRecords();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", ThinFilmApp.init);
