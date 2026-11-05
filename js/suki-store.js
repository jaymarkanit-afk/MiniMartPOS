"use strict";

/* =========================================================
   SUKI CUSTOMER STORE
   The only code that reads or writes the customer list.
========================================================= */

(() => {
  const STORAGE_KEY = "miniMartSukis";
  const PREMIGRATION_PREFIX = `${STORAGE_KEY}__premigration_`;
  const UNUSABLE_PREFIX = `${STORAGE_KEY}__unusable_`;
  const UNREADABLE_MESSAGE =
    "The customer list could not be read, so nothing was saved. Your stored data was not changed.";
  const BACKUP_FAILED_MESSAGE =
    "Customer records could not be upgraded because their backup failed. Nothing was changed.";

  let lastReadIds = new Set();

  function text(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function amount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function hasContent(record) {
    return Boolean(record) &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      Boolean(
        text(record.name).trim() ||
        text(record.phone).trim() ||
        text(record.nfcId).trim() ||
        amount(record.stamps) ||
        amount(record.rewardBalance) ||
        record.history?.length,
      );
  }

  // List position is left out so reordering cannot change a customer's id.
  function legacyIdBase(record) {
    const source = [
      text(record.name).trim(),
      text(record.phone).trim(),
      text(record.joined).trim(),
      window.normalizeNfcId(record.nfcId),
    ].join("|");
    const hash = [...source].reduce(
      (value, character) => (value * 31 + character.charCodeAt(0)) | 0,
      0,
    );
    return `suki-legacy-${Math.abs(hash)}`;
  }

  function nextUnusedId(base, usedIds) {
    let id = base;
    for (let count = 2; usedIds.has(id); count += 1) id = `${base}-${count}`;
    usedIds.add(id);
    return id;
  }

  function normalizeRecord(record, id) {
    return {
      ...record,
      id,
      name: text(record.name),
      phone: text(record.phone),
      joined: text(record.joined),
      nfcId: window.normalizeNfcId(record.nfcId),
      stamps: amount(record.stamps),
      rewardBalance: amount(record.rewardBalance),
      active: record.active !== false,
      history: Array.isArray(record.history) ? record.history : [],
    };
  }

  // Works per record: one bad entry can never affect its neighbours.
  function normalizeList(list) {
    const usable = list.filter(hasContent);
    const usedIds = new Set();
    const storedIds = usable.map((record) => {
      const id = text(record.id);
      if (!id || usedIds.has(id)) return "";
      usedIds.add(id);
      return id;
    });
    return {
      records: usable.map((record, index) => normalizeRecord(
        record,
        storedIds[index] || nextUnusedId(legacyIdBase(record), usedIds),
      )),
      unusable: list.filter((record) => !hasContent(record)),
    };
  }

  function loadStored() {
    const result = window.miniMartDB.readStorage(STORAGE_KEY, [], Array.isArray);
    return {
      readable: result.status === "ok" || result.status === "missing",
      list: result.value,
      raw: result.raw,
    };
  }

  function saveOneTimeBackup(prefix, raw) {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix) && localStorage.getItem(key) === raw) return true;
    }
    return safeWrite(`${prefix}${Date.now()}`, raw, { raw: true }).ok;
  }

  // Returns an error message, or "" when the stored list is safe to replace.
  function migrate() {
    const stored = loadStored();
    if (!stored.readable) return UNREADABLE_MESSAGE;
    const { records, unusable } = normalizeList(stored.list);
    if (!unusable.length && JSON.stringify(records) === JSON.stringify(stored.list)) return "";
    if (
      !saveOneTimeBackup(PREMIGRATION_PREFIX, stored.raw) ||
      (unusable.length && !saveOneTimeBackup(UNUSABLE_PREFIX, JSON.stringify(unusable)))
    ) {
      return BACKUP_FAILED_MESSAGE;
    }
    const result = safeWrite(STORAGE_KEY, records);
    return result.ok ? "" : storageErrorMessage(result);
  }

  function refuse(message) {
    showStorageError(message);
    return { ok: false, error: new Error(message), reason: "refused" };
  }

  function writeRecords(records) {
    const result = safeWrite(STORAGE_KEY, records);
    if (!result.ok) {
      showStorageError(storageErrorMessage(result));
      return result;
    }
    lastReadIds = new Set(records.map((record) => record.id));
    return result;
  }

  function read() {
    const { records } = normalizeList(loadStored().list);
    lastReadIds = new Set(records.map((record) => record.id));
    return records;
  }

  // Use remove() to delete. This refuses any list that loses a customer.
  function save(sukis) {
    if (!Array.isArray(sukis)) return refuse("The customer list is not valid, so nothing was saved.");
    const problem = migrate();
    if (problem) return refuse(problem);
    const { records, unusable } = normalizeList(sukis);
    if (unusable.length) return refuse("A customer record is empty, so nothing was saved.");
    const nextIds = new Set(records.map((record) => record.id));
    const storedRecords = normalizeList(loadStored().list).records;
    const lost = new Set(
      [...lastReadIds, ...storedRecords.map((record) => record.id)].filter((id) => !nextIds.has(id)),
    );
    if (lost.size) {
      return refuse(
        `${lost.size} customer record${lost.size === 1 ? "" : "s"} would have been lost, so nothing was saved.`,
      );
    }
    return writeRecords(records);
  }

  function remove(id) {
    const problem = migrate();
    if (problem) return refuse(problem);
    const { records } = normalizeList(loadStored().list);
    return writeRecords(records.filter((record) => record.id !== id));
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `suki-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  window.miniMartSukiStore = { STORAGE_KEY, read, save, remove, createId };

  const startupProblem = migrate();
  if (startupProblem) showStorageError(startupProblem);
})();
