/* global SpotSettingsApp */

(() => {
  function syncFluenceGuard() {
    const energyInput = document.querySelector("#laserEnergy");
    const areaInput = document.querySelector("#spotAreaMm2");
    const fluenceInput = document.querySelector("#laserFluenceJcm2");
    if (!energyInput || !areaInput || !fluenceInput) return;

    const energyText = energyInput.value.trim();
    const areaText = areaInput.value.trim();
    if (!energyText || !areaText) {
      fluenceInput.value = "";
      return;
    }

    const fluence = SpotSettingsApp.calculateLaserFluence(energyText, areaText);
    fluenceInput.value = fluence === null
      ? ""
      : fluence.toFixed(4).replace(/\.?0+$/, "");
  }

  function bind(id, events = ["input", "change"]) {
    const element = document.querySelector(`#${id}`);
    if (!element) return;
    events.forEach((eventName) => element.addEventListener(eventName, syncFluenceGuard));
  }

  document.addEventListener("DOMContentLoaded", () => {
    ["laserEnergy", "spotAreaMm2", "growthChamber", "lensPosition"].forEach((id) => bind(id));
    ["loadSpotCalibrationBtn", "newRecordBtn", "resetBtn"].forEach((id) => bind(id, ["click"]));
    bind("spotCalibrationForm", ["submit"]);
    bind("recordList", ["click"]);
    syncFluenceGuard();
  });
})();
