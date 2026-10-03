import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { catalogEntriesForProduct } from "./lib/catalog-entries.mjs";
import { renderProductGrid } from "./lib/site-renderers.mjs";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const { chromium } = createRequire(import.meta.url)("playwright");
const option = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=").slice(1).join("=") || fallback;
const label = option("label", "current");
assert.match(label, /^[a-z0-9-]+$/i);
const widths = option("widths", "390,1440").split(",").map(Number);
const routes = option("routes", "/,/collections/tees/,/products/AE14008/").split(",");
const runs = Number(option("runs", "3"));
assert.ok(runs > 0 && widths.every((width) => width > 0));
const verify = process.argv.includes("--verify");
const throttled = process.argv.includes("--throttled");
const output = path.join(root, "output/playwright/performance", label);
await mkdir(output, { recursive: true });
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp4": "video/mp4" };
let server;
let base = process.env.PREVIEW_URL;
if (!base) {
  server = createServer(async (request, response) => {
    try {
      let file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`);
      if (!file.startsWith(`${root}${path.sep}`) && file !== root) throw new Error("Outside preview root");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Content-Length": body.length, "Cache-Control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404); response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
let browser;
try {
  browser = await chromium.launch(process.env.BROWSER_EXECUTABLE ? { headless: true, executablePath: process.env.BROWSER_EXECUTABLE } : { headless: true, channel: "chrome" });
} catch (error) {
  if (server) await new Promise((resolve) => server.close(resolve));
  throw error;
}
const report = { base, localUncompressed: Boolean(server), offlineFonts: process.env.PERF_OFFLINE_FONTS === "1", throttled, runs, samples: [], checks: [] };
async function context(width, javaScriptEnabled = true) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: width < 768 ? 2 : 1, isMobile: width < 768, hasTouch: width < 768, javaScriptEnabled, reducedMotion: "reduce", serviceWorkers: "block" });
  if (report.offlineFonts) {
    await ctx.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await ctx.route("https://fonts.gstatic.com/**", (route) => route.abort());
  }
  return ctx;
}
const slug = (route) => route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  for (const width of widths) for (const route of routes) for (let run = 0; run < runs; run++) {
    const ctx = await context(width);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (throttled) {
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8, connectionType: "cellular4g" });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    const requests = new Map();
    cdp.on("Network.requestWillBeSent", ({ requestId, request }) => requests.set(requestId, { url: request.url, bytes: 0, priority: request.initialPriority }));
    cdp.on("Network.resourceChangedPriority", ({ requestId, newPriority }) => { const entry = requests.get(requestId); if (entry) entry.priority = newPriority; });
    cdp.on("Network.dataReceived", ({ requestId, encodedDataLength }) => { const entry = requests.get(requestId); if (entry) entry.bytes += encodedDataLength; });
    cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => { const entry = requests.get(requestId); if (entry) { entry.bytes = encodedDataLength; entry.complete = true; } });
    const errors = [], failures = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on("requestfailed", (request) => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
    await page.addInitScript(() => {
      window.__performanceSample = { lcp: 0, cls: 0, longTaskBlockingMs: 0 };
      let sessionStart = 0, previousShift = 0, sessionValue = 0;
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) {
        window.__performanceSample.lcp = entry.startTime;
        window.__performanceSample.lcpImage = entry.url;
        window.__performanceSample.lcpLoading = entry.element?.getAttribute("loading");
      } }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        if (!sessionStart || entry.startTime - previousShift > 1000 || entry.startTime - sessionStart > 5000) { sessionStart = entry.startTime; sessionValue = 0; }
        previousShift = entry.startTime; sessionValue += entry.value;
        window.__performanceSample.cls = Math.max(window.__performanceSample.cls, sessionValue);
      } }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__performanceSample.longTaskBlockingMs += Math.max(0, entry.duration - 50); }).observe({ type: "longtask", buffered: true });
    });
    const response = await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 60000 });
    assert.equal(response.status(), 200);
    await page.waitForTimeout(1200);
    const snapshot = await page.evaluate(() => ({
      ...window.__performanceSample,
      fcp: performance.getEntriesByType("paint").find((entry) => entry.name === "first-contentful-paint")?.startTime || 0,
      cards: document.querySelectorAll(".product-grid > .product-card").length,
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      geometry: [...document.querySelectorAll(".product-card")].map((card) => { const rect = card.getBoundingClientRect(); return [rect.x, rect.y + scrollY, rect.width, rect.height]; }),
      height: document.documentElement.scrollHeight
    }));
    const network = [...requests.values()];
    const sample = { width, route, run, ...snapshot, bytes: network.reduce((sum, request) => sum + request.bytes, 0), jsBytes: network.filter((request) => /\.js(?:\?|$)/.test(request.url)).reduce((sum, request) => sum + request.bytes, 0), network, errors, failures };
    report.samples.push(sample);
    if (run === 0) await page.screenshot({ path: path.join(output, `${slug(route)}-${width}.png`) });
    assert.equal(snapshot.overflow, 0);
    assert.deepEqual(errors, []);
    if (verify) {
      assert.ok(!network.some((request) => /\/catalog\.js(?:\?|$)/.test(request.url)), "Public pages must not fetch the full catalog");
      if (route.startsWith("/products/")) assert.equal(network.filter((request) => /\/products\/[^/]+\.js(?:\?|$)/.test(request.url)).length, 1);
    }
    console.log(JSON.stringify({ width, route, run, bytes: sample.bytes, jsBytes: sample.jsBytes, lcp: Math.round(sample.lcp), cls: sample.cls }));
    await ctx.close();
  }
  if (verify) {
    const sandbox = { window: {} };
    vm.runInNewContext(await readFile(path.join(root, "assets/js/catalog.js"), "utf8"), sandbox);
    const products = sandbox.window.PARADIGM_CATALOG.items;
    for (const width of [320, 390, 768, 1024, 1440]) {
      const ctx = await context(width), page = await ctx.newPage();
      for (const route of ["/", "/products/AE14008/", "/products/ED14001/"]) {
        await page.goto(`${base}${route}`);
        const code = route.split("/")[2];
        const expected = products.filter((product) => product.code !== code).flatMap(catalogEntriesForProduct).map((entry) => entry.cardUrl);
        const links = await page.locator(".product-grid > .product-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
        assert.equal(new Set(links).size, links.length, "No repeated cards");
        assert.deepEqual([...links].sort(), [...expected].sort(), "Every catalog card except the current product must be present");
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.locator(".product-card").last().scrollIntoViewIfNeeded();
        const lastImage = await page.locator(".product-card").last().locator("img").elementHandle();
        await page.waitForFunction((image) => image.complete && image.naturalWidth > 0, lastImage, { timeout: 10000 });
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), height, "Lazy media must not change document height");
        await page.locator(".product-card").last().focus();
        assert.equal(await page.locator(".product-card").last().evaluate((card) => card === document.activeElement), true);
        assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), 0);
        if (code) {
          assert.equal(await page.evaluate(() => window.PARADIGM_PRODUCT.code), code);
          const choice = page.locator('[data-choice-kind="swatch"] input').last();
          await choice.check({ force: true });
          assert.ok(await page.locator("[data-primary-action]").getAttribute("href"));
        }
      }
      await page.goto(`${base}/`);
      const previousCard = page.locator(".product-card").nth(25);
      await previousCard.scrollIntoViewIfNeeded();
      const previousScroll = await page.evaluate(() => scrollY);
      await previousCard.click();
      await page.waitForURL(/\/products\//);
      await page.goBack({ waitUntil: "load" });
      await page.waitForTimeout(200);
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - previousScroll) <= 2, "Back navigation must restore the catalog position");
      const original = await readFile(path.join(root, "index.html"), "utf8");
      const gridStart = original.indexOf('<div class="auto-grid product-grid"');
      const gridEnd = original.indexOf("    </div></section>", gridStart);
      assert.ok(gridStart >= 0 && gridEnd > gridStart);
      const entries = products.flatMap(catalogEntriesForProduct);
      const fixture = Array.from({ length: 500 }, (_, index) => ({ ...entries[index % entries.length], cardUrl: `/products/STRESS-${index}` }));
      const stressHtml = original.slice(0, gridStart) + renderProductGrid(fixture, "", { initialViewport: true }) + "\n" + original.slice(gridEnd);
      await page.route(`${base}/`, (route) => route.fulfill({ contentType: "text/html", body: stressHtml }));
      await page.goto(`${base}/`);
      const stress = await page.evaluate(async () => {
        const grid = document.querySelector(".product-grid");
        const height = document.documentElement.scrollHeight;
        window.scrollTo(0, height);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { count: grid.children.length, observed: grid.hasAttribute("data-catalog-loading"), height, afterHeight: document.documentElement.scrollHeight, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
      });
      assert.equal(stress.count, 500); assert.equal(stress.observed, true); assert.equal(stress.height, stress.afterHeight); assert.equal(stress.overflow, 0);
      report.checks.push({ width, stress });
      await ctx.close();
    }
    const ctx = await context(390, false), page = await ctx.newPage();
    for (const route of ["/", "/products/AE14008/"]) {
      await page.goto(`${base}${route}`);
      const code = route.split("/")[2];
      const expected = products.filter((product) => product.code !== code).flatMap(catalogEntriesForProduct).length;
      assert.equal(await page.locator(".product-card").count(), expected, "All cards must be available without JavaScript");
    }
    await ctx.close();
  }
  report.medians = widths.flatMap((width) => routes.map((route) => {
    const samples = report.samples.filter((sample) => sample.width === width && sample.route === route);
    return { width, route, bytes: median(samples.map((sample) => sample.bytes)), jsBytes: median(samples.map((sample) => sample.jsBytes)), lcp: median(samples.map((sample) => sample.lcp)), cls: median(samples.map((sample) => sample.cls)) };
  }));
  await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PERFORMANCE_${verify ? "VERIFIED" : "MEASURED"} report=${path.relative(root, path.join(output, "report.json"))}`);
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
