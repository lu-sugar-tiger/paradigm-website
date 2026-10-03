import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateItemCatalog } from './lib/item-schema.mjs';
import { productCategories } from './lib/product-categories.mjs';

const root = fileURLToPath(new URL("../", import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright");
const option = (name, fallback) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const output = path.join(root, "output/playwright/motion", option("label", "current"));
assert.match(option('label', 'current'), /^[a-z0-9-]+$/i);
await mkdir(output, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = createServer(async (request, response) => {
  try {
    let file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`);
    if (file !== path.resolve(root) && !file.startsWith(root)) throw new Error("Outside preview");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Content-Length": body.length }); response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const report = { checks: [], failures: [], errors: [], offlineFonts: true };
const routes = option("routes", ['/', '/collections/all/', ...productCategories.map(category => `${category.path}/`),
  '/products/AE14008/', '/products/ED14024/', '/teamwear/', '/teamwear/customize/', '/search/?q=tee', '/font-credits/'].join(',')).split(',');
if (process.argv.includes('--all-products')) {
  const source = validateItemCatalog(JSON.parse(await readFile(path.join(root, 'data/products-source.json'), 'utf8')));
  for (const product of source.items.filter(product => product.variants.some(variant => variant.visible))) {
    const route = `/products/${product.code}/`;
    if (!routes.includes(route)) routes.push(route);
  }
}
async function settle(page, time = 600) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(time);
}
const metrics = () => {
  const rect = selector => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y + scrollY, width: box.width, height: box.height } : null;
  };
  return { y: scrollY, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight, main: rect("main"), header: rect(".site-logo"),
    card: rect(".product-card"), footer: rect("footer"), state: document.body.dataset.overlayState || "closed" };
};
async function check(name, run) {
  try { const detail = await run(); report.checks.push({ name, ...detail }); }
  catch (error) { report.failures.push({ name, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function sample(page, action, time = 700) {
  await page.evaluate(() => {
    window.__frames = []; window.__sampling = true;
    function frame(t) {
      if (!window.__sampling) return;
      const rect = document.querySelector("main").getBoundingClientRect();
      const header = document.querySelector('.site-logo').getBoundingClientRect();
      window.__frames.push({ t, x: rect.x, y: rect.y + scrollY, w: rect.width, h: document.documentElement.scrollHeight, scrollY,
        headerX: header.x, headerWidth: header.width,
        state: document.body.dataset.overlayState || "closed", focus: document.activeElement.tagName });
      requestAnimationFrame(frame);
    } requestAnimationFrame(frame);
  });
  await action(); await page.waitForTimeout(time);
  return page.evaluate(() => { window.__sampling = false; return window.__frames; });
}
try {
  browser = await chromium.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE, headless: true } : { channel: "chrome", headless: true });
  for (const width of option("widths", "320,390,768,1023,1024,1440,1920").split(",").map(Number)) {
    const reducedMotion = option("motion", "no-preference");
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion,
      javaScriptEnabled: !process.argv.includes('--no-js'),
      isMobile: process.argv.includes("--touch"), hasTouch: process.argv.includes("--touch") });
    await context.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
    await context.addInitScript(() => {
      window.__shifts = []; window.__transitions = []; window.__lifecycle = [];
      new PerformanceObserver(list => window.__shifts.push(...list.getEntries().map(e => ({ value: e.value, recent: e.hadRecentInput,
        sources: e.sources.map(source => ({ node: source.node?.className, previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })) })))).observe({ type: "layout-shift", buffered: true });
      addEventListener("pagereveal", event => {
        window.__lifecycle.push({ reveal: Boolean(event.viewTransition), t: performance.now() });
        if (!event.viewTransition) return;
        window.__transitions = [];
        const record = { type: null, animations: [], ready: null };
        window.__transitions.push(record);
        event.viewTransition.ready.then(() => { record.ready = true; }, error => { record.ready = error.message; });
        setTimeout(() => { record.type = document.documentElement.dataset.pageMotion; }, 0);
        requestAnimationFrame(() => { record.animations = document.getAnimations().map(a => ({ name: a.animationName, duration: a.effect.getTiming().duration })); });
      });
      addEventListener("pageswap", event => {
        const record = { swap: Boolean(event.viewTransition), entry: event.activation?.entry?.url, t: performance.now() };
        sessionStorage.setItem('__motionSource', JSON.stringify(record));
        window.__lifecycle.push(record);
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on("pageerror", error => report.errors.push({ width, url: page.url(), error: error.message, stack: error.stack }));
    page.on("console", message => { if (message.type() === "error") report.errors.push({ width, url: page.url(), error: message.text() }); });
    if (!process.argv.includes("--only-navigation") && !process.argv.includes('--efficiency-only')) {
    for (const route of routes) await check(`layout ${width} ${route}`, async () => {
      await page.goto(base + route, { waitUntil: "domcontentloaded" }); await settle(page);
      const before = await page.evaluate(metrics);
      const startupShifts = await page.evaluate(() => window.__shifts || []);
      const startupCLS = startupShifts.filter(shift => !shift.recent).reduce((total, shift) => total + shift.value, 0);
      assert.ok(startupCLS <= .01, `Visible startup layout shift: ${startupCLS}`);
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await settle(page, 350);
      const after = await page.evaluate(metrics);
      assert.ok(after.scrollWidth <= after.width + 1, `Horizontal overflow: ${after.scrollWidth} > ${after.width}`);
      assert.ok(Math.abs(after.height - before.height) <= 1, `Scroll height changed ${before.height} → ${after.height}`);
      assert.ok(Math.abs(after.footer.y + after.footer.height - after.height) <= 1, `Space below footer: ${after.height - after.footer.y - after.footer.height}px`);
      const shifts = await page.evaluate(() => window.__shifts || []);
      if (process.argv.includes('--no-js')) {
        assert.equal(await page.evaluate(() => document.documentElement.dataset.siteEnhanced), undefined);
        assert.equal(await page.locator('.detail-thumbnails:visible').count(), 0);
        if (route.startsWith('/search')) assert.ok(await page.locator('.site-footer').isVisible(), 'No-JS search retains its footer');
      }
      return { before, after, shifts, startupShifts, startupCLS };
    });
    if (!process.argv.includes('--only-layout')) {
    await page.goto(base + "/products/AE14008/", { waitUntil: "domcontentloaded" }); await settle(page);
    await page.evaluate(() => scrollTo({ top: 650, behavior: "instant" })); await settle(page, 150);
    for (const kind of width < 1024 ? ["nav", "search"] : ["search", "storefront"]) await check(`overlay ${width} ${kind}`, async () => {
      const before = await page.evaluate(metrics);
      const frames = await sample(page, async () => {
        await page.locator(`[data-${kind}-toggle]`).click(); await page.waitForTimeout(80);
        await page.locator(`[data-${kind}-toggle]`).click(); await page.waitForTimeout(40);
        await page.locator(`[data-${kind}-toggle]`).click(); await page.waitForTimeout(450);
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${kind}-${width}.png`), caret: 'hide' });
        await page.keyboard.press("Escape");
      });
      const after = await page.evaluate(metrics);
      assert.ok(frames.every(frame => Math.abs(frame.w - before.main.width) <= 1), `Main width changes: ${[...new Set(frames.map(f => f.w))]}`);
      assert.ok(frames.every(frame => Math.abs(frame.headerX - before.header.x) <= 1 && Math.abs(frame.headerWidth - before.header.width) <= 1), 'Header geometry must stay fixed');
      assert.ok(frames.every(frame => Math.abs(frame.scrollY - before.y) <= 1), `Scroll moves: ${[...new Set(frames.map(f => f.scrollY))]}`);
      assert.ok(frames.every(frame => Math.abs(frame.h - before.height) <= 1), `Height changes: ${[...new Set(frames.map(f => f.h))]}`);
      assert.equal(after.state, "closed"); assert.equal(after.height, before.height);
      return { before, after, frames };
    });
    await check(`overlay switch ${width}`, async () => {
      const before = await page.evaluate(metrics);
      await page.locator(`[data-${width < 1024 ? "nav" : "storefront"}-toggle]`).click();
      // Other header controls are intentionally hidden while an overlay is open.
      // Exercise controller handoff directly, including its queued focus frame.
      await page.waitForTimeout(70); await page.locator("[data-search-toggle]").evaluate(button => button.click());
      await settle(page); await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.activeElement.closest("[data-search-overlay]") || document.activeElement.matches("[data-search-toggle]")), "Focus stays in active overlay");
      await page.keyboard.press("Escape"); await settle(page);
      const after = await page.evaluate(metrics);
      assert.equal(after.y, before.y); assert.equal(after.height, before.height);
      assert.equal(await page.locator("main[inert]").count(), 0);
      assert.equal(after.state, "closed");
    });
    await check(`dropdown ${width}`, async () => {
      await page.locator(`[data-${width < 1024 ? "nav" : "storefront"}-toggle]`).click(); await settle(page);
      const before = await page.evaluate(metrics);
      const trigger = page.locator('#menu-language-native').locator('..').locator('.dropdown__trigger');
      await trigger.click(); await page.keyboard.press("End"); await page.keyboard.press("Escape");
      await trigger.click(); await page.keyboard.press("Home"); await page.keyboard.press("Escape");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal((await page.evaluate(metrics)).height, before.height);
      await page.keyboard.press("Escape"); await settle(page);
    });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await settle(page, 150);
    if (width >= 1024) {
      await check(`gallery zoom ${width}`, async () => {
        const image = page.locator('[data-product-gallery] img:not([data-product-variant-image])').first();
        await image.evaluate(image => image.focus({ preventScroll: true })); const before = await page.evaluate(metrics);
        await page.keyboard.press("Enter"); await settle(page, 150);
        assert.equal(await page.locator(".media-zoom-overlay").count(), 1);
        await page.keyboard.press("Tab"); await page.keyboard.press("Escape"); await settle(page, 100);
        const after = await page.evaluate(metrics);
        assert.equal(after.y, before.y); assert.equal(after.height, before.height);
        assert.equal(after.main.width, before.main.width);
      });
      await check(`thumbnail scroll ${width}`, async () => {
        const target = page.locator('.detail-thumbnail').last();
        await target.click();
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll('[data-product-gallery] img:not([data-product-variant-image]):not([data-product-image-fallback])')].filter(image => getComputedStyle(image).display !== 'none');
          const image = images.at(-1);
          return Math.abs(image.getBoundingClientRect().top - parseFloat(getComputedStyle(image).scrollMarginBlockStart)) <= 2;
        });
        const images = await page.locator('[data-product-gallery] img:not([data-product-variant-image])').evaluateAll(images => images.filter(image => getComputedStyle(image).display !== 'none').map(image => ({ top: image.getBoundingClientRect().top, inset: parseFloat(getComputedStyle(image).scrollMarginBlockStart) })));
        assert.ok(Math.abs(images.at(-1).top - images.at(-1).inset) <= 2, `Thumbnail lands at the visible header inset: ${JSON.stringify(images.at(-1))}`);
      });
    } else await check(`gallery drag ${width}`, async () => {
      const gallery = page.locator('[data-product-gallery]'); const box = await gallery.boundingBox();
      const before = await page.evaluate(metrics);
      await page.mouse.move(box.x + box.width * .8, box.y + 100); await page.mouse.down();
      await page.mouse.move(box.x + box.width * .2, box.y + 100, { steps: 12 }); await page.mouse.up();
      await settle(page, 700);
      const position = await gallery.evaluate(gallery => ({ left: gallery.scrollLeft, positions: [...gallery.querySelectorAll('img')].filter(image => getComputedStyle(image).display !== 'none').map(image => image.offsetLeft), dragging: gallery.classList.contains('is-pointer-dragging') }));
      assert.ok(position.positions.some(left => Math.abs(left - position.left) <= 1), "Gallery settles on a photo");
      assert.equal(position.dragging, false); assert.equal((await page.evaluate(metrics)).y, before.y);
      return position;
    });
    if (process.argv.includes('--touch') && width < 1024) await check(`touch gallery ${width}`, async () => {
      await page.evaluate(() => document.querySelector('[data-product-gallery]').scrollTo({ left: 0, behavior: 'instant' }));
      const gallery = page.locator('[data-product-gallery]'); const box = await gallery.boundingBox();
      const before = await page.evaluate(metrics); const session = await context.newCDPSession(page);
      const y = Math.max(120, Math.min(450, box.y + box.height / 2));
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .8, y, id: 1 }] });
      for (const fraction of [.65, .5, .35, .2]) {
        await page.waitForTimeout(40);
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * fraction, y, id: 1 }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(page, 850);
      assert.ok(await gallery.evaluate(gallery => gallery.scrollLeft > 0), 'Native touch swipe moves the gallery');
      const points = gap => [-1, 1].map((sign, index) => ({ x: box.x + box.width / 2 + sign * gap, y, id: index + 1 }));
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(35) });
      for (const gap of [45, 55, 65]) {
        await page.waitForTimeout(40); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(gap) });
      }
      assert.equal(await page.locator('.media-zoom-float').count(), 1);
      const during = await page.evaluate(metrics);
      assert.ok(during.scrollWidth <= during.width + 1, 'Touch inspection must not add horizontal page space');
      assert.equal(during.height, before.height);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(page, 100);
      assert.equal(await page.locator('.media-zoom-float, .media-zoom-source-active').count(), 0);
      const after = await page.evaluate(metrics);
      assert.equal(after.height, before.height); assert.equal(after.y, before.y);
      await session.detach();
    });
    await page.goto(base + "/teamwear/", { waitUntil: "domcontentloaded" }); await settle(page);
    await check(`Teamwear floating action ${width}`, async () => {
      const before = await page.evaluate(metrics);
      const frames = await sample(page, async () => {
        await page.evaluate(() => scrollTo({ top: 1000, behavior: "instant" })); await page.waitForTimeout(90);
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(40);
        await page.evaluate(() => scrollTo({ top: 1000, behavior: "instant" })); await page.waitForTimeout(550);
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      });
      assert.ok(frames.every(f => Math.abs(f.h - before.height) <= 1), `Floating action changes document height: ${[...new Set(frames.map(f => f.h))]}`);
      assert.equal(await page.locator('.primary-action.is-floating').count(), 0);
      return { frames };
    });
    for (const rail of await page.locator('[data-card-rail]').all()) await check(`Teamwear rail ${width} ${await rail.getAttribute('id')}`, async () => {
      await rail.scrollIntoViewIfNeeded(); await settle(page, 1000);
      const box = await rail.boundingBox(); const before = await page.evaluate(metrics);
      await page.mouse.move(box.x + box.width * .7, box.y + Math.min(100, box.height / 2)); await page.mouse.down();
      await page.mouse.move(box.x + box.width * .2, box.y + Math.min(100, box.height / 2), { steps: 12 }); await page.mouse.up();
      await settle(page, 850);
      const state = await rail.evaluate(rail => ({ left: rail.scrollLeft, maximum: rail.scrollWidth - rail.clientWidth, dragging: rail.classList.contains('is-pointer-dragging'), settling: rail.classList.contains('is-settling') }));
      assert.equal(state.dragging, false); assert.equal(state.settling, false); assert.ok(state.left > 0);
      assert.equal((await page.evaluate(metrics)).height, before.height);
      return state;
    });
    await page.screenshot({ path: path.join(output, `teamwear-${width}.png`) });
    if ([390, 1440].includes(width)) await check(`breakpoint cleanup ${width}`, async () => {
      await page.goto(base + '/products/AE14008/', { waitUntil: 'domcontentloaded' }); await settle(page);
      if (width < 1024) {
        await page.locator('[data-nav-toggle]').click(); await settle(page);
        await page.setViewportSize({ width: 1440, height: 844 }); await settle(page);
        assert.equal((await page.evaluate(metrics)).state, 'closed');
        assert.ok(await page.locator('.detail-thumbnail').count() > 0, 'Entering Large builds thumbnail navigation');
      } else {
        await page.locator('[data-product-gallery] img:not([data-product-variant-image])').first().evaluate(image => image.focus({ preventScroll: true }));
        await page.keyboard.press('Enter'); await settle(page, 150);
        await page.setViewportSize({ width: 768, height: 844 }); await settle(page);
        assert.equal(await page.locator('.media-zoom-overlay').count(), 0);
        assert.equal(await page.locator('.detail-thumbnails:visible').count(), 0);
      }
      assert.equal(await page.locator('main[inert]').count(), 0);
      assert.equal(await page.evaluate(() => document.body.classList.contains('media-zoom-overlay-open')), false);
      const resized = await page.evaluate(metrics);
      assert.ok(resized.scrollWidth <= resized.width + 1);
      await page.setViewportSize({ width, height: 844 }); await settle(page);
    });
    console.log(`MOTION_COMPONENTS_DONE ${width}`);
    }
    }
    if (!process.argv.includes('--efficiency-only') && !process.argv.includes('--only-layout')) await check(`page transitions ${width} ${reducedMotion}`, async () => {
      const transitions = [];
      async function navigate(action, expected) {
        const from = page.url();
        await action(); await page.waitForURL(url => url.href !== from, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const events = await page.evaluate(() => window.__transitions || []);
        if (reducedMotion !== "reduce") {
          if (expected !== 'none') assert.ok(events.length, `${expected} from ${from}: Cross-document View Transition actually ran: ${JSON.stringify(await page.evaluate(() => ({ lifecycle: window.__lifecycle, source: sessionStorage.getItem('__motionSource') })))}`);
          if (expected !== "none") {
            assert.equal(events.at(-1).type, expected, JSON.stringify(events));
            assert.ok(events.at(-1).animations.some(a => a.name === `page-${['overlay', 'peer'].includes(expected) ? 'fade' : expected}-new`), `Destination animation missing: ${JSON.stringify(events)}`);
          } else assert.ok(!events.at(-1)?.type);
        } else if (reducedMotion === "reduce") assert.equal(events.length, 0, "Reduced motion disables page animation");
        assert.equal(await page.evaluate(() => document.documentElement.dataset.pageMotion), undefined, "Motion state clears");
        const dimensions = await page.evaluate(metrics);
        assert.ok(dimensions.scrollWidth <= dimensions.width + 1);
        transitions.push({ from, to: page.url(), expected, events });
      }
      await page.goto(base + '/collections/tees/', { waitUntil: 'domcontentloaded' }); await settle(page);
      await page.evaluate(() => scrollTo({ top: 650, behavior: 'instant' })); await settle(page, 100);
      const cardIndex = await page.locator('.product-card').evaluateAll(cards => cards.findIndex(card => { const rect = card.getBoundingClientRect(); return rect.top >= 64 && rect.bottom < innerHeight; }));
      assert.ok(cardIndex >= 0);
      await navigate(() => page.locator('.product-card').nth(cardIndex).click(), 'forward');
      await navigate(() => page.goBack({ waitUntil: 'domcontentloaded' }), 'backward');
      assert.ok(Math.abs((await page.evaluate(metrics)).y - 650) <= 2, 'Back restores catalog scroll');
      await navigate(() => page.locator('.product-card').nth(cardIndex).click(), 'forward');
      await navigate(() => page.locator('.product-feed-section .product-card').first().click(), 'peer');
      if (width >= 1024) await navigate(() => page.locator('[data-header-parent]').first().click(), 'backward');
      else {
        await page.locator('[data-nav-toggle]').click(); await settle(page);
        await navigate(() => page.locator('.drawer-nav a[href="/collections/all"]').first().click(), 'overlay');
      }
      await navigate(() => page.locator('.site-logo').click(), 'none');
      await page.goto(base + '/teamwear/', { waitUntil: 'domcontentloaded' }); await settle(page);
      await navigate(() => page.locator('[data-primary-action]').click(), 'forward');
      await navigate(() => page.goBack({ waitUntil: 'domcontentloaded' }), 'backward');
      return { transitions };
    });
    if (!process.argv.includes('--efficiency-only') && !process.argv.includes('--only-layout') && width >= 1024) await check(`header panel ${width}`, async () => {
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await settle(page);
      const before = await page.evaluate(metrics);
      const parent = page.locator('[data-header-parent]').first();
      await parent.hover(); await page.waitForTimeout(50); await page.mouse.move(width - 100, 200);
      await parent.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
      await settle(page, 200);
      assert.equal((await page.evaluate(metrics)).height, before.height);
      assert.equal(await parent.getAttribute('aria-expanded'), 'false');
    });
    if (process.argv.includes('--efficiency-only')) await check(`resize efficiency ${width}`, async () => {
      await page.goto(base + '/products/AE14008/', { waitUntil: 'domcontentloaded' }); await settle(page);
      const session = await context.newCDPSession(page); await session.send('Performance.enable');
      const before = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
      const work = await page.evaluate(async () => {
        const rail = document.querySelector('.detail-thumbnails__rail'); const mutations = [];
        const observer = new MutationObserver(records => mutations.push(...records));
        observer.observe(rail, { attributes: true, childList: true, subtree: true });
        const start = performance.now();
        for (let i = 0; i < 8; i++) dispatchEvent(new Event('resize'));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        observer.disconnect(); return { milliseconds: performance.now() - start, mutations: mutations.length };
      });
      const after = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
      await session.detach();
      assert.equal(work.mutations, 0, 'An unchanged thumbnail rail must not mutate for a resize burst');
      assert.ok(after.LayoutCount - before.LayoutCount <= 2, 'Unchanged resizing must not force a layout for each thumbnail');
      return { work, layouts: after.LayoutCount - before.LayoutCount, styleRecalculations: after.RecalcStyleCount - before.RecalcStyleCount,
        layoutMilliseconds: (after.LayoutDuration - before.LayoutDuration) * 1000, scriptMilliseconds: (after.ScriptDuration - before.ScriptDuration) * 1000 };
    });
    console.log(`MOTION_AUDIT_WIDTH_DONE ${width}`);
    await context.close();
  }
} finally {
  await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, errors: report.errors, output }));
if (report.failures.length || report.errors.length) process.exitCode = 1;
