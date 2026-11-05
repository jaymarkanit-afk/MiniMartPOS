"use strict";

// Most points a customer can earn or spend. Earning stops at this limit.
const MAX_POINTS = 40;
const MAX_REWARD_BALANCE = 200;

function normalizedSukiSettings() {
  const settings = window.miniMartSettings?.get?.() || {};
  const positive = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };
  const nonNegativeInteger = (value, fallback) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : fallback;
  };
  return {
    enabled: settings.sukiEnabled !== false,
    pesosPerPoint: positive(settings.sukiPesosPerPoint, 20),
    pesoValue: positive(settings.sukiPesoValue, 1),
    minPointsToRedeem: nonNegativeInteger(settings.sukiMinPointsToRedeem, 10),
    expiryMode: settings.sukiPointsExpiry === "days" ? "days" : "none",
    expiryDays: positive(settings.sukiPointsExpiryDays, 90),
  };
}

function pointsEarned(totalAmount) {
  const rules = normalizedSukiSettings();
  const amount = Number(totalAmount);
  if (!rules.enabled || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(0, Math.floor(amount / rules.pesosPerPoint));
}

function pesoValueOfPoints(points) {
  const rules = normalizedSukiSettings();
  const amount = Number(points);
  if (!rules.enabled || !Number.isFinite(amount) || amount <= 0) return 0;
  return roundMoney(amount * rules.pesoValue);
}

function canRedeem(points) {
  const rules = normalizedSukiSettings();
  const amount = Number(points);
  return rules.enabled &&
    Number.isFinite(amount) &&
    amount >= rules.minPointsToRedeem;
}

function expiryDate(pointsEntryDate, now = new Date()) {
  const rules = normalizedSukiSettings();
  if (rules.expiryMode !== "days") return null;
  // No earn history and no joined date means no expiry: missing data never removes points.
  if (pointsEntryDate === null || pointsEntryDate === undefined) return null;
  const entryDate = new Date(pointsEntryDate);
  if (Number.isNaN(entryDate.getTime())) return null;
  const date = new Date(entryDate);
  date.setDate(date.getDate() + rules.expiryDays);
  return date;
}

function isExpired(pointsEntryDate, now = new Date()) {
  const date = expiryDate(pointsEntryDate, now);
  return Boolean(date && date.getTime() <= new Date(now).getTime());
}

function maxRedeemAmount(points, cartTotal) {
  const total = Number(cartTotal);
  if (!canRedeem(points) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(pesoValueOfPoints(points), roundMoney(total));
}

function pointsEntryDate(suki) {
  const dates = (Array.isArray(suki?.history) ? suki.history : [])
    .filter((entry) => Number(entry.stampsEarned) > 0 && entry.date)
    .map((entry) => new Date(entry.date))
    .filter((date) => !Number.isNaN(date.getTime()));
  const joined = new Date(suki?.joined || "");
  return dates.sort((first, second) => second - first)[0] ||
    (Number.isNaN(joined.getTime()) ? null : joined);
}

function usablePoints(suki, now = new Date()) {
  const points = Number(suki?.stamps);
  if (!Number.isFinite(points) || points <= 0 || isExpired(pointsEntryDate(suki), now)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_POINTS, points));
}

window.miniMartSukiRules = {
  maxPoints: () => MAX_POINTS,
  maxRewardBalance: () => MAX_REWARD_BALANCE,
  settings: normalizedSukiSettings,
  pointsEarned,
  pesoValueOfPoints,
  canRedeem,
  expiryDate,
  isExpired,
  maxRedeemAmount,
  pointsEntryDate,
  usablePoints,
};
