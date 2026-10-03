# Motion and efficiency audit

This is a recorded audit snapshot. Counts, measurements, and screenshots below describe that run, not the current catalog size or a new browser verification. Use the commands below to remeasure later source changes; current interface decisions are maintained in `docs/design-system.md`.

## Corrections

| Issue | Shared correction |
| --- | --- |
| Opening an overlay changed the background width by 15px on Windows and resized cards. | Keep the root scrollbar gutter stable; remove the duplicate header gutter. |
| Cross-document transitions intermittently canceled before the destination revealed. | Parse the shared stylesheets before the early route controller queries media. Handle skipped transition promises and clear temporary state. |
| Large detail galleries shifted when thumbnail navigation initialized. | Declare thumbnail-capable panels in generated HTML and reserve enhanced geometry before the first content paint. Preserve the original geometry without JavaScript. |
| The search footer jumped out of view when asynchronous results arrived. | Hide the footer visually while results are busy; reveal it at the final position when loading succeeds or fails. |
| Thumbnail updates repeatedly rewrote unchanged elements and forced layout. | Batch reads, coalesce events into one animation frame, write changed attributes only, and skip hidden Base/Medium rails. |
| Catalog setup read card bounds between repeated grid attribute writes. | Read media bounds together and mark each grid once. Retain one shared proximity observer. |

The corrections preserve existing final geometry, image crops, animation durations, easing, and navigation behavior. Nine before/after geometry comparisons across Product Detail, Teamwear Customize, and Search at 390/1024/1440px matched exactly.

Source owners updated for this audit:

- Shared styles: `assets/css/components.css`, `pages.css`, and `product-gallery.css`.
- Behavior: `assets/js/page-transitions.js`, `product-gallery.js`, and `catalog-loading.js`.
- Generation: `scripts/lib/site-renderers.mjs` and asset versions in `scripts/build-site.mjs`; generated pages are rebuilt from these sources.
- Verification and documentation: `scripts/verify-motion-browser.mjs`, the shared component/motion validators, `docs/design-system.md`, and `docs/performance.md`.

## Measured efficiency

A controlled burst of eight unchanged `resize` events on the AE14008 detail page at 1440px:

| Browser metric | Before | After |
| --- | ---: | ---: |
| Layouts | 57 | 0 |
| Style recalculations | 112 | 0 |
| Thumbnail DOM mutations | 448 | 0 |
| Layout CPU time | 4.403ms | 0ms |
| Script CPU time | 6.038ms | 0.328ms |

The final 390px check also produced zero layouts, style recalculations, and thumbnail mutations. These are component measurements, not a claim about whole-site speed or device frame rate. Reports: `output/playwright/motion/efficiency-before/report.json` and `efficiency-final/report.json`.

## Verification

The final full-route run passed 259 layout cases across 37 active pages and seven widths, with startup CLS 0, no console errors, and no failed assertions. Separate normal interaction, touch, reduced-motion, disabled-JavaScript, and efficiency runs also passed. The performance verification passed six route/width samples and the five 500-card layouts. Shared validators, generated-output checks, and `git diff --check` passed.

- All active catalog and product routes, plus Teamwear, Customize, Search, and Font Credits, at 320/390/768/1023/1024/1440/1920px. Catalog routes and visible products are discovered from their central sources.
- Startup layout shifts, horizontal overflow, stable height after lazy loading, and space below the footer.
- Repeated overlay opening/closing/reversals, controller handoff, focus containment/restoration, dropdown keyboard operation, and desktop header hover/keyboard behavior.
- Forward, backward, peer, overlay, and equivalent-catalog navigation; actual native transition animations and Back scroll restoration.
- Mouse dragging, native touch swiping, temporary pinch inspection, keyboard inspection, thumbnail scroll landing, Teamwear rails, and floating-action reversals.
- Breakpoint changes while the mobile drawer or desktop inspection overlay is open; cleanup of scroll locks, inert state, and temporary media.
- Reduced motion and disabled JavaScript.
- All related-card membership, uniqueness, current-product exclusion, data isolation, and a synthetic 500-card feed at five widths.

Reports are under ignored `output/playwright/motion/` and `output/playwright/performance/motion-final/`. The shared static validators and generated-output checks cover the production sources.

## Repeating the checks

Use the existing Playwright runtime and Chromium; no site dependency is added:

```powershell
node scripts/verify-motion-browser.mjs --all-products --only-layout --label=all-pages-final
node scripts/verify-motion-browser.mjs --widths=390,1440 --label=final
node scripts/verify-motion-browser.mjs --widths=390 --touch --label=touch
node scripts/verify-motion-browser.mjs --widths=390,1440 --motion=reduce --label=reduced
node scripts/verify-motion-browser.mjs --widths=320,1440 --only-layout --no-js --label=no-js
node scripts/verify-motion-browser.mjs --widths=390,1440 --efficiency-only --label=efficiency-final
node scripts/measure-performance.mjs --verify --runs=1 --label=motion-final
```

The motion runner starts and closes its own local preview. Set `BROWSER_EXECUTABLE` for an installed Chromium and `NODE_PATH` when using the bundled runtime. Google Fonts CSS is stubbed for reproducible offline motion checks; local fonts remain enabled. Screenshots therefore show fallback text for remote icon/font glyphs and do not verify Google font loading behavior. The performance run uses `PERF_OFFLINE_FONTS=1`. No real-device frame-rate, Safari/Firefox, or public Web Vitals claim is made by these local checks.

Generated HTML and DOM size still grow with the number of catalog cards. The 500-card test verifies layout integrity and progressive media loading; larger catalogs should be measured again before making a capacity claim. No pagination or card cap was introduced.
