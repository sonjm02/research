/*
 * Local persistence and import/export helpers.
 * The app is static GitHub Pages friendly, so it stores records in browser localStorage.
 */

const LabStorage = (() => {
  const STORAGE_KEY = "thin-film-research-notebook-v1";

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(LabSchema.normalizeExperiment);
    } catch (error) {
      console.error("Failed to load records", error);
      return [];
    }
  }

  function saveRecords(records) {
    const normalized = records.map(LabSchema.normalizeExperiment);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized, null, 2));
    return normalized;
  }

  function upsertRecord(record) {
    const records = loadRecords();
    const normalized = LabSchema.normalizeExperiment(record);
    const index = records.findIndex((item) => item.id === normalized.id);

    if (index >= 0) {
      records[index] = normalized;
    } else {
      records.unshift(normalized);
    }

    saveRecords(records);
    return normalized;
  }

  function deleteRecord(id) {
    const filtered = loadRecords().filter((item) => item.id !== id);
    saveRecords(filtered);
    return filtered;
  }

  function clearRecords() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function downloadText(filename, text, mimeType = "text/plain") {
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

  function exportJson(records) {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "thin-film-research-notebook",
      version: LabSchema.STORAGE_VERSION,
      records,
    };
    downloadText(`thin-film-records-${date}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function escapeCsv(value) {
    const text = value === undefined || value === null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv(records) {
    const headers = [
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
      "xrdFiles",
      "afmSummary",
      "afmFiles",
      "tags",
      "notes",
      "createdAt",
      "updatedAt",
    ];

    const lines = [headers.join(",")];
    records.forEach((record) => {
      lines.push(
        headers
          .map((header) => {
            if (header === "xrdFiles" || header === "afmFiles") {
              return escapeCsv((record[header] || []).map((file) => file.name).join("; "));
            }
            return escapeCsv(record[header]);
          })
          .join(",")
      );
    });

    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    downloadText(`thin-film-records-${date}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function importJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const incoming = Array.isArray(parsed) ? parsed : parsed.records;
          if (!Array.isArray(incoming)) {
            throw new Error("JSON 안에 records 배열이 없습니다.");
          }
          const existing = loadRecords();
          const byId = new Map(existing.map((record) => [record.id, record]));
          incoming.map(LabSchema.normalizeExperiment).forEach((record) => byId.set(record.id, record));
          const merged = saveRecords(Array.from(byId.values()));
          resolve(merged);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  return {
    STORAGE_KEY,
    loadRecords,
    saveRecords,
    upsertRecord,
    deleteRecord,
    clearRecords,
    exportJson,
    exportCsv,
    importJsonFile,
  };
})();
