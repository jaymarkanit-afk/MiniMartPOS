// Read-only preview of the Suki points migration. Changes nothing.
(() => {
  const LARGE_GAP_PESOS = 20;
  const sukis = JSON.parse(localStorage.getItem("miniMartSukis") || "[]");
  const settings = JSON.parse(localStorage.getItem("miniMartSettings") || "{}");
  const pesoValue = Number(settings.sukiPesoValue) > 0 ? Number(settings.sukiPesoValue) : 1;
  const expiryOn = settings.sukiPointsExpiry === "days";
  const expiryDays = Number(settings.sukiPointsExpiryDays) > 0 ? Number(settings.sukiPointsExpiryDays) : 90;
  const money = (value) => Math.round(value * 100) / 100;
  const now = new Date();
  let undated = 0;
  const rows = sukis.map((customer) => {
    const stamps = Number(customer.stamps) || 0;
    const rewardBalance = Number(customer.rewardBalance) || 0;
    const history = Array.isArray(customer.history) ? customer.history : [];
    const balancePoints = Math.ceil(Math.round((rewardBalance / pesoValue) * 1e6) / 1e6);
    const newPoints = Math.max(stamps, balancePoints);
    const historySum = history.reduce(
      (sum, entry) => sum + (Number(entry.stampsEarned) || 0) - Math.ceil((Number(entry.rewardUsed) || 0) / pesoValue),
      0,
    );
    const earnDates = history
      .filter((entry) => Number(entry.stampsEarned) > 0 && entry.date)
      .map((entry) => new Date(entry.date))
      .filter((date) => !Number.isNaN(date.getTime()));
    const joined = new Date(customer.joined || "");
    const lastDate = earnDates.sort((a, b) => b - a)[0] || (Number.isNaN(joined.getTime()) ? null : joined);
    if (lastDate === null) undated += 1;
    const expires = new Date(lastDate || 0);
    expires.setDate(expires.getDate() + expiryDays);
    return {
      name: customer.name || "(no name)",
      id: customer.id || "(no id)",
      stamps,
      rewardBalance,
      expectedBalance: money(stamps * pesoValue),
      gapPesos: money(rewardBalance - stamps * pesoValue),
      newPoints,
      pointsAdded: newPoints - stamps,
      overCap: newPoints > 40,
      historySum,
      historyAddsUp: historySum === newPoints,
      lastEarned: lastDate ? lastDate.toISOString().slice(0, 10) : "none",
      // No earn history and no joined date means no expiry: missing data never removes points.
      wouldExpire: lastDate !== null && newPoints > 0 && expires.getTime() <= now.getTime(),
    };
  });
  const disagree = rows.filter((row) => row.gapPesos !== 0);
  const largeGaps = disagree.filter((row) => Math.abs(row.gapPesos) >= LARGE_GAP_PESOS);
  const expiring = rows.filter((row) => row.wouldExpire);
  const report = {
    customers: rows.length,
    pesoValuePerPoint: pesoValue,
    disagree: disagree.length,
    totalGapPesos: money(disagree.reduce((sum, row) => sum + row.gapPesos, 0)),
    pointsAddedByHigherValue: rows.reduce((sum, row) => sum + row.pointsAdded, 0),
    pesoValueAdded: money(rows.reduce((sum, row) => sum + row.pointsAdded, 0) * pesoValue),
    aboveCap: rows.filter((row) => row.overCap).length,
    needBalanceCorrectionEntry: rows.filter((row) => !row.historyAddsUp).length,
    expiry: { turnedOn: expiryOn, days: expiryDays, customers: expiring.length, customersWithNoDates: undated, points: expiring.reduce((sum, row) => sum + row.newPoints, 0) },
    largeGaps: largeGaps.map(({ name, id, stamps, rewardBalance, gapPesos, newPoints }) => ({ name, id, stamps, rewardBalance, gapPesos, newPoints })),
    wouldLosePoints: expiring.map(({ name, id, newPoints, lastEarned }) => ({ name, id, points: newPoints, lastEarned })),
  };
  console.log(`${report.disagree} of ${report.customers} customers disagree. Total gap ₱${report.totalGapPesos}.`);
  console.log(`Large gaps (₱${LARGE_GAP_PESOS}+):`);
  console.table(report.largeGaps);
  console.log(`Expiry is ${expiryOn ? "ON" : "OFF"} (${expiryDays} days). Would lose points:`);
  console.table(report.wouldLosePoints);
  console.log("Paste everything below this line:");
  console.log(JSON.stringify(report, null, 1));
  return report;
})();
