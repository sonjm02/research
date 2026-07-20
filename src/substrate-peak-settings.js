/* Substrate reference peak settings stored in browser localStorage. */

const SubstratePeakSettings = (() => {
  const STORAGE_KEY = "thin-film-substrate-peak-settings-v1";
  const state = { items: [], editingId: null };
  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function format(value, digits = 6) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number.toFixed(digits).replace(/\.?0+$/, "") || "0";
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `substrate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalize(input = {}) {
    const reference = Number(input.reference2Theta);
    return {
      id: input.id || createId(),
      substrate: String(input.substrate || "").trim(),
      peakLabel: String(input.peakLabel || "").trim(),
      reference2Theta: Number.isFinite(reference) && reference > 0 && reference < 180 ? reference : "",
      updatedAt: input.updatedAt || new Date().toISOString(),
    };
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      state.items = Array.isArray(parsed)
        ? parsed.map(normalize).filter((item) => item.substrate && item.peakLabel && item.reference2Theta)
        : [];
    } catch (error) {
      console.error("Failed to load substrate peak settings", error);
      state.items = [];
    }
    return state.items;
  }

  function save(items) {
    state.items = items.map(normalize);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items, null, 2));
    document.dispatchEvent(new CustomEvent("substrate-peak-settings-changed"));
  }

  function getAll() {
    return [...state.items];
  }

  function getById(id) {
    return state.items.find((item) => item.id === id) || null;
  }

  function getForSubstrate(substrate) {
    const target = normalizeText(substrate);
    return target ? state.items.filter((item) => normalizeText(item.substrate) === target) : getAll();
  }

  function setStatus(message, type = "info") {
    const element = $("#substrateSettingsStatus");
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.hidden = false;
  }

  function renderList() {
    const list = $("#substrateSettingsList");
    if (!list) return;
    if (!state.items.length) {
      list.innerHTML = '<div class="empty-state"><h3>저장된 기판 peak가 없습니다.</h3><p>기판, peak 이름, 기준 2θ를 입력하세요.</p></div>';
      return;
    }
    list.innerHTML = [...state.items]
      .sort((a, b) => a.substrate.localeCompare(b.substrate, "ko"))
      .map((item) => `
        <article class="spot-calibration-row">
          <div><strong>${escapeHtml(item.substrate)} · ${escapeHtml(item.peakLabel)}</strong><span>${escapeHtml(format(item.reference2Theta))}°</span></div>
          <div class="record-actions">
            <button type="button" class="tiny" data-substrate-action="edit" data-id="${escapeHtml(item.id)}">수정</button>
            <button type="button" class="tiny danger-text" data-substrate-action="delete" data-id="${escapeHtml(item.id)}">삭제</button>
          </div>
        </article>
      `).join("");
  }

  function resetForm() {
    state.editingId = null;
    $("#substrateSettingsForm")?.reset();
    if ($("#saveSubstrateSettingBtn")) $("#saveSubstrateSettingBtn").textContent = "설정 저장";
  }

  function openModal() {
    renderList();
    $("#substratePeakSettingsModal").hidden = false;
    document.body.classList.add("spot-settings-open");
    $("#substrateSettingName")?.focus();
  }

  function closeModal() {
    $("#substratePeakSettingsModal").hidden = true;
    document.body.classList.remove("spot-settings-open");
    resetForm();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const substrate = $("#substrateSettingName").value.trim();
    const peakLabel = $("#substrateSettingPeakLabel").value.trim();
    const reference2Theta = Number($("#substrateSettingReference").value);
    if (!substrate || !peakLabel || !Number.isFinite(reference2Theta) || reference2Theta <= 0 || reference2Theta >= 180) {
      setStatus("기판, peak 이름, 0°보다 크고 180°보다 작은 기준 2θ를 입력하세요.", "error");
      return;
    }

    const duplicate = state.items.find((item) =>
      item.id !== state.editingId
      && normalizeText(item.substrate) === normalizeText(substrate)
      && normalizeText(item.peakLabel) === normalizeText(peakLabel)
    );
    const targetId = state.editingId || duplicate?.id || createId();
    const next = state.items.filter((item) => item.id !== targetId);
    next.push(normalize({ id: targetId, substrate, peakLabel, reference2Theta }));
    save(next);
    resetForm();
    renderList();
    setStatus(duplicate ? "같은 기판·peak 설정을 업데이트했습니다." : "기판 peak 설정을 저장했습니다.", "success");
  }

  function handleListClick(event) {
    const button = event.target.closest("button[data-substrate-action]");
    if (!button) return;
    const item = getById(button.dataset.id);
    if (!item) return;

    if (button.dataset.substrateAction === "edit") {
      state.editingId = item.id;
      $("#substrateSettingName").value = item.substrate;
      $("#substrateSettingPeakLabel").value = item.peakLabel;
      $("#substrateSettingReference").value = item.reference2Theta;
      $("#saveSubstrateSettingBtn").textContent = "수정 저장";
      return;
    }

    if (confirm(`${item.substrate} · ${item.peakLabel} 설정을 삭제할까요?`)) {
      save(state.items.filter((entry) => entry.id !== item.id));
      renderList();
      setStatus("기판 peak 설정을 삭제했습니다.", "warning");
    }
  }

  function renderUi() {
    $(".header-actions")?.insertAdjacentHTML(
      "afterbegin",
      '<button type="button" class="secondary" id="substratePeakSettingsBtn">기판 Peak 설정</button>'
    );
    document.body.insertAdjacentHTML("beforeend", `
      <div class="spot-settings-modal" id="substratePeakSettingsModal" hidden>
        <section class="spot-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="substrateSettingsTitle">
          <div class="spot-settings-header">
            <div><p class="eyebrow">XRD Calibration</p><h2 id="substrateSettingsTitle">기판 기준 Peak 설정</h2><p>기판별 기준 peak 이름과 2θ 값을 저장합니다.</p></div>
            <button type="button" class="ghost" id="closeSubstrateSettingsBtn">닫기</button>
          </div>
          <div id="substrateSettingsStatus" class="status-message info" hidden></div>
          <form id="substrateSettingsForm" class="spot-calibration-form">
            <label><span>기판</span><input id="substrateSettingName" list="substrateSettingList" placeholder="예: STO(001)" required><datalist id="substrateSettingList"><option value="STO(001)"></option><option value="DSO(110)o"></option></datalist></label>
            <label><span>기준 peak 이름</span><input id="substrateSettingPeakLabel" placeholder="예: STO(002)" required></label>
            <label><span>기준 2θ</span><div class="with-unit"><input type="number" step="any" id="substrateSettingReference" placeholder="예: 46.4721" required><small>degree</small></div></label>
            <div class="form-actions spot-calibration-actions"><button type="submit" class="primary" id="saveSubstrateSettingBtn">설정 저장</button><button type="button" class="secondary" id="resetSubstrateSettingBtn">입력 초기화</button></div>
          </form>
          <div class="spot-calibration-list" id="substrateSettingsList"></div>
          <p class="muted spot-settings-note">검증된 장비·파장 기준값만 입력하세요. 설정은 이 브라우저의 localStorage에 저장됩니다.</p>
        </section>
      </div>
    `);
  }

  function bind() {
    $("#substratePeakSettingsBtn").addEventListener("click", openModal);
    $("#closeSubstrateSettingsBtn").addEventListener("click", closeModal);
    $("#substratePeakSettingsModal").addEventListener("click", (event) => {
      if (event.target.id === "substratePeakSettingsModal") closeModal();
    });
    $("#substrateSettingsForm").addEventListener("submit", handleSubmit);
    $("#resetSubstrateSettingBtn").addEventListener("click", resetForm);
    $("#substrateSettingsList").addEventListener("click", handleListClick);
  }

  function init() {
    load();
    renderUi();
    bind();
    renderList();
  }

  return { init, getAll, getById, getForSubstrate, normalize, format };
})();

document.addEventListener("DOMContentLoaded", SubstratePeakSettings.init);
