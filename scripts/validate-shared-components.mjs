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

const [colors, teamwear, source, tokens, reset, components, pages, choices] = await Promise.all([
  read("data/colors.json").then(JSON.parse),
  read("data/teamwear-options.json").then(JSON.parse),
  read("data/products-source.json").then(JSON.parse),
  read("assets/css/tokens.css"),
  read("assets/css/reset.css"),
  read("assets/css/components.css"),
  read("assets/css/pages.css"),
  read("assets/js/choices.js")
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
assert.match(tokens, /--type-interface-label-transform:\s*uppercase;/, "interface label casing must remain tokenized");
assert.match(components, /\.interface-label\s*\{[\s\S]*?text-transform:\s*var\(--type-interface-label-transform\);/, "interface labels must consume the shared casing token");
assert.match(components, /\.material-symbols-outlined\s*\{[\s\S]*?text-transform:\s*none;/, "Material Symbols must remain exempt from interface-label casing");

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
assert.match(components, /\.breadcrumb a:hover \.breadcrumb__link-label,[\s\S]*?\.page-headline__action--text:hover > span\s*\{[\s\S]*?text-decoration:\s*underline/, "hover must underline only the corresponding interactive headline text");
assert.doesNotMatch(components, /\.breadcrumb a:hover\s*,/, "breadcrumb hover decoration must never target an anchor containing an icon glyph");
assert.match(components, /\.breadcrumb\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-x:\s*auto/, "only the breadcrumb region may scroll within a page headline");
assert.match(components, /\.page-headline__action\s*\{[\s\S]*?flex:\s*0 0 auto/, "headline actions must remain intrinsic-width trailing controls");
assert.match(components, /\.page-headline__action::before\s*\{[\s\S]*?width:\s*var\(--control-size-medium\);[\s\S]*?height:\s*var\(--control-size-medium\)/, "headline actions must retain a 40px interaction target");
assert.match(components, /\.page-headline__action--icon,[\s\S]*?width:\s*var\(--icon-size\);[\s\S]*?height:\s*var\(--icon-size\)/, "headline icon actions must use the shared 24px icon size");
assert.match(components, /\.primary-action__content,[\s\S]*?\.footer-link__content\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*inline-block;/, "external-link labels must own a stable positioning context");
assert.match(components, /\.external-link__label\s*\{[\s\S]*?display:\s*inline-block;/, "external-link labels must expose a measurable line box for top alignment");
assert.match(components, /\.external-link__indicator\s*\{[\s\S]*?inset-block-start:\s*0;[\s\S]*?inset-inline-start:\s*calc\(100% \+ var\(--external-link-arrow-gap\)\);[\s\S]*?font-size:\s*var\(--external-link-arrow-size\)/, "external arrows must be top-aligned after labels at the tokenized half-em size");
assert.match(components, /\[data-external-link="false"\][\s\S]*?display:\s*none;/, "internal actions must hide the external-link indicator and description");
assert.match(components, /\.footer-link\s*\{[\s\S]*?padding-inline-end:\s*calc\(var\(--external-link-arrow-gap\) \+ var\(--external-link-arrow-size\)\)/, "footer links must reserve trailing arrow space without moving their text start");
assert.match(components, /\[data-external-link="true"\]:is\(:hover, :focus-visible\) \.external-link__indicator\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*none;/, "external arrows must reveal on pointer hover and keyboard focus");
assert.match(components, /\.product-grid\s*\{[\s\S]*?gap:\s*var\(--space-1\);[\s\S]*?background:\s*transparent;/, "product-card sections must share the 2px gap and no-fill background contract");
assert.match(pages, /\.reference-page--detail \.product-feed-section\s*\{[\s\S]*?margin-top:\s*var\(--space-1\);/, "product-page feeds must expose a 2px Background Mid divider after the product detail");
assert.match(components, /\.product-card\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*var\(--color-surface-high\);/, "individual product cards must use the Surface High fill without a resting stroke");
assert.match(components, /\.product-card__media\s*\{[\s\S]*?background:\s*transparent;/, "product photos must have no independent fill over the card surface");
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
assert.match(choices, /action\.classList\.toggle\("is-floating", inlineAboveViewport\)/, "fixed-to-float actions must remain floating after their inline mount leaves the viewport");
assert.doesNotMatch(choices, /shouldDock|footerVisible|is-docked|has-floating-primary-action|data-primary-action-dock-mount/, "the persistent floating action must not dock or change header state");
assert.doesNotMatch(components, /primary-action-dock|is-docked/, "shared action styles must not retain a footer dock state");
assert.doesNotMatch(choices, /icons\.svg|#icon-|querySelector\([^\n]*\buse\b/, "dynamic actions must not target SVG sprites");
assert.doesNotMatch(choices, /\.disabled\s*=|setAttribute\(["']disabled/, "the controller must not disable unavailable choices");

const app = await read("assets/js/app.js");
assert.match(app, /function setupOverlay\(\{ overlay, toggle, openClass, openLabel, closeLabel, openSymbol, closeSymbol, initialFocus \}\)/, "menu and Search must share one overlay controller");
assert.match(app, /icon\.textContent = closeSymbol/, "open overlays must use their configured Material close symbol");
assert.match(app, /icon\.textContent = openSymbol/, "closed overlays must restore their configured Material symbol");
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
  assert.match(page, /Generated by scripts\/build-site\.mjs/, `${relativePath} must carry the generated banner`);
  assert.match(page, /assets\/css\/tokens\.css\?v=20260830a/, `${relativePath} must cache-bust the safe-area-aware header tokens`);
  assert.match(page, /assets\/css\/reset\.css\?v=20260829a/, `${relativePath} must cache-bust the stable scrollbar-gutter reset`);
  assert.match(page, /assets\/css\/components\.css\?v=20260830d/, `${relativePath} must cache-bust the shared overlay, header, and navigation-directory styles`);
  assert.match(page, /assets\/js\/app\.js\?v=20260829b/, `${relativePath} must cache-bust the shared overlay behavior`);
  assert.match(page, /assets\/js\/search-core\.js\?v=20260829b/, `${relativePath} must load the shared search matcher`);
  assert.match(page, /assets\/js\/search\.js\?v=20260830a/, `${relativePath} must load the shared Search interface`);
  assert.match(page, /fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined/, `${relativePath} must load the shared Material Symbols font`);
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
  }
  if (relativePath === "teamwear/customize/index.html") {
    assert.match(page, /assets\/js\/choices\.js\?v=20260829a/, "Teamwear Customize must cache-bust the current shared choice controller");
    assert.match(page, /assets\/js\/teamwear-options\.js\?v=20260828a/, "Teamwear Customize must cache-bust centralized model, quantity, and add-on data");
    assert.match(page, /<h1[^>]*>PE Basketball Teamwear<\/h1>/, "Teamwear Customize must render the approved product name");
    assert.match(page, /assets\/js\/teamwear\.js\?v=20260830a/, "Teamwear Customize must cache-bust current shared Teamwear behavior");
    assert.match(page, /<p class="product-detail__price" data-teamwear-price data-generated-component="product-detail-price">NT\$1,580<\/p>/, "Teamwear Customize must expose its centralized NT$1,580 price for controlled add-on updates");
    assert.match(page, /data-choice-kind="chip" data-choice-variant="add-on" data-choice-title="Add-On"/, "Teamwear Customize must render the centralized Add-On chip variation");
    assert.match(page, /data-choice-kind="chip" data-choice-title="Quantity"[\s\S]*?value="Q01"[\s\S]*?&lt;10[\s\S]*?value="Q02"[\s\S]*?10~19[\s\S]*?value="Q03" checked[\s\S]*?&gt;19/, "Teamwear Customize must render three escaped quantity chips with >19 selected by default");
    assert.match(page, /type="checkbox"[^>]*name="teamwear-add-on"[^>]*value="A01"(?![^>]* checked)/, "Front Pockets must begin as an unselected add-on");
    assert.equal((page.match(/data-choice-state-symbol/g) || []).length, 1, "Teamwear Customize must render exactly one state-symbol node for Front Pockets");
    assert.match(page, /data-choice-state-symbol data-choice-unselected-symbol="add" data-choice-selected-symbol="check"[^>]*>add<\//, "Front Pockets must initialize its single state symbol to plus");
    assert.match(page, /data-choice-title="Pattern"[\s\S]*?data-choice-title="Quantity"[\s\S]*?data-choice-title="Add-On"[\s\S]*?data-primary-action-inline-mount="teamwear-customize-primary-action"/, "Quantity and Add-On must sit after Pattern and before Direct Message in that order");
    assert.doesNotMatch(page, /data-summary-code/, "Teamwear Customize must not replace the product-detail price with a selection code");
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
