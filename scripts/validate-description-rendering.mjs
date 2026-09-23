import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { regularTableFigures, transformDescription } from "./lib/rich-description.mjs";
import { html, renderDescription } from "./lib/site-renderers.mjs";

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

const catalog = JSON.parse(await readFile(new URL("../data/products-source.json", import.meta.url), "utf8"));
const items = catalog.items.filter(item => item.variants.some(variant => variant.visible));
const itemCodes = items.map(item => item.code);
let convertedTables = 0;
for (const item of items) {
  const tokens = transformDescription(item.descriptionSource.content);
  const rendered = renderDescription({ tokens, itemCodes, currentItemCode: item.code });
  const cells = [...rendered.matchAll(/<(?:td|th)\b[^>]*>(.*?)<\/(?:td|th)>/g)].map(match => match[1]);
  const sourceCells = tokens.filter(token => token.type === "table").flatMap(token => [...token.header, ...token.body.flat()]);
  assert.deepEqual(cells, sourceCells.map(cell => html(regularTableFigures(cell))), `${item.code}: exact table-cell conversion`);
  if (sourceCells.some(cell => regularTableFigures(cell) !== cell)) convertedTables++;
  const route = await readFile(new URL(`../products/${item.code}/index.html`, import.meta.url), "utf8");
  const indented = rendered.split("\n").map(line => `          ${line}`).join("\n");
  assert.ok(route.includes(indented), `${item.code}: generated route must use the current description renderer`);
}
console.log(`DESCRIPTION_RENDERING_OK items=${items.length} convertedTables=${convertedTables} mentions=true textExact=true spacingExact=true`);
