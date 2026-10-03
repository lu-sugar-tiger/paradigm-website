import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { regularTableFigures, transformDescription } from "./lib/rich-description.mjs";
import { renderDescription, renderChoiceGroup } from "./lib/site-renderers.mjs";
import { createItemColors, itemColors } from "./lib/item-colors.mjs";
import { catalogEntriesForProduct } from "./lib/catalog-entries.mjs";
import { translations } from "./lib/localization.mjs";
import inlineType from "../assets/js/inline-type.js";

for (const [source, expected] of [
  ["⁰³Charcoal", "<sup>03</sup>Charcoal"],
  ["m² H₂O xⁿ 10⁻³", "m<sup>2</sup> H<sub>2</sub>O x<sup>n</sup> 10<sup>−3</sup>"],
  ["⁽¹⁾ A₍ᵢ₊₁₎ ᵃ ₓ", "<sup>(1)</sup> A<sub>(i+1)</sub> <sup>a</sup> <sub>x</sub>"],
  ["  <script> & ⁰³\t ₂\nꟲ³", "  &lt;script&gt; &amp; <sup>03</sup>\t <sub>2</sub>\nꟲ<sup>3</sup>"]
]) {
  assert.equal(inlineType.render(source), expected);
}
assert.equal(inlineType.plain("⁰³Charcoal m² H₂O"), "03Charcoal m2 H2O");

const dimensionLabels = { 肩寬: "Shoulder W", 胸寬: "Chest W", 袖長: "Sleeve L", 衣長: "Body L", 褲頭寬: "Waist W", 褲腳寬: "Leg W", 內側長: "Inseam L", 外側長: "Outseam L" };

assert.equal(regularTableFigures("𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫"), "0123456789");
assert.equal(regularTableFigures("　𝟨𝟢.𝟢–𝟨𝟧.𝟧 / ≤ ½ １２ 𝟎 cm  "), "　60.0–65.5 / ≤ ½ １２ 𝟎 cm  ");

const raw = "• Keep  𝟨𝟢.𝟢　outside tables\n\n-\n\n  M　XL\nWidth　𝟨𝟢.𝟢　𝟨𝟧.𝟧\nLength　72.0　76.0　(cm)\n\n　#ED14024 #bd24021 #ZZ99999\n搭配#ed14024-S13，與 #ED14001。  < & >\n#ED140240 #ED14024_extra #ED14024- #ED14024X\nword#ED14024 https://example.test/#ED14024\n\n#ED14024";
const tokens = transformDescription(raw);
const before = structuredClone(tokens);
const unlinked = renderDescription({ tokens });
const linked = renderDescription({ tokens, itemCodes: ["BD24021", "ED14024", "ED14001"], currentItemCode: "BD24021" });
assert.deepEqual(tokens, before, "Rendering must not modify source tokens");
assert.equal(linked.replace(/<a href="\/products\/[A-Z]+\d{5}">|<\/a>/g, ""), unlinked, "Link wrapping must preserve all characters and spacing");
assert.equal((linked.match(/<a /g) || []).length, 4, "Link only complete references to other published items");
assert.match(linked, /<a href="\/products\/ED14024">#ed14024-S13<\/a>/);
assert.match(linked, /rich-description__hashtag">　<a href="\/products\/ED14024">#ED14024<\/a> #bd24021 #ZZ99999/);
assert.match(linked, /• Keep  𝟨𝟢.𝟢　outside tables/);
assert.match(linked, /<td>60\.0<\/td>/);
assert.match(linked, /<td>65\.5<\/td>/);
assert.match(linked, /&lt; &amp; &gt;/);
assert.equal((linked.match(/rich-description__blank-line/g) || []).length, tokens.filter(token => token.type === "blank").length);
assert.equal((linked.match(/rich-description__divider/g) || []).length, 1);
assert.equal(renderDescription({ tokens, itemCodes: ["BD24021"], currentItemCode: "BD24021" }), unlinked, "Unknown, unpublished and self references stay plain");
assert.doesNotMatch(renderDescription({ tokens: [{ type: "text", text: "https://example.test/?q=#ED14024 www.example.test/?q=#ED14024" }], itemCodes: ["ED14024"] }), /<a /, "URL fragments are not product mentions");

const registry = JSON.parse(await readFile(new URL("../data/colors.json", import.meta.url), "utf8"));
const renamedColors = createItemColors({
  ...registry,
  colors: registry.colors.map((color) => color.code === "C03" ? { ...color, name: "Graphite" } : color)
});
for (const [input, expected] of [
  ["⁰³Old、⁰⁶Old，⁰⁹Old.⁰³Old⁰⁶Old", "⁰³Graphite、⁰⁶Dove，⁰⁹White.⁰³Graphite⁰⁶Dove"],
  ["其中⁰³Old兩色 / ⁰³深灰。", "其中⁰³Graphite兩色 / ⁰³Graphite。"],
  ["⁰³Café • ⁰²Shadow & <plain>", "⁰³Graphite • ⁰²Shadow & <plain>"],
  ["⁰³ Old ꟲ⁰³Old ⁰³\tOld ⁰³\nOld ⁰³　Old", "⁰³ Old ꟲ⁰³Old ⁰³\tOld ⁰³\nOld ⁰³　Old"],
  ["⁰³⁶Old ¹⁰Old ⁹⁹Old ⁰Old ⁰³ m² ²³°C 03Old", "⁰³⁶Old ¹⁰Old ⁹⁹Old ⁰Old ⁰³ m² ²³°C 03Old"]
]) {
  assert.equal(renamedColors.resolveHandles(input), expected, `Color handles: ${input}`);
}
assert.equal(renamedColors.label("C03", "Charcoal"), "⁰³Graphite");
assert.equal(renamedColors.resolveHandles("⁰³Old", { includeCode: false }), "Graphite", "Search must index the resolved name without joining superscript digits to it");
assert.deepEqual(renamedColors.descriptionTerms([{ type: "text", text: "⁰³Old" }]), ["graphite"]);
const handleTokens = [
  { type: "text", text: "其中 ⁰³Old、⁰²Shadow，與 #ED14024。  < & >" },
  { type: "blank", text: "\n" },
  { type: "table", header: ["", "⁰³Old"], body: [["⁰³Old", "⁰²Shadow"], ["Width", "60.0"]] }
];
const sourceHandleTokens = structuredClone(handleTokens);
const handlesHtml = renderDescription({ tokens: handleTokens, colors: renamedColors, itemCodes: ["ED14024"] });
assert.deepEqual(handleTokens, sourceHandleTokens, "Handle resolution must not mutate source tokens or table cells");
assert.match(handlesHtml, /其中 <sup>03<\/sup>Graphite、<sup>02<\/sup>Shadow，與 <a href="\/products\/ED14024">#ED14024<\/a>。  &lt; &amp; &gt;/);
assert.match(handlesHtml, /<th scope="col"><sup>03<\/sup>Graphite<\/th>/);
assert.match(handlesHtml, /<td><sup>02<\/sup>Shadow<\/td>/);
assert.doesNotMatch(handlesHtml, /color-handle|color-label/, "Only semantic sup/sub markup is added, not a special handle component");
const notation = renderDescription({ tokens: [{ type: "text", text: "• m² H₂O ⁰³ Old ꟲ⁰³Old ⁹⁹Old #ED14024" }], colors: renamedColors, itemCodes: ["ED14024"] });
assert.match(notation, /• m<sup>2<\/sup> H<sub>2<\/sub>O <sup>03<\/sup> Old ꟲ<sup>03<\/sup>Old <sup>99<\/sup>Old <a href="\/products\/ED14024">#ED14024<\/a>/, "Nonhandles are typeset as notation without central name replacement");
const renamedSwatch = renderChoiceGroup({
  kind: "swatch", title: "Color", inputName: "fixture-color", primaryActionId: "fixture-action", colors: renamedColors,
  options: [{ id: "charcoal", colorId: "charcoal", colorCode: "C03", label: "Charcoal" }]
});
assert.match(renamedSwatch, /<span data-choice-label-value><sup>03<\/sup>Graphite<\/span>/, "Initial swatch label must use semantic superscript markup without JavaScript");
assert.match(renamedSwatch, /data-choice-label="Graphite"/);
assert.match(renamedSwatch, /data-color-code="C03" data-choice-display-label="⁰³Graphite"/);
assert.ok(renamedSwatch.includes('</span> 03Graphite</span>'), "The accessible name retains an ordinary-text code and name");
const translatedHandle = "Fixture ⁰³Old";
translations[translatedHandle] = "其中 ⁰³Old 兩色";
try {
  const translatedHtml = renderDescription({ tokens: [{ type: "text", text: translatedHandle }], colors: renamedColors });
  assert.match(translatedHtml, /data-l10n-color-en="Fixture ⁰³Graphite"/);
  assert.match(translatedHtml, /data-l10n-color-zh="其中 ⁰³Graphite 兩色"/, "Language updates must use resolved names for either language");
} finally {
  delete translations[translatedHandle];
}
const renamedCard = catalogEntriesForProduct({
  code: "Fixture", name: "Fixture", variants: [{ visible: true, colorCode: "C03", colorName: "Charcoal", imageId: "photo", sku: "unchanged" }],
  colors: [{ colorCode: "C03", label: renamedColors.name("C03") }],
  variantMedia: { photo: { src: "photo.webp" } }
})[0];
assert.equal(renamedCard.variantLabel, "Graphite");
assert.equal(renamedCard.cardAlt, "Fixture, Graphite");
assert.equal(renamedCard.variants[0].colorName, "Charcoal", "Imported names remain exact while presentation follows the code");

const catalog = JSON.parse(await readFile(new URL("../data/products-source.json", import.meta.url), "utf8"));
const items = catalog.items.filter(item => item.variants.some(variant => variant.visible));
const itemCodes = items.map(item => item.code);
let convertedTables = 0;
for (const item of items) {
  const tokens = transformDescription(item.descriptionSource.content);
  const rendered = renderDescription({ tokens, itemCodes, currentItemCode: item.code });
  const cells = [...rendered.matchAll(/<(?:td|th)\b[^>]*>(.*?)<\/(?:td|th)>/g)].map(match => match[1]);
  const sourceCells = tokens.filter(token => token.type === "table").flatMap(token => [...token.header, ...token.body.flat()]);
  assert.deepEqual(cells, sourceCells.map(cell => inlineType.render(itemColors.resolveHandles(regularTableFigures(dimensionLabels[cell] || cell)))), `${item.code}: only approved dimension labels, figures, color names, and script typography may change; order and units stay exact`);
  if (sourceCells.some(cell => regularTableFigures(cell) !== cell)) convertedTables++;
  const route = await readFile(new URL(`../products/${item.code}/index.html`, import.meta.url), "utf8");
  const indented = rendered.split("\n").map(line => `          ${line}`).join("\n");
  assert.ok(route.includes(indented), `${item.code}: generated route must use the current description renderer`);
}
console.log(`DESCRIPTION_RENDERING_OK items=${items.length} convertedTables=${convertedTables} mentions=true colorHandles=semanticSup scriptModifiers=true codeIdentity=true sourceExact=true spacingExact=true`);
