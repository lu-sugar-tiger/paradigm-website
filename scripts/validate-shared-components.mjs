import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDescriptionSource, transformDescription } from "./lib/rich-description.mjs";
import { renderBreadcrumb, renderChoiceGroup, renderDescription, renderPageHeadline, renderPrimaryAction } from "./lib/site-renderers.mjs";

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

const [colors, teamwear, source, components, pages, choices] = await Promise.all([
  read("data/colors.json").then(JSON.parse),
  read("data/teamwear-options.json").then(JSON.parse),
  read("data/products-source.json").then(JSON.parse),
  read("assets/css/components.css"),
  read("assets/css/pages.css"),
  read("assets/js/choices.js")
]);

const colorIds = new Set(colors.colors.map((color) => color.id));
const colorNames = new Set(colors.colors.map((color) => color.name));
assert.equal(colorIds.size, colors.colors.length, "canonical color ids must be unique");
assert.equal(colorNames.size, colors.colors.length, "canonical color names must be unique");

for (const model of teamwear.models) {
  const descriptionSource = normalizeDescriptionSource(model.descriptionSource, `${model.id} description`);
  const descriptionTokens = transformDescription(descriptionSource.content);
  assert.equal(descriptionSource.type, "local", `${model.id} must use the controlled local source until a Google Doc is configured`);
  assert.equal(descriptionTokens.filter((token) => token.type === "hashtag").length, 1, `${model.id} must expose one hashtag token`);
  assert.equal(descriptionTokens.find((token) => token.type === "hashtag")?.text, `#${model.code}`, `${model.id} hashtag must preserve its model code`);
  model.colors.forEach((option) => {
    assert.ok(colorIds.has(option.colorId), `${model.id} ${option.id} must reference a canonical color id`);
    assert.ok(!("value" in option), `${model.id} ${option.id} must not carry a local color value`);
  });
  [...model.colors, ...model.patterns].forEach((option) => {
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

const actionFixture = renderPrimaryAction({
  id: "fixture-action",
  intent: "purchase",
  initialIntent: "notify",
  behavior: "fixed-to-static",
  label: "Buy on Shopee",
  icon: "external",
  href: "https://shopee.tw/",
  root: ".."
});
assert.match(actionFixture, /data-action-intent="notify"/, "actions must support notify independently from responsive behavior");
assert.match(actionFixture, /data-action-behavior="fixed-to-static"/, "actions must expose one controlled responsive behavior");
assert.match(actionFixture, /data-action-notify-symbol="notifications"/, "notify actions must map to the Material notifications symbol");
assert.match(actionFixture, /class="material-symbols-outlined material-icon primary-action__icon"[^>]*>notifications</, "notify actions must render the shared Material symbol");
assert.doesNotMatch(actionFixture, /<svg\b|icons\.svg|#icon-/, "primary actions must not render hand-drawn SVG icons");
assert.throws(
  () => renderPrimaryAction({ id: "bad-action", intent: "build", behavior: "floating", label: "Build", icon: "arrow", href: "/" }),
  /Unsupported primary-action behavior/,
  "primary actions must reject uncontrolled responsive behaviors"
);

const hierarchyBreadcrumb = renderBreadcrumb({
  variant: "hierarchy",
  root: "..",
  items: [
    { label: "All", href: "/collections/all" },
    { label: "SS Tops", current: true, headingLevel: 1 }
  ]
});
assert.match(hierarchyBreadcrumb, /data-generated-component="breadcrumb"/, "breadcrumbs must identify the shared renderer");
assert.match(hierarchyBreadcrumb, /<ol class="breadcrumb__list" role="list">/, "hierarchy breadcrumbs must expose ordered-list semantics");
assert.match(hierarchyBreadcrumb, /<a href="\/collections\/all"><span class="breadcrumb__link-label">All<\/span><\/a>/, "hierarchy breadcrumb links must isolate their hover label from icon glyphs");
assert.match(hierarchyBreadcrumb, /<h1 class="breadcrumb__current" aria-current="page">SS Tops<\/h1>/, "catalog breadcrumbs must support a visually inherited semantic h1");
assert.match(hierarchyBreadcrumb, />chevron_right<\//, "hierarchy breadcrumbs must use the Material chevron icon");
assert.doesNotMatch(hierarchyBreadcrumb, /&gt;|&lt;/, "breadcrumbs must not render text direction signs");

const backBreadcrumb = renderBreadcrumb({
  variant: "back",
  root: "../..",
  ariaLabel: "Back to Teamwear",
  items: [{ label: "Teamwear", href: "/teamwear" }]
});
assert.match(backBreadcrumb, /breadcrumb__icon--back/, "back breadcrumbs must use the controlled back icon direction");
assert.match(backBreadcrumb, /<a class="breadcrumb__back-link" href="\/teamwear"/, "back breadcrumbs must retain native link semantics");
assert.match(backBreadcrumb, /<span class="breadcrumb__link-label">Teamwear<\/span>/, "back breadcrumb links must isolate their hover label from the rotated icon glyph");
assert.doesNotMatch(`${hierarchyBreadcrumb}\n${backBreadcrumb}`, /breadcrumb--(?:standalone|embedded)/, "breadcrumbs must not expose placement variations");

const iconHeadline = renderPageHeadline({
  root: "..",
  breadcrumb: { variant: "hierarchy", items: [{ label: "All", current: true, headingLevel: 1 }] },
  trailingAction: { kind: "icon", icon: "filter", label: "Filter products" }
});
assert.match(iconHeadline, /data-generated-component="page-headline"/, "page headlines must come from the shared renderer");
assert.match(iconHeadline, /page-headline__action--icon[^>]*aria-label="Filter products"/, "icon headline actions must retain accessible labels");
assert.match(iconHeadline, />filter_alt<\//, "catalog headline actions must use the Material filter icon");
assert.doesNotMatch(iconHeadline, /<svg\b|icons\.svg|#icon-/, "catalog headline actions must not render hand-drawn SVG icons");

const textHeadline = renderPageHeadline({
  breadcrumb: { variant: "back", items: [{ label: "Teamwear", href: "/teamwear" }] },
  trailingAction: { kind: "text", label: "Filter" }
});
assert.match(textHeadline, /page-headline__action--text[^>]*><span>Filter<\/span>/, "page headlines must support controlled text actions");

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
assert.match(components, /\.breadcrumb__back-link\s*\{[\s\S]*?gap:\s*var\(--space-2\)/, "back breadcrumbs must use a 4px icon-to-label gap");
assert.match(components, /\.breadcrumb__icon\s*\{[\s\S]*?width:\s*1em;[\s\S]*?height:\s*1em;/, "breadcrumb chevrons must use the shared 1em size");
assert.match(components, /\.breadcrumb__icon--forward\s*\{[\s\S]*?transform:\s*none/, "hierarchy Material chevrons must point right without rotation");
assert.match(components, /\.breadcrumb__icon--back\s*\{[\s\S]*?rotate\(180deg\)/, "back Material chevrons must point left");
assert.match(components, /\.breadcrumb :where\(a, h1, h2, h3, h4, h5, h6, \.breadcrumb__current\)/, "breadcrumb typography inheritance must target text elements only");
assert.doesNotMatch(components, /\.breadcrumb :where\([^)]*\bspan\b/, "breadcrumb typography must not override nested Material icon spans");
assert.match(components, /\.page-headline__row\s*\{[\s\S]*?min-height:\s*var\(--control-size-large\);[\s\S]*?padding-inline:\s*var\(--space-5\);[\s\S]*?background:\s*var\(--color-surface-mid\);[\s\S]*?color:\s*var\(--color-on-surface-low\)/, "all page headlines must own the shared 48px Surface Mid row");
assert.match(components, /\.breadcrumb a:hover \.breadcrumb__link-label,[\s\S]*?\.page-headline__action--text:hover > span\s*\{[\s\S]*?text-decoration:\s*underline/, "hover must underline only the corresponding interactive headline text");
assert.doesNotMatch(components, /\.breadcrumb a:hover\s*,/, "breadcrumb hover decoration must never target an anchor containing an icon glyph");
assert.match(components, /\.breadcrumb\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-x:\s*auto/, "only the breadcrumb region may scroll within a page headline");
assert.match(components, /\.page-headline__action\s*\{[\s\S]*?flex:\s*0 0 auto/, "headline actions must remain intrinsic-width trailing controls");
assert.match(components, /\.page-headline__action::before\s*\{[\s\S]*?width:\s*var\(--control-size-medium\);[\s\S]*?height:\s*var\(--control-size-medium\)/, "headline actions must retain a 40px interaction target");
assert.match(components, /\.page-headline__action--icon,[\s\S]*?width:\s*var\(--icon-size\);[\s\S]*?height:\s*var\(--icon-size\)/, "headline icon actions must use the shared 24px icon size");
assert.match(components, /\.rich-description__divider\s*\{[\s\S]*?var\(--color-on-surface-low\)/, "rich-description dividers must use On Surface Low");
assert.match(components, /\.rich-description__hashtag\s*\{[\s\S]*?color:\s*var\(--color-on-surface-low\)/, "rich-description hashtags must use On Surface Low");
assert.match(components, /\.rich-description__table\s*\{[\s\S]*?border-collapse:\s*collapse;[\s\S]*?border:\s*0/, "rich-description tables must remain gridless");
assert.match(choices, /exactProductSelectionUnavailable/, "product availability must resolve the complete variant combination");
assert.match(choices, /action\.dataset\.actionIntent === "notify"/, "notify behavior must be centralized");
assert.match(choices, /action\.dataset\.actionNotifySymbol/, "dynamic actions must swap Material symbol names");
assert.match(choices, /action\.dataset\.actionBehavior !== "fixed-to-float"/, "only fixed-to-float actions may initialize movement observers");
assert.match(choices, /const shouldDock = isLarge && footerVisible/, "actions may dock only at the Large breakpoint");
assert.doesNotMatch(choices, /icons\.svg|#icon-|querySelector\([^\n]*\buse\b/, "dynamic actions must not target SVG sprites");
assert.doesNotMatch(choices, /\.disabled\s*=|setAttribute\(["']disabled/, "the controller must not disable unavailable choices");

const app = await read("assets/js/app.js");
assert.match(app, /icon\.textContent = toggle\.dataset\.navCloseSymbol/, "open navigation state must use the Material close symbol");
assert.match(app, /icon\.textContent = toggle\.dataset\.navOpenSymbol/, "closed navigation state must restore the Material menu symbol");

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
  ...source.products.filter((product) => product.variants.some((variant) => variant.visible)).map((product) => `products/${product.productNumber}/index.html`)
];
for (const relativePath of generatedPages) {
  const page = await read(relativePath);
  assert.match(page, /Generated by scripts\/build-site\.mjs/, `${relativePath} must carry the generated banner`);
  assert.match(page, /fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined/, `${relativePath} must load the shared Material Symbols font`);
  assert.match(page, /class="material-symbols-outlined material-icon/, `${relativePath} must render shared Material Symbols`);
  assert.doesNotMatch(page, /<svg\b|icons\.svg|#icon-/, `${relativePath} must not render hand-drawn SVG icons`);
  assert.doesNotMatch(page, /placeholder/i, `${relativePath} must not identify rendered draft content as a placeholder`);
  assert.doesNotMatch(page, /class="(?:swatch|size-chip|teamwear-color-choice|teamwear-pattern-option)/, `${relativePath} must not use a legacy choice implementation`);
  assert.doesNotMatch(page, /data-choice-option[^>]*(?:disabled|aria-disabled)/, `${relativePath} choices must stay selectable`);
  assert.doesNotMatch(page, /data-action-(?:presentation|responsive-start)=/, `${relativePath} must not render legacy action behavior attributes`);
  if (/^(?:index\.html|collections\/|products\/|teamwear\/customize\/)/.test(relativePath)) {
    assert.match(page, /data-generated-component="breadcrumb"/, `${relativePath} must use the shared breadcrumb renderer`);
    assert.match(page, /data-generated-component="page-headline"/, `${relativePath} must use the shared page-headline renderer`);
  }
  if (/^(?:products\/|teamwear\/customize\/)/.test(relativePath)) {
    assert.match(page, /data-generated-component="rich-description"/, `${relativePath} must use the shared rich-description renderer`);
    assert.doesNotMatch(page, /class="[^"]*(?:product-copy|size-table)/, `${relativePath} must not render legacy description classes`);
    assert.match(page, /data-action-behavior="fixed-to-static"/, `${relativePath} must keep its action static at Large`);
    assert.doesNotMatch(page, /data-primary-action-dock-mount=/, `${relativePath} must not render an unused action dock`);
  }
  if (relativePath === "teamwear/index.html") {
    assert.match(page, /data-action-behavior="fixed-to-float"/, "Teamwear landing must own the only floating action behavior");
    assert.equal((page.match(/data-primary-action-dock-mount=/g) || []).length, 1, "Teamwear landing must render exactly one controlled dock");
  }
}

const repositoryFiles = await listRepositoryFiles();
const svgFiles = repositoryFiles.filter((relativePath) => relativePath.toLowerCase().endsWith(".svg")).sort();
assert.deepEqual(svgFiles, ["favicon.svg"], "the solid brand favicon must be the only SVG asset in the project");
const favicon = await read("favicon.svg");
assert.match(favicon, /<rect\b[^>]*fill="#a6192e"/, "the allowed favicon must remain a solid brand-color rectangle");
assert.doesNotMatch(favicon, /<(?:path|circle|ellipse|line|polygon|polyline)\b/, "the favicon must not contain hand-drawn artwork");

console.log(`SHARED_COMPONENTS_OK pages=${generatedPages.length} colors=${colors.colors.length} materialIcons=true svgAssets=${svgFiles.length} selectableUnavailable=true generatedOnly=true`);
