import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import core from "../assets/js/pricing-core.js";
import { reference, storefronts, pricingConfigVersion, validateReference } from "./lib/pricing-config.mjs";
import { previousTaipeiMonth, referenceForMonth, refreshDecision, fetchMonthlyReference } from "./lib/pricing-fx.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const json = async (file) => JSON.parse(await read(file));
const fx = { twdPerUsd: 31.716 };
for (const [twd, usd] of [[0, 0], [1, 5], [115, 5], [116, 9], [285, 9], [286, 15], [300, 15], [400, 15], [590, 19], [790, 29], [990, 39], [1180, 39], [1580, 59], [1780, 59], [1980, 69]]) {
  assert.equal(core.usdPrice(twd, fx.twdPerUsd), usd, `USD price for ${twd}`);
}
assert.equal(core.usdPrice(140, 11), 19, "Exact anchor 14 tie must choose 19");
assert.equal(core.usdPrice(40, 11), 9, "Exact anchor 4 tie between internal -1 and 9 goes upward");
assert.equal(core.usdPrice(39, 11), 5, "Internal -1 fails the positive floor and falls back to 5");
assert.equal(core.usdPrice(9, 1), 9, "Candidate equal to the domestic floor is allowed");
assert.equal(core.usdPrice(9.0001, 1), 15, "A candidate just below the floor must fall back");
assert.equal(core.usdPrice(130, 11), 15, "Fallback must exceed the unrounded anchor 13");
assert.equal(core.usdPrice(150, 11), 19, "Anchor ending in 5 still selects its nearest 9");
assert.equal(core.usdPrice(151, 11), 19, "Nearest 9 can be below the anchor while respecting the floor");
assert.equal(core.effectiveTwdPrice({ salePrice: 400, listPrice: 590 }), 400);
assert.equal(core.effectiveTwdPrice({ salePrice: null, listPrice: 590 }), 590);
assert.equal(core.effectiveTwdPrice({ salePrice: 0, listPrice: 590 }), 0);
assert.equal(core.formatPrice(1580, "TWD"), "NT$1,580");
assert.equal(core.formatPrice(1580, "USD", fx), "$59");
assert.equal(core.formatPrice(100000, "USD", { twdPerUsd: 100 }), "$1,099");
assert.equal(core.formatPrice(0, "USD", fx), "$0");
for (const [base, surcharge, usd] of [[1580, 0, 59], [1580, 50, 69], [1580, 100, 69], [1580, 200, 69], [1580, 400, 79], [400, 0, 15], [0, 50, 5], [0, 400, 15], [0, 0, 0]]) {
  assert.equal(core.usdPriceWithSurcharge(base, surcharge, fx.twdPerUsd), usd, `Grouped USD price for ${base} + ${surcharge}`);
  assert.equal(core.formatPrice(base, "USD", fx, surcharge), `$${usd}`);
}
assert.equal(core.formatPrice(1580, "TWD", fx, 400), "NT$1,980");
assert.equal(core.usdPriceWithSurcharge(core.effectiveTwdPrice({ listPrice: 1580, salePrice: 400 }), 0, fx.twdPerUsd), 15);
assert.equal(core.usdPriceWithSurcharge(core.effectiveTwdPrice({ listPrice: 1580, salePrice: 0 }), 50, fx.twdPerUsd), 5);
assert.equal(core.usdPriceWithSurcharge(0.1, 0.2, 0.03), 19, "Decimal groups produce 5 + 9; the exact final tie goes upward");
for (const invalid of [-1, NaN, Infinity, "200", undefined]) assert.throws(() => core.usdPriceWithSurcharge(1580, invalid, 32));
assert.throws(() => core.formatPrice(1580, "TWD", fx, -200), "Discount policy is deferred for both markets");
assert.throws(() => core.usdPriceWithSurcharge(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1));
// Increasing a surcharge must not reduce a quote; every result must cover its
// unrounded domestic floor. Integer cross-products avoid float tolerance here.
let previousPrice = 0;
for (let twd = 0; twd <= 20000; twd += 1) {
  const usd = core.usdPrice(twd, fx.twdPerUsd);
  assert.ok(usd >= previousPrice, `First-pass price decreased at ${twd}`);
  assert.ok(BigInt(usd) * 31716n >= BigInt(twd) * 1000n, `First-pass floor failed at ${twd}`);
  previousPrice = usd;
}
for (const base of [0, 1, 50, 115, 116, 286, 400, 1580, 10000]) {
  let previous = core.usdPrice(base, fx.twdPerUsd);
  for (let surcharge = 0; surcharge <= 2000; surcharge += 1) {
    const usd = core.usdPriceWithSurcharge(base, surcharge, fx.twdPerUsd);
    assert.ok(usd >= previous, `Surcharge decreased ${base} + ${surcharge}`);
    assert.ok(BigInt(usd) * 31716n >= BigInt(base + surcharge) * 1000n, `Grouped floor failed ${base} + ${surcharge}`);
    previous = usd;
  }
}
for (const invalid of [-1, NaN, Infinity, "590", undefined]) assert.throws(() => core.usdPrice(invalid, 32));
for (const invalid of [0, -1, NaN, Infinity, "32"]) assert.throws(() => core.usdPrice(590, invalid));
assert.throws(() => core.formatPrice(590, "EUR", fx));
assert.throws(() => validateReference({ ...reference, twdPerUsd: 0 }));

assert.equal(previousTaipeiMonth(new Date("2025-12-31T16:00:00Z")), "2025-12", "Taipei year rollover");
assert.equal(previousTaipeiMonth(new Date("2026-09-30T15:59:59Z")), "2026-08");
assert.equal(previousTaipeiMonth(new Date("2026-09-30T16:00:00Z")), "2026-09");
const rows = [{ 西元年月: "202609", NTD_USD: "31.716" }, { 西元年月: "202610", NTD_USD: "32.000" }];
const candidate = referenceForMonth(rows, "2026-09");
assert.equal(candidate.twdPerUsd, 31.716);
assert.equal((await fetchMonthlyReference("2026-09", async () => ({ ok: true, json: async () => rows }))).twdPerUsd, 31.716);
await assert.rejects(fetchMonthlyReference("2026-09", async () => { throw new Error("Network failure"); }), /Network failure/);
await assert.rejects(fetchMonthlyReference("2026-09", async () => ({ ok: false, status: 503 })), /HTTP 503/);
await assert.rejects(fetchMonthlyReference("2026-09", async () => ({ ok: true, json: async () => { throw new Error("Invalid JSON"); } })), /Invalid JSON/);
assert.equal(referenceForMonth(rows, "2026-08"), null, "Missing month must not borrow a future month");
assert.equal(refreshDecision({ ...candidate, month: "2026-08" }, null, "2026-09"), "retain");
assert.equal(refreshDecision({ ...candidate, month: "2026-08" }, candidate, "2026-09"), "update");
assert.equal(refreshDecision(candidate, { ...candidate, twdPerUsd: 33 }, "2026-09"), "retain", "Freeze the reviewed month");
assert.throws(() => refreshDecision({ ...candidate, month: "2026-08" }, { ...candidate, month: "2026-10" }, "2026-09"));
for (const malformed of [null, {}, [], [{}], [...rows, rows[0]], [{ 西元年月: "202609", NTD_USD: "0" }], [{ 西元年月: "202609", NTD_USD: "31.716oops" }]]) {
  assert.throws(() => referenceForMonth(malformed, "2026-09"));
}

const browserCore = {};
vm.runInNewContext(await read("assets/js/pricing-core.js"), browserCore);
assert.equal(browserCore.PARADIGM_PRICING_CORE.formatPrice(1580, "USD", fx), "$59");
assert.equal(browserCore.PARADIGM_PRICING_CORE.formatPrice(1580, "USD", fx, 400), "$79");
const catalog = await read("assets/js/catalog.js");
const context = { window: {} };
vm.runInNewContext(catalog, context);
const products = context.window.PARADIGM_CATALOG.items;
const source = await json("data/products-source.json");
for (const product of products) {
  const item = source.items.find((entry) => entry.code === product.code);
  const twd = core.effectiveTwdPrice(item);
  assert.equal(core.effectiveTwdPrice(product), twd);
  assert.equal(product.priceLabel, core.formatPrice(twd));
  const page = await read(`products/${product.code}/index.html`);
  assert.ok(page.includes(`data-product-price data-price-twd="${twd}"`));
  assert.ok(page.includes(`pricing-config.js?v=${pricingConfigVersion}`));
  assert.ok(page.indexOf("pricing-config.js") < page.indexOf("language-preference.js"));
  assert.ok(page.indexOf("pricing.js?") < page.indexOf("search.js?"));
}
const search = await json("assets/data/search-index.json");
for (const product of search.items) {
  assert.equal(product.priceTwd, core.effectiveTwdPrice(products.find((item) => item.code === product.code)));
}
const model = (await json("data/teamwear-options.json")).models[0];
assert.equal(core.formatPrice(model.price, "USD", fx, 200 + 200), "$79", "Group adjustments, price separately, then round their USD sum");
for (const entry of [model, ...model.quantities, ...model.addOns]) {
  const price = entry.price ?? entry.priceAdjustment;
  assert.ok(typeof price === "number" && Number.isFinite(price) && price >= 0, "Teamwear discounts remain deferred");
}
const landing = await read("teamwear/index.html");
assert.ok(landing.includes(`From <span data-price-twd="${model.price}">${core.formatPrice(model.price)}</span>.`));
assert.deepEqual(storefronts.options.map((option) => [option.value, option.market, storefronts.markets[option.market].currency]), [
  ["zh-TWD", "taiwan", "TWD"], ["en-TWD", "taiwan", "TWD"], ["en-USD", "international", "USD"]
]);
console.log("PRICING_OK rounding=true internalNegativeCandidate=true surchargeGrouping=true zeroGroups=true monotonic=true floor=true salePrecedence=true browserCore=true handles=true fxCalendar=true malformedData=true networkFailure=true");
