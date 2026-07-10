/*
 * Local persistence and import/export helpers.
 * The app is static GitHub Pages friendly, so it stores records in browser localStorage.
 */

const LabStorage = (() => {
  const STORAGE_KEY = "thin-film-research-notebook-v1";
  const BACKUP_META_KEY = "thin-film-research-backup-meta-v1";

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((record) => LabSchema.normalizeExperiment(record, { touchUpdatedAt: false }));
    } catch (error) {
      console.error("Failed to load records", error);
      return [];
    }
  }

  function saveRecords(records) {
    const normalized = records.map((record) => LabSchema.normalizeExperiment(record, { touchUpdatedAt: false }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized, null, 2));
    return normalized;
  }

  function upsertRecord(record, options = {}) {
    const { touchUpdatedAt = true } = options;
    const records = loadRecords();
    const normalized = LabSchema.normalizeExperiment(record, { touchUpdatedAt });
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

  function getBackupMeta() {
    try {
      const raw = localStorage.getItem(BACKUP_META_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.error("Failed to load backup metadata", error);
      return {};
    }
  }

  function saveBackupMeta(meta) {
    const next = { ...getBackupMeta(), ...meta };
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(next, null, 2));
    return next;
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
    const exportedAt = LabSchema.getIsoTimestamp();
    const stamp = LabSchema.getLocalDateTimeFileStamp();
    const filename = `thin-film-records-${stamp}.json`;
    const payload = {
      exportedAt,
      app: "thin-film-research-notebook",
      version: LabSchema.STORAGE_VERSION,
      records: records.map((record) => LabSchema.normalizeExperiment(record, { touchUpdatedAt: false })),
    };

    downloadText(filename, JSON.stringify(payload, null, 2), "application/json");
    const backupMeta = saveBackupMeta({
      lastExportedAt: exportedAt,
      lastExportType: "JSON",
      lastJsonExportedAt: exportedAt,
      lastJsonFilename: filename,
    });

    return { filename, exportedAt, backupMeta };
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
    const stamp = LabSchema.getLocalDateTimeFileStamp();
    const filename = `thin-film-records-${stamp}.csv`;
    downloadText(filename, lines.join("\n"), "text/csv;charset=utf-8");

    const backupMeta = saveBackupMeta({
      lastExportedAt: exportedAt,
      lastExportType: "CSV",
      lastCsvExportedAt: exportedAt,
      lastCsvFilename: filename,
    });

    return { filename, exportedAt, backupMeta };
  }

  function parseTimestamp(value) {
    if (!value) return 0;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }

  function validateImportPayload(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON 최상위 구조는 records 배열을 포함한 객체여야 합니다.");
    }

    if (!Array.isArray(parsed.records)) {
      throw new Error("JSON 안에 records 배열이 없습니다.");
    }

    return parsed.records;
  }

  function mergeImportedRecords(existingRecords, incomingRecords) {
    const byId = new Map(existingRecords.map((record) => [record.id, record]));
    const summary = {
      added: 0,
      updated: 0,
      skipped: 0,
      invalid: 0,
    };

    incomingRecords.forEach((rawRecord) => {
      if (!rawRecord || typeof rawRecord !== "object" || Array.isArray(rawRecord)) {
        summary.invalid += 1;
        return;
      }

      const incoming = LabSchema.normalizeExperiment(rawRecord, { touchUpdatedAt: false });
      if (!incoming.id) {
        summary.invalid += 1;
        return;
      }

      const existing = byId.get(incoming.id);
      if (!existing) {
        byId.set(incoming.id, incoming);
        summary.added += 1;
        return;
      }

      const incomingTime = parseTimestamp(incoming.updatedAt);
      const existingTime = parseTimestamp(existing.updatedAt);
      if (incomingTime > existingTime) {
        byId.set(incoming.id, incoming);
        summary.updated += 1;
      } else {
        summary.skipped += 1;
      }
    });

    return {
      records: Array.from(byId.values()).sort((a, b) => parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt)),
      summary,
    };
  }

  function importJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const incomingRecords = validateImportPayload(parsed);
          const existingRecords = loadRecords();
          const result = mergeImportedRecords(existingRecords, incomingRecords);
          const saved = saveRecords(result.records);
          resolve({ records: saved, summary: result.summary });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
      reader.readAsText(file);
    });
  }

  return {
    STORAGE_KEY,
    BACKUP_META_KEY,
    loadRecords,
    saveRecords,
    upsertRecord,
    deleteRecord,
    clearRecords,
    getBackupMeta,
    saveBackupMeta,
    exportJson,
    exportCsv,
    importJsonFile,
  };
})();
