import assert from "node:assert/strict";
import { FX_SOURCE, FX_METHOD, validateReference } from "./pricing-config.mjs";

export function previousTaipeiMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" }).formatToParts(now);
  let year = Number(parts.find((part) => part.type === "year").value);
  let month = Number(parts.find((part) => part.type === "month").value) - 1;
  if (month === 0) { year -= 1; month = 12; }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function referenceForMonth(rows, month) {
  assert.ok(Array.isArray(rows) && rows.length > 0, "Monthly FX response must be a non-empty array");
  assert.match(month, /^\d{4}-(?:0[1-9]|1[0-2])$/);
  const seen = new Set();
  for (const row of rows) {
    assert.ok(row && typeof row["西元年月"] === "string" && /^\d{4}(?:0[1-9]|1[0-2])$/.test(row["西元年月"]), "Malformed monthly FX record");
    assert.ok(!seen.has(row["西元年月"]), "Duplicate monthly FX records");
    seen.add(row["西元年月"]);
    assert.ok(typeof row.NTD_USD === "string" && /^\d+(?:\.\d+)?$/.test(row.NTD_USD) && Number.isFinite(Number(row.NTD_USD)) && Number(row.NTD_USD) > 0, "Malformed official monthly FX rate");
  }
  const matches = rows.filter((row) => row?.["西元年月"] === month.replace("-", ""));
  assert.ok(matches.length <= 1, "Duplicate monthly FX records");
  if (!matches.length) return null;
  const rate = matches[0].NTD_USD;
  assert.ok(typeof rate === "string" && /^\d+(?:\.\d+)?$/.test(rate), "Malformed official monthly FX rate");
  return validateReference({ month, twdPerUsd: Number(rate), source: FX_SOURCE, method: FX_METHOD });
}

export async function fetchMonthlyReference(month, fetcher = fetch) {
  const response = await fetcher(FX_SOURCE, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Monthly FX request failed: HTTP ${response.status}`);
  return referenceForMonth(await response.json(), month);
}

export function refreshDecision(current, candidate, targetMonth) {
  validateReference(current);
  if (current.month >= targetMonth || !candidate) return "retain";
  validateReference(candidate);
  assert.equal(candidate.month, targetMonth, "Only the previous calendar month can replace the reference");
  return "update";
}
