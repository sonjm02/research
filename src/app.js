/* global LabSchema, LabStorage */

const ThinFilmApp = (() => {
  const state = {
    records: [],
    editingId: null,
    searchText: "",
    filmFilter: "all",
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
    if (!isoString) return "";
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

  function getToday() {
    return new Date().toISOString().slice(0, 10);
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

          <form id="experimentForm">
            <input type="hidden" name="id" id="recordId">
            <input type="hidden" name="createdAt" id="createdAt">

            <div class="section-block">
              <h3>기본 정보</h3>
              <div class="field-grid two-cols">
                <label>
                  <span>실험 날짜</span>
                  <input type="date" name="date" id="date" required>
                </label>
                <label>
                  <span>Sample ID <b>*</b></span>
                  <div class="inline-control">
                    <input type="text" name="sampleId" id="sampleId" placeholder="예: SRO-STO-20260710-01" required>
                    <button type="button" class="tiny" id="generateIdBtn">자동</button>
                  </div>
                </label>
              </div>

              <div class="preset-row" aria-label="박막 이름 빠른 선택">
                ${LabSchema.FILM_PRESETS.map((film) => `<button type="button" class="chip" data-film-preset="${film}">${film}</button>`).join("")}
              </div>
            </div>

            <div class="section-block">
              <h3>PLD growth 조건</h3>
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

          <div class="toolbar">
            <input type="search" id="searchInput" placeholder="Sample ID, 박막, 기판, 메모 검색">
            <select id="filmFilter">
              <option value="all">전체 박막</option>
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
      </label>
    `;
  }

  function bindEvents() {
    $("#experimentForm").addEventListener("submit", handleSubmit);
    $("#resetBtn").addEventListener("click", resetForm);
    $("#newRecordBtn").addEventListener("click", resetForm);
    $("#clearAllBtn").addEventListener("click", handleClearAll);
    $("#generateIdBtn").addEventListener("click", () => {
      const filmName = $("#filmName").value || "TF";
      $("#sampleId").value = LabSchema.makeSampleId(filmName);
    });

    $("#exportJsonBtn").addEventListener("click", () => LabStorage.exportJson(state.records));
    $("#exportCsvBtn").addEventListener("click", () => LabStorage.exportCsv(state.records));
    $("#importJsonInput").addEventListener("change", handleImportJson);

    $("#searchInput").addEventListener("input", (event) => {
      state.searchText = event.target.value.trim().toLowerCase();
      renderRecords();
    });

    $("#filmFilter").addEventListener("change", (event) => {
      state.filmFilter = event.target.value;
      renderRecords();
    });

    document.querySelectorAll("[data-film-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.filmPreset;
        if (value !== "Custom") {
          $("#filmName").value = value;
          if (!$("#sampleId").value || $("#sampleId").value.startsWith("TF-")) {
            $("#sampleId").value = LabSchema.makeSampleId(value);
          }
        }
        $("#filmName").focus();
      });
    });

    $("#recordList").addEventListener("click", handleRecordAction);
  }

  function collectFormData() {
    const previous = state.editingId ? state.records.find((record) => record.id === state.editingId) : null;
    const formData = new FormData($("#experimentForm"));
    const base = previous || LabSchema.createEmptyExperiment();

    const xrdFileInput = $("#xrdFiles");
    const afmFileInput = $("#afmFiles");

    return LabSchema.normalizeExperiment({
      ...base,
      id: formData.get("id") || base.id,
      createdAt: formData.get("createdAt") || base.createdAt,
      date: formData.get("date") || getToday(),
      sampleId: formData.get("sampleId"),
      filmName: formData.get("filmName"),
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
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const record = collectFormData();

    if (!record.sampleId.trim() || !record.filmName.trim()) {
      alert("Sample ID와 박막 이름은 필수입니다.");
      return;
    }

    LabStorage.upsertRecord(record);
    state.records = LabStorage.loadRecords();
    state.editingId = null;
    resetForm({ keepRenderedRecords: true });
    renderRecords();
  }

  function resetForm(options = {}) {
    const empty = LabSchema.createEmptyExperiment();
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
    $("#createdAt").value = record.createdAt || new Date().toISOString();
    [
      "date",
      "sampleId",
      "filmName",
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
      const duplicated = LabSchema.normalizeExperiment({
        ...record,
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        sampleId: `${record.sampleId}-copy`,
        createdAt: new Date().toISOString(),
      });
      LabStorage.upsertRecord(duplicated);
      state.records = LabStorage.loadRecords();
      renderRecords();
    }

    if (button.dataset.action === "delete") {
      const ok = confirm(`${record.sampleId} 기록을 삭제할까요?`);
      if (!ok) return;
      LabStorage.deleteRecord(id);
      state.records = LabStorage.loadRecords();
      renderRecords();
      if (state.editingId === id) resetForm({ keepRenderedRecords: true });
    }
  }

  function handleClearAll() {
    if (!state.records.length) return;
    const ok = confirm("저장된 모든 실험 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.");
    if (!ok) return;
    LabStorage.clearRecords();
    state.records = [];
    resetForm({ keepRenderedRecords: true });
    renderRecords();
  }

  async function handleImportJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state.records = await LabStorage.importJsonFile(file);
      renderRecords();
      alert("JSON 기록을 가져왔습니다.");
    } catch (error) {
      alert(`가져오기 실패: ${error.message}`);
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

  function getFilteredRecords() {
    return state.records.filter((record) => {
      const filmOk = state.filmFilter === "all" || String(record.filmName).toUpperCase() === state.filmFilter;
      const haystack = [
        record.sampleId,
        record.filmName,
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
  }

  function renderRecords() {
    updateFilmFilterOptions();
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
            <p class="record-subtitle">${escapeHtml(record.filmName || "-")} on ${escapeHtml(record.substrate || "-")}</p>
          </div>
          <div class="record-actions">
            <button type="button" class="tiny" data-action="edit" data-id="${record.id}">수정</button>
            <button type="button" class="tiny" data-action="duplicate" data-id="${record.id}">복제</button>
            <button type="button" class="tiny danger-text" data-action="delete" data-id="${record.id}">삭제</button>
          </div>
        </div>

        <div class="condition-grid">
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
    resetForm({ keepRenderedRecords: true });
    renderRecords();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", ThinFilmApp.init);
