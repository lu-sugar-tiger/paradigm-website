import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173/teamwear/";
const out = "output/playwright";
await mkdir(out, { recursive: true });
const errors = [];
async function context(options = {}) {
  const ctx = await browser.newContext(options);
  // Offline typography is unrelated to media behavior; keep network tests deterministic.
  await ctx.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await ctx.route("https://fonts.gstatic.com/**", (route) => route.abort());
  ctx.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  return ctx;
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector(".teamwear-hero").classList.contains("is-video-ready"));
}
async function state(page) {
  return page.evaluate(() => {
    const video = document.querySelector("#teamwear-hero-video");
    const hero = document.querySelector(".teamwear-hero");
    const image = hero.querySelector("img");
    return { src: video.getAttribute("src"), paused: video.paused, width: video.videoWidth, height: video.videoHeight,
      time: video.currentTime, duration: video.duration, muted: video.muted,
      overflow: document.documentElement.scrollWidth > innerWidth,
      poster: image.complete && image.naturalWidth > 0,
      heroHeight: hero.getBoundingClientRect().height,
      button: hero.querySelector("button").getAttribute("aria-label") };
  });
}
try {
  for (const width of [320, 390, 768, 1023, 1024, 1440, 1920]) {
    const ctx = await context({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await ready(page);
    const current = await state(page);
    const expected = width < 768 ? [1080, 1920] : width < 1024 ? [1440, 1440] : [1920, 1080];
    assert.deepEqual([current.width, current.height], expected);
    assert.ok(current.muted && current.poster && !current.overflow && !current.paused);
    assert.equal(current.button, "Pause background video");
    await page.getByRole("button", { name: "Pause background video", exact: true }).click();
    assert.ok((await state(page)).paused);
    await page.locator("#highlights-title").scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(150);
    assert.ok((await state(page)).paused, "Manual pause must survive offscreen return");
    await page.getByRole("button", { name: "Play background video", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector("video").paused);
    await page.locator("#gallery-title").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("video").paused);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => !document.querySelector("video").paused);
    await page.setViewportSize({ width: width < 768 ? 1440 : 390, height: 900 });
    assert.equal((await state(page)).src, current.src, "Resizing must not reload the selected asset");
    await page.setViewportSize({ width, height: 900 });
    if ([390, 768, 1440].includes(width)) await page.screenshot({ path: `${out}/hero-video-${width}.png` });
    console.log(JSON.stringify({ viewportWidth: width, ...current }));
    await ctx.close();
  }
  for (const kind of ["reduced", "saveData", "noJS", "blocked", "failed", "slow"]) {
    const ctx = await context({ viewport: { width: 390, height: 844 }, reducedMotion: kind === "reduced" ? "reduce" : "no-preference", javaScriptEnabled: kind !== "noJS" });
    if (kind === "saveData") await ctx.addInitScript(() => Object.defineProperty(navigator, "connection", { value: Object.assign(new EventTarget(), { saveData: true }) }));
    if (kind === "blocked") await ctx.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Blocked for test", "NotAllowedError")); });
    const page = await ctx.newPage();
    const requests = [];
    page.on("request", (request) => { if (request.url().endsWith(".mp4")) requests.push(request.url()); });
    if (kind === "failed") await page.route("**/*.mp4", (route) => route.abort());
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    if (kind === "slow") await page.route("**/*.mp4", async (route) => { await gate; await route.continue(); });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator(".teamwear-hero__media img").evaluate((image) => image.decode());
    await page.waitForTimeout(350);
    const current = await state(page);
    assert.ok(current.poster);
    if (kind !== "slow") assert.ok(current.paused);
    assert.ok(!await page.locator(".teamwear-hero").evaluate((hero) => hero.classList.contains("is-video-ready")));
    if (["reduced", "saveData", "noJS"].includes(kind)) {
      assert.equal(current.src, null);
      assert.equal(requests.length, 0, `${kind} must not download video`);
    }
    if (["reduced", "saveData"].includes(kind)) {
      await page.getByRole("button", { name: "Play background video", exact: true }).click();
      await ready(page);
      assert.ok(!(await state(page)).paused);
    }
    if (kind === "noJS") assert.equal(await page.locator(".teamwear-hero__content").evaluate((el) => getComputedStyle(el).opacity), "1");
    if (kind === "blocked") assert.equal(current.button, "Play background video");
    if (kind === "failed") assert.ok(await page.locator("[data-hero-video-toggle]").isHidden());
    if (kind === "slow") { release(); await ready(page); assert.equal((await state(page)).heroHeight, current.heroHeight); }
    console.log(`FALLBACK_OK ${kind}`);
    await ctx.close();
  }
  // Exercise real-time native looping rather than seeking across the seam.
  const loopContext = await context({ viewport: { width: 1440, height: 900 } });
  const loopPage = await loopContext.newPage();
  await loopPage.goto(base, { waitUntil: "domcontentloaded" });
  await ready(loopPage);
  await loopPage.evaluate(() => {
    const video = document.querySelector("video");
    window.loopSamples = [];
    let previousTime = video.currentTime;
    let previousNow = performance.now();
    function frame(now, metadata) {
      if (metadata.mediaTime < previousTime) window.loopSamples.push({ gapMs: now - previousNow, readyState: video.readyState });
      previousTime = metadata.mediaTime;
      previousNow = now;
      if (window.loopSamples.length < 3) video.requestVideoFrameCallback(frame);
    }
    video.requestVideoFrameCallback(frame);
  });
  for (let count = 1; count <= 3; count++) {
    await loopPage.waitForFunction((target) => window.loopSamples.length >= target, count, { timeout: 30000 });
    console.log(`NATIVE_LOOP_OK ${count} ${JSON.stringify(await loopPage.evaluate(() => window.loopSamples.at(-1)))}`);
  }
  const samples = await loopPage.evaluate(() => window.loopSamples);
  assert.ok(samples.every((sample) => sample.gapMs < 250 && sample.readyState >= 2), "Loop seam must not stall decoding");
  // Emulate the document visibility signal independently of headless tab policy.
  await loopPage.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.ok((await state(loopPage)).paused);
  await loopPage.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await loopPage.waitForFunction(() => !document.querySelector("video").paused);
  console.log("VISIBILITY_SIGNAL_OK");
  await loopContext.close();
  assert.deepEqual(errors, []);
  console.log("HERO_VIDEO_BROWSER_OK");
} finally {
  await browser.close();
}
