import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { itemColors } from "./lib/item-colors.mjs";
import inlineType from "../assets/js/inline-type.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4178";
const errors = [];
const output = "output/playwright";
await mkdir(output, { recursive: true });

async function verifyLabel(page, expected) {
  expected = inlineType.plain(expected);
  const label = page.locator('[data-choice-kind="swatch"] [data-choice-label-value]');
  assert.equal(await label.textContent(), expected);
  assert.equal(await label.locator("sup").count(), 1, "The selected code must be one semantic superscript run");
  assert.equal(await label.locator("sup").textContent(), expected.slice(0, 2));
  const selectedText = await label.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const text = selection.toString();
    selection.removeAllRanges();
    return { text, userSelect: getComputedStyle(element).userSelect };
  });
  assert.equal(selectedText.text, expected, "Selection/copy text must contain ordinary characters, without lost names or extra whitespace");
  assert.notEqual(selectedText.userSelect, "none");
}

async function verifyProductState(page) {
  const state = await page.evaluate(() => {
    const detail = document.querySelector("[data-product-detail]");
    const product = window.PARADIGM_PRODUCT;
    const chosen = (kind) => detail.querySelector(`[data-choice-kind="${kind}"] input:checked`).closest("[data-choice-option]");
    const color = chosen("swatch");
    const size = chosen("chip");
    const variant = product.variants.find((row) => row.visible && row.colorCode === color.dataset.colorCode && row.sizeName === size.dataset.choiceLabel);
    const colorImages = [...new Set(product.variants.filter((row) => row.visible && row.colorCode === color.dataset.colorCode && row.imageId).map((row) => row.imageId))];
    const expectedImage = variant?.imageId || (colorImages.length === 1 ? colorImages[0] : "");
    const available = product.variants.some((row) => row.visible && !row.soldOut && row.colorCode === color.dataset.colorCode && row.sizeName === size.dataset.choiceLabel);
    return {
      expectedImage,
      actualImage: detail.querySelector("[data-product-variant-image]")?.dataset.productImageId || "",
      actionIntent: detail.querySelector("[data-primary-action]").dataset.actionIntent,
      expectedIntent: available ? "purchase" : "notify",
      wrongAvailability: [...detail.querySelectorAll('[data-choice-kind="swatch"] [data-choice-option]')].filter((option) => {
        const expected = product.variants.some((row) => row.visible && !row.soldOut && row.colorCode === option.dataset.colorCode && row.sizeName === size.dataset.choiceLabel);
        return option.dataset.availability !== (expected ? "available" : "unavailable");
      }).length
    };
  });
  assert.equal(state.actualImage, state.expectedImage, "Color codes must retain the correct variant image");
  assert.equal(state.actionIntent, state.expectedIntent, "Color codes must retain purchase availability");
  assert.equal(state.wrongAvailability, 0);
}

async function selectLanguage(page, value, width) {
  const toggle = page.locator(width >= 1024 ? "[data-storefront-toggle]" : "[data-nav-toggle]");
  await toggle.focus();
  await toggle.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-overlay-state="open"]'));
  const trigger = page.locator("#menu-language-native").locator("..").locator(".dropdown__trigger");
  await trigger.press("ArrowDown");
  await page.keyboard.press("Home");
  if (value === "en-TWD") await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#menu-language-native").inputValue(), value);
  await trigger.press("Escape");
  await page.waitForFunction(() => !document.body.hasAttribute("data-overlay-state"));
}

async function verifyPage(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "No positive horizontal overflow");
  assert.ok(await page.locator('[data-choice-label-value] sup').count() > 0);
}

async function verifyInlineModifiers(page) {
  const result = await page.evaluate(() => {
    const host = document.createElement("div");
    host.className = "type-body";
    document.querySelector("main").append(host);
    const metrics = [];
    for (const role of ["type-body", "type-small", "type-h2"]) {
      for (const modifier of ["span", "strong", "em"]) {
        const line = document.createElement("p");
        line.className = role;
        const parent = document.createElement(modifier);
        line.append(parent);
        host.append(line);
        window.PARADIGM_INLINE_TYPE.set(parent, "m² H₂O");
        const height = line.getBoundingClientRect().height;
        const style = getComputedStyle(parent);
        const scripts = [...parent.querySelectorAll("sup, sub")].map((node) => {
          const child = getComputedStyle(node);
          return {
            ratio: parseFloat(child.fontSize) / parseFloat(style.fontSize),
            family: child.fontFamily === style.fontFamily,
            weight: child.fontWeight === style.fontWeight,
            italic: child.fontStyle === style.fontStyle,
            color: child.color === style.color,
            lineHeight: child.lineHeight,
            top: parseFloat(child.top),
            tag: node.tagName,
            size: parseFloat(child.fontSize)
          };
        });
        const range = document.createRange();
        range.selectNodeContents(parent);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const copied = selection.toString();
        selection.removeAllRanges();
        parent.textContent = "m2 H2O";
        metrics.push({ role, modifier, scripts, copied, height, plainHeight: line.getBoundingClientRect().height });
      }
    }
    window.PARADIGM_INLINE_TYPE.set(host, "<img src=x onerror=alert(1)> ²");
    const safe = !host.querySelector("img") && host.textContent === "<img src=x onerror=alert(1)> 2";
    host.remove();
    return { metrics, safe };
  });
  assert.ok(result.safe, "Unicode text must never become executable authored HTML");
  for (const metric of result.metrics) {
    assert.equal(metric.copied, metric.role === "type-h2" ? "M2 H2O" : "m2 H2O", "Selection retains the surrounding role's existing text-transform behavior");
    assert.equal(metric.height, metric.plainHeight, "Script modifiers must not change line-box height");
    for (const script of metric.scripts) {
      assert.equal(script.ratio, 0.75);
      assert.ok(script.family && script.weight && script.italic && script.color);
      assert.equal(script.lineHeight, "0px");
      assert.equal(script.top, script.size * (script.tag === "SUP" ? -0.5 : 0.25));
    }
  }
}

try {
  for (const width of [390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${base}/products/PD14025/`);
    await page.waitForFunction(() => window.PARADIGM_VARIANT_GALLERY);
    const description = page.locator(".rich-description__line").filter({ hasText: "其中" });
    assert.equal(await description.textContent(), "其中 03Charcoal、06Dove 兩色");
    assert.equal(await description.locator("sup").count(), 2);
    assert.equal(await page.locator(".rich-description sup").filter({ hasText: /^2$/ }).count(), 1, "Ordinary m² notation must also render as sup");
    const options = page.locator('[data-choice-kind="swatch"] [data-choice-option]');
    const first = await options.first().getAttribute("data-color-code");
    await verifyLabel(page, itemColors.label(first));
    await options.nth(1).click();
    const second = await options.nth(1).getAttribute("data-color-code");
    await verifyLabel(page, itemColors.label(second));
    await verifyProductState(page);
    await options.nth(1).locator("input").press("ArrowRight");
    await verifyLabel(page, itemColors.label(await options.nth(2).getAttribute("data-color-code")));
    await verifyProductState(page);
    // A changed display name must still select the imported Charcoal SKU by C03.
    const charcoal = page.locator('[data-color-code="C03"]');
    await charcoal.evaluate((option) => {
      option.dataset.choiceLabel = "Graphite";
      option.dataset.choiceDisplayLabel = "⁰³Graphite";
    });
    await charcoal.click();
    await verifyLabel(page, "⁰³Graphite");
    await verifyProductState(page);
    await selectLanguage(page, "zh-TWD", width);
    await verifyLabel(page, "⁰³Graphite");
    await selectLanguage(page, "en-TWD", width);
    await verifyLabel(page, "⁰³Graphite");
    assert.equal(await description.locator("sup").count(), 2, "Language changes retain superscript rendering");
    assert.equal(await charcoal.locator("span.visually-hidden").first().textContent(), "Color 03Charcoal", "Accessible labels use ordinary code text");
    assert.match(await page.locator('[data-choice-kind="swatch"] [data-choice-status]').textContent(), /03Graphite/);
    await verifyInlineModifiers(page);
    await verifyPage(page);
    if (width === 1440) {
      await options.nth(1).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/color-handles-product-desktop.png`, clip: { x: 910, y: 112, width: 430, height: 715 } });
    }
    await page.goto(`${base}/teamwear/customize/`);
    await page.waitForFunction(() => window.PARADIGM_VARIANT_GALLERY);
    await verifyLabel(page, "²¹Mocha");
    await page.locator('[data-color-code="C13"]').click();
    await verifyLabel(page, "¹³Cardinal");
    await page.locator('[data-color-code="C13"] input').press("ArrowRight");
    await verifyLabel(page, "²¹Mocha");
    await page.locator('[data-choice-title="Pattern"] [data-choice-option]').first().click();
    const image = await page.locator("[data-product-variant-image]").getAttribute("src");
    assert.ok(image?.includes(".webp"), "Teamwear pattern/color selection must retain its generated variant image");
    await selectLanguage(page, "zh-TWD", width);
    await verifyLabel(page, "²¹Mocha");
    await selectLanguage(page, "en-TWD", width);
    await verifyLabel(page, "²¹Mocha");
    await verifyPage(page);
    if (width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/color-handles-teamwear-desktop.png` });
    }
    await context.close();

    const staticContext = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const staticPage = await staticContext.newPage();
    await staticPage.goto(`${base}/products/PD14025/`);
    await verifyLabel(staticPage, itemColors.label(first));
    await verifyPage(staticPage);
    await staticPage.goto(`${base}/teamwear/customize/`);
    await verifyLabel(staticPage, "²¹Mocha");
    await verifyPage(staticPage);
    await staticContext.close();
    console.log(`COLOR_HANDLES_BROWSER_OK width=${width} semanticSup=true scriptInheritance=true lineBoxes=true selection=true codeIdentity=true languages=true noJs=true`);
  }
  assert.deepEqual(errors, [], "Browser errors and failed local assets");
} finally {
  await browser.close();
}
