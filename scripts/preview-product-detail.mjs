import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Snapshot the shared generated page; all experimental layout stays local.
const productCode = "PH14010";
const previewPath = "/output/playwright/product-detail-experiment/";
const directory = new URL(`..${previewPath}`, import.meta.url);
const source = await readFile(new URL(`../products/${productCode}/index.html`, import.meta.url), "utf8");
const galleryMarker = '<div class="product-detail__gallery"';
if (!source.includes(galleryMarker)) throw new Error("Shared product gallery not found.");
const mediaMarker = '<div class="product-detail__media">';
if (!source.includes(mediaMarker)) throw new Error("Shared product media wrapper not found.");
const experimentFiles = await Promise.all([
  ["product-detail-preview.css", "experiment.css"],
  ["product-detail-preview.js", "experiment.js"]
].map(async ([sourceName, targetName]) => {
  const content = await readFile(new URL(`./experiments/${sourceName}`, import.meta.url));
  return { targetName, content, version: createHash("sha256").update(content).digest("hex").slice(0, 12) };
}));
const page = source
  .replace("<head>", `<head>\n  <base href="/products/${productCode}/">\n  <meta name="robots" content="noindex,nofollow">`)
  .replace(/<link rel="canonical"[^>]*>/, "")
  .replace(/<title>[^<]*<\/title>/, "<title>Product detail experiment | Paradigm</title>")
  .replace(/href="#([^"]*)"/g, `href="${previewPath}#$1"`)
  .replace(/<body class="([^"]*)"/, '<body class="$1 product-detail-experiment"')
  .replace(galleryMarker, `<aside class="detail-thumbnails" aria-label="Product photographs"><nav class="detail-thumbnails__rail" aria-label="Gallery thumbnails"></nav></aside>\n        ${galleryMarker}`)
  .replace("</head>", `  <link rel="stylesheet" href="${previewPath}experiment.css?v=${experimentFiles[0].version}">\n  <script defer src="${previewPath}experiment.js?v=${experimentFiles[1].version}"></script>\n</head>`);

await mkdir(directory, { recursive: true });
await writeFile(new URL("index.html", directory), page);
for (const { targetName, content } of experimentFiles) {
  await writeFile(new URL(targetName, directory), content);
}
console.log(`Product detail experiment: ${previewPath}`);
