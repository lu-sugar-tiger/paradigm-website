import { writeFile } from "node:fs/promises";
import { reference } from "./lib/pricing-config.mjs";
import { previousTaipeiMonth, fetchMonthlyReference, refreshDecision } from "./lib/pricing-fx.mjs";

const month = previousTaipeiMonth();
if (reference.month >= month) {
  console.log(`Retaining published ${reference.month} reference (${reference.twdPerUsd} TWD/USD).`);
} else {
  // A failed fetch or invalid response exits unsuccessfully before any write.
  const candidate = await fetchMonthlyReference(month);
  if (refreshDecision(reference, candidate, month) === "retain") {
    console.log(`${month} is not published yet; retaining ${reference.month} reference.`);
  } else if (process.argv.includes("--check")) {
    console.log(`Available update: ${JSON.stringify(candidate)}`);
  } else {
    await writeFile(new URL("../data/pricing-reference.json", import.meta.url), `${JSON.stringify(candidate, null, 2)}\n`);
    console.log(`Prepared ${month} reference (${candidate.twdPerUsd} TWD/USD). Rebuild and review before publishing.`);
  }
}
