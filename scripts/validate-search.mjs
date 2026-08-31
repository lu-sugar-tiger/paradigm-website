import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
const json = async (relativePath) => JSON.parse(await read(relativePath));

const [config, index, source, searchPage, searchCoreSource, searchClient, app, renderer, build, components, pages] = await Promise.all([
  json("data/search.json"),
  json("assets/data/search-index.json"),
  json("data/products-source.json"),
  read("search/index.html"),
  read("assets/js/search-core.js"),
  read("assets/js/search.js"),
  read("assets/js/app.js"),
  read("scripts/lib/site-renderers.mjs"),
  read("scripts/build-site.mjs"),
  read("assets/css/components.css"),
  read("assets/css/pages.css")
]);

assert.deepEqual(config.popularKeywords, ["Teamwear", "Everyday", "Paradigm", "Hoodie", "Tee"], "popular searches must preserve the approved manual order");
assert.equal(config.pages.length, 8, "search authoring data must contain six canonical pages and two controlled external links");
assert.deepEqual(
  config.pages.map((page) => page.url),
  ["/collections/all", "/collections/ss-tops", "/collections/aw-tops", "/collections/bottoms", "/teamwear", "/teamwear/customize", "https://www.instagram.com/prdm.tw/", "https://shopee.tw/"],
  "search pages must exclude home, redirects, and Search itself while retaining the approved external links"
);
assert.equal(new Set(config.pages.map((page) => page.url)).size, config.pages.length, "search page URLs must be unique");
for (const page of config.pages) {
  assert.equal(typeof page.title, "string", "page records require a title");
  assert.equal(typeof page.interfaceLabel, "boolean", "page records must explicitly declare whether their established title uses the interface-label casing role");
  assert.equal(typeof page.summary, "string", "page records require a summary");
  assert.ok(Array.isArray(page.keywords) && page.keywords.length > 0, "page records require controlled keywords");
}
assert.deepEqual(config.pages.filter((page) => page.external).map((page) => page.title), ["Instagram", "Shopee"], "only Instagram and Shopee must be authored as external page results");
assert.deepEqual(
  config.pages.filter((page) => page.interfaceLabel).map((page) => page.title),
  ["All Products", "SS Tops", "AW Tops", "Bottoms", "Instagram", "Shopee"],
  "Search page titles must reuse interface-label casing only where the established interface does"
);

const visibleProductNumbers = source.products
  .filter((product) => product.variants.some((variant) => variant.visible))
  .map((product) => product.productNumber);
assert.equal(visibleProductNumbers.length, 19, "the product source must still expose the expected 19 visible products");
assert.equal(index.schemaVersion, 1, "the generated Search index schema must be versioned");
assert.deepEqual(index.popularKeywords, config.popularKeywords, "the generated index must preserve popular-search order");
assert.equal(index.pages.length, 8, "the generated index must contain every controlled page and external link");
assert.deepEqual(index.pages.filter((page) => page.external).map((page) => page.title), ["Instagram", "Shopee"], "the generated index must preserve the external-link contract");
assert.deepEqual(index.pages.map((page) => page.interfaceLabel), config.pages.map((page) => page.interfaceLabel), "the generated index must preserve each page title's established casing role");
assert.equal(index.products.length, visibleProductNumbers.length, "the generated index must contain every visible product");
assert.deepEqual(index.products.map((product) => product.productNumber), visibleProductNumbers, "the generated index must preserve visible product order");
for (const product of index.products) {
  for (const field of ["title", "productNumber", "category", "productType", "family", "price", "url", "alt"]) {
    assert.equal(typeof product[field], "string", `${product.productNumber} must include ${field}`);
  }
  assert.ok(Array.isArray(product.colors), `${product.productNumber} must include colors`);
  assert.ok(Array.isArray(product.searchTerms), `${product.productNumber} must include structured search terms`);
  assert.equal("media" in product, true, `${product.productNumber} must include the card-media field`);
  if (product.media) {
    assert.equal(typeof product.media.src, "string", `${product.productNumber} card media must include a source`);
    assert.ok(Array.isArray(product.media.derivatives), `${product.productNumber} must include responsive card media`);
  }
  assert.equal("description" in product, false, `${product.productNumber} must not include long descriptions`);
  assert.equal("shopeeUrl" in product, false, `${product.productNumber} must not expose purchase data in Search`);
}
for (const label of ["Hoodie", "Tee", "Crewneck", "Everyday", "Black", "AW Tops"]) {
  assert.ok(index.vocabulary.some((entry) => entry.toLowerCase() === label.toLowerCase()), `Search vocabulary must include ${label}`);
}

const context = vm.createContext({ globalThis: {} });
vm.runInContext(searchCoreSource, context, { filename: "search-core.js" });
const core = context.globalThis.PARADIGM_SEARCH_CORE;
assert.ok(core, "the Search matcher must expose its shared browser API");
const numbersFor = (query) => Array.from(core.rankRecords(index.products, query), (product) => product.productNumber);
const pagesFor = (query) => Array.from(core.rankRecords(index.pages, query), (page) => page.title);
assert.equal(core.normalize("  HoOdIe!!!  "), "hoodie", "matching must ignore casing, whitespace, and punctuation");
assert.equal(core.titleCase("ss TOPS"), "SS Tops", "suggestions must use title case while preserving controlled acronyms");
assert.deepEqual(Array.from(core.suggestions(index, "")), config.popularKeywords, "blank Search must use the exact manual suggestions");
assert.ok(Array.from(core.suggestions(index, "hoo")).includes("Hoodie"), "current-input suggestions must include matching product types");
assert.ok(Array.from(core.suggestions(index, "tee")).every((label) => label === core.titleCase(label)), "every generated suggestion must use title case");
assert.ok(numbersFor("hoodie").length > 0 && numbersFor("hoodie").every((number) => index.products.find((product) => product.productNumber === number).productType === "Hoodie"), "hoodie must return only matching Hoodie products");
assert.ok(pagesFor("teamwear").includes("PE Basketball Teamwear"), "teamwear must return its canonical page");
assert.deepEqual(pagesFor("instagram"), ["Instagram"], "Instagram must be searchable as a page result");
assert.deepEqual(pagesFor("shopee"), ["Shopee"], "Shopee must be searchable as a page result");
assert.deepEqual(numbersFor("Everyday Tee"), ["ED14001", "ED14024"], "every query token must match a structured field");
assert.deepEqual(numbersFor("ED14001"), ["ED14001"], "exact product-number matching must work");
assert.deepEqual(numbersFor(" eD-14001!! "), ["ED14001"], "product-number matching must tolerate whitespace, casing, and punctuation");
assert.deepEqual(numbersFor("result-that-does-not-exist"), [], "no-result queries must remain empty");

assert.match(searchPage, /<meta name="robots" content="noindex,follow">/, "the generated Search route must be noindex,follow");
assert.match(searchPage, /<link rel="canonical" href="https:\/\/prdm\.tw\/search">/, "the generated Search route must have the stable canonical URL");
assert.match(searchPage, /data-search-page-title/, "the Search breadcrumb must expose a live title target");
assert.match(searchPage, /data-search-page-results/, "the Search route must expose a generated-results mount");
assert.match(searchClient, /assets\/data\/search-index\.json/, "the Search client must reference the generated local index");
assert.match(renderer, /data-search-toggle/, "the shared header must expose the Search toggle");
assert.match(renderer, /data-search-overlay/, "the shared header must render the Search overlay on every page");
assert.match(searchPage, /data-search-open-symbol="search" data-search-close-symbol="close"/, "the same Search control must swap its Material symbol");
assert.match(searchPage, /autocomplete="off"[^>]*data-search-input/, "the Search input must be ready for immediate user input");
assert.match(searchPage, /placeholder="Search prdm\.tw"/, "the Search field must use the complete approved prompt");
assert.match(searchClient, /fetch\("\/assets\/data\/search-index\.json\?v=20260830a"/, "the Search index must be lazy-loaded with a cache version");
assert.match(searchClient, /new URLSearchParams\(\{ q: query\.trim\(\) \}\)/, "Search navigation must safely encode the query");
assert.match(searchClient, /window\.location\.assign\(searchUrl\(query\)\)/, "Enter and the trailing action must navigate to the shareable Search route");
assert.match(searchClient, /pageTitle\.textContent = label/, "the results breadcrumb must safely preserve query casing");
assert.doesNotMatch(searchClient, /search-page-result__summary|element\("p",\s*"search-page-result/, "page results must not render summaries");
assert.doesNotMatch(searchClient, /search-result-group__heading|search-result-group__title/, "result-type titles must not be rendered visibly");
assert.doesNotMatch(searchClient, /emptyRow|No suggested searches|No page results|No product results/, "empty result types must be skipped instead of rendering empty-state rows");
assert.match(searchClient, /if \(suggestions\.length > 0\)[\s\S]*?if \(pages\.length > 0\)[\s\S]*?if \(products\.length > 0\)/, "Search must append only result types that contain matches");
assert.match(searchClient, /section\.setAttribute\("aria-label", label\)/, "result types must retain an accessible name without a visible title");
assert.doesNotMatch(searchClient, /search-suggestion interface-label/, "suggestions must not receive implicit uppercase transformation");
assert.match(searchClient, /search-page-result__title\$\{page\.interfaceLabel \? " interface-label" : ""\}/, "page results must reuse each page's established interface-label casing role");
assert.match(searchClient, /suggestion:\s*"search"/, "suggestions must use the Material magnifying-lens trailing icon");
assert.match(searchClient, /internalPage:\s*"arrow_forward"/, "internal page results must use the Material right-arrow trailing icon");
assert.match(searchClient, /externalPage:\s*"arrow_outward"/, "external page results must use the Material northeast-arrow trailing icon");
assert.match(searchClient, /trailingContent\(\s*"search-suggestion__content",\s*element\("span", "search-suggestion__label", label\),\s*TRAILING_ICONS\.suggestion\s*\)/, "every suggestion must render its trailing icon after the label");
assert.match(searchClient, /page\.external \? TRAILING_ICONS\.externalPage : TRAILING_ICONS\.internalPage/, "page results must select the trailing icon from their internal or external destination");
assert.match(searchClient, /icon\.setAttribute\("aria-hidden", "true"\)/, "decorative Search trailing icons must remain hidden from assistive technology");
assert.match(searchClient, /let suggestionsSuppressed = false;/, "Search must track whether a suggestion was selected");
assert.match(searchClient, /input\.addEventListener\("input", \(\) => \{[\s\S]*?suggestionsSuppressed = false;[\s\S]*?renderOverlay\(\);/, "manual input must restore current-input suggestions");
assert.match(searchClient, /const query = suggestion\.dataset\.searchSuggestion;[\s\S]*?suggestionsSuppressed = true;/, "selecting a suggestion must suppress further suggestions immediately");
assert.match(searchClient, /const suggestions = suggestionsSuppressed \? \[\] : core\.suggestions\(index, query\);/, "suppressed suggestions must remain absent until manual input");
assert.match(searchClient, /link\.target = "_blank"[\s\S]*?link\.rel = "noopener noreferrer"/, "external page results must open safely in a new tab");
assert.doesNotMatch(searchClient, /innerHTML|outerHTML|insertAdjacentHTML/, "Search results must use safe DOM construction rather than HTML injection");
assert.match(app, /setPageInert\(true\)/, "shared overlays must make the covered page inert");
assert.match(app, /event\.key === "Escape"/, "shared overlays must close with Escape");
assert.match(app, /const focusable = \[toggle, \.\.\.focusableNodes\(overlay\)\]/, "shared overlays must keep focus within the active surface and its close control");
assert.match(app, /last\.focus\(\)[\s\S]*?first\.focus\(\)/, "shared overlays must wrap keyboard focus in both directions");
assert.match(components, /\.search-overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?background:\s*var\(--color-background-high\)/, "Search must use Background High for the full-screen overlay");
assert.match(components, /\.search-overlay\s*\{[\s\S]*?overflow-y:\s*auto/, "the Search overlay must scroll independently");
assert.match(components, /\.search-form\s*\{[\s\S]*?min-height:\s*calc\(var\(--control-size-large\) \+ \(var\(--stroke-width-thin\) \* 2\)\)/, "the Search frame must wrap a shared 48px target plus its two tokenized strokes");
assert.match(components, /\.search-form\s*\{[^}]*border:\s*var\(--stroke-width-thin\) solid var\(--color-outline-low\);[^}]*background:\s*var\(--color-background-high\)/, "the Search field must use the tokenized thin option-chip border and Background High");
assert.match(components, /\.search-form:has\(\.search-form__input:focus-visible\)\s*\{[^}]*border-color:\s*var\(--color-outline-high\);[^}]*\}/, "focused Search must switch the existing one-pixel border to Outline High");
assert.doesNotMatch(components, /\.search-form:has\(\.search-form__input:focus-visible\)\s*\{[^}]*\boutline(?:-offset)?:/, "focused Search must not add an extra outline");
assert.match(components, /\.search-form__input\s*\{[\s\S]*?font-size:\s*var\(--type-body-size\);[\s\S]*?font-weight:\s*var\(--font-weight-base\);[\s\S]*?line-height:\s*var\(--type-body-line-height\)/, "the Search field and placeholder must use the complete Body text role");
assert.match(components, /\.search-form__input\s*\{[^}]*color:\s*var\(--color-on-background-high\)/, "Search input text must use On Background High");
assert.match(components, /\.search-form__input::placeholder\s*\{[^}]*color:\s*var\(--color-on-background-low\)/, "Search placeholder text must use On Background Low");
assert.match(components, /\.search-form__submit\s*\{[^}]*color:\s*var\(--color-on-background-high\)/, "the enabled Search action must use On Background High");
assert.match(components, /\.search-form__submit:disabled\s*\{[^}]*color:\s*var\(--color-on-background-low\)/, "the disabled Search action must use On Background Low");
assert.match(components, /\[data-search-toggle\]\s*\{[^}]*color:\s*var\(--color-on-background-high\)/, "the header Search and close symbols must use On Background High");
assert.match(components, /\.search-suggestion\s*\{[^}]*padding:\s*0;[^}]*font-size:\s*var\(--type-body-size\);[^}]*line-height:\s*var\(--type-body-line-height\)/, "suggestions must use Body with no browser-default inset or extra row spacing");
assert.match(components, /\.search-suggestion\s*\{[^}]*color:\s*var\(--color-on-background-low\)/, "suggestions must use On Background Low");
assert.match(components, /\.search-page-result\s*\{[^}]*padding-block:\s*0;/, "page result rows must not add spacing beyond the relaxed paragraph gap");
assert.match(components, /\.search-page-result__title\s*\{[^}]*font-size:\s*var\(--type-h6-size\);[^}]*line-height:\s*var\(--type-h6-line-height\)/, "page result titles must use H6");
assert.match(components, /\.search-page-result__title\s*\{[^}]*color:\s*var\(--color-on-background-high\)/, "page result titles must use On Background High");
assert.match(components, /\.external-link__indicator,[\s\S]*?\.search-result__indicator\s*\{[^}]*inset-block-start:\s*50%;[^}]*inset-inline-start:\s*calc\(100% \+ var\(--external-link-arrow-gap\)\);[^}]*translate:\s*0 -50%;[^}]*font-size:\s*var\(--external-link-arrow-size\)/, "Search trailing icons must reuse the existing text-matched external-arrow geometry");
assert.match(components, /\.search-result__indicator\s*\{[^}]*color:\s*inherit;[^}]*pointer-events:\s*none;/, "Search trailing icons must inherit each result's text color without changing its hit target");
assert.match(components, /\.search-status-row\s*\{[^}]*color:\s*var\(--color-on-background-low\)/, "Search loading and error status must use On Background Low");
assert.match(components, /\.search-result-group\s*\{[^}]*background:\s*var\(--color-background-high\)/, "Search text result groups must use Background High");
assert.match(components, /\.nav-drawer,[\s\S]*?\.search-overlay\s*\{[^}]*background:\s*var\(--color-background-high\)/, "menu and Search overlays must share Background High");
assert.match(components, /\.nav-drawer__panel,[\s\S]*?\.search-overlay__panel\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*100%;[^}]*background:\s*var\(--color-background-high\)/, "menu and Search panels must share their full-width Background High surface");
assert.match(components, /\.nav-drawer__panel\s*\{[^}]*padding-block:\s*calc\(var\(--header-height\) \+ var\(--space-7\)\) 0;/, "the menu must share Search's top position without adding bottom padding");
assert.match(components, /\.search-overlay__panel\s*\{[^}]*padding-block:\s*calc\(var\(--header-height\) \+ var\(--space-7\)\) 0;/, "Search must retain its header-plus-Space-7 top position without bottom padding");
assert.doesNotMatch(components.match(/\.search-overlay__panel\s*\{[^}]*\}/)?.[0] || "", /var\(--space-8\)/, "Search must not retain the former Space 8 bottom padding");
assert.match(components, /\.nav-drawer__inner,[\s\S]*?\.search-overlay__inner\s*\{[^}]*width:\s*min\(100%, var\(--content-width\)\)/, "menu and Search must share the centered content-width contract");
assert.match(components, /\.drawer-nav,[\s\S]*?\.search-overlay__form-wrap,[\s\S]*?\.search-result-group__content\s*\{[^}]*padding-inline:\s*var\(--layout-shell-gutter-inline\)/, "menu and Search content must share the responsive shell inset");
assert.match(components, /\.drawer-nav__groups\s*\{[^}]*display:\s*grid;[^}]*gap:\s*var\(--space-7\)/, "Product and Teamwear groups must be separated by Space 7");
assert.match(components, /\.drawer-nav__group\s*\{[^}]*gap:\s*var\(--type-paragraph-spacing-relaxed\);[^}]*font-size:\s*var\(--type-h5-size\)/, "parents must use only relaxed paragraph spacing before their child lists in the H5 context");
assert.match(components, /\.drawer-nav__children\s*\{[^}]*gap:\s*var\(--type-paragraph-spacing-relaxed\);[^}]*font-size:\s*var\(--type-h6-size\)/, "children must use relaxed paragraph spacing in the H6 context");
assert.match(components, /\.drawer-nav__parent\s*\{[^}]*color:\s*var\(--color-on-background-high\);[^}]*font-size:\s*var\(--type-h5-size\);[^}]*line-height:\s*var\(--type-h5-line-height\)/, "Product and Teamwear must use H5 and On Background High");
assert.match(components, /\.drawer-nav__child\s*\{[^}]*color:\s*var\(--color-on-background-mid\);[^}]*font-size:\s*var\(--type-h6-size\);[^}]*line-height:\s*var\(--type-h6-line-height\)/, "menu subcollections must use H6 and On Background Mid");
assert.doesNotMatch(components, /drawer-nav__(?:divider|subcollections)/, "the menu must not retain its divider hairline or legacy subcollection implementation");
assert.doesNotMatch(components, /\.search-result-group \+ \.search-result-group\s*\{/, "Search result types must not render a divider");
assert.match(components, /\.search-results\s*\{[^}]*display:\s*grid;[^}]*row-gap:\s*var\(--space-7\);[^}]*margin-top:\s*var\(--space-7\);[^}]*background:\s*var\(--color-background-high\)/, "Search must own one Space 7 offset before its first result and between every result type");
assert.match(components, /\.search-result-group\s*\{[^}]*padding-block:\s*0;/, "result groups must not compound the Search container's Space 7 rhythm");
assert.match(components, /\.search-suggestion-list,[\s\S]*?\.search-page-result-list\s*\{[^}]*gap:\s*var\(--type-paragraph-spacing-relaxed\);[^}]*background:\s*transparent;/, "individual results must use relaxed paragraph spacing without dividers");
assert.doesNotMatch(components, /\.search-suggestion-list,[\s\S]*?\.search-page-result-list\s*\{[^}]*gap:\s*var\(--space-1\)/, "individual results must not use divider spacing");
assert.doesNotMatch(components, /\.search-result-group__title/, "visible result-type title styling must be removed");
assert.match(components, /\.search-result-group--products\s*\{[\s\S]*?background:\s*var\(--color-background-mid\)/, "product results must use Background Mid");
assert.match(pages, /\.search-page__results \.search-result-group--products\s*\{[^}]*margin-top:\s*0;/, "the results-page product feed must rely on group padding for separation without adding a second gap");
assert.match(build, /outputs\.set\("assets\/data\/search-index\.json"/, "the static generator must own the Search index");
assert.match(build, /outputs\.set\("search\/index\.html"/, "the static generator must own the Search route");

console.log(`SEARCH_OK pages=${index.pages.length} products=${index.products.length} popular=${index.popularKeywords.length}`);
