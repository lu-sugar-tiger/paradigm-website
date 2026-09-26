import assert from "node:assert/strict";
import { catalogEntriesForProduct } from "./lib/catalog-entries.mjs";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildCatalogRefineGroups } from "../_archive/catalog-refine/catalog-refine.mjs";
import { renderDropdown } from "./lib/site-renderers.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const config = JSON.parse(await read("_archive/catalog-refine/catalog-refine.json"));
const sandbox = { window: {} };
vm.runInNewContext(await read("assets/js/catalog.js"), sandbox);
const products = JSON.parse(JSON.stringify(sandbox.window.PARADIGM_CATALOG.items));
const groups = buildCatalogRefineGroups(config, products);
assert.deepEqual(groups.map(({ name, kind }) => [name, kind]), [["sort", "single"], ["color", "multiple"], ["line", "multiple"], ["type", "multiple"], ["price", "range"]]);
assert.equal(groups[0].selectedValue, "newest");
const narrow = buildCatalogRefineGroups(config, products.filter((product) => product.code === "ED14024"));
assert.deepEqual(narrow.find((group) => group.name === "line").options, [{ value: "ED", label: "Everyday" }]);
assert.deepEqual(narrow.find((group) => group.name === "type").options, [{ value: "14", label: "Tee / Football Jersey" }]);
const zeroPrice = buildCatalogRefineGroups(config, [{ ...products[0], salePrice: 0 }]).find((group) => group.kind === "range");
assert.equal(zeroPrice.min, 0, "Zero sale prices must survive range generation");
assert.equal(zeroPrice.max, 0);
const markup = renderDropdown({ id: "refine-fixture", label: "Refine", groups, variant: "text", align: "end" });
assert.match(markup, /data-dropdown-grouped data-dropdown-align="end"/);
assert.match(markup, /dropdown__text-content/);
assert.match(markup, /<form[^>]*aria-label="Refine"/);
assert.doesNotMatch(markup, /role="listbox"|role="option"|aria-haspopup="listbox"/, "Mixed controls must preserve their native form semantics");
assert.equal((markup.match(/type="radio"/g) || []).length, 4);
assert.equal((markup.match(/type="number"/g) || []).length, 2);
assert.equal((markup.match(/<fieldset/g) || []).length, 5);
assert.match(markup, /type="reset">Clear all/);
assert.match(markup, /data-dropdown-close>Done/);
assert.throws(() => renderDropdown({ groups: [{ name: "bad", kind: "unknown" }] }), /Unsupported dropdown group/);
assert.throws(() => renderDropdown({ groups: [groups[0], groups[0]] }), /unique groups/);
const custom = renderDropdown({ id: "custom", label: "Custom", groups: [{ name: "finish", label: "Finish", kind: "multiple", options: [{ value: "<value>", label: "A & B" }] }] });
assert.match(custom, /value="&lt;value&gt;"/);
assert.match(custom, /A &amp; B/);
for (const [route, category] of [["index.html", "all"], ["collections/all/index.html", "all"], ["collections/ss-tops/index.html", "SS Tops"], ["collections/aw-tops/index.html", "AW Tops"], ["collections/bottoms/index.html", "Bottoms"]]) {
  const page = await read(route);
  assert.match(page, /data-catalog>/, route);
  assert.doesNotMatch(page, /catalog-refine|data-dropdown-grouped|data-catalog-(?:empty|status)/, `${route} must omit archived Refine controls, script, and status`);
  const expected = products.filter((product) => category === "all" || product.category === category)
    .sort((left, right) => Number(right.sequence) - Number(left.sequence))
    .flatMap(catalogEntriesForProduct).map((product) => product.cardUrl.slice("/products/".length));
  const rendered = [...page.matchAll(/class="product-card" href="\/products\/([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(rendered, expected, `${route} must render all collection products latest first without JavaScript`);
}
console.log(`CATALOG_REFINE_OK archived=true latestFirst=true groups=5 configured=true canonicalCodes=true nativeControls=true collectionScoped=true`);
