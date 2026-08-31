import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CSS_DIRECTORY = path.join(ROOT, "assets", "css");

function propertyValue(source, property) {
  const match = source.match(new RegExp(`${property.replaceAll("-", "\\-")}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

function blockAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing ${marker}`);
  const open = source.indexOf("{", markerIndex);
  assert.notEqual(open, -1, `missing opening block for ${marker}`);
  let depth = 1;
  let close = open + 1;
  while (close < source.length && depth > 0) {
    if (source[close] === "{") depth += 1;
    if (source[close] === "}") depth -= 1;
    close += 1;
  }
  assert.equal(depth, 0, `unbalanced block for ${marker}`);
  return source.slice(open + 1, close - 1);
}

function ruleDeclarations(source, selector) {
  const declarations = [];
  let cursor = 0;
  while (cursor < source.length) {
    const selectorIndex = source.indexOf(selector, cursor);
    if (selectorIndex < 0) break;
    const open = source.indexOf("{", selectorIndex + selector.length);
    if (open < 0) break;
    const nextRuleBoundary = source.indexOf("}", selectorIndex + selector.length);
    if (nextRuleBoundary >= 0 && nextRuleBoundary < open) {
      cursor = selectorIndex + selector.length;
      continue;
    }
    let depth = 1;
    let close = open + 1;
    while (close < source.length && depth > 0) {
      if (source[close] === "{") depth += 1;
      if (source[close] === "}") depth -= 1;
      close += 1;
    }
    declarations.push(source.slice(open + 1, close - 1));
    cursor = close;
  }
  return declarations;
}

const tokens = await readFile(path.join(CSS_DIRECTORY, "tokens.css"), "utf8");
const reset = await readFile(path.join(CSS_DIRECTORY, "reset.css"), "utf8");
const layout = await readFile(path.join(CSS_DIRECTORY, "layout.css"), "utf8");
const components = await readFile(path.join(CSS_DIRECTORY, "components.css"), "utf8");
const motion = await readFile(path.join(CSS_DIRECTORY, "motion.css"), "utf8");
const pages = await readFile(path.join(CSS_DIRECTORY, "pages.css"), "utf8");
const teamwear = await readFile(path.join(CSS_DIRECTORY, "teamwear.css"), "utf8");
const teamwearStory = await readFile(path.join(CSS_DIRECTORY, "teamwear-story.css"), "utf8");
const teamwearTemplate = await readFile(path.join(ROOT, "scripts", "templates", "teamwear-page.html"), "utf8");
const teamwearBehavior = await readFile(path.join(ROOT, "assets", "js", "teamwear.js"), "utf8");
const mediaZoom = await readFile(path.join(ROOT, "assets", "js", "media-zoom.js"), "utf8");
const choices = await readFile(path.join(ROOT, "assets", "js", "choices.js"), "utf8");
const productionCssFiles = (await readdir(CSS_DIRECTORY)).filter((file) => file.endsWith(".css"));
const productionCssEntries = await Promise.all(
  productionCssFiles.map(async (file) => [file, await readFile(path.join(CSS_DIRECTORY, file), "utf8")])
);

const cssScaleTransformPattern = /\bscale\s*\(/;
assert.doesNotMatch("filter: grayscale(1);", cssScaleTransformPattern, "The CSS scale validator must not reject grayscale filters");
for (const [file, source] of productionCssEntries) {
  assert.doesNotMatch(source, /@media[^\{]*\(\s*(?:any-)?hover\s*:/, `${file} must not gate interaction styling by hover capability`);
  assert.doesNotMatch(source, /@media[^\{]*\(\s*(?:any-)?pointer\s*:/, `${file} must not gate interaction styling by pointer capability`);
  assert.doesNotMatch(source, cssScaleTransformPattern, `${file} must not use scale() effects`);
  assert.doesNotMatch(source, /(^|[;\{])\s*scale\s*:/m, `${file} must not use the individual scale property`);
}

const spacingScale = new Map([
  ["--space-1", "0.125rem"],
  ["--space-2", "0.25rem"],
  ["--space-3", "0.5rem"],
  ["--space-4", "0.75rem"],
  ["--space-5", "1rem"],
  ["--space-6", "1.5rem"],
  ["--space-7", "2rem"],
  ["--space-8", "3rem"],
  ["--space-9", "4rem"]
]);
for (const [token, value] of spacingScale) {
  assert.equal(propertyValue(tokens, token), value, `${token} must remain ${value}`);
}
assert.doesNotMatch(tokens, /--space-0-5\s*:/, "The former fractional spacing token must be removed");
assert.doesNotMatch(tokens, /--space-(?:10|11)\s*:/, "The primitive spacing scale must stop at space-9");
assert.equal(propertyValue(tokens, "--layout-gutter-inline"), "var(--space-5)", "Base gutter must be 16px");
assert.equal(propertyValue(tokens, "--layout-canvas-width"), undefined, "The removed 1440px visual-canvas cap must not remain defined");
assert.equal(propertyValue(tokens, "--layout-section-padding-tight"), "var(--space-6)", "Tight sections must use 24px");
assert.equal(propertyValue(tokens, "--layout-section-padding-default"), "var(--space-8)", "Default sections must use 48px");
assert.equal(propertyValue(tokens, "--layout-section-padding-editorial"), "var(--space-9)", "Editorial sections must use 64px");
assert.equal(propertyValue(tokens, "--layout-section-content-gap"), "var(--space-8)", "Section content gaps must use 48px");
assert.equal(propertyValue(tokens, "--primary-action-padding-block"), "var(--space-5)", "Primary actions must use 16px vertical padding");
assert.equal(propertyValue(tokens, "--primary-action-padding-inline"), "var(--space-7)", "Primary actions must use 32px horizontal padding");
assert.match(
  reset,
  /html\s*\{[\s\S]*?background:\s*linear-gradient\(\s*to bottom,\s*var\(--color-surface-high\) 0 50%,\s*var\(--color-container-mid\) 50% 100%\s*\);/,
  "The root canvas must use a hard un-tokenized 50% split between the page-top and footer-bottom colors"
);
assert.doesNotMatch(blockAfter(reset, "html"), /\bopacity\s*:|rgba\(|hsla\(|color-mix\(|transparent/, "The root canvas must use fully opaque semantic colors without blending");
assert.doesNotMatch(tokens, /--(?:root|overscroll)[^:]*split\s*:/, "The functional root-canvas split must remain literal rather than becoming a design token");
assert.equal(propertyValue(tokens, "--type-interface-label-transform"), "uppercase", "Interface labels must use the shared uppercase presentation token");
assert.match(
  tokens,
  /--header-actions-width:\s*calc\(\s*var\(--icon-size\)\s*\+\s*var\(--icon-size\)\s*\+\s*var\(--space-5\)\s*\);/,
  "Header actions must preserve two intrinsic 24px glyph boxes with the shared 16px visual gap"
);
assert.equal(propertyValue(tokens, "--header-control-gap"), undefined, "The obsolete off-scale 10px header gap token must remain removed");
assert.match(propertyValue(tokens, "--header-control-target-crop"), /var\(--control-size-large\)[\s\S]*var\(--icon-size\)[\s\S]*var\(--space-5\)/, "Adjacent header hit regions must derive their crop from the target, glyph, and gap tokens");
assert.equal(propertyValue(tokens, "--external-link-arrow-size"), "1em", "External-link arrows must match the label font size");
assert.equal(propertyValue(tokens, "--external-link-arrow-gap"), "var(--space-1)", "External-link arrows must use the shared 2px label gap");
assert.equal(propertyValue(tokens, "--external-link-arrow-motion-distance"), "var(--space-1)", "External-link arrow motion must use the shared 2px distance");
assert.equal(propertyValue(tokens, "--media-zoom-float-z-index"), "120", "Floating product inspection must sit above the shared header");
assert.equal(propertyValue(tokens, "--media-zoom-overlay-z-index"), "130", "The enlarged gallery must sit above every other shared layer");
assert.equal(propertyValue(tokens, "--motion-duration-enter"), "400ms", "Page and component entrances must use the shared 400ms role");
assert.equal(propertyValue(tokens, "--motion-duration-exit"), "200ms", "Page and component exits must use the shared 200ms role");
assert.equal(propertyValue(tokens, "--motion-duration-standard"), "300ms", "Standard state changes must use the shared 300ms role");
assert.equal(propertyValue(tokens, "--motion-duration-compact-enter"), "250ms", "Compact surfaces must use the shared 250ms entrance role");
assert.equal(propertyValue(tokens, "--motion-stagger-short"), "40ms", "Short sequencing must use the shared 40ms stagger");
assert.equal(propertyValue(tokens, "--motion-distance-component"), "var(--space-4)", "Component travel must use the shared 12px role");
assert.equal(propertyValue(tokens, "--motion-page-depth-shift"), "24%", "Receding pages must use the shared 24% depth shift");
assert.match(motion, /@view-transition\s*\{[\s\S]*?navigation:\s*auto;/, "Cross-document View Transitions must be progressively enabled in the shared motion layer");
assert.match(motion, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?navigation:\s*none;/, "Reduced motion must disable cross-document page transitions");
assert.doesNotMatch(tokens, /--button-height\s*:/, "Primary actions must be content-sized rather than height-token sized");
const mediumTokens = blockAfter(tokens, "@media (min-width: 48rem)");
assert.equal(propertyValue(mediumTokens, "--layout-gutter-inline"), "var(--space-7)", "Medium and Large gutters must be 32px");
assert.equal(propertyValue(tokens, "--content-width"), "60rem", "Base and Medium content must max at 960px");
const largeTokens = blockAfter(tokens, "@media (min-width: 64rem)");
assert.equal(propertyValue(largeTokens, "--content-width"), "80rem", "Large content must max at 1280px");
assert.doesNotMatch(layout, /\.split(?:\s|\{|,)/, "The unused split layout must be removed");
assert.doesNotMatch(`${layout}\n${components}`, /gap:\s*1px/, "Unused 1px grid gaps must be removed");
assert.doesNotMatch(
  `${layout}\n${components}\n${pages}`,
  /(?:gap|margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?)\s*:\s*2px/,
  "Shared 2px spacing must consume --space-1"
);
assert.match(
  components,
  /\.product-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*?gap:\s*var\(--space-1\)/,
  "Base product feeds must use two columns and the shared 2px gap"
);
assert.doesNotMatch(tokens, /--product-card-rail-(?:width|height)/, "Removed carousel size tokens must not remain in the design system");
assert.doesNotMatch(`${components}\n${pages}`, /marquee-strip/, "Removed horizontal product-carousel styles must not remain");
assert.match(
  components,
  /\.product-card__body\s*\{[\s\S]*?gap:\s*var\(--space-2\)/,
  "Catalog product names and prices must use the 4px tight internal gap"
);
assert.match(
  components,
  /\.product-card__body\s*\{[\s\S]*?padding:\s*0 calc\(var\(--layout-shell-gutter-inline\) - var\(--space-3\)\) var\(--space-3\)/,
  "Product-card text must align to the responsive 16px/32px shell gutter without moving product media"
);
assert.match(
  components,
  /\.page-headline__row\s*\{[\s\S]*?gap:\s*var\(--space-5\);[\s\S]*?min-height:\s*var\(--control-size-large\);[\s\S]*?padding-inline:\s*var\(--layout-shell-gutter-inline\)/,
  "Every page headline must use the shared 48px row and responsive shell gutter"
);
assert.match(
  components,
  /\.breadcrumb\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-x:\s*auto/,
  "Breadcrumbs must own overflow without displacing the trailing headline action"
);
assert.match(
  components,
  /\.breadcrumb--back\s*\{[\s\S]*?justify-content:\s*flex-start/,
  "Back breadcrumbs must align their complete chevron-and-label control with other breadcrumbs"
);
assert.match(
  components,
  /\.page-headline__action\s*\{[\s\S]*?flex:\s*0 0 auto/,
  "Page-headline actions must occupy only their intrinsic width"
);
assert.doesNotMatch(components, /\.filter-bar|\.breadcrumb--(?:standalone|embedded)/, "Legacy headline layout variations must remain removed");
assert.doesNotMatch(pages, /\.reference-page--detail \.page-headline/, "Product Detail must use the shared headline surface without overrides");
assert.match(
  components,
  /\[data-media-zoom-touch\],[\s\S]*?\[data-media-zoom-gallery\] img\s*\{[\s\S]*?touch-action:\s*pan-x pan-y;/,
  "Touch-inspection media must retain native horizontal and vertical one-finger panning"
);
assert.match(components, /\.media-zoom-float\s*\{[\s\S]*?position:\s*fixed !important;[\s\S]*?will-change:\s*width, height, transform;/, "Pinched media must use an isolated fixed copy with frame-updated dimensions and translation");
assert.match(components, /\.media-zoom-source-active\s*\{[\s\S]*?visibility:\s*hidden !important;/, "Pinched media must hide its in-flow source without collapsing layout");
assert.match(components, /\.media-zoom-overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?overflow:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/, "The enlarged gallery must own full-viewport two-axis scrolling");
assert.match(components, /\.media-zoom-overlay__column\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*0;[\s\S]*?margin-inline:\s*auto;/, "The enlarged gallery must remain a centered gapless image column");
assert.match(mediaZoom, /const LARGE_VIEW_QUERY = "\(min-width: 64rem\)";/, "The enlarged overlay must begin at the shared Large breakpoint");
assert.match(mediaZoom, /const OVERLAY_GALLERY_RATIO = 2;/, "Large inspection must keep its double-width overlay column");
assert.doesNotMatch(`${components}\n${mediaZoom}`, /media-zoom-lens|LENS_GALLERY_RATIO|DESKTOP_ZOOM|renderLens|queueLensFrame/, "Large inspection must not retain the removed hover magnifier");
assert.match(mediaZoom, /gallery\.getBoundingClientRect\(\)\.width \* OVERLAY_GALLERY_RATIO/, "Overlay width must derive from twice the measured gallery column");
assert.match(mediaZoom, /overlay\.scrollLeft = Math\.max\(0, \(overlay\.scrollWidth - overlay\.clientWidth\) \/ 2\)/, "A wider overlay column must initialize at its horizontal center");
assert.match(mediaZoom, /overlay\.scrollTop = images\[selectedIndex\]\?\.offsetTop \|\| 0/, "The enlarged gallery must open vertically at the selected image");
assert.match(mediaZoom, /largeView\.addEventListener\("change", setLargeGalleryMode\)/, "Leaving Large must tear down the enlarged gallery");
assert.match(mediaZoom, /previousBodyOverflow[\s\S]*?trigger\.focus\(\{ preventScroll: true \}\)/, "Overlay closure must restore body scrolling and source focus");
assert.doesNotMatch(mediaZoom, /\.style\.scale\b|\bscale\s*\(/, "Media inspection must never bypass the CSS scaling prohibition through JavaScript");

const mediumComponents = blockAfter(components, "@media (min-width: 48rem)");
assert.match(
  mediumComponents,
  /\.product-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  "Medium and larger catalogs must use three columns"
);

assert.match(
  pages,
  /\.product-detail__summary \.stack-md\s*\{[\s\S]*?gap:\s*var\(--space-6\);[\s\S]*?margin-top:\s*var\(--space-5\)/,
  "Product Header to Color must use 16px while Color to unlabeled Size choices uses 24px"
);
assert.match(
  pages,
  /\.reference-page--detail \.rich-description\s*\{[\s\S]*?margin-top:\s*var\(--space-7\)/,
  "Detail choices and rich descriptions must use the 32px composition rhythm"
);
assert.doesNotMatch(
  `${tokens}\n${layout}\n${components}\n${pages}\n${teamwearStory}`,
  /--border-(?:hairline|control)\b/,
  "Border aliases must be removed in favor of direct semantic outline colors"
);

const mediumPages = blockAfter(pages, "@media (min-width: 48rem)");
assert.match(
  mediumPages,
  /\.product-detail__summary\s*\{[\s\S]*?padding:\s*var\(--space-5\) var\(--space-7\)/,
  "Medium and larger product information must retain 16px vertical padding and align horizontally to the 32px responsive gutter"
);
assert.doesNotMatch(
  mediumPages,
  /\.product-detail__(?:panel|gallery)\s*\{|grid-template-columns|grid-column/,
  "Product detail must retain the Base single-column carousel composition through Medium"
);

const largePages = blockAfter(pages, "@media (min-width: 64rem)");
const largeComponents = blockAfter(components, "@media (min-width: 64rem)");
assert.match(
  largePages,
  /\.product-detail__panel\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)[\s\S]*?align-items:\s*stretch[\s\S]*?gap:\s*0/,
  "Large product detail must use a gapless equal-height five-column grid"
);
assert.match(largePages, /\.product-detail__gallery\s*\{[\s\S]*?grid-column:\s*span 3/, "Large gallery must span three columns");
assert.match(largePages, /\.product-detail__summary\s*\{[\s\S]*?grid-column:\s*span 2/, "Large information must span two columns");
assert.match(largeComponents, /data-action-behavior="fixed-to-static"[\s\S]*?position:\s*static/, "Large purchase and inquiry actions must be static");

for (const declarations of ruleDeclarations(pages, ".reference-page--detail .product-detail__summary")) {
  assert.doesNotMatch(declarations, /min-height\s*:/, "Product information must not use a fixed or minimum height");
}

assert.match(
  teamwearStory,
  /\.teamwear-highlights,[\s\S]*?padding-block:\s*var\(--layout-section-padding-editorial\)/,
  "All Teamwear editorial sections must use the 64px semantic section role"
);
assert.match(teamwearStory, /\.teamwear-section-heading\s*\{[\s\S]*?margin-bottom:\s*var\(--layout-section-content-gap\)/, "Teamwear headings must use the 48px content gap");
assert.match(teamwearStory, /\.teamwear-highlights__header\s*\{[\s\S]*?margin-bottom:\s*var\(--layout-section-content-gap\)/, "Highlights must use the same 48px content gap");
assert.match(teamwearStory, /\.teamwear-story-shell \.site-header\s*\{[\s\S]*?position:\s*absolute;/, "The Teamwear header must keep its initial overlay position and scroll away with the page");
assert.doesNotMatch(teamwearStory, /has-floating-primary-action|\.teamwear-story-shell[^\{]*\.site-header[^\{]*\{[^}]*visibility:\s*hidden/, "The Teamwear header must not hide in response to the floating action");
assert.match(teamwearStory, /padding:\s*0 var\(--teamwear-content-edge\)/, "Teamwear rails must start and end at the derived Teamwear content edge");
assert.match(teamwearStory, /scroll-padding-inline:\s*var\(--teamwear-content-edge\)/, "Teamwear rails must use the content edge for scroll positioning");
assert.match(teamwearStory, /\.teamwear-highlights__viewport,[\s\S]*?\.teamwear-colorway__viewport,[\s\S]*?\.teamwear-gallery__viewport\s*\{[\s\S]*?position:\s*relative;/, "Every Teamwear rail viewport must establish the overlay positioning context");
assert.match(teamwearStory, /\.teamwear-rail-controls\s*\{[\s\S]*?display:\s*none;/, "Teamwear rail controls must remain hidden below Large");
assert.match(teamwearStory, /\.teamwear-rail-button\s*\{[\s\S]*?width:\s*var\(--control-size-large\);[\s\S]*?height:\s*var\(--control-size-large\);[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--radius-pill\);[\s\S]*?background:\s*var\(--color-container-low\);[\s\S]*?color:\s*var\(--color-on-surface-high\);[\s\S]*?box-shadow:\s*none;/, "Teamwear rail controls must use real 48px circular interaction boxes with semantic colors");
assert.doesNotMatch(teamwearStory, /data:image\/svg\+xml|teamwear-rail-chevron-mask|-webkit-mask:\s*var\(--teamwear-rail|mask:\s*var\(--teamwear-rail/, "Teamwear rail controls must not recreate Material glyphs with SVG data masks");
assert.doesNotMatch(teamwearStory, /\.teamwear-rail-button::before\s*\{/, "Teamwear rail controls must paint their Material symbols directly without a pseudo-icon layer");
assert.match(teamwearStory, /\.teamwear-rail-button \.material-icon\s*\{[\s\S]*?width:\s*var\(--icon-size\);[\s\S]*?height:\s*var\(--icon-size\);[\s\S]*?font-size:\s*var\(--icon-size\);/, "Teamwear rail controls must visibly render the shared 24px Material glyph inside the 48px target");
assert.match(teamwearStory, /\.teamwear-rail-button\[hidden\]\s*\{[\s\S]*?display:\s*none;/, "Unavailable Teamwear rail directions must override the authored button display rule");
assert.doesNotMatch(teamwearStory, /\.teamwear-rail-button[^\{]*\{[^}]*transition\s*:/, "Teamwear rail buttons must not animate hover-state changes");
assert.doesNotMatch(teamwearStory, /\.teamwear-rail-button[^\{]*:hover/, "Teamwear rail buttons must not define a hover effect");
assert.match(teamwearTemplate, /teamwear-highlights__viewport">\s*\{\{HIGHLIGHT_CONTROLS\}\}\s*<div class="teamwear-highlights__rail"/, "Highlight controls must be generated inside their rail viewport");
assert.match(teamwearTemplate, /teamwear-colorway__viewport">\s*\{\{COLORWAY_CONTROLS\}\}\s*<div class="teamwear-colorway__rail"/, "Colorway controls must be generated inside their rail viewport");
assert.match(teamwearTemplate, /teamwear-gallery__viewport">\s*\{\{GALLERY_CONTROLS\}\}\s*<div class="teamwear-gallery__rail"/, "Gallery controls must be generated inside their rail viewport");
assert.match(teamwearBehavior, /const atStart = rail\.scrollLeft <= 1;[\s\S]*?const lastCard = rail\.querySelector\("\.teamwear-rail-card:last-child"\);[\s\S]*?const railRight = rail\.getBoundingClientRect\(\)\.right;[\s\S]*?const lastCardRight = lastCard\?\.getBoundingClientRect\(\)\.right \|\| railRight;[\s\S]*?const atEnd = maximumScroll <= 1 \|\| lastCardRight <= railRight \+ 1;[\s\S]*?previousButton\.hidden = atStart;[\s\S]*?nextButton\.hidden = atEnd;/, "Teamwear rail controls must show only Previous as soon as the final card is fully visible");
assert.equal((teamwearTemplate.match(/<article class="teamwear-faq__item">/g) || []).length, 5, "Teamwear FAQ must render five static question-and-answer rows");
assert.doesNotMatch(teamwearTemplate, /<details|<summary|<i aria-hidden="true"><\/i>/, "Teamwear FAQ must not retain disclosure markup or icons");
assert.match(teamwearStory, /\.teamwear-story-page \.teamwear-faq__item\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?padding:\s*var\(--space-6\) 0;[\s\S]*?border-bottom:\s*1px solid var\(--color-outline-low\);/, "Static Teamwear FAQ rows must use one content column and space-6 vertical padding");
assert.match(teamwearStory, /\.teamwear-story-page \.teamwear-faq__item > p\s*\{[\s\S]*?color:\s*var\(--color-on-surface-low\);/, "Static Teamwear FAQ answers must remain visible at low emphasis");
assert.doesNotMatch(teamwearStory, /\.teamwear-story-page \.teamwear-faq (?:details|summary)|teamwear-faq-question-height/, "Teamwear FAQ styles must not reserve disclosure or closed-row geometry");
assert.doesNotMatch(teamwearBehavior, /faqList|faqItems|faqQuestions|teamwear-faq-question-height/, "Teamwear behavior must not retain accordion measurement code");
assert.match(
  teamwearStory,
  /\.teamwear-story-page\.reveal-ready \.teamwear-rail-card\[data-section-reveal\]\s*\{[\s\S]*?translate:\s*0 var\(--motion-distance-component\);[\s\S]*?var\(--rail-card-delay, 0ms\)/,
  "Teamwear rail cards must use the centralized 12px entrance and per-card delay"
);
assert.match(teamwearStory, /\.teamwear-rail-card__photo-track\s*\{[\s\S]*?width:\s*calc\(100% \+ var\(--space-5\) \+ var\(--space-5\)\);[\s\S]*?translate:\s*var\(--rail-photo-offset, 0px\) 0;/, "Teamwear rail photos must provide 16px inline bleed and consume the bounded photo offset");
assert.match(teamwearStory, /\.teamwear-rail-card__copy\s*\{[\s\S]*?translate:\s*var\(--rail-copy-offset, 0px\) 0;/, "Teamwear rail copy must consume its opposed offset");
assert.match(teamwearBehavior, /card\.style\.setProperty\("--rail-card-delay", `\$\{index \* 40\}ms`\)/, "Teamwear cards must reveal in DOM order with a 40ms stagger");
assert.match(teamwearBehavior, /getBoundingClientRect\(\)[\s\S]*?--rail-photo-offset[\s\S]*?positions\[index\] \* -16[\s\S]*?--rail-copy-offset[\s\S]*?positions\[index\] \* 8/, "Teamwear rails must read geometry before writing bounded opposed 16px and 8px offsets");
assert.match(teamwearBehavior, /reducedMotionQuery\.addEventListener\("change"[\s\S]*?rails\.forEach\(\(rail\) => railUpdates\.get\(rail\)\?\.\(\)\)/, "Teamwear rail motion must tear down and resume when the reduced-motion preference changes");
assert.match(teamwearStory, /\.teamwear-story-page \.teamwear-hero\s*\{[\s\S]*?width:\s*100%;[\s\S]*?margin-inline:\s*auto;[\s\S]*?padding:\s*0/, "Teamwear hero must span the complete viewport width without extra top padding");
assert.match(teamwearStory, /\.teamwear-material__media\s*\{[\s\S]*?width:\s*100%;[\s\S]*?margin-inline:\s*auto;/, "Teamwear full-bleed material media must span the complete viewport width");
assert.doesNotMatch(teamwearStory, /layout-canvas-width/, "Teamwear media must not retain the removed 1440px cap");
assert.match(teamwearStory, /\.teamwear-hero__copy\s*\{[\s\S]*?var\(--layout-section-padding-editorial\)[\s\S]*?var\(--primary-action-fixed-clearance\)/, "Hero copy must derive action clearance from shared primary-action tokens");
const mediumTeamwear = blockAfter(teamwearStory, "@media (min-width: 48rem)");
assert.match(
  teamwearStory,
  /--teamwear-card-width:\s*calc\(\s*\(min\(100vw, var\(--content-width\)\) - var\(--space-2\)\) \/ 2\s*\)/,
  "Base Teamwear rail cards must use the two-column reference-width formula with one rail gap"
);
assert.match(
  mediumTeamwear,
  /\.teamwear-story-page\s*\{[\s\S]*?--teamwear-card-width:\s*calc\(\s*\(min\(100vw, var\(--content-width\)\) - var\(--space-2\) - var\(--space-2\)\) \/ 3\s*\)/,
  "Medium and Large Teamwear rail cards must use the three-column reference-width formula with two rail gaps"
);
assert.equal(
  mediumTeamwear
    .replace(/\.teamwear-story-page\s*\{[\s\S]*?--teamwear-card-width:\s*calc\(\s*\(min\(100vw, var\(--content-width\)\) - var\(--space-2\) - var\(--space-2\)\) \/ 3\s*\);[\s\S]*?\}/, "")
    .trim(),
  "",
  "Teamwear must retain mobile composition through Medium; only rail-card sizing may change"
);
const largeTeamwear = blockAfter(teamwearStory, "@media (min-width: 64rem)");
assert.doesNotMatch(largeTeamwear, /(?:^|\n)\s*\.teamwear-highlights__header\s*\{[\s\S]*?grid-template-columns:/, "Highlights must keep eyebrow above title at Large");
assert.doesNotMatch(largeTeamwear, /(?:^|\n)\s*\.teamwear-section-heading\s*\{[\s\S]*?grid-template-columns:/, "Teamwear headings must keep eyebrow above title at Large");
assert.doesNotMatch(largeTeamwear, /\.teamwear-section-heading__content\s*\{[\s\S]*?grid-template-columns:/, "Rail controls must not reserve a heading column at Large");
assert.match(largeTeamwear, /\.teamwear-rail-controls\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?display:\s*grid;[\s\S]*?height:\s*var\(--teamwear-card-width\);[\s\S]*?padding-inline:\s*var\(--layout-shell-gutter-inline\);[\s\S]*?pointer-events:\s*none;/, "Large Teamwear rail controls must overlay the square image band at the physical browser-edge gutter");
assert.match(largeTeamwear, /\.teamwear-rail-button\s*\{[\s\S]*?pointer-events:\s*auto;/, "Overlay rail buttons must remain independently clickable");
assert.match(largeTeamwear, /\.teamwear-process__layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 3fr\);[\s\S]*?gap:\s*0;/, "Teamwear process content must use the 2fr/3fr Large split without a column gap");
assert.match(largeTeamwear, /\.teamwear-process__layout > \.teamwear-section-heading\s*\{[\s\S]*?padding-inline-end:\s*var\(--space-9\)/, "Teamwear process heading must create its Large separation with 64px inner-end padding");
assert.match(largeTeamwear, /\.teamwear-material__bento\s*\{[\s\S]*?repeat\(3,/, "Teamwear bento must gain three columns at Large");
assert.match(largeTeamwear, /\.teamwear-story-page \.teamwear-faq__layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 3fr\);[\s\S]*?gap:\s*0;/, "Teamwear FAQ must use the 2fr/3fr Large split without a column gap");
assert.match(largeTeamwear, /\.teamwear-story-page \.teamwear-faq__heading\s*\{[\s\S]*?padding-inline-end:\s*var\(--space-9\)/, "Teamwear FAQ heading must create its Large separation with 64px inner-end padding");
assert.doesNotMatch(teamwearStory, /(?:gap|padding|margin(?:-(?:top|right|bottom|left))?)\s*:\s*(?:2|4|8|12|16|24|32|48|64|72|80|96|128)px/, "Teamwear spacing must consume system tokens");
assert.doesNotMatch(teamwearStory, /(?:gap|padding|margin(?:-(?:top|right|bottom|left))?)\s*:[^;]*var\(--radius-/, "Radius roles must not be used as spacing");
assert.match(components, /\.primary-action\s*\{/, "Shared primary action must remain available");
assert.doesNotMatch(teamwear, /teamwear-action-height|\.teamwear-page \.primary-action/, "Teamwear must not override shared primary-action sizing");
assert.doesNotMatch(components.match(/\.primary-action\s*\{[\s\S]*?\}/)?.[0] || "", /(?:min-)?height\s*:/, "Primary actions must not use fixed or minimum heights");
assert.match(components, /\.site-footer\s*\{[\s\S]*?margin-top:\s*0;/, "The shared footer must connect directly to preceding content");
assert.doesNotMatch(teamwearStory, /\.teamwear-page \.site-footer/, "Teamwear must not override shared footer spacing");
assert.match(tokens, /--layout-shell-gutter-inline:\s*var\(--space-5\);/, "Base shared shell gutters must use the 16px spacing token");
assert.match(mediumTokens, /--layout-shell-gutter-inline:\s*var\(--space-7\);/, "Medium and Large shared shell gutters must use the 32px spacing token");
assert.match(tokens, /--safe-area-inset-top:\s*env\(safe-area-inset-top, 0px\);/, "The shared shell must expose the browser top safe-area inset");
assert.match(tokens, /--safe-area-inset-left:\s*env\(safe-area-inset-left, 0px\);/, "The shared shell must expose the browser left safe-area inset");
assert.match(tokens, /--safe-area-inset-right:\s*env\(safe-area-inset-right, 0px\);/, "The shared shell must expose the browser right safe-area inset");
assert.match(tokens, /--header-bar-height:\s*var\(--space-9\);/, "The shared header control row must use the 64px spacing token at every breakpoint");
assert.match(tokens, /--header-height:\s*calc\([\s\S]*?var\(--header-bar-height\)[\s\S]*?var\(--safe-area-inset-top\)[\s\S]*?\);/, "The complete header height must combine its control row with the browser top safe area");
assert.doesNotMatch(largeTokens, /--header-(?:bar-)?height:/, "Large layouts must not override the shared header geometry");
assert.match(components, /\.site-header\s*\{[\s\S]*?padding-top:\s*var\(--safe-area-inset-top\);/, "The opaque header surface must extend through the browser top safe area");
assert.match(components, /\.site-header__inner\s*\{[\s\S]*?min-height:\s*var\(--header-bar-height\);[\s\S]*?max\(var\(--layout-shell-gutter-inline\), var\(--safe-area-inset-right\)\)[\s\S]*?max\(var\(--layout-shell-gutter-inline\), var\(--safe-area-inset-left\)\)/, "Shared headers must combine the responsive shell gutter with landscape safe areas");
assert.doesNotMatch(components, /\.site-header__inner\s*\{[\s\S]*?padding:\s*var\(--space-8\)/, "Shared headers must not retain the former asymmetric 48px top padding");
assert.doesNotMatch(`${mediumComponents}\n${largeComponents}`, /\.site-header__inner\s*\{/, "Header row geometry must not change at responsive breakpoints");
assert.match(components, /\.page-headline__row\s*\{[\s\S]*?padding-inline:\s*var\(--layout-shell-gutter-inline\);/, "Page headlines must use the shared shell gutter");
assert.match(components, /\.site-footer__grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?row-gap:\s*var\(--space-5\);[\s\S]*?column-gap:\s*0;[\s\S]*?padding-block:\s*var\(--space-7\) var\(--space-9\);[\s\S]*?padding-inline:\s*var\(--layout-shell-gutter-inline\);/, "Base footers must use one column, a 16px vertical gap, no horizontal gap, 32px top padding, 64px bottom padding, and tokenized shell padding");
assert.doesNotMatch(teamwear, /--layout-shell-gutter-inline/, "Teamwear must not override the shared header, headline, or footer gutter");
assert.match(mediumComponents, /\.site-footer__grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/, "Medium footers must use two equal columns");
assert.match(largeComponents, /\.site-footer__grid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/, "Large footers must use three equal columns");
assert.match(components, /\.footer-meta\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?align-self:\s*end;[\s\S]*?gap:\s*0 var\(--space-3\);/, "Footer metadata must stay bottom-aligned and wrap only between its two segments");
assert.doesNotMatch(components, /\.footer-links|\.footer-link \.material-icon/, "Footers must not retain the former nested link grid or icons");
assert.doesNotMatch(components.match(/\.footer-link\s*\{[\s\S]*?\}/)?.[0] || "", /opacity|transition/, "Footer links must render at their inherited foreground color without opacity styling");
assert.doesNotMatch(components, /\.footer-link:hover\s*\{/, "Footer links must not reintroduce an opacity hover state");
assert.match(components, /body:has\(\.primary-action\[data-action-behavior\]\) \.site-footer__grid\s*\{[\s\S]*?var\(--primary-action-fixed-clearance\)/, "Base and Medium footers must reserve calculated fixed-action clearance");
assert.match(teamwear, /\.teamwear-page main \.container\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?width:\s*min\(100%, var\(--content-width\)\);[\s\S]*?padding-inline:\s*var\(--layout-gutter-inline\)/, "Teamwear content must apply its gutter inside the centered shared reference region");
assert.match(teamwear, /\.teamwear-page\s*\{[\s\S]*?--layout-gutter-inline:\s*var\(--space-7\)/, "Base Teamwear content must sit two spacing levels inside the shared shell gutter");
assert.match(teamwear, /@media \(min-width:\s*48rem\)[\s\S]*?\.teamwear-page\s*\{[\s\S]*?--layout-gutter-inline:\s*var\(--space-9\)/, "Medium and Large Teamwear content must sit two spacing levels inside the shared shell gutter");
assert.match(teamwear, /--teamwear-content-edge:\s*max\([\s\S]*?var\(--layout-gutter-inline\)[\s\S]*?calc\(\(100vw - var\(--content-width\)\) \/ 2 \+ var\(--layout-gutter-inline\)\)[\s\S]*?\);/, "Teamwear must derive its viewport edge from the centered 1280px region plus its inner gutter");
assert.doesNotMatch(teamwear, /--teamwear-reference-edge:/, "Teamwear must not retain the superseded outer-reference action edge");
assert.match(teamwear, /--layout-page-gutter:\s*var\(--teamwear-content-edge\)/, "The Teamwear floating action must align to the 1280px reference offset plus the 64px inner gutter");
assert.match(components, /\.choice-option--chip\s*\{[\s\S]*?flex:\s*1 1 0/, "Shared chip choices must expand equally");
assert.match(components, /\.choice-option--chip-add-on\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) var\(--choice-size\)/, "Add-on chips must reserve one tokenized square icon column");
assert.match(components, /\.choice-option__state-symbol\s*\{[\s\S]*?font-size:\s*var\(--icon-size-small\)/, "Add-on state symbols must use the 20px icon token");
assert.match(components, /\.choice-option--swatch\s*\{/, "Shared swatch choices must remain available");
assert.match(tokens, /--primary-action-floating-bottom-gap:\s*var\(--space-9\);/, "Large floating actions must use the 64px spacing token for their bottom gap");
assert.match(tokens, /--primary-action-floating-clearance:\s*calc\([\s\S]*?var\(--primary-action-content-clearance\)[\s\S]*?var\(--primary-action-floating-bottom-gap\)/, "The footer must reserve the calculated floating-action and bottom-gap footprint");
assert.match(components, /data-action-behavior="fixed-to-float"\]\.is-floating\s*\{[\s\S]*?var\(--layout-page-gutter\)[\s\S]*?var\(--primary-action-floating-bottom-gap\)/, "Large floating actions must use the page gutter on the right and the fixed semantic gap on the bottom");
assert.match(largeComponents, /data-action-behavior="fixed-to-float"\]\.is-floating\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?translate:\s*0 var\(--motion-distance-component\);[\s\S]*?opacity var\(--motion-duration-exit\) var\(--motion-ease-exit\)[\s\S]*?translate var\(--motion-duration-exit\) var\(--motion-ease-exit\)/, "Large floating actions must reverse out with the shared 12px and 200ms exit roles");
assert.match(largeComponents, /data-action-behavior="fixed-to-float"\]\.is-floating\.is-floating-visible\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?translate:\s*0 0;[\s\S]*?var\(--motion-duration-enter\)[\s\S]*?var\(--motion-ease-enter\)/, "Large floating actions must enter with the shared 400ms emphasized-decelerate role");
assert.match(choices, /floatingState = "entering"[\s\S]*?requestAnimationFrame[\s\S]*?floatingState = "floating"[\s\S]*?floatingState = "exiting"/, "The fixed-to-float controller must sequence entering, floating, and exiting states without cloning the action");
assert.match(choices, /clearMotionListener\(\)[\s\S]*?stateVersion[\s\S]*?afterOpacityTransition/, "Floating-action reversals must cancel stale completions and continue from the current CSS presentation");
assert.doesNotMatch(largeComponents.match(/\.primary-action\[data-action-behavior="fixed-to-float"\]\.is-floating\s*\{[\s\S]*?\}/)?.[0] || "", /safe-area-inset-bottom/, "Large floating actions must not add a safe-area inset to the requested space-9 bottom offset");
assert.match(largeComponents, /body:has\(\.primary-action\[data-action-behavior="fixed-to-float"\]\) \.site-footer__grid\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--space-9\) \+ var\(--primary-action-floating-clearance\)\)/, "Large Teamwear footers must clear the persistent floating action without docking it");
assert.doesNotMatch(`${components}\n${teamwearStory}`, /primary-action-dock|is-docked|has-floating-primary-action/, "The persistent Teamwear action must not retain dock or header-hiding states");
assert.doesNotMatch(teamwear, /\.teamwear-(?:facts|patterns|pattern-grid|pattern-card|on-court|reversible|feedback|closing)/, "Unused legacy Teamwear landing rules must be removed");
assert.doesNotMatch(`${components}\n${pages}`, /\.reference-page--teamwear/, "Unused legacy Teamwear page rules must be removed from shared CSS");

console.log("LAYOUT_SYSTEM_OK spacing=2-64 gutters=16-32 sections=24-48-64 media=viewport content=960-1280 catalog=2-3-3 detail=single-single-5col teamwear=mobile-mobile-desktop");
