# Catalog loading and continuous scrolling

Catalogs contain all distinct catalog cards in generated HTML. Product detail feeds contain the same cards for every other visible product, grouped in existing relevance order. Every card for the current product is excluded; duplicate card URLs are removed. There is no pagination, card-count limit, or repeated loop at the end.

The first catalog image is eager and high priority. `catalog-loading.js` promotes other images actually in the initial viewport to eager loading at normal priority. Remaining images retain native lazy loading at low priority, so the browser fetches ahead of scrolling rather than downloading the entire feed during idle time. Lazy loading is proximity based, not a strict wait-until-the-first-screen-finishes queue.

All titles, prices, links, and reserved media sizes remain in HTML, including without JavaScript. Supported browsers skip distant offscreen square media rendering with `content-visibility: auto`; text layout remains unchanged. The existing media aspect ratio reserves its exact footprint without estimated card heights. The shared loader restores ordinary painting within one viewport of the visible area to preserve fractional-width photo rasterization. Without JavaScript or IntersectionObserver, ordinary rendering and native image loading remain available.

Listings do not request `catalog.js`. Product detail pages load one generated, content-versioned `assets/js/products/{code}.js` payload before the shared choice controller. `window.PARADIGM_PRODUCT` holds only the current product's choice data. The full generated catalog remains a build-validation artifact. Source product data stays centralized in `data/products-source.json`.

## Repeating measurements

Use the existing Playwright runtime; no additional site dependency is required:

```powershell
node scripts/measure-performance.mjs --label=baseline
node scripts/measure-performance.mjs --label=current --verify
node scripts/measure-performance.mjs --label=mobile-4g --widths=390 --throttled
```

The runner starts a temporary local HTTP preview by default. Set `PREVIEW_URL` to use an existing preview or production URL. It uses installed Chrome by default; `BROWSER_EXECUTABLE` accepts another Chromium executable. `PERF_OFFLINE_FONTS=1` blocks Google Fonts for reproducible offline comparisons and is recorded in the report. Use the bundled Node and `NODE_PATH` if Playwright is provided by the Codex runtime.

Options include `--runs=3`, `--routes=/,/collections/tees/,/products/AE14008/`, and `--widths=390,1440`. Reports and screenshots go under ignored `output/playwright/performance/{label}/`. Reports include median LCP, CLS, FCP, main-thread long-task blocking time, request priorities, and transferred bytes captured through browser network events. Long-task blocking time is not Lighthouse TBT; the runner does not estimate TTI or field INP. Reduced motion disables animations and hero autoplay during comparisons.

`--verify` checks all related-card membership, uniqueness, current-product exclusion, network data isolation, reserved scroll height, keyboard focus, Back navigation scroll restoration, disabled JavaScript, and a synthetic 500-card layout at 320/390/768/1024/1440px.

The local preview is uncompressed and uncached. Its numbers diagnose relative costs and do not represent production compression, cache behavior, or real-user performance. Check production separately with PageSpeed Insights and Chrome DevTools before reporting public Web Vitals.

## Animation and scrolling efficiency

See [the motion audit](motion-audit.md) for startup stability, interruptible interactions, and resize measurements. Catalog setup batches media bounds before marking each grid; thumbnail synchronization skips hidden mobile rails and avoids rewriting unchanged nodes. The 500-card verification still checks that distant image loading and proximity painting preserve document height and avoid horizontal overflow.
