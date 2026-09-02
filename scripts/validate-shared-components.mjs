import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoryForTitle, productFamilyKey, rankRelatedProducts } from "./lib/product-relations.mjs";
import { normalizeDescriptionSource, transformDescription } from "./lib/rich-description.mjs";
import { renderBreadcrumb, renderChoiceGroup, renderDescription, renderPageHeadline, renderPrimaryAction, renderProductDetailPrice, renderProductGrid, renderRailControls, renderSiteFooter, renderSiteHeader } from "./lib/site-renderers.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8");

async function listRepositoryFiles(directory = ROOT, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!prefix && [".git", "node_modules"].includes(entry.name)) continue;
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRepositoryFiles(path.join(directory, entry.name), relativePath));
    } else {
      files.push(relativePath.replaceAll("\\", "/"));
    }
  }
  return files;
}

const [colors, teamwear, source, tokens, reset, components, teamwearStory, pages, choices, search, mediaZoom, rendererSource, productTemplate, teamwearTemplate, customizeTemplate] = await Promise.all([
  read("data/colors.json").then(JSON.parse),
  read("data/teamwear-options.json").then(JSON.parse),
  read("data/products-source.json").then(JSON.parse),
  read("assets/css/tokens.css"),
  read("assets/css/reset.css"),
  read("assets/css/components.css"),
  read("assets/css/teamwear-story.css"),
  read("assets/css/pages.css"),
  read("assets/js/choices.js"),
  read("assets/js/search.js"),
  read("assets/js/media-zoom.js"),
  read("scripts/lib/site-renderers.mjs"),
  read("scripts/templates/product-page.html"),
  read("scripts/templates/teamwear-page.html"),
  read("scripts/templates/teamwear-customize.html")
]);

const colorIds = new Set(colors.colors.map((color) => color.id));
const colorNames = new Set(colors.colors.map((color) => color.name));
const visibleProducts = source.products
  .filter((product) => product.variants.some((variant) => variant.visible))
  .map((product) => ({ ...product, category: categoryForTitle(product.title) }));
const visibleProductByNumber = new Map(visibleProducts.map((product) => [product.productNumber, product]));
assert.equal(colorIds.size, colors.colors.length, "canonical color ids must be unique");
assert.equal(colorNames.size, colors.colors.length, "canonical color names must be unique");

for (const model of teamwear.models) {
  assert.equal(model.name, "PE Basketball Teamwear", `${model.id} must use the approved product name`);
  const descriptionSource = normalizeDescriptionSource(model.descriptionSource, `${model.id} description`);
  const descriptionTokens = transformDescription(descriptionSource.content);
  assert.equal(descriptionSource.type, "local", `${model.id} must use the controlled local source until a Google Doc is configured`);
  assert.equal(descriptionTokens.filter((token) => token.type === "hashtag").length, 1, `${model.id} must expose one hashtag token`);
  assert.equal(descriptionTokens.find((token) => token.type === "hashtag")?.text, `#${model.code}`, `${model.id} hashtag must preserve its model code`);
  assert.ok(Number.isInteger(model.price) && model.price > 0, `${model.id} must define a positive integer price`);
  assert.equal(model.quantities.length, 3, `${model.id} must define the three controlled quantity tiers`);
  assert.deepEqual(model.quantities.map((quantity) => [quantity.label, quantity.priceAdjustment]), [["<10", 200], ["10~19", 100], [">19", 0]], `${model.id} quantity tiers must preserve their approved labels and NT-dollar adjustments`);
  model.quantities.forEach((quantity) => {
    assert.ok(Number.isInteger(quantity.priceAdjustment) && quantity.priceAdjustment >= 0, `${model.id} ${quantity.id} must define a non-negative integer price adjustment`);
  });
  assert.ok(Array.isArray(model.addOns) && model.addOns.length > 0, `${model.id} must define its add-ons in centralized data`);
  model.addOns.forEach((addOn) => {
    assert.ok(Number.isInteger(addOn.priceAdjustment) && addOn.priceAdjustment >= 0, `${model.id} ${addOn.id} must define a non-negative integer price adjustment`);
  });
  model.colors.forEach((option) => {
    assert.ok(colorIds.has(option.colorId), `${model.id} ${option.id} must reference a canonical color id`);
    assert.ok(!("value" in option), `${model.id} ${option.id} must not carry a local color value`);
  });
  [...model.colors, ...model.patterns, ...model.quantities, ...model.addOns].forEach((option) => {
    assert.ok(["available", "unavailable"].includes(option.availability), `${model.id} ${option.id} availability must be controlled`);
  });
}

assert.deepEqual(
  normalizeDescriptionSource({ type: "local", content: "• Local" }),
  { type: "local", content: "• Local" },
  "local description sources must retain their content"
);
assert.deepEqual(
  normalizeDescriptionSource({ type: "google-doc", content: "• Remote", documentId: "doc-1", modifiedTime: "2026-08-25T00:00:00Z" }),
  { type: "google-doc", content: "• Remote", documentId: "doc-1", modifiedTime: "2026-08-25T00:00:00Z" },
  "Google Doc description sources must retain synchronization metadata"
);
assert.throws(
  () => normalizeDescriptionSource({ type: "google-doc", content: "• Missing metadata" }),
  /documentId/,
  "Google Doc description sources must require document metadata"
);

source.products.flatMap((product) => product.variants.filter((variant) => variant.visible)).forEach((variant) => {
  assert.ok(colorNames.has(variant.color), `product color ${variant.color} must resolve through colors.json`);
});

const fixture = renderChoiceGroup({
  kind: "chip",
  title: "Size",
  inputName: "fixture-size",
  selectedValue: "L",
  primaryActionId: "fixture-action",
  options: [
    { id: "M", label: "M", availability: "available" },
    { id: "L", label: "L", availability: "unavailable" }
  ]
});
assert.match(fixture, /type="radio"/, "choice groups must use native radios");
assert.match(fixture, /<legend class="visually-hidden">Size<\/legend>/, "choice groups must retain an accessible native legend");
assert.match(fixture, /class="choice-group__layout"/, "choice groups must use a normal-flow visual layout wrapper");
assert.doesNotMatch(fixture, /\sdisabled(?:\s|>)/, "unavailable choices must remain enabled");
assert.doesNotMatch(fixture, /aria-disabled/, "unavailable choices must not use aria-disabled");
assert.match(fixture, /data-availability="unavailable"/, "unavailable state must be independent metadata");
assert.match(fixture, />Unavailable</, "unavailable state must be announced accessibly");

const hiddenLabelFixture = renderChoiceGroup({
  kind: "chip",
  title: "Size",
  inputName: "fixture-size-hidden-label",
  selectedValue: "M",
  primaryActionId: "fixture-action",
  showLabel: false,
  options: [{ id: "M", label: "M", availability: "available" }]
});
assert.match(hiddenLabelFixture, /<legend class="visually-hidden">Size<\/legend>/, "hidden visual labels must retain their accessible legend");
assert.doesNotMatch(hiddenLabelFixture, /choice-group__label/, "showLabel false must omit the visual label from layout");

const addOnFixture = renderChoiceGroup({
  kind: "chip",
  variant: "add-on",
  title: "Add-on",
  inputName: "fixture-add-on",
  primaryActionId: "fixture-action",
  options: [{ id: "A01", label: "Front Pockets", selected: false, availability: "available" }]
});
assert.match(addOnFixture, /choice-group--chip-add-on[^>]*data-choice-kind="chip" data-choice-variant="add-on"/, "add-ons must remain a controlled variation of the centralized chip group");
assert.match(addOnFixture, /type="checkbox"[^>]*value="A01"(?![^>]* checked)/, "add-on chips must use an initially unselected native checkbox");
assert.match(addOnFixture, /choice-option__label interface-label[^>]*>Front Pockets<\//, "add-on chip labels must use the shared uppercase interface role");
assert.match(addOnFixture, /class="material-symbols-outlined material-icon choice-option__state-symbol" data-choice-state-symbol data-choice-unselected-symbol="add" data-choice-selected-symbol="check"[^>]*>add<\//, "add-on chips must render one centralized Material symbol initialized to plus");
assert.equal((addOnFixture.match(/data-choice-state-symbol/g) || []).length, 1, "each add-on chip must render exactly one state-symbol node");
assert.throws(
  () => renderChoiceGroup({ kind: "swatch", variant: "add-on", title: "Invalid", inputName: "invalid", primaryActionId: "fixture-action", options: [] }),
  /requires chip choices/,
  "the add-on variation must not detach from the centralized chip component"
);

const actionFixture = renderPrimaryAction({
  id: "fixture-action",
  intent: "purchase",
  initialIntent: "notify",
  behavior: "fixed-to-static",
  label: "Buy on Shopee",
  href: "https://shopee.tw/",
  target: "_blank",
  external: true,
  root: ".."
});
assert.match(actionFixture, /data-action-intent="notify"/, "actions must support notify independently from responsive behavior");
assert.match(actionFixture, /data-action-behavior="fixed-to-static"/, "actions must expose one controlled responsive behavior");
assert.match(actionFixture, /data-action-default-external="true"/, "actions must expose their default external-link state");
assert.match(actionFixture, /data-action-notify-external="true"/, "notify actions must expose their external-link state");
assert.match(actionFixture, /data-external-link="true"/, "external actions must expose their current external-link state");
assert.match(actionFixture, /class="primary-action__content"><span class="external-link__label interface-label" data-primary-action-label>Notify Me<\/span><span class="material-symbols-outlined material-icon external-link__indicator"[^>]*>arrow_outward<\/span>/, "external actions must render an uppercase-role label followed by the trailing Material arrow");
assert.match(actionFixture, /data-external-link-description> \(opens in a new tab\)<\/span>/, "external actions must describe their new-tab behavior accessibly");
assert.doesNotMatch(actionFixture, /primary-action__icon|data-action-(?:default|notify)-(?:icon|symbol)/, "primary actions must not retain leading-icon or symbol-swapping contracts");
assert.doesNotMatch(actionFixture, /<svg\b|icons\.svg|#icon-/, "primary actions must not render hand-drawn SVG icons");
assert.throws(
  () => renderPrimaryAction({ id: "bad-action", intent: "build", behavior: "floating", label: "Build", href: "/" }),
  /Unsupported primary-action behavior/,
  "primary actions must reject uncontrolled responsive behaviors"
);
assert.throws(
  () => renderPrimaryAction({ id: "bad-external-action", intent: "purchase", behavior: "fixed-to-static", label: "Buy", href: "https://example.com/", external: true }),
  /external state must match its new-tab target/,
  "primary actions must keep external indicators synchronized with new-tab behavior"
);

const footerFixture = renderSiteFooter();
assert.match(footerFixture, /<span class="external-link__label interface-label">Instagram<\/span><span class="material-symbols-outlined material-icon external-link__indicator"[^>]*>arrow_outward<\/span>/, "footers must retain Instagram as an interface label with a trailing external arrow");
assert.match(footerFixture, /<span class="external-link__label interface-label">Shopee<\/span><span class="material-symbols-outlined material-icon external-link__indicator"[^>]*>arrow_outward<\/span>/, "footers must retain Shopee as an interface label with a trailing external arrow");
assert.equal((footerFixture.match(/data-external-link-description/g) || []).length, 2, "each footer external link must describe its new-tab behavior");
assert.equal((footerFixture.match(/target="_blank" rel="noopener noreferrer" data-external-link="true"/g) || []).length, 2, "footer external links must retain safe new-tab semantics");
assert.match(footerFixture, /<div class="footer-meta">[\s\S]*?<span>Paradigm Co\., Ltd\.<\/span>[\s\S]*?data-current-year/, "footers must retain flexible company metadata");
assert.doesNotMatch(footerFixture, /Privacy Policy|Term of Use|Sales and Refunds|Discord|photo_camera|public|forum/, "footers must contain only the current external links and company metadata");

const hierarchyBreadcrumb = renderBreadcrumb({
  variant: "hierarchy",
  root: "..",
  items: [
    { label: "All", href: "/collections/all" },
    { label: "SS Tops", current: true, headingLevel: 1, interfaceLabel: true }
  ]
});
assert.match(hierarchyBreadcrumb, /data-generated-component="breadcrumb"/, "breadcrumbs must identify the shared renderer");
assert.match(hierarchyBreadcrumb, /<ol class="breadcrumb__list" role="list">/, "hierarchy breadcrumbs must expose ordered-list semantics");
assert.match(hierarchyBreadcrumb, /<a href="\/collections\/all"><span class="breadcrumb__link-label interface-label">All<\/span><\/a>/, "hierarchy breadcrumb links must use the shared interface-label role");
assert.match(hierarchyBreadcrumb, /<h1 class="breadcrumb__current interface-label" aria-current="page">SS Tops<\/h1>/, "catalog breadcrumbs must support an interface-label semantic h1");
assert.match(hierarchyBreadcrumb, />chevron_right<\//, "hierarchy breadcrumbs must use the Material chevron icon");
assert.doesNotMatch(hierarchyBreadcrumb, /&gt;|&lt;/, "breadcrumbs must not render text direction signs");

const backBreadcrumb = renderBreadcrumb({
  variant: "back",
  root: "../..",
  ariaLabel: "Back to Teamwear",
  items: [{ label: "Teamwear", href: "/teamwear" }]
});
assert.match(backBreadcrumb, /breadcrumb__icon--back/, "back breadcrumbs must use the controlled back icon direction");
assert.match(backBreadcrumb, />chevron_left<\//, "back breadcrumbs must use the native Material left chevron");
assert.match(backBreadcrumb, /<a class="breadcrumb__back-link" href="\/teamwear"/, "back breadcrumbs must retain native link semantics");
assert.match(backBreadcrumb, /<span class="breadcrumb__link-label interface-label">Teamwear<\/span>/, "back breadcrumb links must use the shared interface-label role without affecting the icon");
assert.doesNotMatch(`${hierarchyBreadcrumb}\n${backBreadcrumb}`, /breadcrumb--(?:standalone|embedded)/, "breadcrumbs must not expose placement variations");

const iconHeadline = renderPageHeadline({
  root: "..",
  breadcrumb: { variant: "hierarchy", items: [{ label: "All", current: true, headingLevel: 1 }] },
  trailingAction: { kind: "icon", icon: "search", label: "Search products" }
});
assert.match(iconHeadline, /data-generated-component="page-headline"/, "page headlines must come from the shared renderer");
assert.match(iconHeadline, /page-headline__action--icon[^>]*aria-label="Search products"/, "icon headline actions must retain accessible labels");
assert.match(iconHeadline, />search<\//, "generic icon headline actions must retain centralized Material symbols");
assert.doesNotMatch(iconHeadline, /<svg\b|icons\.svg|#icon-/, "headline actions must not render hand-drawn SVG icons");

const textHeadline = renderPageHeadline({
  breadcrumb: { variant: "hierarchy", items: [{ label: "All", current: true, headingLevel: 1, interfaceLabel: true }] },
  trailingAction: { kind: "text", label: "Refine" }
});
assert.match(textHeadline, /page-headline__action--text[^>]*><span class="interface-label">Refine<\/span>/, "catalog headlines must render Refine through the shared interface-label role");

const productBreadcrumb = renderBreadcrumb({
  variant: "hierarchy",
  items: [
    { label: "All", href: "/collections/all" },
    { label: "Fixture Product", current: true, dataAttribute: "data-product-breadcrumb-title" }
  ]
});
assert.match(productBreadcrumb, /<span class="breadcrumb__current" aria-current="page" data-product-breadcrumb-title>Fixture Product<\/span>/, "product breadcrumb titles must preserve authored casing");
assert.doesNotMatch(productBreadcrumb, /breadcrumb__current interface-label[^>]*data-product-breadcrumb-title/, "product breadcrumb titles must stay outside the interface-label role");

const headerFixture = renderSiteHeader();
assert.equal((headerFixture.match(/data-search-toggle/g) || []).length, 1, "shared headers must render one Search toggle");
assert.equal((headerFixture.match(/data-nav-toggle/g) || []).length, 1, "shared headers must render one navigation toggle");
assert.equal((headerFixture.match(/data-search-submit/g) || []).length, 1, "shared headers must render one Search submit control inside the overlay");
assert.doesNotMatch(headerFixture, /Shopping bag|shopping_bag/, "shared headers must not render a shopping-bag control or glyph");
assert.match(headerFixture, /<a class="drawer-nav__parent interface-label" href="\/collections\/all" aria-current="page">Product<\/a>/, "the clickable Product parent must own the all-products destination and interface-label casing");
assert.match(headerFixture, /<a class="drawer-nav__child interface-label" href="\/collections\/ss-tops">SS Tops<\/a>[\s\S]*?<a class="drawer-nav__child interface-label" href="\/collections\/aw-tops">AW Tops<\/a>[\s\S]*?<a class="drawer-nav__child interface-label" href="\/collections\/bottoms">Bottoms<\/a>/, "Product children must render in their controlled directory order");
assert.match(headerFixture, /<a class="drawer-nav__parent interface-label" href="\/teamwear">Teamwear<\/a>[\s\S]*?<a class="drawer-nav__child interface-label" href="\/teamwear">Basketball<\/a>/, "Teamwear and Basketball must both link to the Teamwear overview");
assert.equal((headerFixture.match(/aria-current="page"/g) || []).length, 1, "the default all-products navigation must expose one current-page marker");
const subcollectionHeaderFixture = renderSiteHeader({ currentPath: "/collections/ss-tops" });
assert.match(subcollectionHeaderFixture, /href="\/collections\/ss-tops" aria-current="page">SS Tops<\/a>/, "a product subcollection must own the current-page marker on its route");
assert.equal((subcollectionHeaderFixture.match(/aria-current="page"/g) || []).length, 1, "product subcollection navigation must expose one current-page marker");
const teamwearHeaderFixture = renderSiteHeader({ currentPath: "/teamwear/customize" });
assert.match(teamwearHeaderFixture, /href="\/teamwear" aria-current="page">Basketball<\/a>/, "Basketball must own the current-page marker throughout Teamwear");
assert.equal((teamwearHeaderFixture.match(/aria-current="page"/g) || []).length, 1, "Teamwear navigation must expose one current-page marker");
assert.doesNotMatch(headerFixture, /drawer-nav__divider|role="separator"/, "the navigation directory must not render a divider element or hairline");
assert.match(reset, /html\s*\{[\s\S]*?scrollbar-gutter:\s*stable;/, "the root scrollbar gutter must remain stable while navigation locks page scrolling");
assert.match(components, /html:has\(body\[data-overlay-state\]\)\s*\{[^}]*scrollbar-gutter:\s*auto;/, "an open overlay must take ownership of the root scrollbar track instead of stacking a second gutter");
assert.match(components, /body\[data-overlay-state\] \.site-header\s*\{[^}]*overflow-y:\s*hidden;[^}]*scrollbar-gutter:\s*stable;/, "the fixed header must retain the transferred stable gutter while an overlay owns scrolling");
assert.match(components, /\.nav-drawer,\s*\.search-overlay\s*\{[^}]*inset-block:\s*0;[^}]*inset-inline-start:\s*0;[^}]*inline-size:\s*100vw;[^}]*overflow-y:\s*auto;[^}]*scrollbar-gutter:\s*stable;/, "each independently scrolling overlay must span the viewport and reserve its gutter in the root scrollbar track");
assert.doesNotMatch(components, /(?:\.nav-drawer|\.search-overlay)[^}]*overflow-y:\s*scroll;/, "overlays must not force a visible scrollbar when their content fits");
assert.match(tokens, /--type-interface-label-transform:\s*uppercase;/, "interface label casing must remain tokenized");
assert.match(components, /\.interface-label\s*\{[\s\S]*?text-transform:\s*var\(--type-interface-label-transform\);/, "interface labels must consume the shared casing token");
assert.match(components, /\.material-symbols-outlined\s*\{[\s\S]*?text-transform:\s*none;/, "Material Symbols must remain exempt from interface-label casing");
assert.doesNotMatch(components, /\.material-symbols-outlined\s*\{[^}]*--font-weight-base\s*:/, "Material Symbols must inherit their surrounding semantic text role");
assert.match(tokens, /--material-icon-weight-offset:\s*100;/, "all Material Symbols must share the tokenized 100 weight offset");
assert.match(tokens, /--material-icon-grade:\s*0;/, "all Material Symbols must share grade 0");
assert.match(components, /\.material-symbols-outlined\s*\{[\s\S]*?--material-icon-weight:\s*calc\(var\(--font-weight-base\) - var\(--material-icon-weight-offset\)\);[\s\S]*?font-weight:\s*var\(--material-icon-weight\);[\s\S]*?font-variation-settings:\s*"FILL" 0, "wght" var\(--material-icon-weight\), "GRAD" var\(--material-icon-grade\), "opsz" 24;/, "Material Symbols must use grade 0 and render 100 below their owning text weight");
assert.doesNotMatch(components, /"GRAD"\s+-25/, "component-specific Material Symbol states must not retain the previous -25 grade");

const railControlsFixture = renderRailControls({ label: "Highlights", railId: "fixture-rail", root: ".." });
assert.match(railControlsFixture, /data-rail-previous hidden>[\s\S]*?>chevron_left<\//, "Previous rail controls must render the native left Material chevron and begin hidden");
assert.match(railControlsFixture, /data-rail-next hidden>[\s\S]*?>chevron_right<\//, "Next rail controls must render the native right Material chevron and begin hidden");
assert.doesNotMatch(railControlsFixture, />arrow_forward<\//, "Rail controls must not rotate or reuse the forward-arrow symbol");

const productGridFixture = renderProductGrid([
  { productNumber: "FIXTURE", title: "Fixture product", price: "NT$1", image: null, alt: "" }
]);
assert.match(productGridFixture, /^<div class="auto-grid product-grid" data-generated-component="product-grid">/, "product grids must expose one controlled vertical-feed class contract");
assert.doesNotMatch(productGridFixture, /marquee-strip/, "product grids must not expose the removed carousel variation");

const productDetailPriceFixture = renderProductDetailPrice({ price: "NT$1,580", dataAttribute: "data-product-price" });
assert.equal(productDetailPriceFixture, '<p class="product-detail__price" data-product-price data-generated-component="product-detail-price">NT$1,580</p>', "product-detail prices must share one renderer and support controlled data hooks");
assert.throws(
  () => renderProductDetailPrice({ price: "NT$1,580", dataAttribute: "onclick" }),
  /Invalid product-detail price data attribute/,
  "product-detail prices must reject uncontrolled attributes"
);

const descriptionFixture = renderDescription({
  tokens: transformDescription("• Exact text\n\n-\n\nSizeA SizeB\nWidth 1 2\nLength 3 4\n\n　#Fixture")
});
assert.match(descriptionFixture, /data-generated-component="rich-description"/, "rich descriptions must identify the shared renderer");
assert.match(descriptionFixture, /rich-description__blank-line">&#10;<\/div>/, "blank description lines must keep one selectable newline without generated indentation");
assert.match(descriptionFixture, /class="rich-description__line rich-description__divider" role="separator">-<\/div>/, "rich descriptions must render selectable semantic dividers");
assert.match(descriptionFixture, /class="rich-description__line rich-description__hashtag">　#Fixture<\/p>/, "rich descriptions must render exact hashtag content");
assert.match(descriptionFixture, /<table class="rich-description__table">/, "rich descriptions must render confirmed tables semantically");
assert.match(descriptionFixture, /<th scope="row">Width<\/th>/, "rich-description tables must retain row-header semantics");

assert.match(components, /\.choice-option--chip\s*\{[\s\S]*?flex:\s*1 1 0/, "chips must share equal flexible widths");
assert.match(components, /\.choice-option--chip\s*\{[\s\S]*?height:\s*var\(--choice-size\)/, "all chip variations must retain the shared 32px height token");
assert.match(components, /\.choice-option--chip-add-on\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) var\(--choice-size\);[\s\S]*?padding:\s*0;/, "add-on chips must reserve a square right-end icon column without changing chip height");
assert.match(components, /\.choice-option--chip-add-on > \.choice-option__label\s*\{[\s\S]*?width:\s*100%;[\s\S]*?padding-inline:\s*var\(--space-3\);[\s\S]*?text-align:\s*center;/, "add-on chip text must center within the remaining left region");
assert.match(components, /\.choice-option__state-icon\s*\{[\s\S]*?width:\s*var\(--choice-size\);[\s\S]*?height:\s*var\(--choice-size\);[\s\S]*?align-self:\s*center;[\s\S]*?justify-self:\s*end;[\s\S]*?margin-inline-end:\s*-1px;/, "add-on chip icons must occupy a tokenized square flush with the right edge without changing chip height");
assert.match(components, /\.choice-option__state-symbol\s*\{[\s\S]*?font-size:\s*var\(--icon-size-small\);/, "add-on chip symbols must use the shared 20px icon token");
assert.doesNotMatch(components, /choice-option__state-symbol--(?:add|check)/, "add-on chips must not coexist as layered plus and check nodes");
assert.match(choices, /function syncChoiceStateSymbols\(group\)[\s\S]*?symbol\.textContent = input\.checked \? symbol\.dataset\.choiceSelectedSymbol : symbol\.dataset\.choiceUnselectedSymbol;/, "the single add-on state symbol must swap glyph text from native checked state");
assert.match(components, /\.choice-group__layout\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*var\(--space-3\)/, "choice labels and options must form one internally spaced normal-flow group");
assert.match(components, /\.choice-group__options\s*\{[\s\S]*?margin-top:\s*0/, "choice option rows must not space themselves away from the group legend");
assert.match(components, /\.choice-group__options\s*\{[\s\S]*?gap:\s*var\(--space-3\)/, "choice groups must use the shared 8px gap");
assert.match(components, /data-availability="unavailable"\]:not\(:has\(input:checked\)\)/, "unavailable unselected styling must be controlled");
assert.match(components, /:has\(input:checked\)/, "selected styling must win through native checked state");
assert.match(components, /\.choice-option--chip\[data-availability="unavailable"\]:not\(:has\(input:checked\)\)\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background-color:\s*var\(--color-container-low\);[\s\S]*?color:\s*var\(--color-on-container-low\)/, "unavailable unselected chips must use the shared low-container treatment");
assert.match(components, /\.choice-option--chip\[data-availability="unavailable"\]:has\(input:checked\)\s*\{[\s\S]*?border-color:\s*var\(--color-on-container-low\);[\s\S]*?background-color:\s*var\(--color-container-low\);[\s\S]*?color:\s*var\(--color-on-container-low\)/, "unavailable selected chips must use the shared emphasized low-container treatment");
assert.match(components, /\.choice-option--swatch::before\s*\{[\s\S]*?background-color:\s*var\(--choice-color\)/, "swatches must preserve a registered color block independent from their backing fill");
assert.match(components, /\.choice-option--swatch\[data-availability="unavailable"\]:has\(input:checked\)\s*\{[\s\S]*?border-color:\s*var\(--color-on-container-low\);[\s\S]*?background-color:\s*var\(--color-container-low\)/, "unavailable selected swatches must use the shared low-container treatment");
assert.match(components, /\.breadcrumb__separator\s*\{[\s\S]*?margin-inline:\s*var\(--space-2\)/, "hierarchy separators must use 4px spacing on both sides");
assert.match(components, /\.breadcrumb--back\s*\{[\s\S]*?justify-content:\s*flex-start/, "back breadcrumbs must align the complete control with the shared headline start edge");
assert.match(components, /\.breadcrumb__back-link\s*\{[\s\S]*?gap:\s*var\(--space-2\)/, "back breadcrumbs must use a 4px icon-to-label gap");
assert.match(components, /\.breadcrumb__icon\s*\{[\s\S]*?width:\s*1em;[\s\S]*?height:\s*1em;/, "breadcrumb chevrons must use the shared 1em size");
assert.doesNotMatch(components, /\.breadcrumb__icon--back\s*\{[\s\S]*?rotate\(/, "back Material arrows must not depend on rotation");
assert.match(components, /\.breadcrumb :where\(a, h1, h2, h3, h4, h5, h6, \.breadcrumb__current\)/, "breadcrumb typography inheritance must target text elements only");
assert.doesNotMatch(components, /\.breadcrumb :where\([^)]*\bspan\b/, "breadcrumb typography must not override nested Material icon spans");
assert.match(components, /\.page-headline__row\s*\{[\s\S]*?min-height:\s*var\(--control-size-large\);[\s\S]*?padding-inline:\s*var\(--layout-shell-gutter-inline\);[\s\S]*?background:\s*var\(--color-surface-mid\);[\s\S]*?color:\s*var\(--color-on-surface-low\)/, "all page headlines must own the shared 48px Surface Mid row and responsive shell gutter");
assert.match(components, /\.breadcrumb a:is\(:hover, :active, :focus-visible\) \.breadcrumb__link-label,[\s\S]*?\.page-headline__action--text:is\(:hover, :active, :focus-visible\) > span\s*\{[\s\S]*?text-decoration:\s*underline/, "hover, press, and keyboard focus must underline only the corresponding interactive headline text");
assert.doesNotMatch(components, /\.breadcrumb a:is\([^)]*\)\s*,/, "breadcrumb interaction decoration must never target an anchor containing an icon glyph");
assert.match(components, /\.breadcrumb\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?min-height:\s*var\(--control-size-large\);[\s\S]*?flex:\s*1 1 auto;[\s\S]*?align-self:\s*stretch;[\s\S]*?margin-inline-start:\s*calc\(0px - var\(--layout-shell-gutter-inline\)\);[\s\S]*?padding-inline-start:\s*var\(--layout-shell-gutter-inline\);[\s\S]*?overflow-x:\s*auto/, "only the breadcrumb region may scroll, and its full-row scrollport must preserve expanded link targets without moving text");
assert.match(components, /\.page-headline__action\s*\{[\s\S]*?flex:\s*0 0 auto/, "headline actions must remain intrinsic-width trailing controls");
assert.doesNotMatch(components, /:where\([\s\S]*?\.site-logo,[\s\S]*?\.footer-link[\s\S]*?\)\s*\{[\s\S]*?min-height:\s*var\(--control-size-large\);/, "interaction guidance must not impose a shared min-height that changes established text-link layout");
assert.match(components, /\.site-actions\s*\{[\s\S]*?gap:\s*var\(--space-5\);[\s\S]*?width:\s*var\(--header-actions-width\);/, "header glyphs must use the shared 16px visual gap without enlarging their layout boxes");
assert.match(components, /\.site-logo\s*\{[\s\S]*?flex:\s*0 1 auto;[\s\S]*?margin-inline-end:\s*auto;/, "the logo must retain its intrinsic clickable width while auto margin preserves header distribution");
assert.match(components, /\.icon-button\s*\{[\s\S]*?width:\s*var\(--icon-size\);[\s\S]*?height:\s*var\(--icon-size\);/, "icon buttons must retain intrinsic 24px layout boxes");
assert.match(components, /\.icon-button::before\s*\{[\s\S]*?width:\s*var\(--control-size-large\);[\s\S]*?height:\s*var\(--control-size-large\);[\s\S]*?translate:\s*-50% -50%;/, "icon buttons must use out-of-flow 48px hit regions without changing layout");
assert.match(components, /\.site-actions \.icon-button:first-child::before\s*\{[\s\S]*?clip-path:\s*inset\(0 var\(--header-control-target-crop\) 0 0\);[\s\S]*?\.site-actions \.icon-button:last-child::before\s*\{[\s\S]*?clip-path:\s*inset\(0 0 0 var\(--header-control-target-crop\)\);/, "Search must crop only its right edge and Menu only its left edge where their expanded hit regions meet");
assert.match(components, /\.icon-button \.material-icon\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?font-size:\s*var\(--icon-size\);/, "intrinsic icon buttons must retain centered 24px glyphs");
assert.match(components, /\.search-form\s*\{[\s\S]*?height:\s*var\(--control-size-large\);[\s\S]*?min-height:\s*var\(--control-size-large\);[\s\S]*?border:\s*var\(--stroke-width-thin\) solid var\(--color-outline-low\);/, "the Search frame must retain its established 48px layout height and tokenized stroke");
assert.match(components, /\.search-form__submit\s*\{[\s\S]*?width:\s*var\(--control-size-large\);[\s\S]*?min-width:\s*var\(--control-size-large\);[\s\S]*?height:\s*100%;/, "Search submit controls must retain a real 48px interaction target");
assert.match(components, /\.page-headline__action--icon,[\s\S]*?\.page-headline__action-icon\s*\{[\s\S]*?width:\s*var\(--icon-size\);[\s\S]*?height:\s*var\(--icon-size\);/, "headline icon actions must retain intrinsic 24px layout boxes");
assert.match(components, /\.page-headline__action::before\s*\{[\s\S]*?width:\s*var\(--control-size-large\);/, "headline actions may use a 48px out-of-flow hit region inside the existing headline row");
assert.match(components, /\.drawer-nav a\s*\{[\s\S]*?display:\s*block;/, "drawer links must retain their intrinsic line-box layout");
assert.match(components, /\.search-suggestion\s*\{[\s\S]*?display:\s*block;/, "Search suggestions must retain their intrinsic line-box layout");
assert.match(components, /\.primary-action__content,[\s\S]*?\.footer-link__content,[\s\S]*?\.search-suggestion__content,[\s\S]*?\.search-page-result__content\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*inline-block;/, "external-link and Search labels must own a stable positioning context");
assert.match(components, /\.external-link__label\s*\{[\s\S]*?display:\s*block;/, "external-link labels must expose an exact block box for arrow alignment");
assert.match(components, /\.external-link__indicator\s*\{[\s\S]*?inset-block-start:\s*50%;[\s\S]*?inset-inline-start:\s*calc\(100% \+ var\(--external-link-arrow-gap\)\);[\s\S]*?translate:\s*0 -50%;[\s\S]*?font-size:\s*var\(--external-link-arrow-size\)/, "external arrows must be vertically centered after labels at the tokenized matching-em size");
assert.match(components, /\.search-result__leading-indicator\s*\{[\s\S]*?inset-block-start:\s*50%;[\s\S]*?inset-inline-end:\s*calc\(100% \+ var\(--external-link-arrow-gap\)\);[\s\S]*?translate:\s*0 -50%;[\s\S]*?font-size:\s*var\(--external-link-arrow-size\)/, "Search leading icons must mirror the external-arrow geometry before their text");
assert.match(components, /\[data-external-link="false"\][\s\S]*?display:\s*none;/, "internal actions must hide the external-link indicator and description");
assert.match(components, /\.footer-link\s*\{[\s\S]*?padding-inline-end:\s*calc\(var\(--external-link-arrow-gap\) \+ var\(--external-link-arrow-size\)\)/, "footer links must reserve trailing arrow space without moving their text start");
assert.match(components, /\[data-external-link="true"\]:is\(:hover, :active, :focus-visible\) \.external-link__indicator\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*none;/, "external arrows must reveal on hover, press, and keyboard focus");
assert.match(search, /function leadingContent\(contentClass, label, iconName\)[\s\S]*?"material-symbols-outlined material-icon search-result__leading-indicator"[\s\S]*?content\.append\(icon, label\)/, "Search leading icons must use the shared absolute icon-before-label positioning context");
assert.match(search, /const externalIcon = element\("span", "material-symbols-outlined material-icon external-link__indicator", RESULT_ICONS\.external\)/, "external Search results must reuse the standard interactive trailing-arrow class");
assert.match(components, /\.drawer-nav a:is\(:hover, :active, :focus-visible\),[\s\S]*?\.search-suggestion:is\(:hover, :active, :focus-visible\),[\s\S]*?\.search-page-result:is\(:hover, :active, :focus-visible\) \.search-page-result__title\s*\{[\s\S]*?text-decoration:\s*underline/, "navigation and search links must share hover, press, and keyboard-focus feedback");
assert.match(components, /\.choice-option\[data-availability="available"\]:is\(:hover, :active\)\s*\{[\s\S]*?border-color:\s*var\(--color-outline-high\)/, "available choices must share their hover border while pressed");
assert.match(components, /\.choice-option--chip\s*\{[^}]*--font-weight-base:\s*var\(--type-body-weight\);[^}]*font-weight:\s*var\(--font-weight-base\);/, "chips must establish the complete Body text role");
assert.match(components, /\.choice-option--chip:has\(input:checked\)\s*\{[^}]*font-weight:\s*min\([^}]*var\(--font-weight-black\)[^}]*calc\(var\(--font-weight-base\) \+ var\(--font-weight-strong-offset\)\)[^}]*\);/, "selected chip labels and their icons must use the shared Strong modifier over Body");
assert.doesNotMatch(components, /\.choice-option--chip:has\(input:checked\)\s*\{[^}]*--font-weight-base\s*:/, "selected chips must not replace their Body role with a state-specific base weight");
assert.match(components, /\.choice-option--chip:has\(input:checked\) \.choice-option__state-symbol\s*\{[^}]*--material-icon-weight:\s*min\([^}]*calc\(var\(--font-weight-black\) - var\(--material-icon-weight-offset\)\)[^}]*calc\(var\(--font-weight-base\) \+ var\(--font-weight-strong-offset\) - var\(--material-icon-weight-offset\)\)/, "selected Add-On icons must remain 100 below the Strong label calculation");
assert.match(components, /\.button\s*\{[^}]*--font-weight-base:\s*var\(--type-h5-weight\);[^}]*font-weight:\s*var\(--font-weight-base\);/, "shared buttons must use the complete H5 role weight without a state-emphasis override");
assert.match(components, /\.search-form\s*\{[^}]*--font-weight-base:\s*var\(--type-body-weight\);/, "Search action icons must explicitly share the field's Body weight");
assert.match(components, /\.footer-link\s*\{[^}]*--font-weight-base:\s*var\(--type-body-weight\);[^}]*font-weight:\s*var\(--font-weight-base\);/, "footer external arrows must explicitly share their Body label weight");
assert.match(components, /\.product-grid\s*\{[\s\S]*?gap:\s*var\(--space-1\);[\s\S]*?background:\s*transparent;/, "product-card sections must share the 2px gap and no-fill background contract");
assert.match(pages, /\.reference-page--detail \.product-feed-section\s*\{[\s\S]*?margin-top:\s*var\(--space-1\);/, "product-page feeds must expose a 2px Background Mid divider after the product detail");
assert.match(components, /\.product-card\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*var\(--color-surface-high\);/, "individual product cards must use the Surface High fill without a resting stroke");
assert.match(components, /\.product-card__media\s*\{[\s\S]*?background:\s*transparent;/, "product photos must have no independent fill over the card surface");
assert.match(rendererSource, /const touchZoom = image && !media\?\.isFallback \? " data-media-zoom-touch" : "";[\s\S]*?class="product-card__media"\$\{touchZoom\}/, "shared product cards must opt in only when populated non-fallback media exists");
assert.match(search, /if \(product\.media\?\.src\) \{[\s\S]*?if \(!product\.media\.isFallback\) media\.dataset\.mediaZoomTouch = "";/, "Search product cards must opt only their populated non-fallback photo media into touch inspection");
assert.match(productTemplate, /data-product-gallery\{\{PRODUCT_GALLERY_ZOOM\}\}/, "retail detail galleries must conditionally opt non-fallback photography into shared Large inspection");
assert.match(customizeTemplate, /data-builder-preview data-media-zoom-gallery/, "Teamwear Customize must opt into shared Large inspection");
assert.equal((customizeTemplate.match(/data-media-zoom-touch/g) || []).length, 3, "every Teamwear Customize gallery image must opt into touch inspection");
assert.equal((teamwearTemplate.match(/data-media-zoom-touch/g) || []).length, 7, "authored Teamwear highlight and customer-gallery photos must opt into touch inspection");
assert.equal((teamwearTemplate.match(/data-media-zoom-surface/g) || []).length, 7, "authored Teamwear rail photos must declare their immediate backing surfaces");
assert.match(await read("scripts/build-site.mjs"), /teamwear-rail-card__surface" data-media-zoom-surface[^\n]*teamwear-colorway-card__media" data-media-zoom-touch/, "generated Teamwear colorways must use the shared source-surface contract");
assert.doesNotMatch(teamwearTemplate.match(/<section class="teamwear-hero"[\s\S]*?<\/section>/)?.[0] || "", /data-media-zoom-touch/, "Teamwear hero media must stay outside product inspection");
assert.doesNotMatch(teamwearTemplate.match(/<section class="teamwear-material"[\s\S]*?<\/section>/)?.[0] || "", /data-media-zoom-touch/, "Teamwear fabric media must stay outside product inspection");
assert.match(components, /\[data-media-zoom-touch\],[\s\S]*?\[data-media-zoom-gallery\] img\s*\{[\s\S]*?touch-action:\s*pan-x pan-y;/, "zoom targets must preserve native one-finger panning");
assert.match(mediaZoom, /const TOUCH_ZOOM_MIN = 1;[\s\S]*?const TOUCH_ZOOM_MAX = 4;/, "touch product inspection must remain bounded from 1x through 4x");
assert.match(mediaZoom, /touches\.length >= 2[\s\S]*?startTouchGesture[\s\S]*?event\.preventDefault\(\)/, "touch inspection must activate only after a second touch reaches the same media target");
assert.match(mediaZoom, /const source = node\.closest\("\[data-media-zoom-touch\]"\);[\s\S]*?!source \|\| !imagesWithin\(source\)\.some[\s\S]*?return null;/, "touch inspection must reject unmarked and image-free targets");
assert.match(mediaZoom, /if \(!match\) return;[\s\S]*?startTouchGesture\(match\[0\], match\[1\]\)[\s\S]*?event\.preventDefault\(\)/, "touchstart must remain native unless two touches resolve to one eligible opt-in");
assert.match(mediaZoom, /function beginDrag\(touch\)[\s\S]*?function updateDrag\(touch\)/, "touch inspection must hand movement to the remaining finger");
assert.match(mediaZoom, /cloneNode\(true\)[\s\S]*?\["--choice-color", "--rail-photo-offset", "--rail-copy-offset"\][\s\S]*?getPropertyValue\(property\)/, "floating media copies must retain current imagery, Teamwear tinting, and live rail translation");
assert.doesNotMatch(teamwearStory, /media-zoom-(?:source|surface)-active/, "Teamwear must not duplicate shared floating-source state CSS");
assert.match(mediaZoom, /function mediaSurface\(source\)[\s\S]*?closest\("\[data-media-zoom-surface\]"\) \|\| source/, "the shared controller must resolve an optional backing surface with a source fallback");
assert.match(mediaZoom, /createFloatingClone\(source\)[\s\S]*?surface\.classList\.add\("media-zoom-surface-active"\)[\s\S]*?source\.classList\.add\("media-zoom-source-active"\)/, "touch inspection must activate shared source and surface states only after its floating copy exists");
assert.match(mediaZoom, /source\.classList\.remove\("media-zoom-source-active"\)[\s\S]*?surface\.classList\.remove\("media-zoom-surface-active"\)[\s\S]*?clone\.remove\(\)/, "touch inspection cleanup must restore both shared layers before removing its copy");
assert.match(components, /\.media-zoom-source-active\s*\{[\s\S]*?visibility:\s*visible !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?\.media-zoom-source-active > \*\s*\{[\s\S]*?visibility:\s*hidden !important;[\s\S]*?\.media-zoom-surface-active\s*\{[\s\S]*?background:\s*transparent !important;/, "shared floating zoom must preserve source geometry, hide its photo content, and reveal the backing context");
assert.match(mediaZoom, /largestImageSource[\s\S]*?srcset[\s\S]*?currentSrc/, "inspection media must prefer the largest responsive source and retain a current-source fallback");
assert.match(mediaZoom, /requestAnimationFrame[\s\S]*?translate3d/, "gesture-driven inspection must update through animation frames and translation");
assert.doesNotMatch(mediaZoom, /\.style\.scale\b|\bscale\s*\(/, "shared media inspection must not use scale transforms");
assert.match(mediaZoom, /role", "dialog"[\s\S]*?aria-modal", "true"[\s\S]*?tabindex", "-1"/, "the enlarged gallery must expose an accessible modal contract");
assert.match(mediaZoom, /event\.key === "Escape"[\s\S]*?event\.key === "Tab"/, "the enlarged gallery must close with Escape and contain keyboard focus");
assert.doesNotMatch(`${components}\n${mediaZoom}`, /media-zoom-lens|LENS_GALLERY_RATIO|DESKTOP_ZOOM|renderLens|queueLensFrame/, "Large media inspection must not retain the removed hover magnifier");
assert.match(components, /\.product-card__body\s*\{[\s\S]*?padding:\s*0 calc\(var\(--layout-shell-gutter-inline\) - var\(--space-3\)\) var\(--space-3\);/, "product names and prices must combine with the card inset to follow the responsive shell gutter");
assert.match(components, /\.product-card__body\s*\{[\s\S]*?background:\s*transparent;/, "product-card bodies must have no independent fill over the card surface");
assert.match(components, /\.product-card__title\s*\{[\s\S]*?background:\s*transparent;/, "product names must have no independent fill over the card surface");
assert.match(components, /\.product-card__title\s*\{[\s\S]*?color:\s*var\(--color-on-surface-high\);/, "product names must use On Surface High over the Surface High card");
assert.match(components, /\.product-card__category,[\s\S]*?\.product-card__price\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--color-on-surface-low\);/, "product categories and prices must use On Surface Low without an independent fill");
assert.match(components, /\.product-card__price\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?text-align:\s*right;/, "product prices must occupy and align to the complete responsive card-content width");
const productCardStyles = components.match(/\.product-grid\s*\{[\s\S]*?(?=\.product-detail\s*\{)/)?.[0] || "";
assert.doesNotMatch(productCardStyles, /--color-on-background-/, "product-card content must not use On Background roles over a Surface fill");
assert.doesNotMatch(`${components}\n${pages}`, /marquee-strip/, "the removed horizontal product carousel must not retain CSS overrides");
assert.match(components, /\.rich-description__divider\s*\{[\s\S]*?var\(--color-on-surface-low\)/, "rich-description dividers must use On Surface Low");
assert.match(components, /\.rich-description__hashtag\s*\{[\s\S]*?color:\s*var\(--color-on-surface-low\)/, "rich-description hashtags must use On Surface Low");
assert.match(components, /\.rich-description__table\s*\{[\s\S]*?border-collapse:\s*collapse;[\s\S]*?border:\s*0/, "rich-description tables must remain gridless");
assert.match(choices, /exactProductSelectionUnavailable/, "product availability must resolve the complete variant combination");
assert.match(choices, /action\.dataset\.actionIntent === "notify"/, "notify behavior must be centralized");
assert.match(choices, /action\.dataset\.actionNotifyExternal/, "dynamic actions must synchronize external-link state");
assert.match(choices, /action\.dataset\.externalLink = String\(nextExternal\)/, "dynamic actions must expose their current external-link state");
assert.doesNotMatch(choices, /primary-action__icon|action(?:Notify|Default)Symbol/, "dynamic actions must not swap icon glyphs");
assert.match(choices, /action\.dataset\.actionBehavior !== "fixed-to-float"/, "only fixed-to-float actions may initialize movement observers");
assert.match(choices, /const shouldFloat = largeView\.matches && inlineAboveViewport;[\s\S]*?if \(shouldFloat\) enterFloating\(\);[\s\S]*?else exitFloating\(\);/, "fixed-to-float actions must derive their motion state from the Large breakpoint and inline mount position");
assert.match(choices, /floatingState = "entering"[\s\S]*?is-floating-visible[\s\S]*?floatingState = "floating"[\s\S]*?floatingState = "exiting"[\s\S]*?settleInline/, "floating actions must use the centralized interruptible state path");
assert.match(choices, /void action\.offsetWidth;[\s\S]*?requestAnimationFrame/, "floating-action entrances must commit their hidden fixed state before becoming visible");
assert.match(choices, /startsInline[\s\S]*?is-floating-preparing[\s\S]*?remove\("is-floating-preparing"\)[\s\S]*?is-floating-visible/, "fresh floating-action preparation must not replace current-state reversal");
assert.match(choices, /!action\.classList\.contains\("is-floating-visible"\)[\s\S]*?settleInline\(\);/, "pre-frame floating-action reversals must settle without waiting for a missing transition");
assert.match(choices, /reducedMotion\.addEventListener\("change", \(event\) => updateMount\(event\.matches\)\)/, "floating-action motion must settle immediately when reduced motion changes");
assert.doesNotMatch(choices, /\bscale\s*\(|\.style\.scale\b/, "floating-action behavior must not introduce scaling");
assert.doesNotMatch(choices, /shouldDock|footerVisible|is-docked|has-floating-primary-action|data-primary-action-dock-mount/, "the persistent floating action must not dock or change header state");
assert.doesNotMatch(components, /primary-action-dock|is-docked/, "shared action styles must not retain a footer dock state");
assert.doesNotMatch(choices, /icons\.svg|#icon-|querySelector\([^\n]*\buse\b/, "dynamic actions must not target SVG sprites");
assert.doesNotMatch(choices, /\.disabled\s*=|setAttribute\(["']disabled/, "the controller must not disable unavailable choices");

const app = await read("assets/js/app.js");
assert.match(app, /function setupOverlay\(\{ overlay, toggle, openClass, openLabel, closeLabel, initialFocus \}\)/, "menu and Search must share one interruptible overlay state controller");
assert.match(app, /const STATES = Object\.freeze\(\{ closed: "closed", opening: "opening", open: "open", closing: "closing" \}\)/, "shared overlays must expose the four centralized visual states");
assert.match(rendererSource, /function renderToggleIconPair[\s\S]*?toggle-icon--resting[\s\S]*?toggle-icon--close/, "shared controls must render stacked Material icons instead of replacing text");
assert.doesNotMatch(app, /icon\.textContent|openSymbol|closeSymbol/, "overlay state changes must not replace Material icon text");
assert.match(app, /document\.addEventListener\("keydown", \(event\) => \{[\s\S]*?event\.key === "Escape"[\s\S]*?event\.key !== "Tab"/, "shared overlays must trap focus and handle Escape from one controller");
assert.doesNotMatch(app, /scrollbar-compensation|window\.innerWidth\s*-\s*document\.documentElement\.clientWidth/, "overlays must rely on the stable root gutter instead of shifting the header with measured compensation");

const authoredTemplates = ["scripts/templates/product-page.html", "scripts/templates/teamwear-page.html", "scripts/templates/teamwear-customize.html"];
for (const relativePath of authoredTemplates) {
  const template = await read(relativePath);
  assert.doesNotMatch(template, /<header class="site-header"|<footer class="site-footer"|class="choice-option|data-primary-action(?:\s|>)/, `${relativePath} must compose shared renderers instead of copying component markup`);
  assert.doesNotMatch(template, /class="[^"]*(?:breadcrumb|page-headline)|&gt;|&lt;/, `${relativePath} must not author page-headline or breadcrumb markup`);
  assert.doesNotMatch(template, /class="[^"]*rich-description/, `${relativePath} must not author rich-description markup`);
  assert.doesNotMatch(template, /<svg\b|icons\.svg|#icon-/, `${relativePath} must compose Material icons instead of authoring SVG icons`);
}
assert.doesNotMatch(components, /\.collection-breadcrumb/, "legacy collection breadcrumb CSS must be removed");
assert.doesNotMatch(components, /\.filter-bar|\.filter-button|\.breadcrumb--(?:standalone|embedded)/, "legacy headline placement and filter implementations must be removed");
assert.doesNotMatch(pages, /\.reference-page--detail \.page-headline/, "detail pages must not override the shared headline surface");
assert.doesNotMatch(`${components}\n${pages}`, /\.(?:product-copy|size-table|product-fit-guide|product-code)\b/, "legacy description classes must be removed");

const generatedPages = [
  "index.html",
  "collections/all/index.html",
  "collections/ss-tops/index.html",
  "collections/aw-tops/index.html",
  "collections/bottoms/index.html",
  "teamwear/index.html",
  "teamwear/customize/index.html",
  "search/index.html",
  ...source.products.filter((product) => product.variants.some((variant) => variant.visible)).map((product) => `products/${product.productNumber}/index.html`)
];
for (const relativePath of generatedPages) {
  const page = await read(relativePath);
  const productDetailGallery = page.match(/<div class="product-detail__gallery"[\s\S]*?<\/div>/)?.[0] || "";
  const touchZoomTags = page.match(/<[^>]+data-media-zoom-touch[^>]*>/g) || [];
  touchZoomTags.forEach((tag) => {
    assert.match(tag, /^(?:<img\b|<div class="product-card__media"|<div class="teamwear-rail-card__media(?: teamwear-colorway-card__media)?")/, `${relativePath} must not opt non-product or non-photo markup into custom pinch inspection`);
  });
  const zoomSurfaceTags = page.match(/<[^>]+data-media-zoom-surface[^>]*>/g) || [];
  zoomSurfaceTags.forEach((tag) => {
    assert.match(tag, /^<div class="teamwear-rail-card__surface" data-media-zoom-surface>$/, `${relativePath} must use backing-surface markers only on explicit photo-card media surfaces`);
  });
  assert.match(page, /Generated by scripts\/build-site\.mjs/, `${relativePath} must carry the generated banner`);
  assert.match(page, /assets\/css\/tokens\.css\?v=20260901b/, `${relativePath} must cache-bust the shared typography, target, icon, safe-area, media-layer, and motion tokens`);
  assert.match(page, /assets\/css\/motion\.css\?v=20260831a/, `${relativePath} must load the shared motion layer`);
  assert.match(page, /assets\/css\/components\.css\?v=20260902g/, `${relativePath} must cache-bust shared interaction-target, overlay, static resting toggle, paired-icon, floating-action, media-source, and transferred stable overlay-gutter rules`);
  assert.match(page, /assets\/css\/reset\.css\?v=20260829a/, `${relativePath} must cache-bust the stable scrollbar-gutter reset`);
  assert.match(page, /assets\/js\/page-transitions\.js\?v=20260831a/, `${relativePath} must load the early route-motion controller`);
  assert.match(page, /assets\/js\/app\.js\?v=20260831a/, `${relativePath} must cache-bust the shared overlay behavior`);
  assert.match(page, /assets\/js\/search-core\.js\?v=20260829b/, `${relativePath} must load the shared search matcher`);
  assert.match(page, /assets\/js\/search\.js\?v=20260902a/, `${relativePath} must load the shared Search interface`);
  assert.match(page, /assets\/js\/choices\.js\?v=20260831c/, `${relativePath} must cache-bust the shared choice and floating-action controller`);
  if (/^(?:index\.html|collections\/|products\/|teamwear\/|search\/)/.test(relativePath)) {
    assert.match(page, /assets\/js\/media-zoom\.js\?v=20260831c/, `${relativePath} must cache-bust the shared media inspection behavior`);
  } else {
    assert.doesNotMatch(page, /media-zoom\.js/, `${relativePath} must not load media inspection outside opted-in page families`);
  }
  if (relativePath === "teamwear/index.html") {
    assert.match(page, /assets\/css\/teamwear-story\.css\?v=20260902a/, `${relativePath} must cache-bust the restored 32px Teamwear rail treatment`);
  }
  assert.match(page, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/, `${relativePath} must preconnect to Google Fonts CSS`);
  assert.match(page, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/, `${relativePath} must preconnect to Google font files`);
  assert.match(page, /family=Roboto:wdth,wght@87\.5,100\.\.900&amp;display=swap/, `${relativePath} must load Roboto Semi Condensed across the complete weight range`);
  assert.match(page, /fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined:opsz,wght,FILL,GRAD@24,100\.\.700,0,0&amp;icon_names=/, `${relativePath} must load the optimized Material Symbols subset with the complete offset weight range and fixed grade 0`);
  assert.doesNotMatch(page, /alibabafonts|AlibabaSansTC/i, `${relativePath} must not load the deferred Alibaba webfont`);
  assert.match(page, /class="material-symbols-outlined material-icon/, `${relativePath} must render shared Material Symbols`);
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/, `${relativePath} must expose browser safe areas through the shared viewport metadata`);
  assert.doesNotMatch(page, /<svg\b|icons\.svg|#icon-/, `${relativePath} must not render hand-drawn SVG icons`);
  assert.doesNotMatch(page, /Shopping bag|shopping_bag|filter_alt/, `${relativePath} must not render retired bag or catalog-filter icons`);
  assert.doesNotMatch(page.replace(/\splaceholder="[^"]*"/g, ""), /placeholder/i, `${relativePath} must not identify rendered draft content as a placeholder`);
  assert.doesNotMatch(page, /class="(?:swatch|size-chip|teamwear-color-choice|teamwear-pattern-option)/, `${relativePath} must not use a legacy choice implementation`);
  assert.doesNotMatch(page, /data-choice-option[^>]*(?:disabled|aria-disabled)/, `${relativePath} choices must stay selectable`);
  assert.doesNotMatch(page, /data-action-(?:presentation|responsive-start)=/, `${relativePath} must not render legacy action behavior attributes`);
  if (/^(?:index\.html|collections\/|products\/|teamwear\/customize\/|search\/)/.test(relativePath)) {
    assert.match(page, /data-generated-component="breadcrumb"/, `${relativePath} must use the shared breadcrumb renderer`);
    assert.match(page, /data-generated-component="page-headline"/, `${relativePath} must use the shared page-headline renderer`);
  }
  if (/^(?:index\.html|collections\/)/.test(relativePath)) {
    assert.match(page, /page-headline__action--text[^>]*><span class="interface-label">Refine<\/span>/, `${relativePath} must render the catalog Refine text action`);
  }
  if (/^(?:products\/|teamwear\/customize\/)/.test(relativePath)) {
    assert.match(page, /data-generated-component="rich-description"/, `${relativePath} must use the shared rich-description renderer`);
    assert.match(page, /data-generated-component="product-detail-price"/, `${relativePath} must use the shared product-detail price renderer`);
    assert.doesNotMatch(page, /class="[^"]*(?:product-copy|size-table)/, `${relativePath} must not render legacy description classes`);
    assert.match(page, /data-action-behavior="fixed-to-static"/, `${relativePath} must keep its action static at Large`);
    assert.doesNotMatch(page, /data-primary-action-dock-mount=/, `${relativePath} must not render an unused action dock`);
    if (/^products\//.test(relativePath) && productDetailGallery.includes("data-product-image-fallback")) {
      assert.doesNotMatch(productDetailGallery, /data-product-gallery data-media-zoom-gallery/, `${relativePath} fallback gallery must not enable image inspection`);
    } else {
      assert.match(page, /data-media-zoom-gallery/, `${relativePath} must render the shared touch and Large gallery contract`);
    }
  }
  if (/^(?:index\.html|collections\/)/.test(relativePath)) {
    assert.match(page, /class="product-card__media" data-media-zoom-touch><img/, `${relativePath} populated catalog cards must render touch inspection markup`);
    assert.doesNotMatch(page, /class="product-card__media" data-media-zoom-touch><\/div>/, `${relativePath} blank catalog media must not opt into touch inspection`);
    assert.doesNotMatch(page, /class="product-card__media" data-media-zoom-touch><img[^>]*data-product-image-fallback/, `${relativePath} fallback catalog media must not opt into touch inspection`);
  }
  if (relativePath === "search/index.html") {
    assert.match(page, /assets\/js\/media-zoom\.js\?v=20260831c/, "Search must load touch inspection for dynamically rendered product-card photos");
  }
  if (relativePath === "teamwear/customize/index.html") {
    assert.match(page, /assets\/js\/choices\.js\?v=20260831c/, "Teamwear Customize must cache-bust the current shared choice controller");
    assert.match(page, /assets\/js\/teamwear-options\.js\?v=20260828a/, "Teamwear Customize must cache-bust centralized model, quantity, and add-on data");
    assert.match(page, /<h1[^>]*>PE Basketball Teamwear<\/h1>/, "Teamwear Customize must render the approved product name");
    assert.match(page, /assets\/js\/teamwear\.js\?v=20260831a/, "Teamwear Customize must cache-bust current shared Teamwear behavior");
    assert.match(page, /<p class="product-detail__price" data-teamwear-price data-generated-component="product-detail-price">NT\$1,580<\/p>/, "Teamwear Customize must expose its centralized NT$1,580 price for controlled add-on updates");
    assert.match(page, /data-choice-kind="chip" data-choice-variant="add-on" data-choice-title="Add-On"/, "Teamwear Customize must render the centralized Add-On chip variation");
    assert.match(page, /data-choice-kind="chip" data-choice-title="Quantity"[\s\S]*?value="Q01"[\s\S]*?&lt;10[\s\S]*?value="Q02"[\s\S]*?10~19[\s\S]*?value="Q03" checked[\s\S]*?&gt;19/, "Teamwear Customize must render three escaped quantity chips with >19 selected by default");
    assert.match(page, /type="checkbox"[^>]*name="teamwear-add-on"[^>]*value="A01"(?![^>]* checked)/, "Front Pockets must begin as an unselected add-on");
    assert.equal((page.match(/data-choice-state-symbol/g) || []).length, 1, "Teamwear Customize must render exactly one state-symbol node for Front Pockets");
    assert.match(page, /data-choice-state-symbol data-choice-unselected-symbol="add" data-choice-selected-symbol="check"[^>]*>add<\//, "Front Pockets must initialize its single state symbol to plus");
    assert.match(page, /data-choice-title="Pattern"[\s\S]*?data-choice-title="Quantity"[\s\S]*?data-choice-title="Add-On"[\s\S]*?data-primary-action-inline-mount="teamwear-customize-primary-action"/, "Quantity and Add-On must sit after Pattern and before Direct Message in that order");
    assert.doesNotMatch(page, /data-summary-code/, "Teamwear Customize must not replace the product-detail price with a selection code");
  }
  if (relativePath === "teamwear/index.html") {
    assert.equal((page.match(/data-media-zoom-touch/g) || []).length, 14, "Teamwear landing must opt in four highlight, seven colorway, and three customer-gallery photos");
    assert.equal((page.match(/data-media-zoom-surface/g) || []).length, 14, "every Teamwear landing zoom target must pair with the shared backing-surface contract");
  }
  if (relativePath === "collections/all/index.html") {
    assert.match(page, /<h1 class="breadcrumb__current interface-label" aria-current="page">All<\/h1>/, "the All collection heading must remain All");
    assert.equal((page.match(/All Products/g) || []).length, 0, "the navigation directory must use Product without renaming the All collection heading");
  }
  if (relativePath === "teamwear/index.html" || relativePath === "teamwear/customize/index.html") {
    assert.doesNotMatch(page, /Basketball 01/, `${relativePath} must not retain the retired product name`);
  }
  if (relativePath.startsWith("products/")) {
    const currentProductNumber = relativePath.split("/")[1];
    const currentProduct = visibleProductByNumber.get(currentProductNumber);
    const expectedProductNumbers = rankRelatedProducts(visibleProducts, currentProduct).map((product) => product.productNumber);
    const actualProductNumbers = [...page.matchAll(/<a class="product-card" href="\/products\/([^"]+)">/g)].map((match) => match[1]);
    assert.match(page, /class="breadcrumb__current" aria-current="page" data-product-breadcrumb-title/, `${relativePath} product breadcrumb title must preserve authored casing`);
    assert.match(page, /<section class="section section--tight product-feed-section">[\s\S]*?<div class="auto-grid product-grid"/, `${relativePath} must place the shared feed after a tokenized divider boundary`);
    assert.match(page, /<div class="auto-grid product-grid" data-generated-component="product-grid">/, `${relativePath} must use the shared vertical product feed`);
    assert.doesNotMatch(page, /marquee-strip/, `${relativePath} must not render the removed product carousel`);
    assert.equal(actualProductNumbers.length, visibleProducts.length - 1, `${relativePath} must render every other visible product`);
    assert.ok(!actualProductNumbers.includes(currentProductNumber), `${relativePath} must exclude its current product`);
    assert.deepEqual(actualProductNumbers, expectedProductNumbers, `${relativePath} must preserve the family-category-catalog similarity order`);
  }
  if (relativePath === "teamwear/index.html") {
    assert.match(page, /<body class="[^"]*teamwear-story-shell/, "Teamwear landing must own its page-positioned header behavior");
    assert.match(page, /data-action-behavior="fixed-to-float"/, "Teamwear landing must own the only floating action behavior");
    assert.equal((page.match(/data-primary-action-dock-mount=/g) || []).length, 0, "Teamwear landing must not render a floating-action dock");
    assert.match(page, /<fieldset[^>]*data-choice-title="Pattern"[\s\S]*?<legend class="visually-hidden">Pattern<\/legend>/, "Teamwear landing must retain an accessible Pattern legend");
    assert.doesNotMatch(page, /<div class="choice-group__label"[^>]*>[\s\S]*?Pattern[\s\S]*?<\/div>/, "Teamwear landing must not display the Pattern label");
    assert.doesNotMatch(page.replace(/\splaceholder="[^"]*"/g, ""), /placeholder|draft|pending approval|being collected/i, "Teamwear must not announce draft or pending content in the rendered experience");
  }
}

const relatedNumbersFor = (productNumber) => rankRelatedProducts(visibleProducts, visibleProductByNumber.get(productNumber)).map((product) => product.productNumber);
assert.equal(productFamilyKey("14001"), null, "products without an alphabetic prefix must not share a family key");
assert.deepEqual(relatedNumbersFor("ED14001").slice(0, 3), ["ED14024", "ED23002", "ED24014"], "Everyday products must rank by family, then category, then catalog order");
assert.equal(relatedNumbersFor("PH14010")[0], "PH14011", "Football jerseys must rank their matching family first");
assert.equal(relatedNumbersFor("GM42022")[0], "GM42023", "Training shorts must rank their matching family first");

const repositoryFiles = await listRepositoryFiles();
const svgFiles = repositoryFiles.filter((relativePath) => relativePath.toLowerCase().endsWith(".svg")).sort();
assert.deepEqual(svgFiles, ["favicon.svg"], "the solid brand favicon must be the only SVG asset in the project");
const favicon = await read("favicon.svg");
assert.match(favicon, /<svg\b[^>]*viewBox="0 0 64 64"/, "the allowed favicon must retain its 64px square canvas");
assert.match(favicon, /<circle\b[^>]*cx="32"[^>]*cy="32"[^>]*r="32"[^>]*fill="#a6192e"/, "the allowed favicon must remain a full-canvas brand-color circle");
assert.doesNotMatch(favicon, /<(?:path|rect|ellipse|line|polygon|polyline)\b/, "the favicon must not contain hand-drawn artwork or additional shapes");

console.log(`SHARED_COMPONENTS_OK pages=${generatedPages.length} colors=${colors.colors.length} materialIcons=true svgAssets=${svgFiles.length} selectableUnavailable=true generatedOnly=true`);
