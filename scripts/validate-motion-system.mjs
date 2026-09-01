import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8");

function propertyValue(source, property) {
  const match = source.match(new RegExp(`${property.replaceAll("-", "\\-")}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

const [tokens, motion, pageTransitions, components, app, search, choices, teamwearStory, teamwear, renderer, docs, source] = await Promise.all([
  read("assets/css/tokens.css"),
  read("assets/css/motion.css"),
  read("assets/js/page-transitions.js"),
  read("assets/css/components.css"),
  read("assets/js/app.js"),
  read("assets/js/search.js"),
  read("assets/js/choices.js"),
  read("assets/css/teamwear-story.css"),
  read("assets/js/teamwear.js"),
  read("scripts/lib/site-renderers.mjs"),
  read("docs/design-system.md"),
  read("data/products-source.json").then(JSON.parse)
]);

const exactTokens = new Map([
  ["--motion-ease-enter", "cubic-bezier(.05, .7, .1, 1)"],
  ["--motion-ease-exit", "cubic-bezier(.3, 0, .8, .15)"],
  ["--motion-ease-emphasized", "cubic-bezier(.2, 0, 0, 1)"],
  ["--motion-ease-compact-enter", "cubic-bezier(0, 0, 0, 1)"],
  ["--motion-duration-enter", "400ms"],
  ["--motion-duration-exit", "200ms"],
  ["--motion-duration-standard", "300ms"],
  ["--motion-duration-compact-enter", "250ms"],
  ["--motion-stagger-short", "40ms"],
  ["--motion-distance-component", "var(--space-4)"],
  ["--motion-page-depth-shift", "24%"]
]);
for (const [token, expected] of exactTokens) {
  assert.equal(propertyValue(tokens, token), expected, `${token} must remain ${expected}`);
}

let routeApi;
const listeners = new Map();
const storage = new Map();
const context = {
  URL,
  window: {
    location: { href: "https://prdm.tw/" },
    matchMedia: () => ({ matches: false }),
    addEventListener: (type, listener) => listeners.set(type, listener),
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    }
  },
  document: {
    documentElement: { dataset: {} },
    querySelector: () => null
  },
  navigation: undefined,
  __PARADIGM_MOTION_TEST__: (api) => { routeApi = api; }
};
context.globalThis = context;
vm.runInNewContext(pageTransitions, context, { filename: "page-transitions.js" });
assert.ok(routeApi, "the page-transition controller must expose its private route classifier to validation");

const cases = [
  ["/", "/collections/all", false, "none"],
  ["/collections/all", "/collections/ss-tops", false, "forward"],
  ["/collections/ss-tops", "/collections/all", false, "backward"],
  ["/collections/ss-tops", "/collections/aw-tops", false, "peer"],
  ["/search", "/products/ED14001", false, "forward"],
  ["/products/ED14001", "/products/ED14024", false, "peer"],
  ["/teamwear", "/teamwear/customize", false, "forward"],
  ["/teamwear/customize", "/teamwear", false, "backward"],
  ["/collections/all", "/teamwear", false, "peer"],
  ["/future-a", "/future-b", false, "peer"],
  ["/collections/all", "/products/ED14001", true, "overlay"]
];
for (const [from, to, overlayOpen, expected] of cases) {
  assert.equal(routeApi.transitionBetween(from, to, overlayOpen), expected, `${from} to ${to} must classify as ${expected}`);
}
assert.equal(routeApi.classifyPath("/search").depth, 1, "Search must be catalog depth 1");
assert.equal(routeApi.classifyPath("/products/ED14001").depth, 2, "Products must be catalog depth 2");

assert.match(pageTransitions, /addEventListener\("pageswap"[\s\S]*?addEventListener\("pagereveal"/, "page motion must use cross-document lifecycle events");
assert.match(pageTransitions, /event\.viewTransition[\s\S]*?event\.activation\?\.entry\?\.url/, "outgoing motion must use the browser's View Transition activation record");
assert.match(pageTransitions, /transition\?\.skipTransition\(\)/, "equivalent routes and reduced motion must skip the authored transition");
assert.match(pageTransitions, /transition\?\.finished\.finally[\s\S]*?delete document\.documentElement\.dataset\.pageMotion/, "temporary route state must clear after each transition");
assert.doesNotMatch(pageTransitions, /addEventListener\(["']click|preventDefault|pushState|replaceState|popstate/, "page motion must not intercept navigation or mutate history");

assert.match(motion, /@view-transition\s*\{\s*navigation:\s*auto;/, "the shared stylesheet must progressively enable cross-document transitions");
assert.match(motion, /data-page-motion="forward"[\s\S]*?page-forward-old[\s\S]*?data-page-motion="forward"[\s\S]*?page-forward-new/, "forward transitions must animate both page layers");
assert.match(motion, /data-page-motion="backward"[\s\S]*?page-backward-old[\s\S]*?data-page-motion="backward"[\s\S]*?page-backward-new/, "backward transitions must use the symmetric path");
assert.match(motion, /page-fade-new var\(--motion-duration-compact-enter\) var\(--motion-ease-compact-enter\) 50ms both/, "peer pages must use the 250ms compact entrance after 50ms");
assert.match(motion, /opacity:\s*\.88;\s*translate:\s*var\(--motion-page-depth-end\)/, "forward depth must recede to 88 percent opacity and 24 percent inline travel");
assert.match(motion, /:root\[dir="rtl"\][\s\S]*?--motion-page-enter-start:\s*-100%[\s\S]*?--motion-page-back-end:\s*-100%/, "true RTL documents must reverse logical page direction");
assert.match(motion, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?navigation:\s*none;/, "reduced motion must disable cross-document motion");

assert.match(renderer, /data-overlay-state="closed" data-search-overlay[\s\S]*?data-overlay-state="closed" data-nav-drawer/, "both overlays must start from the shared closed state");
assert.match(renderer, /renderToggleIconPair[\s\S]*?toggle-icon--resting[\s\S]*?toggle-icon--close/, "overlay toggles must render stable stacked Material icons");
assert.match(app, /Object\.freeze\(\{ closed: "closed", opening: "opening", open: "open", closing: "closing" \}\)/, "the shared controller must define all four interruptible overlay states");
assert.match(app, /activeOverlay\.close\(false, true\)/, "switching overlays must reverse the current surface immediately");
assert.match(app, /document\.body\.style\.overflow = "hidden";[\s\S]*?setPageInert\(true\)/, "open overlays must preserve scroll locking and inert content");
assert.match(app, /event\.key === "Escape"[\s\S]*?event\.key !== "Tab"/, "overlays must keep Escape closure and focus containment");
assert.match(components, /clip-path:\s*inset\(0 0 100% 0\)[\s\S]*?var\(--motion-duration-compact-enter\) var\(--motion-ease-compact-enter\)/, "overlay surfaces must enter from the top with the compact motion role");
assert.match(components, /toggle-icon--close[\s\S]*?transition-delay:\s*var\(--motion-stagger-short\)/, "the close icon must follow the surface by one short stagger");
assert.match(search, /sequenceOverlayRender = true[\s\S]*?renderOverlay\(\)/, "Search must opt only the first overlay render into sequencing");
assert.match(search, /--overlay-sequence-delay[\s\S]*?120 \+ index \* 40[\s\S]*?--overlay-exit-delay/, "result groups must enter and leave in ordered 40ms steps");

assert.match(choices, /const largeView = window\.matchMedia\("\(min-width: 64rem\)"\);[\s\S]*?const reducedMotion = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\);/, "floating-action motion must use the shared Large and reduced-motion boundaries");
assert.match(choices, /floatingState = "entering"[\s\S]*?is-floating-visible[\s\S]*?floatingState = "floating"[\s\S]*?floatingState = "exiting"/, "floating actions must expose the centralized reversible state sequence");
assert.match(choices, /void action\.offsetWidth;[\s\S]*?requestAnimationFrame/, "the fixed floating-action start state must be committed before its visible entrance frame");
assert.match(choices, /startsInline[\s\S]*?is-floating-preparing[\s\S]*?void action\.offsetWidth[\s\S]*?remove\("is-floating-preparing"\)[\s\S]*?is-floating-visible/, "fresh floating-action entrances must paint their hidden fixed state without changing reversal behavior");
assert.match(choices, /!action\.classList\.contains\("is-floating-visible"\)[\s\S]*?settleInline\(\);/, "pre-frame floating-action reversals must settle without waiting for a transition that never started");
assert.match(choices, /stateVersion[\s\S]*?clearMotionListener[\s\S]*?version !== stateVersion/, "floating-action motion must discard stale completions when scroll direction reverses");
assert.match(components, /data-action-behavior="fixed-to-float"\]\.is-floating\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?translate:\s*0 var\(--motion-distance-component\);[\s\S]*?var\(--motion-duration-exit\) var\(--motion-ease-exit\)/, "floating actions must use the shared 12px and 200ms exit path");
assert.match(components, /data-action-behavior="fixed-to-float"\]\.is-floating\.is-floating-visible\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?translate:\s*0 0;[\s\S]*?var\(--motion-duration-enter\)[\s\S]*?var\(--motion-ease-enter\)/, "floating actions must use the shared 400ms entrance path");
assert.match(components, /data-action-behavior="fixed-to-float"\]\.is-floating\.is-floating-preparing\s*\{[\s\S]*?transition:\s*none;/, "fresh floating actions must commit their hidden fixed state before the enter transition begins");
assert.match(docs, /entering → floating → exiting → inline[\s\S]*?12px toward block-end[\s\S]*?400ms enter role[\s\S]*?200ms exit role/, "the design system must document the fixed-to-float state path and exact shared roles");

assert.match(teamwearStory, /\.teamwear-hero__media[\s\S]*?opacity var\(--motion-duration-enter\) var\(--motion-ease-enter\)/, "Teamwear hero media must fade over the shared 400ms entrance");
assert.match(teamwearStory, /\.teamwear-hero__content\s*\{[\s\S]*?translate:\s*0 var\(--motion-distance-entrance\)[\s\S]*?calc\(var\(--motion-stagger-short\) \+ var\(--motion-stagger-short\)\)/, "Teamwear hero copy must follow with the 24px entrance role after two 40ms staggers");
assert.match(teamwear, /querySelectorAll\("\.teamwear-rail-card\[data-section-reveal\]"\)[\s\S]*?index \* 40/, "rail cards must reveal in DOM order with 40ms staggering");
assert.match(teamwear, /const railRect = rail\.getBoundingClientRect\(\)[\s\S]*?const positions = cards\.map[\s\S]*?cards\.forEach[\s\S]*?--rail-photo-offset[\s\S]*?-16[\s\S]*?--rail-copy-offset[\s\S]*?\* 8/, "rail parallax must read all geometry before writing bounded opposed offsets");
assert.match(teamwearStory, /\.teamwear-rail-card__photo-track[\s\S]*?width:\s*calc\(100% \+ var\(--space-5\) \+ var\(--space-5\)\)[\s\S]*?--rail-photo-offset/, "rail photos must own 16px non-scaled bleed on each inline edge");
assert.match(teamwearStory, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?teamwear-rail-card__photo-track[\s\S]*?translate:\s*0 0/, "reduced motion must reveal Teamwear content and remove parallax");
assert.match(teamwear, /reducedMotionQuery\.addEventListener\("change"[\s\S]*?railUpdates\.get\(rail\)\?\.\(\)/, "Teamwear must dynamically tear down and restore rail motion when the preference changes");

const combinedMotion = `${motion}\n${components}\n${teamwearStory}\n${pageTransitions}\n${app}\n${search}\n${choices}\n${teamwear}`;
assert.doesNotMatch(combinedMotion, /\bscale\s*\(|(^|[;{])\s*scale\s*:/m, "motion production code must not scale or zoom interface layers");
assert.match(docs, /Apple-style spatial continuity with Material 3's explicit web transition values/, "the design system must distinguish spatial principles from explicit timing values");
assert.match(docs, /response 350ms and damping ratio 1; damping \.8 is reserved for real momentum gestures/, "future spring defaults and the momentum-only exception must be documented");

const generatedPages = [
  "index.html",
  "collections/all/index.html",
  "collections/ss-tops/index.html",
  "collections/aw-tops/index.html",
  "collections/bottoms/index.html",
  "search/index.html",
  "teamwear/index.html",
  "teamwear/customize/index.html",
  ...source.products.filter((product) => product.variants.some((variant) => variant.visible)).map((product) => `products/${product.productNumber}/index.html`)
];
for (const relativePath of generatedPages) {
  const page = await read(relativePath);
  const earlyController = page.search(/<script src="(?:\.\.\/)*assets\/js\/page-transitions\.js\?v=20260831a"><\/script>/);
  const deferredApp = page.search(/<script defer src="(?:\.\.\/)*assets\/js\/app\.js\?v=20260831a"><\/script>/);
  assert.ok(earlyController >= 0 && deferredApp > earlyController, `${relativePath} must load the route controller early and before deferred behavior`);
  assert.match(page, /assets\/css\/motion\.css\?v=20260831a/, `${relativePath} must load the cache-busted global motion stylesheet`);
  assert.match(page, /assets\/css\/components\.css\?v=20260901d/, `${relativePath} must load the cache-busted shared floating-action, Search icon, and media-source motion`);
  assert.match(page, /assets\/js\/choices\.js\?v=20260831c/, `${relativePath} must load the cache-busted floating-action state controller`);
}

console.log(`MOTION_SYSTEM_OK routes=${cases.length} pages=${generatedPages.length}`);
