import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import core from "../assets/js/pricing-core.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const reference = JSON.parse(await readFile("data/pricing-reference.json", "utf8"));
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4178";
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function checkPrices(page, currency) {
  assert.equal(await page.locator(".product-card__price:not([data-price-twd]), .product-detail__price:not([data-price-twd])").count(), 0);
  const prices = await page.locator("[data-price-twd]").evaluateAll(elements => elements.map(element => ({
    total: Number(element.dataset.priceTwd),
    base: Number(element.dataset.priceBaseTwd ?? element.dataset.priceTwd),
    surcharge: Number(element.dataset.priceSurchargeTwd ?? 0),
    text: element.textContent
  })));
  assert.ok(prices.length, `Missing prices on ${page.url()}`);
  for (const price of prices) {
    assert.equal(price.base + price.surcharge, price.total);
    assert.equal(price.text, core.formatPrice(price.base, currency, reference, price.surcharge), JSON.stringify(price));
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Overflow on ${page.url()}`);
}

async function choose(page, width, value, keyboard = false) {
  const toggle = page.locator(width < 1024 ? "[data-nav-toggle]" : "[data-storefront-toggle]");
  if (keyboard) {
    await toggle.focus();
    await toggle.press("Enter");
  } else await toggle.click();
  await page.waitForFunction(() => document.body.dataset.overlayState === "open");
  const trigger = page.locator(".dropdown:has(#menu-language-native) .dropdown__trigger");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (keyboard) {
    await trigger.focus();
    await trigger.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.closest("#menu-language-list"));
    await page.keyboard.press("Home");
    const index = ["zh-TWD", "en-TWD", "en-USD"].indexOf(value);
    for (let step = 0; step < index; step++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  } else {
    await trigger.click();
    await page.locator(`#menu-language-list [data-value="${value}"]`).click();
  }
  assert.equal(await page.locator("#menu-language-native").inputValue(), value);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.body.dataset.overlayState);
  assert.equal(await page.evaluate(() => window.PARADIGM_STOREFRONT.value), value);
}

async function inquiryPrice(page, expected) {
  await page.evaluate(() => {
    document.execCommand = () => true;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async text => { window.__copiedInquiry = text; }
    } });
    const action = document.querySelector("[data-primary-action]");
    action.addEventListener("click", event => event.preventDefault(), { once: true });
    action.click();
  });
  assert.ok((await page.evaluate(() => window.__copiedInquiry)).includes(`Price: ${expected}`));
  assert.equal(await page.locator("[data-teamwear-price]").textContent(), expected);
}

try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    // Font networking is unrelated to this arithmetic check; local layout and
    // application errors are still checked, as in the localization browser QA.
    await context.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${base}/teamwear/customize/`);
    await page.waitForFunction(() => window.PARADIGM_PRICING);
    await checkPrices(page, "TWD");
    await inquiryPrice(page, "NT$1,580");
    await choose(page, width, "en-USD", true);
    await inquiryPrice(page, "$59");

    await page.locator('[data-choice-id="Q01"]').click();
    await checkPrices(page, "USD");
    await inquiryPrice(page, "$69");
    await page.locator('[data-choice-id="A01"]').click();
    await checkPrices(page, "USD");
    await inquiryPrice(page, "$79");
    for (const value of ["zh-TWD", "en-USD", "en-TWD", "en-USD"]) {
      await choose(page, width, value);
      const currency = value.endsWith("USD") ? "USD" : "TWD";
      await checkPrices(page, currency);
      await inquiryPrice(page, currency === "USD" ? "$79" : "NT$1,980");
    }
    await page.reload();
    await checkPrices(page, "USD");
    await inquiryPrice(page, "$59"); // Options reset; storefront preference persists.
    await page.locator('[data-choice-id="A01"]').click();
    await inquiryPrice(page, "$69");
    await page.locator('[data-choice-id="A01"]').click();
    await inquiryPrice(page, "$59");

    for (const route of ["/", "/collections/tees/", "/collections/hoodies/", "/products/ED14001/", "/teamwear/", "/search/?q=Tee"]) {
      await page.goto(base + route);
      if (route.startsWith("/search")) await page.locator("[data-search-page-results] [data-price-twd]").first().waitFor();
      await checkPrices(page, "USD");
    }
    await choose(page, width, "en-TWD");
    await page.locator("[data-search-toggle]").click();
    await page.waitForFunction(() => document.body.dataset.overlayState === "open");
    await page.locator("[data-search-input]").fill("Hoodie");
    await page.locator("[data-search-results] [data-price-twd]").first().waitFor();
    await checkPrices(page, "TWD");
    await page.locator("[data-search-toggle]").click();
    await page.waitForFunction(() => !document.body.dataset.overlayState);
    await choose(page, width, "en-USD");
    await page.locator("[data-search-toggle]").click();
    await page.locator("[data-search-input]").fill("Everyday");
    await page.locator("[data-search-results] [data-price-twd]").first().waitFor();
    await checkPrices(page, "USD");
    await context.close();
    console.log(`PRICING_BROWSER_WIDTH_OK width=${width}`);
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  await noJs.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  const fallback = await noJs.newPage();
  for (const route of ["/", "/products/ED14001/", "/teamwear/", "/teamwear/customize/"]) {
    await fallback.goto(base + route);
    await checkPrices(fallback, "TWD");
  }
  await noJs.close();
  assert.deepEqual(errors, []);
  console.log("PRICING_BROWSER_OK surchargeGrouping=true inquiry=true repeatedSwitching=true persistence=true searchDynamic=true noJS=true keyboard=true overflow=false consoleErrors=0");
} finally {
  await browser.close();
}
