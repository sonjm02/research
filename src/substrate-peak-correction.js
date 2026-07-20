/* global LabSchema, LabStorage, SubstratePeakSettings */

const SubstratePeakCorrection = (() => {
  const START = "[Substrate peak 2theta correction]";
  const END = "[/Substrate peak 2theta correction]";
  const BRAGG_START = "[Bragg 법칙 격자상수 계산]";
  const BRAGG_END = "[/Bragg 법칙 격자상수 계산]";
  const LAUE_START = "[Laue oscillation 두께 계산]";
  const LAUE_END = "[/Laue oscillation 두께 계산]";
  const state = { suppress: false };
  const $ = (selector) => document.querySelector(selector);

  function format(value, digits = 6, signed = false) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const text = number.toFixed(digits).replace(/\.?0+$/, "") || "0";
    return signed && number > 0 ? `+${text}` : text;
  }

  function stripBlock(text, start, end) {
    let output = String(text || "");
    let startIndex = output.indexOf(start);
    while (startIndex >= 0) {
      const endIndex = output.indexOf(end, startIndex);
      const removeEnd = endIndex < 0 ? output.length : endIndex + end.length;
      output = `${output.slice(0, startIndex)}${output.slice(removeEnd)}`;
      startIndex = output.indexOf(start);
    }
    return output.trim();
  }

  function stripAll(summary) {
    return stripBlock(stripBlock(stripBlock(summary, START, END), BRAGG_START, BRAGG_END), LAUE_START, LAUE_END);
  }

  function selectedSetting() {
    const select = $("#substratePeakSettingSelect");
    if (!select?.value) return null;
    const stored = SubstratePeakSettings.getById(select.value);
    if (stored) return stored;
    const option = select.selectedOptions?.[0];
    const reference = Number(option?.dataset.reference);
    if (!option || !Number.isFinite(reference)) return null;
    return SubstratePeakSettings.normalize({
      id: select.value,
      substrate: option.dataset.substrate,
      peakLabel: option.dataset.peakLabel,
      reference2Theta: reference,
    });
  }

  function calculateCorrection(referenceValue, measuredValue) {
    const reference = Number(referenceValue);
    const measured = Number(measuredValue);
    if (!Number.isFinite(reference) || reference <= 0 || reference >= 180) throw new Error("기준 기판 peak 2θ가 올바르지 않습니다.");
    if (!Number.isFinite(measured) || measured <= 0 || measured >= 180) throw new Error("측정 기판 peak 2θ는 0°보다 크고 180°보다 작아야 합니다.");
    return { reference, measured, offset: measured - reference, shift: reference - measured };
  }

  function shifted(value, shift) {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return null;
    const corrected = raw + shift;
    if (corrected <= 0 || corrected >= 180) throw new Error("보정된 2θ 값이 범위를 벗어났습니다.");
    return corrected;
  }

  function readData() {
    const setting = selectedSetting();
    const measuredText = $("#substratePeakMeasured")?.value.trim() || "";
    if (!setting || !measuredText) return { active: false, setting, measuredText };

    const corr = calculateCorrection(setting.reference2Theta, measuredText);
    const braggText = $("#xrdBragg2Theta")?.value.trim() || "";
    const reflectionL = $("#xrdReflectionL")?.value || "2";
    const fringe1Status = $("#xrdFringe1Status")?.value === "none" ? "none" : "value";
    const fringe2Status = $("#xrdFringe2Status")?.value === "none" ? "none" : "value";
    const fringe1Text = $("#xrdFringe1_2Theta")?.value.trim() || "";
    const fringe2Text = $("#xrdFringe2_2Theta")?.value.trim() || "";

    const rawBragg = braggText ? Number(braggText) : null;
    const rawFringe1 = fringe1Status === "none" || !fringe1Text ? null : Number(fringe1Text);
    const rawFringe2 = fringe2Status === "none" || !fringe2Text ? null : Number(fringe2Text);
    const correctedBragg = rawBragg === null ? null : shifted(rawBragg, corr.shift);
    const correctedFringe1 = rawFringe1 === null ? null : shifted(rawFringe1, corr.shift);
    const correctedFringe2 = rawFringe2 === null ? null : shifted(rawFringe2, corr.shift);

    const rawLattice = rawBragg === null ? null : LabSchema.calculateOutOfPlaneLatticeParameter(rawBragg, reflectionL);
    const correctedLattice = correctedBragg === null ? null : LabSchema.calculateOutOfPlaneLatticeParameter(correctedBragg, reflectionL);
    const canThickness = rawBragg !== null && rawFringe1 !== null && rawFringe2 !== null;
    const rawThickness = canThickness ? LabSchema.calculateLaueThickness(rawBragg, rawFringe1, rawFringe2) : null;
    const correctedThickness = canThickness ? LabSchema.calculateLaueThickness(correctedBragg, correctedFringe1, correctedFringe2) : null;

    return {
      active: true,
      setting,
      corr,
      reflectionL,
      fringe1Status,
      fringe2Status,
      rawBragg,
      rawFringe1,
      rawFringe2,
      correctedBragg,
      correctedFringe1,
      correctedFringe2,
      rawLattice,
      correctedLattice,
      rawThickness,
      correctedThickness,
    };
  }

  function peakLine(label, raw, corrected, status = "value") {
    if (status === "none") return `${label} = none (관측되지 않음)`;
    if (!Number.isFinite(raw)) return `${label} = 미입력`;
    return `${label}: raw ${format(raw)}° → corrected ${format(corrected)}°`;
  }

  function buildResultBlock(data) {
    const lines = [
      START,
      `기판 설정: ${data.setting.substrate} · ${data.setting.peakLabel}`,
      `기준 기판 peak = ${format(data.corr.reference)}°`,
      `측정 기판 peak = ${format(data.corr.measured)}°`,
      `측정값 - 기준값 = ${format(data.corr.offset, 6, true)}°`,
      `적용 shift = 기준값 - 측정값 = ${format(data.corr.shift, 6, true)}°`,
      peakLine("2θ_Bragg", data.rawBragg, data.correctedBragg),
      peakLine("1st fringe 2θ", data.rawFringe1, data.correctedFringe1, data.fringe1Status),
      peakLine("2nd fringe 2θ", data.rawFringe2, data.correctedFringe2, data.fringe2Status),
    ];

    if (data.rawLattice && data.correctedLattice) {
      lines.push(
        "",
        `[보정 전 Bragg 분석 · ${data.rawLattice.reflectionLabel}]`,
        `d_raw = ${format(data.rawLattice.dSpacingAngstrom)} Å`,
        `c_raw = ${format(data.rawLattice.latticeParameterAngstrom)} Å`,
        `[보정 후 Bragg 분석 · ${data.correctedLattice.reflectionLabel}]`,
        `d_corrected = ${format(data.correctedLattice.dSpacingAngstrom)} Å`,
        `c_corrected = ${format(data.correctedLattice.latticeParameterAngstrom)} Å`,
        `Δc = ${format(data.correctedLattice.latticeParameterAngstrom - data.rawLattice.latticeParameterAngstrom, 6, true)} Å`
      );
    }

    if (data.fringe1Status === "none" || data.fringe2Status === "none") {
      lines.push("", "Laue 두께 계산 불가: 하나 이상의 fringe가 none임.");
    } else if (data.rawThickness && data.correctedThickness) {
      lines.push(
        "",
        "[보정 전 Laue 분석]",
        `Δ(2θ)_raw = ${format(data.rawThickness.delta2ThetaDeg)}°`,
        `t_raw = ${format(data.rawThickness.thicknessNm, 4)} nm`,
        "[보정 후 Laue 분석]",
        `Δ(2θ)_corrected = ${format(data.correctedThickness.delta2ThetaDeg)}°`,
        `t_corrected = ${format(data.correctedThickness.thicknessNm, 4)} nm`,
        `Δt = ${format(data.correctedThickness.thicknessNm - data.rawThickness.thicknessNm, 4, true)} nm`
      );
    } else {
      lines.push("", "Laue 두께 계산 대기: 두 fringe 값을 모두 입력해야 합니다.");
    }
    lines.push(END);
    return lines.join("\n");
  }

  function writeOutputs(data) {
    const values = {
      substratePeakReference: data?.active ? format(data.corr.reference) : (data?.setting ? format(data.setting.reference2Theta) : ""),
      substratePeakOffset: data?.active ? format(data.corr.offset, 6, true) : "",
      substratePeakAppliedShift: data?.active ? format(data.corr.shift, 6, true) : "",
      xrdCorrectedBragg: data?.active && Number.isFinite(data.correctedBragg) ? format(data.correctedBragg) : "",
      xrdCorrectedFringe1: data?.active && data.fringe1Status === "none" ? "none" : (data?.active && Number.isFinite(data.correctedFringe1) ? format(data.correctedFringe1) : ""),
      xrdCorrectedFringe2: data?.active && data.fringe2Status === "none" ? "none" : (data?.active && Number.isFinite(data.correctedFringe2) ? format(data.correctedFringe2) : ""),
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element) element.value = value;
    });
  }

  function setStatus(message, type = "info") {
    const element = $("#substrateCorrectionStatus");
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${type}`;
  }

  function showAppStatus(message, type = "info") {
    const element = $("#statusMessage");
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.hidden = false;
  }

  function apply(options = {}) {
    if (state.suppress) return { active: false };
    const summary = $("#xrdSummary");
    try {
      const data = readData();
      writeOutputs(data);
      if (!data.active) {
        if (summary) summary.value = stripBlock(summary.value, START, END);
        setStatus(data.setting ? "측정 기판 peak 2θ를 입력하면 보정됩니다." : "기판 기준 peak 설정을 선택하세요.", "info");
        return data;
      }

      const manual = stripAll(summary?.value || "");
      if (summary) summary.value = [manual, buildResultBlock(data)].filter(Boolean).join("\n\n");
      if (data.correctedLattice) {
        $("#xrdDSpacingAngstrom").value = format(data.correctedLattice.dSpacingAngstrom, 5);
        $("#xrdLatticeParameterAngstrom").value = format(data.correctedLattice.latticeParameterAngstrom, 5);
      }
      $("#xrdThicknessNm").value = data.correctedThickness ? format(data.correctedThickness.thicknessNm, 3) : "";

      const message = `offset ${format(data.corr.offset, 6, true)}° · shift ${format(data.corr.shift, 6, true)}°`
        + (data.correctedLattice ? ` · 보정 c ${format(data.correctedLattice.latticeParameterAngstrom, 5)} Å` : "")
        + (data.correctedThickness ? ` · 보정 두께 ${format(data.correctedThickness.thicknessNm, 3)} nm` : "");
      setStatus(message, "success");
      if (options.announce) showAppStatus(`기판 peak 보정 완료: ${message}`, "success");
      return data;
    } catch (error) {
      writeOutputs(null);
      if (summary) summary.value = stripBlock(summary.value, START, END);
      setStatus(error.message, "error");
      if (options.announce) showAppStatus(error.message, "error");
      return { active: false, error };
    }
  }

  function optionHtml(item, selected = false) {
    return `<option value="${item.id}" data-reference="${item.reference2Theta}" data-substrate="${item.substrate}" data-peak-label="${item.peakLabel}" ${selected ? "selected" : ""}>${item.substrate} · ${item.peakLabel} · ${format(item.reference2Theta)}°</option>`;
  }

  function refreshSelect(record = null) {
    const select = $("#substratePeakSettingSelect");
    if (!select) return;
    const previous = select.value;
    const matches = SubstratePeakSettings.getForSubstrate($("#substrate")?.value || "");
    const parts = ['<option value="">보정 안 함</option>'];
    const savedId = record?.substratePeakCalibrationId || "";
    if (savedId && !SubstratePeakSettings.getById(savedId) && record.substratePeakReference2Theta) {
      parts.push(optionHtml(SubstratePeakSettings.normalize({
        id: savedId,
        substrate: record.substrate,
        peakLabel: record.substratePeakCalibrationLabel || "저장된 peak",
        reference2Theta: record.substratePeakReference2Theta,
      }), true));
    }
    matches.forEach((item) => parts.push(optionHtml(item)));
    select.innerHTML = parts.join("");
    const values = Array.from(select.options).map((option) => option.value);
    if (savedId && values.includes(savedId)) select.value = savedId;
    else if (previous && values.includes(previous)) select.value = previous;
    else if (matches.length === 1) select.value = matches[0].id;
    else select.value = "";
    writeOutputs({ active: false, setting: selectedSetting() });
  }

  function renderUi() {
    const xrdCard = Array.from(document.querySelectorAll(".record-card")).find(
      (card) => card.querySelector("h4")?.textContent.trim() === "XRD 자동 계산"
    );
    xrdCard?.insertAdjacentHTML("beforebegin", `
      <div class="record-card" id="substrateCorrectionCard" style="margin-bottom:0.9rem;border-left:4px solid #6366f1;">
        <h4>기판 peak 기준 2θ 보정</h4>
        <p class="section-help">δ = measured − reference, corrected peak = raw peak − δ. 같은 shift를 Bragg와 두 fringe에 모두 적용합니다.</p>
        <div class="field-grid">
          <label><span>기판 기준 peak 설정</span><select id="substratePeakSettingSelect"></select><small>증착 기판과 같은 설정만 표시됩니다.</small></label>
          <label><span>기준 기판 peak 2θ</span><div class="with-unit"><input id="substratePeakReference" readonly><small>degree</small></div></label>
          <label><span>측정 기판 peak 2θ</span><div class="with-unit"><input type="number" step="any" id="substratePeakMeasured" placeholder="예: 46.4723"><small>degree</small></div></label>
          <label><span>측정값 − 기준값</span><div class="with-unit"><input id="substratePeakOffset" readonly><small>degree</small></div></label>
          <label><span>전체 peak 적용 shift</span><div class="with-unit"><input id="substratePeakAppliedShift" readonly><small>degree</small></div></label>
          <label><span>보정된 2θ Bragg</span><div class="with-unit"><input id="xrdCorrectedBragg" readonly><small>degree</small></div></label>
          <label><span>보정된 1st fringe</span><div class="with-unit"><input id="xrdCorrectedFringe1" readonly><small>degree</small></div></label>
          <label><span>보정된 2nd fringe</span><div class="with-unit"><input id="xrdCorrectedFringe2" readonly><small>degree</small></div></label>
        </div>
        <div class="form-actions" style="margin-top:0.8rem;"><button type="button" class="secondary" id="applySubstrateCorrectionBtn">기판 보정 계산</button></div>
        <div id="substrateCorrectionStatus" class="status-message info" style="margin-top:0.8rem;margin-bottom:0;">기판 기준 peak 설정을 선택하세요.</div>
      </div>
    `);
  }

  function populate(record) {
    state.suppress = true;
    refreshSelect(record);
    $("#substratePeakMeasured").value = record.substratePeakMeasured2Theta || "";
    state.suppress = false;
    setTimeout(apply, 0);
  }

  function reset() {
    state.suppress = true;
    $("#substratePeakMeasured").value = "";
    refreshSelect();
    writeOutputs(null);
    state.suppress = false;
    setStatus("기판 기준 peak 설정을 선택하세요.", "info");
  }

  function validateSubmit(event) {
    const measured = $("#substratePeakMeasured")?.value.trim();
    if (!measured) return;
    if (!selectedSetting()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAppStatus("측정 기판 peak를 입력했다면 기준 peak 설정도 선택해야 합니다.", "error");
      return;
    }
    try {
      readData();
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAppStatus(error.message, "error");
    }
  }

  function bind() {
    $("#substrate").addEventListener("input", () => { refreshSelect(); apply(); });
    $("#substratePeakSettingSelect").addEventListener("change", apply);
    $("#substratePeakMeasured").addEventListener("input", apply);
    $("#applySubstrateCorrectionBtn").addEventListener("click", () => apply({ announce: true }));
    ["xrdBragg2Theta", "xrdReflectionL", "xrdFringe1Status", "xrdFringe2Status", "xrdFringe1_2Theta", "xrdFringe2_2Theta"].forEach((id) => {
      $(`#${id}`).addEventListener("input", apply);
      $(`#${id}`).addEventListener("change", apply);
    });
    $("#calculateXrdBtn").addEventListener("click", apply);
    $("#experimentForm").addEventListener("submit", validateSubmit, true);
    ["newRecordBtn", "resetBtn"].forEach((id) => $(`#${id}`).addEventListener("click", () => setTimeout(reset, 0)));
    $("#recordList").addEventListener("click", (event) => {
      const button = event.target.closest('button[data-action="edit"]');
      if (!button) return;
      const record = LabStorage.loadRecords().find((item) => item.id === button.dataset.id);
      if (record) populate(record);
    });
    document.addEventListener("substrate-peak-settings-changed", () => { refreshSelect(); apply(); });
  }

  function init() {
    renderUi();
    refreshSelect();
    bind();
  }

  return {
    init,
    apply,
    readData,
    buildResultBlock,
    stripAll,
    stripBlock,
    format,
    START,
    END,
  };
})();

document.addEventListener("DOMContentLoaded", SubstratePeakCorrection.init);
