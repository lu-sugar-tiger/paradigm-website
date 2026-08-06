import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sourceText = await readFile(path.join(ROOT, "data", "products-source.json"), "utf8");
const source = JSON.parse(sourceText);
const catalogText = await readFile(path.join(ROOT, "assets", "js", "catalog.js"), "utf8");
const redirects = await readFile(path.join(ROOT, "_redirects"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(catalogText, sandbox, { filename: "catalog.js" });
const products = sandbox.window.PARADIGM_CATALOG?.products;

assert.ok(Array.isArray(products), "catalog must expose a products array");
assert.ok(!sourceText.includes('"sku"'), "public sync snapshot must not contain SKUs");
assert.ok(!catalogText.includes('"sku"'), "browser catalog must not contain SKUs");

const visibleSources = source.products.filter((product) =>
  product.variants.some((variant) => variant.visible)
);
assert.equal(products.length, visibleSources.length, "catalog must include every visible product model");
assert.equal(new Set(products.map((product) => product.productNumber)).size, products.length, "product numbers must be unique");

const sourceByNumber = new Map(source.products.map((product) => [product.productNumber, product]));
const placeholders = [];

for (const product of products) {
  const sourceProduct = sourceByNumber.get(product.productNumber);
  assert.ok(sourceProduct, `${product.productNumber} must have a source record`);
  assert.ok(product.title && product.category && product.price, `${product.productNumber} must have display metadata`);
  assert.ok(product.shopeeUrl.startsWith("https://shopee.tw/"), `${product.productNumber} must have a Shopee URL`);
  assert.ok(product.bullets[0]?.startsWith("• "), `${product.productNumber} must start at the first document bullet`);
  assert.ok(product.code?.startsWith("#"), `${product.productNumber} must retain the document's final code line`);
  assert.ok(product.measurements.length > 0, `${product.productNumber} must retain document measurements`);
  assert.ok(product.measurementSizes.length > 0, `${product.productNumber} must retain document measurement sizes`);
  assert.ok(
    product.measurements.every((row) => row.length === product.measurementSizes.length + 1),
    `${product.productNumber} measurement rows must match their header`
  );
  assert.ok(product.colors.length > 0 && product.sizes.length > 0, `${product.productNumber} must have visible options`);
  assert.equal(
    product.soldOut,
    product.variants.filter((variant) => variant.visible).every((variant) => variant.soldOut),
    `${product.productNumber} sold-out status must match its visible variants`
  );
  assert.equal(product.image, product.images[0], `${product.productNumber} main image must be image 0`);

  for (const image of product.images) {
    await access(path.join(ROOT, image));
  }

  if (product.imageSource === "placeholder") placeholders.push(product.productNumber);

  const routePath = path.join(ROOT, "products", product.productNumber, "index.html");
  const route = await readFile(routePath, "utf8");
  assert.ok(route.includes(`data-product-number="${product.productNumber}"`), `${product.productNumber} route must target the product`);
  assert.ok(route.includes(`<h1 data-product-title>${product.title}</h1>`), `${product.productNumber} route must include its static title`);
  assert.ok(route.includes(product.bullets[0]), `${product.productNumber} route must include its static document copy`);
  assert.ok(!route.includes("{{"), `${product.productNumber} route must not contain template tokens`);

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

console.log(`PRODUCT_CATALOG_OK products=${products.length} soldOut=${products.filter((product) => product.soldOut).length} placeholders=${placeholders.length}`);
console.log(`PLACEHOLDER_PRODUCTS ${placeholders.join(",") || "none"}`);
