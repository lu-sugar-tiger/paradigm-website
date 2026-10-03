import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4178";
const output = "output/playwright/responsive-input";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const results = [];
const routes = ["/products/ED14024/", "/teamwear/customize/"];
async function waitImage(page, index) {
  try { await page.waitForFunction((index) => {
    const gallery = document.querySelector(".product-detail__gallery");
    const images = [...gallery.querySelectorAll("img")].filter((image) => !image.hidden && getComputedStyle(image).display !== "none");
    return Math.abs(gallery.scrollLeft - images[index].offsetLeft) <= 1;
  }, index, { timeout: 5000 }); }
  catch (error) { console.log(JSON.stringify({ url: page.url(), index, state: await page.locator(".product-detail__gallery").evaluate((gallery) => ({ scroll: gallery.scrollLeft, offsets: [...gallery.querySelectorAll("img")].map((image) => image.offsetLeft), buttons: [...gallery.parentElement.querySelectorAll("button")].map((button) => ({ hidden: button.hidden, disabled: button.disabled })) })) })); throw error; }
}
async function grab(page, direction, index) {
  const gallery = page.locator(".product-detail__gallery");
  await gallery.scrollIntoViewIfNeeded();
  const box = await gallery.boundingBox();
  const y = Math.max(120, Math.min(450, box.y + box.height / 2));
  await page.mouse.move(box.x + box.width * (direction > 0 ? .8 : .2), y);
  await page.mouse.down();
  assert.equal(await gallery.evaluate((element) => element.classList.contains("is-pointer-dragging")), true);
  assert.equal(await gallery.evaluate((element) => getComputedStyle(element).scrollSnapType), "none");
  await page.mouse.move(box.x + box.width * (direction > 0 ? .2 : .8), y, { steps: 12 });
  await page.mouse.up();
  await waitImage(page, index);
  assert.equal(await gallery.evaluate((element) => element.classList.contains("is-pointer-dragging")), false);
}
async function pinch(context, page) {
  const image = page.locator(".product-detail__gallery img:visible").first();
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  const center = { x: box.x + box.width / 2, y: Math.max(120, Math.min(450, box.y + box.height / 2)) };
  const session = await context.newCDPSession(page);
  const points = (gap) => [-1, 1].map((sign, index) => ({ x: center.x + sign * gap, y: center.y, id: index + 1 }));
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(35) });
  await page.waitForFunction((width) => Math.abs((document.querySelector(".media-zoom-float")?.getBoundingClientRect().width || 0) - width) < 1, box.width);
  for (const gap of [45, 55, 65]) {
    await page.waitForTimeout(40);
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(gap) });
  }
  await page.waitForFunction((width) => document.querySelector(".media-zoom-float").getBoundingClientRect().width > width * 1.5, box.width);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await page.locator(".media-zoom-float, .media-zoom-source-active, .media-zoom-surface-active, .media-zoom-overlay").count(), 0);
  await session.detach();
}
async function swipe(context, page) {
  const gallery = page.locator(".product-detail__gallery");
  await gallery.scrollIntoViewIfNeeded();
  const box = await gallery.boundingBox();
  const y = Math.max(120, Math.min(450, box.y + box.height / 2));
  const session = await context.newCDPSession(page);
  await gallery.evaluate((element) => { window.swipeTestEnded = false; element.addEventListener("scrollend", () => { window.swipeTestEnded = true; }, { once: true }); });
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width * .8, y, id: 1 }] });
  for (let step = 1; step <= 8; step++) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + box.width * (.8 - step * .075), y, id: 1 }] });
    await page.waitForTimeout(20);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
  await page.waitForFunction(() => window.swipeTestEnded);
  await waitImage(page, 1);
}
function observe(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
}

try {
  for (const width of [320, 390, 767, 768, 1023, 1024, 1440, 1920]) {
    for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, reducedMotion: "reduce" });
      const page = await context.newPage();
      observe(page);
      for (const route of routes) {
        await page.goto(base + route);
        await page.evaluate(() => document.fonts.ready);
        const gallery = page.locator(".product-detail__gallery");
        assert.equal(await page.locator(".product-detail__media .teamwear-rail-controls, .product-detail__media button:not(.detail-thumbnail)").count(), 0, "Detail galleries must not render previous/next browsing controls");
        if (width < 1024) assert.equal(await page.locator(".detail-thumbnail:visible").count(), 0, "Thumbnail navigation must remain desktop-only");
        const options = () => page.locator("[data-choice-group] input:checked").evaluateAll((inputs) => inputs.map((input) => input.value));
        const before = await options();
        const total = await gallery.locator("img:visible").count();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${width} ${route}: horizontal overflow`);
        if (width < 1024) {
          assert.equal(await gallery.getAttribute("tabindex"), null);
          assert.equal(await page.locator("[data-gallery-position]").count(), 0);
          assert.ok(await gallery.evaluate((element) => Math.abs(element.parentElement.getBoundingClientRect().height - element.getBoundingClientRect().height) < 1), "Controls must add no row or gallery height");
          await waitImage(page, 0);
          await grab(page, 1, 1);
          await grab(page, -1, 0);
          assert.deepEqual(await options(), before, "Browsing must preserve chosen options");
          if (touch) {
            await pinch(context, page);
            await swipe(context, page);
          }
          const choice = page.locator('[data-choice-kind="swatch"] [data-choice-option]').first();
          await choice.click();
          await waitImage(page, total - 1);
          assert.equal(await gallery.locator("img:visible").last().evaluate((image) => image.hasAttribute("data-product-variant-image") || image.hasAttribute("data-builder-image")), true, "Variant slot must remain last");
          await grab(page, -1, total - 2);
          await page.evaluate(() => document.querySelector(".product-detail__gallery").scrollTo({ left: 0, behavior: "instant" }));
          await waitImage(page, 0);
        } else {
          const image = gallery.locator("img:visible").first();
          if (touch) {
            await image.tap();
            assert.equal(await page.locator(".media-zoom-overlay").count(), 0, "Touch taps must not open the pointer viewer");
            await pinch(context, page);
            await page.waitForTimeout(750);
          }
          await image.click();
          assert.equal(await page.locator(".media-zoom-overlay").count(), 1, "A mouse must work even on a touch-capable device");
          await page.keyboard.press("Escape");
          await image.focus(); await image.press("Enter");
          assert.equal(await page.locator(".media-zoom-overlay").count(), 1);
          await page.keyboard.press("Escape");
          assert.equal(await image.evaluate((element) => element === document.activeElement), true);
        }
        if (!touch && [390, 768, 1024, 1440].includes(width)) await page.screenshot({ path: `${output}/${route.includes("products") ? "product" : "customize"}-${width}.png` });
        results.push({ width, touch, route, total, passed: true });
      }
      await page.goto(base + "/teamwear/");
      assert.equal(await page.locator(".teamwear-rail-controls").first().isVisible(), width >= 1024, "Teamwear landing rail controls must remain limited to Large");
      if (width >= 1024) {
        await page.goto(base + "/products/ED14024/");
        const parent = page.locator("[data-header-parent]").first();
        if (touch) {
          await parent.tap();
          assert.equal(await parent.getAttribute("aria-expanded"), "true");
          assert.match(page.url(), /\/products\/ED14024\/$/);
          await parent.tap();
          await page.waitForURL(/\/collections\/all\/?$/);
          await page.goto(base + "/products/ED14024/");
          await parent.tap(); await parent.click();
          await page.waitForURL(/\/collections\/all\/?$/);
        } else {
          await parent.hover();
          assert.equal(await parent.getAttribute("aria-expanded"), "true");
          await parent.click();
          await page.waitForURL(/\/collections\/all\/?$/);
        }
        await page.goto(base + "/products/ED14024/");
        await parent.focus(); await parent.press("ArrowDown");
        assert.equal(await page.locator(".header-directory__panel a").first().evaluate((element) => element === document.activeElement), true);
        await page.keyboard.press("Escape");
        assert.equal(await parent.getAttribute("aria-expanded"), "false");
        await parent.press("Enter"); await page.waitForURL(/\/collections\/all\/?$/);
      } else {
        await page.locator("[data-nav-toggle]").click();
        await page.waitForFunction(() => document.body.dataset.overlayState === "open");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.body.hasAttribute("data-overlay-state"));
      }
      await context.close();
      console.log(`RESPONSIVE_INPUT_PASS width=${width} touch=${touch}`);
    }
  }
  const motionContext = await browser.newContext({ viewport: { width: 768, height: 900 }, reducedMotion: "no-preference" });
  const motionPage = await motionContext.newPage();
  observe(motionPage);
  await motionPage.goto(base + routes[0]);
  const total = await motionPage.locator(".product-detail__gallery img:visible").count();
  await grab(motionPage, 1, 1);
  await grab(motionPage, 1, 2);
  await grab(motionPage, 1, 3);
  await grab(motionPage, -1, 2);
  await motionPage.setViewportSize({ width: 1024, height: 900 });
  await motionPage.waitForFunction(() => getComputedStyle(document.querySelector(".product-detail__gallery")).display === "grid");
  await motionPage.setViewportSize({ width: 768, height: 900 });
  await motionPage.waitForFunction(() => getComputedStyle(document.querySelector(".product-detail__gallery")).display === "flex");
  await motionPage.evaluate(() => document.querySelector(".product-detail__gallery").scrollTo({ left: 0, behavior: "instant" }));
  await waitImage(motionPage, 0);
  for (let index = 1; index < total; index++) await grab(motionPage, 1, index);
  await motionContext.close();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 768, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + routes[0]);
  assert.equal(await page.locator(".product-detail__media button").count(), 0);
  assert.ok(await page.locator(".product-detail__gallery").evaluate((gallery) => gallery.scrollWidth > gallery.clientWidth), "No-JS native gallery must remain scrollable");
  await context.close();
  assert.deepEqual(errors, [], "Browser console and runtime errors");
  await writeFile(`${output}/results.json`, JSON.stringify({ results, smoothBrowsing: true, breakpointChanges: true, noJavaScript: true, errors }, null, 2));
  console.log(`RESPONSIVE_INPUT_OK cases=${results.length} directory=true pinch=true mouseGrab=true mixedInputs=true noDetailControls=true smoothBrowsing=true breakpointChanges=true noJavaScript=true`);
} finally { await browser.close(); }
