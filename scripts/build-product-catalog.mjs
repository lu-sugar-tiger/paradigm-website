import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformProductCopy } from "./lib/product-copy.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_PATH = path.join(ROOT, "data", "products-source.json");
const COLORWAYS_PATH = path.join(ROOT, "data", "product-colorways.json");
const CATALOG_PATH = path.join(ROOT, "assets", "js", "catalog.js");
const TEMPLATE_PATH = path.join(ROOT, "scripts", "templates", "product-page.html");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function categoryFor(title) {
  if (/Shorts/i.test(title)) return "Bottoms";
  if (/(Hoodie|Crewneck)/i.test(title)) return "AW Tops";
  return "SS Tops";
}

function slugFor(title) {
  return title
    .replace(/^PRDM\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function priceLabel(price) {
  return `NT$${Number(price).toLocaleString("en-US")}`;
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCopy(tokens) {
  return tokens.map((token) => {
    if (token.type === "blank") {
      return `              <div class="product-copy__line product-copy__blank-line">${html(token.text)}</div>`;
    }
    if (token.type === "rule") {
      return `              <div class="product-copy__line product-copy__rule" role="separator">${html(token.text)}</div>`;
    }
    if (token.type === "table") {
      const header = token.header.map((cell, index) => (
        index === 0
          ? `                  <th scope="col" aria-label="Row heading">${html(cell)}</th>`
          : `                  <th scope="col">${html(cell)}</th>`
      )).join("\n");
      const body = token.body.map((row) => `                <tr>\n${row.map((cell, index) => (
        index === 0
          ? `                  <th scope="row">${html(cell)}</th>`
          : `                  <td>${html(cell)}</td>`
      )).join("\n")}\n                </tr>`).join("\n");
      return `              <div class="product-copy__table-wrap">\n                <table class="size-table">\n                  <thead>\n                    <tr>\n${header}\n                    </tr>\n                  </thead>\n                  <tbody>\n${body}\n                  </tbody>\n                </table>\n              </div>`;
    }
    return `              <p class="product-copy__line">${html(token.text)}</p>`;
  }).join("\n");
}

function renderSwatches(product) {
  return product.colors.map((color, index) => {
    const soldOut = product.variants
      .filter((variant) => variant.visible && variant.color === color.label)
      .every((variant) => variant.soldOut);
    return `                  <button class="swatch${index === 0 && !soldOut ? " is-active" : ""}${soldOut ? " is-muted" : ""}" type="button" aria-label="${html(color.label)}${soldOut ? " — sold out" : ""}" title="${html(color.label)}" style="background-color: ${html(color.hex)}"${soldOut ? " disabled" : ""}></button>`;
  }).join("\n");
}

function renderSizes(product) {
  return product.sizes.map((size, index) => {
    const soldOut = product.variants
      .filter((variant) => variant.visible && variant.size === size)
      .every((variant) => variant.soldOut);
    return `                  <button class="size-chip${index === Math.min(1, product.sizes.length - 1) && !soldOut ? " is-active" : ""}${soldOut ? " is-muted" : ""}" type="button"${soldOut ? " disabled aria-label=\"" + html(size) + " — sold out\"" : ""}>${html(size)}</button>`;
  }).join("\n");
}

function applyTemplate(template, product) {
  const categoryPath = product.category.toLowerCase().replace(" ", "-");
  const shopeeAttributes = product.soldOut
    ? 'aria-disabled="true" tabindex="-1"'
    : `href="${html(product.shopeeUrl)}" target="_blank" rel="noopener noreferrer"`;

  const values = {
    TITLE: html(product.title),
    PRODUCT_NUMBER: html(product.productNumber),
    CATEGORY: html(product.category),
    CATEGORY_PATH: html(categoryPath),
    PRODUCT_MEDIA: product.image
      ? `            <img src="../../${html(product.image)}" alt="${html(product.alt)}" width="800" height="800" data-product-image>`
      : "",
    PRICE: html(product.price),
    COLOR_LABEL: html(product.colors[0]?.label || "Color"),
    SWATCHES: renderSwatches(product),
    SIZES: renderSizes(product),
    SHOPEE_ATTRIBUTES: shopeeAttributes,
    SHOPEE_LABEL: product.soldOut ? "Sold out" : "Buy on Shopee",
    PRODUCT_COPY: renderCopy(product.copy)
  };

  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}

const [source, colorwayRegistry, template] = await Promise.all([
  readFile(SOURCE_PATH, "utf8").then(JSON.parse),
  readFile(COLORWAYS_PATH, "utf8").then(JSON.parse),
  readFile(TEMPLATE_PATH, "utf8")
]);
const colorways = new Map(
  colorwayRegistry.colorways.map(({ label, hex }) => [label, hex])
);

const products = source.products
  .filter((entry) => entry.variants.some((variant) => variant.visible))
  .map((entry) => {
    const copy = transformProductCopy(entry.document?.content || "");
    const visibleVariants = entry.variants.filter((variant) => variant.visible);
    const colors = unique(visibleVariants.map((variant) => variant.color)).map((label) => {
      const hex = colorways.get(label);
      if (!hex) throw new Error(`Missing product colorway definition for "${label}".`);
      return { label, hex };
    });
    const sizes = unique(visibleVariants.map((variant) => variant.size));
    const localImages = (entry.localImages || []).filter(Boolean);

    return {
      slug: slugFor(entry.title),
      productNumber: entry.productNumber,
      title: entry.title,
      category: categoryFor(entry.title),
      price: priceLabel(entry.price),
      image: localImages[0] || null,
      images: localImages,
      imageSource: localImages.length ? entry.imageSource : "blank",
      alt: localImages.length ? `${entry.title} product image` : "",
      colors,
      sizes,
      variants: entry.variants.map(({ sku, color, size, visible, soldOut }) => ({
        ...(sku ? { sku } : {}),
        color,
        size,
        visible,
        soldOut
      })),
      soldOut: visibleVariants.every((variant) => variant.soldOut),
      copy,
      shopeeUrl: entry.shopeeUrl,
      source: {
        spreadsheetModifiedTime: source.source.spreadsheetModifiedTime,
        documentId: entry.document?.id || null,
        documentModifiedTime: entry.document?.modifiedTime || null,
        imageFiles: entry.images.map((image) => ({
          id: image.id,
          modifiedTime: image.modifiedTime,
          localPath: image.localPath
        }))
      }
    };
  });

const catalogBanner = [
  "// Generated by scripts/build-product-catalog.mjs.",
  `// Source: ${source.source.spreadsheetUrl} (${source.source.sheetName})`,
  `// Spreadsheet modified: ${source.source.spreadsheetModifiedTime}`,
  "// Edit data/products-source.json or rerun the Drive sync; do not hand-edit this file.",
  ""
].join("\n");

await writeFile(
  CATALOG_PATH,
  `${catalogBanner}window.PARADIGM_CATALOG = ${JSON.stringify({ products }, null, 2)};\n`,
  "utf8"
);

for (const product of products) {
  const routeDirectory = path.join(ROOT, "products", product.productNumber);
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, "index.html"), applyTemplate(template, product), "utf8");
}

console.log(`Generated ${products.length} products and routes.`);
