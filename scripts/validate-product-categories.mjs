import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import vm from "node:vm";
import { categoryForTypeCode, collectionForTypeCode, productCategories, legacyCollectionRedirects } from "./lib/product-categories.mjs";
import { catalogEntriesForProduct } from "./lib/catalog-entries.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const source = JSON.parse(await read("data/products-source.json"));
const index = JSON.parse(await read("assets/data/search-index.json"));
const context = { window: {} };
vm.runInNewContext(await read("assets/js/catalog.js"), context);
const products = JSON.parse(JSON.stringify(context.window.PARADIGM_CATALOG.items));
const redirects = await read("_redirects");
const approved = [
  ["typeCode", "14", "Tees", "/collections/tees"],
  ["typeCode", "23", "Crewnecks", "/collections/crewnecks"],
  ["typeCode", "24", "Hoodies", "/collections/hoodies"],
  ["typeCode", "42", "Shorts", "/collections/shorts"]
];
assert.deepEqual(productCategories.map(({ typeCode, lineCode, title, path }) => [typeCode ? "typeCode" : "lineCode", typeCode || lineCode, title, path]), approved, "collection names, membership codes, URLs, and order must match the approved categories");
for (const collection of productCategories) assert.ok(collection.typeCode && !collection.lineCode, "only type collections are published");
for (const slug of ["everyday", "paradigm", "aesthetics", "timeless"]) {
  const path = `/collections/${slug}`;
  assert.ok(!index.pages.some((page) => page.url === path), `${path} must not appear in Search`);
  assert.ok(!redirects.includes(path), `${path} must not retain collection redirects`);
  assert.equal(await access(new URL(`../collections/${slug}/index.html`, import.meta.url)).then(() => true, () => false), false, `${path} must not retain a public page`);
}
assert.throws(() => categoryForTypeCode("99"), /Unconfigured product typeCode/, "unknown types must fail instead of falling back to a guessed category");
const visible = source.items.filter((product) => product.variants.some((variant) => variant.visible));
assert.equal(products.length, visible.length, "category changes must retain all visible items");
for (const product of products) {
  const raw = source.items.find((item) => item.code === product.code);
  assert.equal(product.category, categoryForTypeCode(raw.typeCode), `${product.code} category must follow its type code`);
  const page = await read(`products/${product.code}/index.html`);
  const category = collectionForTypeCode(raw.typeCode);
  const categoryLink = page.match(/<a href="([^"]+)" data-product-breadcrumb-category>([\s\S]*?)<\/a>/);
  assert.equal(categoryLink?.[1], category.path, `${product.code} breadcrumb must point to its type collection`);
  assert.equal(categoryLink?.[2].replace(/<[^>]*>/g, ""), category.title, `${product.code} breadcrumb must show its category`);
}
const counts = [];
for (const { typeCode, lineCode, title, slug, path } of productCategories) {
  const page = await read(`collections/${slug}/index.html`);
  const field = typeCode ? "typeCode" : "lineCode";
  const code = typeCode || lineCode;
  const members = products.filter((item) => source.items.find((raw) => raw.code === item.code)[field] === code);
  counts.push(`${title}=${members.length}`);
  const expectedUrls = members.flatMap(catalogEntriesForProduct).map((item) => item.cardUrl || `/products/${item.code}`);
  const actualUrls = [...page.matchAll(/<a class="product-card" href="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(actualUrls, expectedUrls, `${title} must include precisely its ${field}'s visible variants in catalog order`);
  assert.match(page, new RegExp(`<h1[^>]*>${title}</h1>`), `${title} must use its approved heading`);
  assert.ok(page.includes(`href="https://prdm.tw${path}"`), `${title} must have its canonical URL`);
  assert.ok(page.includes('href="/collections/all"'), `${title} must link back to All`);
  assert.equal(index.pages.filter((record) => record.url === path && record.title === title).length, 1, `${title} must appear once in Search`);
  assert.ok(redirects.includes(`${path}/index.html ${path} 301`), `${title} must canonicalize index.html`);
}
for (const { from, to } of legacyCollectionRedirects) {
  const page = await read(`${from.slice(1)}/index.html`);
  assert.ok(page.includes(`http-equiv="refresh" content="0;url=${to}"`), `${from} must redirect on static hosting`);
  assert.ok(page.includes(`href="https://prdm.tw${to}"`), `${from} must canonicalize to the current route`);
  for (const path of [from, `${from}/`, `${from}/index.html`]) assert.ok(redirects.includes(`${path} ${to} 301`), `${path} must redirect on Pages hosting`);
  assert.ok(!index.pages.some((record) => record.url === from), `${from} must not be a search result`);
}
const jerseys = products.filter((product) => /Football Jersey/.test(product.name));
assert.ok(jerseys.length > 0 && jerseys.every((product) => product.category === "Tees"), "Football Jerseys must stay in Tees under code 14");
console.log(`PRODUCT_CATEGORIES_OK ${counts.join(" ")} codeMembership=true legacyRedirects=true`);
