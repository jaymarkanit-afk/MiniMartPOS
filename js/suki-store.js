"use strict";

/* =========================================================
   SUKI CUSTOMER STORE
   The only code that reads or writes the customer list.
========================================================= */

(() => {
  const STORAGE_KEY = "miniMartSukis";
  const PREMIGRATION_PREFIX = `${STORAGE_KEY}__premigration_`;
  const UNUSABLE_PREFIX = `${STORAGE_KEY}__unusable_`;
  const POINTS_BACKUP_PREFIX = `${STORAGE_KEY}__pointsBackup_`;
  // Stays false until the owner has checked the preview numbers and approved them.
  const SUKI_MIGRATION_ENABLED = false;
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
        normalizeCardCode(record.cardCode) ||
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
      // Only customers with a USB card have this field, so other records stay identical.
      ...("cardCode" in record ? { cardCode: normalizeCardCode(record.cardCode) } : {}),
      stamps: amount(record.stamps),
      // Only records waiting for the migration still carry the old balance.
      ...("rewardBalance" in record ? { rewardBalance: amount(record.rewardBalance) } : {}),
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

  function addEntry(record, entry) {
    const stamps = Math.max(0, record.stamps + entry.pointsChange);
    const next = {
      ...record,
      stamps,
      history: [...record.history, { date: new Date().toISOString(), ...entry, stampsAfter: stamps }],
    };
    // Until the migration runs, the old balance keeps its gap from the points.
    if ("rewardBalance" in record) {
      const pesos = entry.pointsChange * window.miniMartSukiRules.settings().pesoValue;
      next.rewardBalance = Math.max(0, window.miniMartDB.roundMoney(record.rewardBalance + pesos));
    }
    return next;
  }

  // Expiry is only worked out on read. This writes it, the next time the customer is written.
  function settleExpiry(record) {
    const rules = window.miniMartSukiRules;
    if (!(record.stamps > 0) || !rules.isExpired(rules.pointsEntryDate(record))) return record;
    return addEntry(record, {
      type: "Points expired",
      kind: "expire",
      description: `${record.stamps} points expired`,
      pointsExpired: record.stamps,
      pointsChange: -record.stamps,
    });
  }

  function pointsEntry(record, change) {
    const rules = window.miniMartSukiRules;
    const details = change.details || {};
    if (change.kind === "earn") {
      const earned = Math.min(Number(change.points) || 0, Math.max(0, rules.maxPoints() - record.stamps));
      const spent = Math.min(Number(change.spent) || 0, record.stamps + earned);
      return {
        type: "Purchase",
        ...details,
        kind: "earn",
        saleId: change.saleId ?? null,
        stampsEarned: earned,
        pointsSpent: spent,
        pointsChange: earned - spent,
      };
    }
    if (change.kind === "redeem") {
      const spent = Math.min(Number(change.points) || 0, record.stamps);
      return {
        type: "Reward redeemed",
        ...details,
        kind: "redeem",
        saleId: change.saleId ?? null,
        stampsEarned: 0,
        pointsSpent: spent,
        pointsChange: -spent,
      };
    }
    if (change.kind === "void-reverse") {
      const earned = Number(change.earned) || 0;
      const spent = Number(change.spent) || 0;
      const after = record.stamps + spent - earned;
      return {
        type: "Sale voided",
        ...details,
        kind: "void-reverse",
        saleId: change.saleId,
        pointsReversed: earned,
        pointsReturned: spent,
        shortfall: Math.max(0, -after),
        pointsChange: Math.max(0, after) - record.stamps,
      };
    }
    if (change.kind === "correction") {
      return {
        type: "Balance correction",
        ...details,
        kind: "correction",
        oldStamps: change.oldStamps,
        oldRewardBalance: change.oldRewardBalance,
        newStamps: change.newStamps,
        pointsChange: change.pointsChange,
      };
    }
    return null;
  }

  // The only code that changes points or adds history. Both go in one write.
  // kind is earn, redeem, expire, void-reverse or correction. A sale that both earns and
  // spends is one earn with spent set, so it stays one history entry.
  function applyPointsChange(id, change) {
    const problem = migrate();
    if (problem) return refuse(problem);
    const { records } = normalizeList(loadStored().list);
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return refuse("That customer could not be found, so nothing was saved.");
    if (
      change.kind === "void-reverse" &&
      records[index].history.some((entry) => entry.kind === "void-reverse" && entry.saleId === change.saleId)
    ) {
      return { ok: true, error: null, reason: null, suki: records[index], entry: null };
    }
    let next = settleExpiry(records[index]);
    const entry = change.kind === "expire" ? null : pointsEntry(next, change);
    if (change.kind !== "expire" && !entry) return refuse("That points change is not valid, so nothing was saved.");
    if (entry) next = addEntry(next, entry);
    records[index] = next;
    return { ...writeRecords(records), suki: next, entry: next.history.at(-1) };
  }

  // The first customer holding a card code that a later customer also holds.
  function sharedCardOwner(records) {
    const owners = new Map();
    for (const { cardCode, name } of records) {
      if (!cardCode) continue;
      if (owners.has(cardCode)) return owners.get(cardCode);
      owners.set(cardCode, name);
    }
    return null;
  }

  function findByCardCode(code) {
    const cardCode = normalizeCardCode(code);
    if (!cardCode) return null;
    return normalizeList(loadStored().list).records.find((record) => record.cardCode === cardCode) || null;
  }

  function setCardCode(id, code) {
    const cardCode = normalizeCardCode(code);
    if (!cardCode) return refuse("That card code is not valid, so nothing was saved.");
    const owner = findByCardCode(cardCode);
    if (owner && owner.id !== id) return refuse(`This card is already registered to ${owner.name}.`);
    const sukis = read();
    const suki = sukis.find((record) => record.id === id);
    if (!suki) return refuse("That customer could not be found, so nothing was saved.");
    suki.cardCode = cardCode;
    return save(sukis);
  }

  function clearCardCode(id) {
    const sukis = read();
    const suki = sukis.find((record) => record.id === id);
    if (!suki) return refuse("That customer could not be found, so nothing was saved.");
    delete suki.cardCode;
    return save(sukis);
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
    const cardOwner = sharedCardOwner(records);
    if (cardOwner) return refuse(`This card is already registered to ${cardOwner}.`);
    // Points and history stay as stored: only applyPointsChange changes them, and a
    // stale tab must not undo them.
    const stored = new Map(storedRecords.map((record) => [record.id, record]));
    return writeRecords(records.map((record) => {
      const current = stored.get(record.id);
      if (!current) return record;
      const kept = { ...record, stamps: current.stamps, history: current.history };
      if ("rewardBalance" in current) kept.rewardBalance = current.rewardBalance;
      return JSON.stringify(kept) === JSON.stringify(current) ? kept : settleExpiry(kept);
    }));
  }

  function remove(id) {
    const problem = migrate();
    if (problem) return refuse(problem);
    const { records } = normalizeList(loadStored().list);
    return writeRecords(records.filter((record) => record.id !== id));
  }

  function migrateRecord(record) {
    const rules = window.miniMartSukiRules;
    const { rewardBalance, ...rest } = record;
    const stamps = Math.max(rest.stamps, rules.pointsForPesos(rewardBalance));
    const next = { ...rest, stamps };
    const gap = stamps - rules.historyPoints(next);
    if (gap === 0) return next;
    return {
      ...next,
      history: [...next.history, {
        date: new Date().toISOString(),
        ...pointsEntry(next, {
          kind: "correction",
          oldStamps: rest.stamps,
          oldRewardBalance: rewardBalance,
          newStamps: stamps,
          pointsChange: gap,
          details: { description: "Points corrected when the balance moved to points" },
        }),
        stampsAfter: stamps,
      }],
    };
  }

  // Moves each old balance into points, keeping the higher value. A record is finished
  // once it has no rewardBalance, so a second run changes nothing, and a restored old
  // backup migrates cleanly. The raw list is saved first, or nothing happens.
  function runPointsMigration() {
    const problem = migrate();
    if (problem) return { ...refuse(problem), changed: 0 };
    const stored = loadStored();
    const { records } = normalizeList(stored.list);
    const pending = records.filter((record) => "rewardBalance" in record);
    if (!pending.length) return { ok: true, error: null, reason: null, changed: 0, pointsAdded: 0 };
    if (!safeWrite(`${POINTS_BACKUP_PREFIX}${Date.now()}`, stored.raw, { raw: true }).ok) {
      return { ...refuse(BACKUP_FAILED_MESSAGE), changed: 0 };
    }
    const migrated = records.map((record) => ("rewardBalance" in record ? migrateRecord(record) : record));
    const result = writeRecords(migrated);
    if (!result.ok) return { ...result, changed: 0 };
    const pointsAdded = migrated.reduce((sum, record, index) => sum + record.stamps - records[index].stamps, 0);
    console.info(`Mini Mart Suki points: moved ${pending.length} customers, ${pointsAdded} points added.`);
    return { ...result, changed: pending.length, pointsAdded };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `suki-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  window.miniMartSukiStore = {
    STORAGE_KEY,
    read,
    save,
    remove,
    createId,
    applyPointsChange,
    findByCardCode,
    setCardCode,
    clearCardCode,
    runPointsMigration,
    migrationEnabled: SUKI_MIGRATION_ENABLED,
  };

  const startupProblem = migrate();
  if (startupProblem) showStorageError(startupProblem);
  else if (SUKI_MIGRATION_ENABLED) runPointsMigration();
})();
