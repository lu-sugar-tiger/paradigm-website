import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  tokenizeProductCopy,
  transformProductCopy
} from "./lib/product-copy.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const source = JSON.parse(await readFile(path.join(ROOT, "data", "products-source.json"), "utf8"));
const colorwayRegistry = JSON.parse(await readFile(path.join(ROOT, "data", "product-colorways.json"), "utf8"));
const catalogText = await readFile(path.join(ROOT, "assets", "js", "catalog.js"), "utf8");
const appText = await readFile(path.join(ROOT, "assets", "js", "app.js"), "utf8");
const redirects = await readFile(path.join(ROOT, "_redirects"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(catalogText, sandbox, { filename: "catalog.js" });
const products = sandbox.window.PARADIGM_CATALOG?.products;

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function occurrences(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

const flexibleFormatFixture = [
  "ignored preface",
  "•  keep　these spaces  ",
  "\u200B",
  "　-\u2009",
  "",
  "　Petite\u2009Tall",
  "BodyWidth\u00A0⅝″\u20073½",
  "Drop\u202Fα\u205Fβ",
  "",
  "#Fixture"
].join("\n");
const flexibleFixtureTokens = transformProductCopy(flexibleFormatFixture);
const flexibleFixtureTable = flexibleFixtureTokens.find((token) => token.type === "table");
assert.equal(flexibleFixtureTokens[0].text, "•  keep　these spaces  ", "ordinary text spaces must remain byte-for-byte identical");
assert.equal(flexibleFixtureTokens.find((token) => token.type === "rule").text, "-", "dash transform must use one simple selectable dash character");
assert.deepEqual(flexibleFixtureTable.header, ["", "Petite", "Tall"], "table headers must support arbitrary names and Unicode separators");
assert.deepEqual(flexibleFixtureTable.body, [["BodyWidth", "⅝″", "3½"], ["Drop", "α", "β"]], "table cells must support arbitrary row names and value formats");
assert.deepEqual(
  flexibleFixtureTokens.filter((token) => token.type === "blank").map((token) => token.text),
  ["\u200B\n", "\n", "\n"],
  "blank paragraphs must preserve their source whitespace and use the Google Docs U+000A terminator"
);

const ambiguousFixture = "• Keep\n\nAlpha Beta\nGamma Delta Epsilon\n\n#Fixture";
assert.ok(!transformProductCopy(ambiguousFixture).some((token) => token.type === "table"), "an uncertain one-row block must remain plain text");
const missingRuleSpacingFixture = transformProductCopy("• Keep\n-\nContinue\n\n#Fixture");
const missingRuleSpacingIndex = missingRuleSpacingFixture.findIndex((token) => token.type === "rule");
assert.equal(missingRuleSpacingFixture[missingRuleSpacingIndex - 1]?.type, "text", "a rule must not insert a missing blank before itself");
assert.equal(missingRuleSpacingFixture[missingRuleSpacingIndex + 1]?.type, "text", "a rule must not insert a missing blank after itself");
const repeatedBlankFixture = transformProductCopy("• Keep\n\n\nContinue\n\n#Fixture");
assert.equal(repeatedBlankFixture.filter((token) => token.type === "blank").length, 3, "blank paragraphs must not be collapsed");
assert.ok(repeatedBlankFixture.filter((token) => token.type === "blank").every((token) => token.text === "\n"), "empty blank paragraphs must remain selectable U+000A characters");

assert.ok(Array.isArray(products), "catalog must expose a products array");
assert.ok(!appText.includes("Placeholder image"), "UI must not label missing imagery");
const cardRenderer = appText.slice(
  appText.indexOf("function buildProductCard"),
  appText.indexOf("function renderNavigation")
);
assert.ok(!cardRenderer.includes("soldOut"), "collection cards must not render a sold-out state");

const visibleSources = source.products.filter((product) =>
  product.variants.some((variant) => variant.visible)
);
assert.ok(Array.isArray(colorwayRegistry.colorways), "product colorways must be a complete list");
assert.ok(
  colorwayRegistry.colorways.every(({ label, hex }) =>
    typeof label === "string" && label.length > 0 && /^#[0-9a-f]{6}$/i.test(hex)
  ),
  "every product colorway must have a label and six-digit hex value"
);
assert.equal(
  new Set(colorwayRegistry.colorways.map(({ label }) => label)).size,
  colorwayRegistry.colorways.length,
  "product colorway labels must be unique"
);
const colorwayByLabel = new Map(colorwayRegistry.colorways.map(({ label, hex }) => [label, hex]));
const sourceColorwayLabels = [...new Set(
  visibleSources.flatMap((product) =>
    product.variants.filter((variant) => variant.visible).map((variant) => variant.color)
  )
)].sort();
assert.deepEqual(
  [...colorwayByLabel.keys()].sort(),
  sourceColorwayLabels,
  "product-colorways.json must exactly cover every visible catalog colorway"
);
assert.equal(products.length, visibleSources.length, "catalog must include every visible product model");
assert.equal(new Set(products.map((product) => product.productNumber)).size, products.length, "product numbers must be unique");

const sourceByNumber = new Map(source.products.map((product) => [product.productNumber, product]));
const blankImages = [];
let copyTableCount = 0;

for (const product of products) {
  const sourceProduct = sourceByNumber.get(product.productNumber);
  assert.ok(sourceProduct, `${product.productNumber} must have a source record`);
  assert.ok(product.title && product.category && product.price, `${product.productNumber} must have display metadata`);
  assert.ok(product.shopeeUrl.startsWith("https://shopee.tw/"), `${product.productNumber} must have a Shopee URL`);
  assert.ok(product.colors.length > 0 && product.sizes.length > 0, `${product.productNumber} must have visible options`);
  product.colors.forEach(({ label, hex }) => {
    assert.equal(hex, colorwayByLabel.get(label), `${product.productNumber} ${label} must use the product colorway registry`);
  });
  assert.equal(product.variants.length, sourceProduct.variants.length, `${product.productNumber} variant count must match the sheet snapshot`);
  product.variants.forEach((variant, index) => {
    assert.ok(variant.sku, `${product.productNumber} variant ${index + 1} must retain its SKU`);
    assert.equal(variant.sku, sourceProduct.variants[index].sku, `${product.productNumber} variant ${index + 1} SKU must match the sheet snapshot`);
  });

  const sourceCopy = tokenizeProductCopy(sourceProduct.document?.content || "");
  const expectedCopy = transformProductCopy(sourceProduct.document?.content || "");
  assert.equal(
    JSON.stringify(product.copy),
    JSON.stringify(expectedCopy),
    `${product.productNumber} copy transforms must match the Doc exactly`
  );
  assert.equal(
    JSON.stringify(product.copy.filter((token) => token.type === "text").map((token) => token.text)),
    JSON.stringify(sourceCopy.filter((token) => token.type === "text").map((token) => token.text)),
    `${product.productNumber} must preserve every character in ordinary text lines`
  );
  assert.equal(
    JSON.stringify(product.copy.map((token) => token.type)),
    JSON.stringify(sourceCopy.map((token) => token.type)),
    `${product.productNumber} must preserve the source paragraph and rule sequence`
  );
  assert.ok(product.copy.every((token) => ["text", "blank", "rule", "table"].includes(token.type)), `${product.productNumber} copy token type must be explicit`);
  assert.equal(
    JSON.stringify(product.copy.filter((token) => token.type === "blank").map((token) => token.text)),
    JSON.stringify(sourceCopy.filter((token) => token.type === "blank").map((token) => `${token.text}\n`)),
    `${product.productNumber} blank paragraphs must preserve source whitespace and use U+000A`
  );
  product.copy.forEach((token, index) => {
    if (token.type === "rule") {
      assert.equal(token.text, "-", `${product.productNumber} rules must retain one selectable dash character`);
      assert.equal(sourceCopy[index]?.type, "rule", `${product.productNumber} rules must remain in their source position`);
    }
  });
  const copyTables = product.copy.filter((token) => token.type === "table");
  assert.equal(copyTables.length, 1, `${product.productNumber} current Doc must contain one confirmed size table`);
  copyTableCount += copyTables.length;
  copyTables.forEach((table) => {
    assert.ok(table.header.length >= 3, `${product.productNumber} table must have a row-heading column and at least two data columns`);
    assert.ok(table.body.length >= 2, `${product.productNumber} table must contain multiple body rows`);
    assert.equal(table.header.length, table.columnCount, `${product.productNumber} table header width must be rectangular`);
    assert.ok(table.body.every((row) => row.length === table.columnCount), `${product.productNumber} table body width must be rectangular`);
  });

  assert.equal(
    product.soldOut,
    product.variants.filter((variant) => variant.visible).every((variant) => variant.soldOut),
    `${product.productNumber} sold-out status must match its visible variants`
  );

  if (product.images.length) {
    assert.equal(product.image, product.images[0], `${product.productNumber} main image must be image 0`);
    for (const image of product.images) await access(path.join(ROOT, image));
  } else {
    blankImages.push(product.productNumber);
    assert.equal(product.image, null, `${product.productNumber} without photography must have a blank image`);
    assert.equal(product.imageSource, "blank", `${product.productNumber} without photography must use blank media`);
  }

  const routePath = path.join(ROOT, "products", product.productNumber, "index.html");
  const route = await readFile(routePath, "utf8");
  assert.ok(route.includes(`data-product-number="${product.productNumber}"`), `${product.productNumber} route must target the product`);
  assert.ok(route.includes(`<h1 data-product-title>${product.title}</h1>`), `${product.productNumber} route must include its static title`);
  assert.ok(route.includes(html(product.copy[0].text)), `${product.productNumber} route must include its static document copy`);
  assert.equal(occurrences(route, /product-copy__blank-line/g), product.copy.filter((token) => token.type === "blank").length, `${product.productNumber} route blank-line count must match its copy tokens`);
  assert.equal(occurrences(route, /product-copy__rule/g), product.copy.filter((token) => token.type === "rule").length, `${product.productNumber} route rule count must match its copy tokens`);
  assert.equal(occurrences(route, /class="size-table"/g), copyTables.length, `${product.productNumber} route table count must match its confirmed table tokens`);
  product.colors.forEach(({ label, hex }) => {
    assert.ok(route.includes(`title="${html(label)}"`), `${product.productNumber} route must render the ${label} colorway`);
    assert.ok(route.includes(`background-color: ${hex}`), `${product.productNumber} route must use the registered ${label} colorway value`);
  });
  assert.ok(!route.includes("{{"), `${product.productNumber} route must not contain template tokens`);
  assert.equal(route.includes("data-product-image"), Boolean(product.image), `${product.productNumber} route media must match image availability`);
  assert.ok(!product.variants.some((variant) => route.includes(variant.sku)), `${product.productNumber} route must not render SKUs`);

  if (product.soldOut) {
    assert.ok(route.includes('aria-disabled="true"'), `${product.productNumber} sold-out route must disable purchase`);
  } else {
    assert.ok(route.includes(`href="${product.shopeeUrl}"`), `${product.productNumber} must link to its Shopee listing`);
    assert.ok(route.includes('target="_blank" rel="noopener noreferrer"'), `${product.productNumber} external link must be safe`);
  }
}

for (const product of source.products) {
  for (const image of product.images) {
    assert.ok(image.id && image.modifiedTime && image.localPath, `${product.productNumber} Drive image state must be complete`);
    await access(path.join(ROOT, image.localPath));
  }
}

const legacyRedirects = {
  "PL-002": "GM42022",
  "PL-003": "BT24020",
  "PL-004": "TL23018",
  "PL-005": "AE14008",
  "PL-006": "PD24015",
  "PL-007": "PH14010",
  "PL-008": "ED14001"
};
for (const [legacy, current] of Object.entries(legacyRedirects)) {
  assert.ok(
    redirects.includes(`/products/${legacy} /products/${current} 301`),
    `${legacy} must redirect to ${current}`
  );
}

console.log(`PRODUCT_CATALOG_OK products=${products.length} colorways=${colorwayRegistry.colorways.length} soldOut=${products.filter((product) => product.soldOut).length} blankImages=${blankImages.length} copyTables=${copyTableCount} textExact=true spacingSourceExact=true blankEol=U+000A`);
console.log(`BLANK_IMAGE_PRODUCTS ${blankImages.join(",") || "none"}`);
