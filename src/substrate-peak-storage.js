/* global LabSchema, LabStorage, SubstratePeakCorrection */

(() => {
  const $ = (selector) => document.querySelector(selector);

  function recordFields(data) {
    const format = SubstratePeakCorrection.format;
    if (!data.active) {
      return {
        substratePeakCalibrationId: "",
        substratePeakCalibrationLabel: "",
        substratePeakReference2Theta: "",
        substratePeakMeasured2Theta: "",
        substratePeakOffset2Theta: "",
        xrdAppliedShift2Theta: "",
        xrdCorrectedBragg2Theta: "",
        xrdCorrectedFringe1_2Theta: "",
        xrdCorrectedFringe2_2Theta: "",
        xrdRawDSpacingAngstrom: "",
        xrdRawLatticeParameterAngstrom: "",
        xrdRawThicknessNm: "",
        xrdCorrectedDSpacingAngstrom: "",
        xrdCorrectedLatticeParameterAngstrom: "",
        xrdCorrectedThicknessNm: "",
      };
    }

    return {
      substratePeakCalibrationId: data.setting.id,
      substratePeakCalibrationLabel: `${data.setting.substrate} · ${data.setting.peakLabel}`,
      substratePeakReference2Theta: format(data.corr.reference),
      substratePeakMeasured2Theta: format(data.corr.measured),
      substratePeakOffset2Theta: format(data.corr.offset),
      xrdAppliedShift2Theta: format(data.corr.shift),
      xrdCorrectedBragg2Theta: Number.isFinite(data.correctedBragg) ? format(data.correctedBragg) : "",
      xrdCorrectedFringe1_2Theta: data.fringe1Status === "none" ? "none" : (Number.isFinite(data.correctedFringe1) ? format(data.correctedFringe1) : ""),
      xrdCorrectedFringe2_2Theta: data.fringe2Status === "none" ? "none" : (Number.isFinite(data.correctedFringe2) ? format(data.correctedFringe2) : ""),
      xrdRawDSpacingAngstrom: data.rawLattice ? format(data.rawLattice.dSpacingAngstrom) : "",
      xrdRawLatticeParameterAngstrom: data.rawLattice ? format(data.rawLattice.latticeParameterAngstrom) : "",
      xrdRawThicknessNm: data.rawThickness ? format(data.rawThickness.thicknessNm, 4) : "",
      xrdCorrectedDSpacingAngstrom: data.correctedLattice ? format(data.correctedLattice.dSpacingAngstrom) : "",
      xrdCorrectedLatticeParameterAngstrom: data.correctedLattice ? format(data.correctedLattice.latticeParameterAngstrom) : "",
      xrdCorrectedThicknessNm: data.correctedThickness ? format(data.correctedThickness.thicknessNm, 4) : "",
    };
  }

  function patchUpsert() {
    const original = LabStorage.upsertRecord.bind(LabStorage);
    LabStorage.upsertRecord = (record, options = {}) => {
      const isFormSave = record?.id && record.id === $("#recordId")?.value;
      if (!isFormSave) return original(record, options);

      try {
        const data = SubstratePeakCorrection.readData();
        const next = { ...record, ...recordFields(data) };
        if (data.active) {
          next.xrdSummary = [
            SubstratePeakCorrection.stripAll(record.xrdSummary),
            SubstratePeakCorrection.buildResultBlock(data),
          ].filter(Boolean).join("\n\n");
          if (data.correctedLattice) {
            next.xrdDSpacingAngstrom = SubstratePeakCorrection.format(data.correctedLattice.dSpacingAngstrom, 5);
            next.xrdLatticeParameterAngstrom = SubstratePeakCorrection.format(data.correctedLattice.latticeParameterAngstrom, 5);
          }
          next.xrdThicknessNm = data.correctedThickness
            ? SubstratePeakCorrection.format(data.correctedThickness.thicknessNm, 3)
            : "";
        } else {
          next.xrdSummary = SubstratePeakCorrection.stripBlock(
            record.xrdSummary,
            SubstratePeakCorrection.START,
            SubstratePeakCorrection.END
          );
        }
        return original(next, options);
      } catch (error) {
        console.error("Substrate correction save failed", error);
        return original(record, options);
      }
    };
  }

  function patchCsvExport() {
    LabStorage.exportCsv = (records) => {
      const headers = [
        "date", "sampleId", "filmName", "growthChamber", "substrate", "temperatureC", "oxygenPressure",
        "lensPosition", "laserEnergy", "spotAreaMm2", "laserFluenceJcm2", "spotAreaSource", "spotCalibrationId",
        "spotCalibrationLabel", "laserHz", "laserShots",
        "substratePeakCalibrationId", "substratePeakCalibrationLabel", "substratePeakReference2Theta",
        "substratePeakMeasured2Theta", "substratePeakOffset2Theta", "xrdAppliedShift2Theta",
        "xrdBragg2Theta", "xrdCorrectedBragg2Theta", "xrdReflectionL", "xrdDSpacingAngstrom",
        "xrdLatticeParameterAngstrom", "xrdRawDSpacingAngstrom", "xrdRawLatticeParameterAngstrom",
        "xrdCorrectedDSpacingAngstrom", "xrdCorrectedLatticeParameterAngstrom", "xrdFringe1Status",
        "xrdFringe2Status", "xrdFringe1_2Theta", "xrdFringe2_2Theta", "xrdCorrectedFringe1_2Theta",
        "xrdCorrectedFringe2_2Theta", "xrdThicknessNm", "xrdRawThicknessNm", "xrdCorrectedThicknessNm",
        "xrdSummary", "xrdFiles", "afmSummary", "afmFiles", "tags", "notes", "createdAt", "updatedAt",
      ];
      const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const lines = [headers.join(",")];

      records.forEach((record) => {
        const normalized = LabSchema.normalizeExperiment(record, { touchUpdatedAt: false });
        lines.push(headers.map((header) => {
          if (header === "xrdFiles" || header === "afmFiles") {
            return csv((normalized[header] || []).map((file) => file.name).join("; "));
          }
          return csv(normalized[header]);
        }).join(","));
      });

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const filename = `thin-film-records-${LabSchema.getLocalDateTimeFileStamp()}.csv`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      const exportedAt = LabSchema.getIsoTimestamp();
      const backupMeta = LabStorage.saveBackupMeta({
        lastExportedAt: exportedAt,
        lastExportType: "CSV",
        lastCsvExportedAt: exportedAt,
        lastCsvFilename: filename,
      });
      return { filename, exportedAt, backupMeta };
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    patchUpsert();
    patchCsvExport();
  });
})();
