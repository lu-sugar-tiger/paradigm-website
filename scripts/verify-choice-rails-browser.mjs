import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4178";
const output = "output/playwright/choice-rails-production";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const failures = [];
const results = [];
const routes = ["/products/ED14024/", "/teamwear/customize/", "/teamwear/"];
const dimensions = (group) => {
  const rail = group.querySelector(".choice-group__options");
  const choices = [...group.querySelectorAll("[data-choice-option]")];
  const style = getComputedStyle(rail);
  const sizer = group.querySelector(".choice-group__sizer");
  return {
    kind: group.dataset.choiceKind, variant: group.dataset.choiceVariant,
    widths: choices.map((choice) => choice.getBoundingClientRect().width),
    rows: new Set(choices.map((choice) => choice.offsetTop)).size,
    overflow: rail.scrollWidth > rail.clientWidth + 1,
    hidden: choices.some((choice) => choice.hidden), scrollbar: style.scrollbarWidth,
    clipped: choices.some((choice) => { const label = choice.querySelector(".choice-option__label"); return label && label.scrollWidth > label.clientWidth + 1; }),
    minimum: rail.style.getPropertyValue("--choice-chip-min"),
    measured: sizer ? `${Math.ceil(sizer.getBoundingClientRect().width)}px` : ""
  };
};
async function checkLayout(page, width) {
  const states = [];
  for (const group of await page.locator("[data-choice-group]").all()) {
    assert.ok(await group.evaluate((element) => element.classList.contains("choice-group--rail")));
    assert.equal(await group.locator(".choice-group__track").count(), 1);
    const state = await group.evaluate(dimensions);
    assert.equal(state.hidden, false);
    assert.equal(state.clipped, false);
    if (state.kind === "chip") {
      assert.ok(Math.max(...state.widths) - Math.min(...state.widths) < 1, "Chip columns share an equal width");
      assert.equal(state.minimum, state.measured, "Localized Strong sizer determines the Large minimum");
    }
    if (width < 1024) {
      assert.equal(state.rows, 1);
      assert.equal(state.scrollbar, "none");
      assert.equal(await group.locator(".choice-group__options").evaluate((element) => getComputedStyle(element, "::-webkit-scrollbar").display), "none");
    } else assert.equal(state.overflow, false, "Large must wrap every option");
    assert.equal(await group.locator("button, [data-rail-next], [data-rail-previous]").count(), 0);
    states.push(state);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "No page overflow");
  return states;
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
}
async function changeLanguage(page, value) {
  await page.locator("#menu-language-native").evaluate((select, value) => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }, value);
  await settle(page);
}
async function drag(page, group) {
  const rail = group.locator(".choice-group__options");
  await rail.scrollIntoViewIfNeeded();
  const before = await group.locator("input:checked").evaluateAll((inputs) => inputs.map((input) => input.value));
  const box = await rail.boundingBox();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height / 2, { steps: 12 });
  assert.ok(await rail.evaluate((element) => element.classList.contains("is-pointer-dragging")));
  assert.equal(await rail.evaluate((element) => getComputedStyle(element).cursor), "grabbing");
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.ok(await rail.evaluate((element) => element.scrollLeft > 0));
  assert.deepEqual(await group.locator("input:checked").evaluateAll((inputs) => inputs.map((input) => input.value)), before, "Dragging does not change the chosen color/size");
  assert.equal(await rail.evaluate((element) => element.classList.contains("is-pointer-dragging")), false);
}

try {
  for (const width of [320, 390, 768, 1023, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on("requestfailed", (request) => failures.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    for (const route of routes) {
      await page.goto(base + route); await settle(page);
      const initial = await checkLayout(page, width);
      for (const group of await page.locator('[data-choice-group]:not([data-choice-variant="add-on"])').all()) {
        const before = await group.evaluate(dimensions);
        if (width < 1024 && before.overflow) await drag(page, group);
        await group.locator("input").first().focus();
        await page.keyboard.press("End");
        assert.ok(await group.locator("input").last().isChecked());
        assert.ok(await group.locator("input").last().evaluate((input) => document.activeElement === input));
        if (width < 1024) {
          assert.ok(await group.evaluate((group) => {
            const rail = group.querySelector(".choice-group__options").getBoundingClientRect();
            const choice = group.querySelector("input:checked").closest("[data-choice-option]").getBoundingClientRect();
            return choice.left >= rail.left - 1 && choice.right <= rail.right + 1;
          }), "Keyboard reveals the selected option");
        }
        await page.keyboard.press("Home");
      }
      if (route.startsWith("/products/")) {
        assert.ok(await page.locator("[data-product-gallery]").evaluate((gallery) => gallery.hasAttribute("data-variant-revealed")));
        assert.ok(await page.locator("[data-product-variant-image]").count());
        assert.ok(await page.locator("[data-primary-action]").evaluate((action) => action.dataset.actionDefaultHref.includes("shopee")));
      }
      if (route === "/teamwear/customize/") {
        const image = page.locator("[data-builder-preview] [data-product-variant-image]");
        const previousSource = await image.getAttribute("src");
        const quantity = page.locator('[data-choice-title="Quantity"] input');
        await quantity.last().focus(); await page.keyboard.press("End");
        assert.equal(await image.getAttribute("src"), previousSource, "Quantity preserves the selected preview image");
        const addOn = page.locator('[data-choice-variant="add-on"] input');
        const before = await addOn.isChecked();
        const priceBefore = Number(await page.locator("[data-teamwear-price]").getAttribute("data-price-twd"));
        await addOn.focus(); await page.keyboard.press("Space");
        assert.equal(await addOn.isChecked(), !before);
        const adjustment = await page.evaluate(() => window.PARADIGM_TEAMWEAR.models[0].addOns[0].priceAdjustment);
        assert.equal(Number(await page.locator("[data-teamwear-price]").getAttribute("data-price-twd")), priceBefore + (before ? -adjustment : adjustment));
        assert.equal(await image.getAttribute("src"), previousSource, "Add-On preserves the selected preview image");
        assert.equal(await page.locator('[data-choice-variant="add-on"] [data-choice-state-symbol]').textContent(), before ? "add" : "check");
      }
      const selection = await page.locator("[data-choice-group] input:checked").evaluateAll((inputs) => inputs.map((input) => input.value));
      await changeLanguage(page, "zh-TWD");
      const translated = await checkLayout(page, width);
      assert.deepEqual(await page.locator("[data-choice-group] input:checked").evaluateAll((inputs) => inputs.map((input) => input.value)), selection);
      await changeLanguage(page, "en-TWD");
      if ([390, 1440].includes(width) && route !== "/teamwear/") {
        await page.locator(".product-detail__summary").screenshot({ path: `${output}/${route.startsWith("/products/") ? "product" : "teamwear"}-${width}.png`, style: ".site-header { visibility: hidden; }" });
      }
      results.push({ width, route, initial, translated });
    }
    await context.close();
  }
  for (const width of [320, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(base + route);
      for (const group of await page.locator("[data-choice-group]").all()) {
        const state = await group.evaluate(dimensions);
        assert.equal(state.hidden, false); assert.equal(state.clipped, false);
        if (state.kind === "chip") assert.ok(Math.max(...state.widths) - Math.min(...state.widths) < 1);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      const last = page.locator('[data-choice-kind="chip"] [data-choice-option]').last();
      await last.click(); assert.ok(await last.locator("input").isChecked());
    }
    await context.close();
  }
  if (errors.length) console.log(JSON.stringify({ failures, errors }));
  assert.deepEqual(errors, []);
  await writeFile(`${output}/verification.json`, JSON.stringify({ results, errors, noJavaScript: [320, 1440] }, null, 2));
  console.log("SHARED_CHOICE_RAILS_BROWSER_OK: product, Teamwear Customize, Teamwear landing; 320/390/768/1023/1024/1440/1920; pointer drag, keyboard, EN/ZH, price/media selection, no-JS; no overflow or console errors.");
} finally { await browser.close(); }
