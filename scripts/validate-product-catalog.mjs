import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  tokenizeDescription,
  transformDescription
} from "./lib/rich-description.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const source = JSON.parse(await readFile(path.join(ROOT, "data", "products-source.json"), "utf8"));
const colorRegistry = JSON.parse(await readFile(path.join(ROOT, "data", "colors.json"), "utf8"));
const productImageFallback = JSON.parse(await readFile(path.join(ROOT, "data", "product-image-fallback.json"), "utf8"));
const catalogText = await readFile(path.join(ROOT, "assets", "js", "catalog.js"), "utf8");
const appText = await readFile(path.join(ROOT, "assets", "js", "app.js"), "utf8");
const redirects = await readFile(path.join(ROOT, "_redirects"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(catalogText, sandbox, { filename: "catalog.js" });
const products = sandbox.window.PARADIGM_CATALOG?.products;
const imageShortEdges = [540, 1080, 2160];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

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

function webpChunkTypes(buffer) {
  const types = [];
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    types.push(type);
    offset += 8 + size + (size % 2);
  }
  return types;
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
const flexibleFixtureTokens = transformDescription(flexibleFormatFixture);
const flexibleFixtureTable = flexibleFixtureTokens.find((token) => token.type === "table");
assert.equal(flexibleFixtureTokens[0].text, "•  keep　these spaces  ", "ordinary text spaces must remain byte-for-byte identical");
assert.equal(flexibleFixtureTokens.find((token) => token.type === "divider").text, "-", "divider transform must use one simple selectable dash character");
assert.equal(flexibleFixtureTokens.find((token) => token.type === "hashtag").text, "#Fixture", "hashtag content must remain exact");
assert.deepEqual(flexibleFixtureTable.header, ["", "Petite", "Tall"], "table headers must support arbitrary names and Unicode separators");
assert.deepEqual(flexibleFixtureTable.body, [["BodyWidth", "⅝″", "3½"], ["Drop", "α", "β"]], "table cells must support arbitrary row names and value formats");
assert.deepEqual(
  flexibleFixtureTokens.filter((token) => token.type === "blank").map((token) => token.text),
  ["\u200B\n", "\n", "\n"],
  "blank paragraphs must preserve their source whitespace and use the Google Docs U+000A terminator"
);

const ambiguousFixture = "• Keep\n\nAlpha Beta\nGamma Delta Epsilon\n\n#Fixture";
assert.ok(!transformDescription(ambiguousFixture).some((token) => token.type === "table"), "an uncertain one-row block must remain plain text");
const missingDividerSpacingFixture = transformDescription("• Keep\n-\nContinue\n\n#Fixture");
const missingDividerSpacingIndex = missingDividerSpacingFixture.findIndex((token) => token.type === "divider");
assert.equal(missingDividerSpacingFixture[missingDividerSpacingIndex - 1]?.type, "text", "a divider must not insert a missing blank before itself");
assert.equal(missingDividerSpacingFixture[missingDividerSpacingIndex + 1]?.type, "text", "a divider must not insert a missing blank after itself");
const repeatedBlankFixture = transformDescription("• Keep\n\n\nContinue\n\n#Fixture");
assert.equal(repeatedBlankFixture.filter((token) => token.type === "blank").length, 3, "blank paragraphs must not be collapsed");
assert.ok(repeatedBlankFixture.filter((token) => token.type === "blank").every((token) => token.text === "\n"), "empty blank paragraphs must remain selectable U+000A characters");
const hashtagFixture = transformDescription("• Keep\n\n　#LeadingSpace\n#One #Two");
assert.deepEqual(
  hashtagFixture.filter((token) => token.type === "hashtag").map((token) => token.text),
  ["　#LeadingSpace", "#One #Two"],
  "every line whose first non-space character is # must become a hashtag without changing its content"
);

assert.ok(Array.isArray(products), "catalog must expose a products array");
assert.ok(!appText.includes("Placeholder image"), "UI must not label missing imagery");
assert.ok(!appText.includes("buildProductCard"), "collection cards must be generated rather than rebuilt by app.js");

const fallbackSource = await readFile(path.join(ROOT, productImageFallback.sourcePath));
assert.equal(sha256(fallbackSource), productImageFallback.sourceSha256, "product fallback source hash must match its manifest");
assert.equal(productImageFallback.sourceWidth, productImageFallback.sourceHeight, "product fallback source must remain square");
assert.deepEqual(
  productImageFallback.transform,
  {
    format: "webp",
    quality: 100,
    resize: "short-edge",
    shortEdges: imageShortEdges,
    opacity: 0.0625,
    background: "#ffffff",
    flatten: true
  },
  "product fallback transform must remain flat white with 6.25% artwork opacity"
);
assert.equal(productImageFallback.media.isFallback, true, "product fallback media must be explicitly marked");
assert.deepEqual(productImageFallback.media.derivatives.map(({ shortEdge }) => shortEdge), imageShortEdges, "product fallback must provide all responsive tiers");
for (const derivative of productImageFallback.media.derivatives) {
  assert.equal(derivative.width, derivative.shortEdge, "product fallback derivatives must remain square without cropping");
  assert.equal(derivative.height, derivative.shortEdge, "product fallback derivatives must remain square without cropping");
  const buffer = await readFile(path.join(ROOT, derivative.path));
  assert.equal(buffer.length, derivative.bytes, `${derivative.path} byte size must match its manifest`);
  assert.equal(sha256(buffer), derivative.sha256, `${derivative.path} hash must match its manifest`);
  const chunks = webpChunkTypes(buffer);
  assert.ok(chunks.includes("VP8 "), `${derivative.path} must be a lossy flat WebP`);
  assert.ok(!chunks.includes("ALPH"), `${derivative.path} must not retain an alpha channel`);
}

const visibleSources = source.products.filter((product) =>
  product.variants.some((variant) => variant.visible)
);
assert.ok(Array.isArray(colorRegistry.colors), "canonical colors must be a complete list");
assert.ok(
  colorRegistry.colors.every(({ id, name, value }) =>
    typeof id === "string" && id.length > 0 && typeof name === "string" && name.length > 0 && /^#[0-9a-f]{6}$/i.test(value)
  ),
  "every canonical color must have an id, name, and six-digit value"
);
assert.equal(
  new Set(colorRegistry.colors.map(({ id }) => id)).size,
  colorRegistry.colors.length,
  "canonical color ids must be unique"
);
const colorByLabel = new Map(colorRegistry.colors.map((color) => [color.name, color]));
const colorById = new Map(colorRegistry.colors.map((color) => [color.id, color]));
const sourceColorwayLabels = [...new Set(
  visibleSources.flatMap((product) =>
    product.variants.filter((variant) => variant.visible).map((variant) => variant.color)
  )
)].sort();
assert.ok(sourceColorwayLabels.every((label) => colorByLabel.has(label)), "colors.json must cover every visible product colorway");
assert.equal(products.length, visibleSources.length, "catalog must include every visible product model");
assert.equal(new Set(products.map((product) => product.productNumber)).size, products.length, "product numbers must be unique");

const sourceByNumber = new Map(source.products.map((product) => [product.productNumber, product]));
const fallbackImages = [];
let descriptionTableCount = 0;

for (const product of products) {
  const sourceProduct = sourceByNumber.get(product.productNumber);
  assert.ok(sourceProduct, `${product.productNumber} must have a source record`);
  assert.ok(product.title && product.category && product.price, `${product.productNumber} must have display metadata`);
  assert.ok(product.shopeeUrl.startsWith("https://shopee.tw/"), `${product.productNumber} must have a Shopee URL`);
  assert.ok(product.colors.length > 0 && product.sizes.length > 0, `${product.productNumber} must have visible options`);
  product.colors.forEach(({ label, colorId }) => {
    assert.equal(colorById.get(colorId)?.name, label, `${product.productNumber} ${label} must reference the canonical color registry`);
  });
  assert.equal(product.variants.length, sourceProduct.variants.length, `${product.productNumber} variant count must match the sheet snapshot`);
  product.variants.forEach((variant, index) => {
    assert.ok(variant.sku, `${product.productNumber} variant ${index + 1} must retain its SKU`);
    assert.equal(variant.sku, sourceProduct.variants[index].sku, `${product.productNumber} variant ${index + 1} SKU must match the sheet snapshot`);
  });

  const sourceDescription = tokenizeDescription(sourceProduct.document?.content || "");
  const expectedDescription = transformDescription(sourceProduct.document?.content || "");
  assert.equal(
    JSON.stringify(product.description),
    JSON.stringify(expectedDescription),
    `${product.productNumber} description transforms must match the Doc exactly`
  );
  assert.equal(
    JSON.stringify(product.description.filter((token) => token.type === "text").map((token) => token.text)),
    JSON.stringify(sourceDescription.filter((token) => token.type === "text").map((token) => token.text)),
    `${product.productNumber} must preserve every character in ordinary text lines`
  );
  assert.equal(
    JSON.stringify(product.description.map((token) => token.type)),
    JSON.stringify(sourceDescription.map((token) => token.type)),
    `${product.productNumber} must preserve the source paragraph and token sequence`
  );
  assert.ok(product.description.every((token) => ["text", "blank", "divider", "hashtag", "table"].includes(token.type)), `${product.productNumber} description token type must be explicit`);
  assert.equal(
    JSON.stringify(product.description.filter((token) => token.type === "blank").map((token) => token.text)),
    JSON.stringify(sourceDescription.filter((token) => token.type === "blank").map((token) => `${token.text}\n`)),
    `${product.productNumber} blank paragraphs must preserve source whitespace and use U+000A`
  );
  product.description.forEach((token, index) => {
    if (token.type === "divider") {
      assert.equal(token.text, "-", `${product.productNumber} dividers must retain one selectable dash character`);
      assert.equal(sourceDescription[index]?.type, "divider", `${product.productNumber} dividers must remain in their source position`);
    }
  });
  const descriptionHashtags = product.description.filter((token) => token.type === "hashtag");
  assert.equal(descriptionHashtags.length, 1, `${product.productNumber} current Doc must contain one hashtag token`);
  assert.ok(descriptionHashtags[0].text.includes(`#${product.productNumber}`), `${product.productNumber} hashtag must preserve its source product code`);
  const descriptionTables = product.description.filter((token) => token.type === "table");
  assert.equal(descriptionTables.length, 1, `${product.productNumber} current Doc must contain one confirmed size table`);
  descriptionTableCount += descriptionTables.length;
  descriptionTables.forEach((table) => {
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

  const sourceHasPhotography = (sourceProduct.images || []).some((image) => image.localPath)
    || (sourceProduct.localImages || []).some(Boolean);
  if (sourceHasPhotography) {
    assert.equal(product.image, product.images[0], `${product.productNumber} main image must be image 0`);
    for (const image of product.images) await access(path.join(ROOT, image));
    assert.equal(product.media.length, product.images.length, `${product.productNumber} media records must match its image list`);
  } else {
    fallbackImages.push(product.productNumber);
    assert.equal(product.image, productImageFallback.media.src, `${product.productNumber} without photography must use the shared fallback`);
    assert.deepEqual(Array.from(product.images), [productImageFallback.media.src], `${product.productNumber} must expose one fallback image`);
    assert.equal(product.imageSource, "fallback", `${product.productNumber} without photography must identify fallback media`);
    assert.equal(product.alt, "", `${product.productNumber} decorative fallback must have empty alt text`);
    assert.equal(product.media.length, 1, `${product.productNumber} must expose one fallback media record`);
    assert.equal(product.media[0].isFallback, true, `${product.productNumber} fallback media must be marked`);
  }

  const routePath = path.join(ROOT, "products", product.productNumber, "index.html");
  const route = await readFile(routePath, "utf8");
  assert.ok(route.includes(`data-product-number="${product.productNumber}"`), `${product.productNumber} route must target the product`);
  assert.ok(route.includes(`<h1 data-product-title>${product.title}</h1>`), `${product.productNumber} route must include its static title`);
  assert.ok(route.includes(html(product.description[0].text)), `${product.productNumber} route must include its static document description`);
  assert.match(route, /data-generated-component="rich-description"/, `${product.productNumber} route must use the shared rich-description renderer`);
  assert.equal(occurrences(route, /rich-description__blank-line/g), product.description.filter((token) => token.type === "blank").length, `${product.productNumber} route blank-line count must match its description tokens`);
  assert.equal(occurrences(route, /rich-description__divider/g), product.description.filter((token) => token.type === "divider").length, `${product.productNumber} route divider count must match its description tokens`);
  assert.equal(occurrences(route, /rich-description__hashtag/g), descriptionHashtags.length, `${product.productNumber} route hashtag count must match its description tokens`);
  assert.equal(occurrences(route, /class="rich-description__table"/g), descriptionTables.length, `${product.productNumber} route table count must match its confirmed table tokens`);
  product.colors.forEach(({ label, colorId }) => {
    assert.ok(route.includes(`title="${html(label)}"`), `${product.productNumber} route must render the ${label} colorway`);
    assert.ok(route.includes(`data-color-id="${html(colorId)}"`), `${product.productNumber} route must reference canonical color ${colorId}`);
  });
  assert.ok(!route.includes("{{"), `${product.productNumber} route must not contain template tokens`);
  const galleryMarkup = route.slice(route.indexOf("data-product-gallery"), route.indexOf('<article class="product-detail__summary">'));
  assert.equal(occurrences(galleryMarkup, /<img src="\.\.\/\.\.\/assets\/images\/(?:catalog|products)\//g), product.images.length, `${product.productNumber} route media count must match images`);
  if (!sourceHasPhotography) {
    assert.equal(occurrences(galleryMarkup, /data-product-image-fallback/g), 1, `${product.productNumber} detail route must mark its fallback image`);
    assert.doesNotMatch(galleryMarkup, /data-media-zoom-gallery|data-media-zoom-touch/, `${product.productNumber} fallback must not enable image zoom`);
  }
  if (product.media.some((image) => image.derivatives.length)) {
    assert.equal(occurrences(galleryMarkup, / srcset="/g), product.media.filter((image) => image.derivatives.length).length, `${product.productNumber} responsive gallery images must expose srcset`);
    assert.equal(occurrences(galleryMarkup, / sizes="\(min-width: 80rem\) 768px, \(min-width: 64rem\) 60vw, 100vw"/g), product.media.filter((image) => image.derivatives.length).length, `${product.productNumber} responsive gallery images must expose the detail slot sizes`);
  }
  assert.ok(!product.variants.some((variant) => route.includes(variant.sku)), `${product.productNumber} route must not render SKUs`);
  assert.ok(route.includes("Generated by scripts/build-site.mjs"), `${product.productNumber} route must carry the generated banner`);

  if (product.soldOut) {
    assert.ok(route.includes('data-action-intent="notify"'), `${product.productNumber} sold-out route must begin with Notify Me`);
    assert.ok(route.includes('data-external-link="true"'), `${product.productNumber} sold-out route must expose the external notification destination`);
    assert.ok(route.includes('>arrow_outward</span>'), `${product.productNumber} sold-out route must use the trailing Material external arrow`);
  } else {
    assert.ok(route.includes(`href="${product.shopeeUrl}"`), `${product.productNumber} must link to its Shopee listing`);
    assert.ok(route.includes('target="_blank" rel="noopener noreferrer"'), `${product.productNumber} external link must be safe`);
  }
}

const allProductsPage = await readFile(path.join(ROOT, "collections", "all", "index.html"), "utf8");
assert.equal(occurrences(allProductsPage, /data-product-image-fallback/g), fallbackImages.length, "all-products catalog must render every shared fallback");
assert.doesNotMatch(allProductsPage, /product-card__media" data-media-zoom-touch><img[^>]*data-product-image-fallback/, "catalog fallback images must not enable touch zoom");

for (const product of source.products) {
  for (const image of product.images) {
    assert.ok(image.id && image.modifiedTime && image.localPath, `${product.productNumber} Drive image state must be complete`);
    await access(path.join(ROOT, image.localPath));
    if (!image.derivatives?.length) continue;
    assert.match(image.sourceSha256, /^[0-9a-f]{64}$/, `${product.productNumber} source image must retain its full SHA-256`);
    assert.deepEqual(
      image.transform,
      { format: "webp", quality: 100, resize: "short-edge", shortEdges: imageShortEdges },
      `${product.productNumber} image transform recipe must remain explicit and canonical`
    );
    assert.deepEqual(image.derivatives.map(({ shortEdge }) => shortEdge), imageShortEdges, `${product.productNumber} image derivatives must use the three canonical short edges`);
    for (const derivative of image.derivatives) {
      assert.equal(Math.min(derivative.width, derivative.height), derivative.shortEdge, `${product.productNumber} derivative short edge must match its recorded tier`);
      assert.match(derivative.sha256, /^[0-9a-f]{64}$/, `${product.productNumber} derivative must retain its full SHA-256`);
      const pathMatch = derivative.path.match(/^assets\/images\/catalog\/([0-9a-f]{2})\/([0-9a-f]{20,64})-(\d+)x(\d+)\.webp$/);
      assert.ok(pathMatch, `${product.productNumber} derivative path must be content-addressed and dimension-exact`);
      assert.equal(pathMatch[1], derivative.sha256.slice(0, 2), `${product.productNumber} derivative shard must match its hash`);
      assert.ok(derivative.sha256.startsWith(pathMatch[2]), `${product.productNumber} derivative filename prefix must match its full hash`);
      assert.equal(Number(pathMatch[3]), derivative.width, `${product.productNumber} derivative filename width must match metadata`);
      assert.equal(Number(pathMatch[4]), derivative.height, `${product.productNumber} derivative filename height must match metadata`);
      const derivativePath = path.join(ROOT, derivative.path);
      const derivativeBytes = await readFile(derivativePath);
      assert.equal(sha256(derivativeBytes), derivative.sha256, `${product.productNumber} derivative bytes must match their recorded hash`);
      assert.equal((await stat(derivativePath)).size, derivative.bytes, `${product.productNumber} derivative byte size must match metadata`);
    }
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

console.log(`PRODUCT_CATALOG_OK products=${products.length} canonicalColors=${colorRegistry.colors.length} soldOut=${products.filter((product) => product.soldOut).length} fallbackImages=${fallbackImages.length} descriptionTables=${descriptionTableCount} hashtags=${products.length} textExact=true spacingSourceExact=true blankEol=U+000A`);
console.log(`FALLBACK_IMAGE_PRODUCTS ${fallbackImages.join(",") || "none"}`);
