import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_PATH = path.join(ROOT, "data", "products-source.json");
const CATALOG_PATH = path.join(ROOT, "assets", "js", "catalog.js");
const TEMPLATE_PATH = path.join(ROOT, "scripts", "templates", "product-page.html");

const COLOR_HEX = {
  Black: "#111111",
  Cardinal: "#8d1f2d",
  Grey: "#a7a8a6",
  Midnight: "#1b2b68",
  Mocha: "#8a6a50",
  Mud: "#5b483b",
  Shadow: "#343434",
  White: "#f2f0e9"
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function trimOuterBlankLines(lines) {
  const copy = lines.slice();
  while (copy[0] === "") copy.shift();
  while (copy.at(-1) === "") copy.pop();
  return copy;
}

function parseDocumentCopy(rawContent) {
  const allLines = rawContent
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  const firstBullet = allLines.findIndex((line) => /^[•●]\s*/u.test(line));
  if (firstBullet < 0) {
    throw new Error("Product document has no bullet list");
  }

  let lastLine = allLines.length - 1;
  while (lastLine > firstBullet && !allLines[lastLine]) lastLine -= 1;
  const copyLines = allLines.slice(firstBullet, lastLine + 1);

  const bullets = [];
  let cursor = 0;
  while (cursor < copyLines.length) {
    const line = copyLines[cursor];
    if (!line) {
      cursor += 1;
      continue;
    }
    if (!/^[•●]\s*/u.test(line)) break;
    bullets.push(line.replace(/^●/u, "•"));
    cursor += 1;
  }

  const body = trimOuterBlankLines(copyLines.slice(cursor));
  const separators = body
    .map((line, index) => (line === "-" ? index : -1))
    .filter((index) => index >= 0);
  const firstSeparator = separators[0] ?? -1;
  const secondSeparator = separators[1] ?? -1;

  const descriptionStart = firstSeparator >= 0 ? firstSeparator + 1 : 0;
  const descriptionEnd = secondSeparator >= 0 ? secondSeparator : body.length;
  const description = ["-", ...trimOuterBlankLines(body.slice(descriptionStart, descriptionEnd))];

  const technical = secondSeparator >= 0 ? body.slice(secondSeparator + 1) : [];
  const codeIndex = technical.findLastIndex((line) => /^#\S+/u.test(line));
  const code = codeIndex >= 0 ? technical[codeIndex] : null;
  const fitStart = technical.findIndex((line) => line.startsWith("建議"));
  const headerIndex = technical.findIndex((line) => /(^|\s)M(\s|$)/u.test(line) && /(^|\s)L(\s|$)/u.test(line));
  const measurementSizes = headerIndex >= 0
    ? technical[headerIndex]
        .normalize("NFKC")
        .split(/\s+/u)
        .filter((value) => /^(?:XS|S|M|L|XL|XXL)$/iu.test(value))
    : [];
  const measurementEnd = fitStart >= 0 ? fitStart : codeIndex >= 0 ? codeIndex : technical.length;
  const measurementLines = headerIndex >= 0
    ? technical.slice(headerIndex + 1, measurementEnd)
    : technical.slice(0, measurementEnd);

  const measurements = measurementLines
    .filter(Boolean)
    .map((line) => line.normalize("NFKC").replace(/\s*\(cm\)\s*$/iu, "").trim())
    .map((line) => line.split(/\s+/u))
    .filter((cells) => measurementSizes.length > 0 && cells.length >= measurementSizes.length + 1)
    .map((cells) => [cells[0], ...cells.slice(1, measurementSizes.length + 1)]);

  const fitEnd = codeIndex >= 0 ? codeIndex : technical.length;
  const fitGuide = fitStart >= 0
    ? technical.slice(fitStart, fitEnd).filter(Boolean).map((line) => line.normalize("NFKC"))
    : [];

  return {
    bullets,
    description,
    measurements,
    measurementSizes,
    fitGuide,
    code,
    copyLines
  };
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

function renderLines(lines) {
  return lines
    .map((line) => line
      ? `                <p class="product-copy__line">${html(line)}</p>`
      : "                <div class=\"product-copy__line product-copy__blank-line\">&nbsp;</div>")
    .join("\n");
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

function renderMeasurements(product) {
  return product.measurements.map((cells, index) => {
    const unit = index === product.measurements.length - 1 ? "(cm)" : "";
    return `                    <tr><th scope="row">${html(cells[0])}</th>${cells.slice(1).map((cell) => `<td>${html(cell)}</td>`).join("")}<td class="size-table__unit">${unit}</td></tr>`;
  }).join("\n");
}

function renderMeasurementHeaders(product) {
  return [
    '                      <th scope="col" aria-label="Measurement"></th>',
    ...product.measurementSizes.map((size) => `                      <th scope="col">${html(size)}</th>`),
    '                      <th scope="col" aria-label="Unit"></th>'
  ].join("\n");
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
    IMAGE: html(product.image),
    ALT: html(product.alt),
    PLACEHOLDER_NOTE: product.imageSource === "placeholder"
      ? '            <span class="product-media-note">Placeholder image</span>'
      : "",
    PRICE: html(product.price),
    COLOR_LABEL: html(product.colors[0]?.label || "Color"),
    SWATCHES: renderSwatches(product),
    SIZES: renderSizes(product),
    SHOPEE_ATTRIBUTES: shopeeAttributes,
    SHOPEE_LABEL: product.soldOut ? "Sold out" : "Buy on Shopee",
    BULLETS: renderLines(product.bullets),
    DESCRIPTION: renderLines(product.description),
    MEASUREMENT_HEADERS: renderMeasurementHeaders(product),
    MEASUREMENTS: renderMeasurements(product),
    FIT_GUIDE: renderLines(product.fitGuide),
    CODE: html(product.code)
  };

  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const template = await readFile(TEMPLATE_PATH, "utf8");

const products = source.products
  .filter((entry) => entry.variants.some((variant) => variant.visible))
  .map((entry) => {
    const parsed = parseDocumentCopy(entry.document?.content || "");
    const visibleVariants = entry.variants.filter((variant) => variant.visible);
    const colors = unique(visibleVariants.map((variant) => variant.color)).map((label) => ({
      label,
      hex: COLOR_HEX[label] || "#777777"
    }));
    const sizes = unique(visibleVariants.map((variant) => variant.size));
    const localImages = entry.localImages.filter(Boolean);
    if (!localImages.length) {
      throw new Error(`${entry.productNumber} has no local image or image fallback`);
    }

    return {
      slug: slugFor(entry.title),
      productNumber: entry.productNumber,
      title: entry.title,
      category: categoryFor(entry.title),
      price: priceLabel(entry.price),
      image: localImages[0],
      images: localImages,
      imageSource: entry.imageSource,
      alt: entry.imageSource === "placeholder"
        ? `${entry.title} placeholder illustration; product photography pending`
        : `${entry.title} product image`,
      colors,
      sizes,
      variants: entry.variants.map(({ color, size, visible, soldOut }) => ({
        color,
        size,
        visible,
        soldOut
      })),
      soldOut: visibleVariants.every((variant) => variant.soldOut),
      bullets: parsed.bullets,
      description: parsed.description,
      fitGuide: parsed.fitGuide,
      code: parsed.code || `#${entry.productNumber}`,
      measurements: parsed.measurements,
      measurementSizes: parsed.measurementSizes,
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
