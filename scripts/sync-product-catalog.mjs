import assert from "node:assert/strict";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateProductImageDerivatives } from "./generate-product-images.mjs";
import { documentText, syncCatalog } from "./lib/catalog-sync.mjs";
import { mapSheetItemRow } from "./lib/item-schema.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const capture = process.argv[2];
assert.ok(capture, "Usage: node scripts/sync-product-catalog.mjs <connector-capture-directory> [--apply]");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const sheet = await readJson(path.join(capture, "sheet.json"));
const resources = await readJson(path.join(capture, "resources.json"));
const previous = await readJson(path.join(root, "data/products-source.json"));
const links = await readJson(path.join(root, "data/store-links.json"));
const documents = {};
const images = {};
const existing = new Map(previous.items.flatMap((item) => [...item.images, ...(item.variantImages || [])]).map((image) => [image.id, image]));
const imageCachePath = path.join(capture, "generated-images.json");
let imageCache = {};
try { imageCache = await readJson(imageCachePath); } catch (error) { if (error.code !== "ENOENT") throw error; }
for (const [id, resource] of Object.entries(resources)) {
  const meta = resource.metadata;
  assert.ok(meta?.modified_time, `Missing metadata for ${id}`);
  if (resource.document) {
    documents[id] = { id, title: meta.title, modifiedTime: meta.modified_time, content: documentText(resource.document) };
    continue;
  }
  const cached = imageCache[id] || existing.get(id);
  if (cached?.modifiedTime === meta.modified_time && cached.derivatives?.length === 3) {
    try {
      await Promise.all(cached.derivatives.map((image) => access(path.join(root, image.path))));
      images[id] = cached;
      continue;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const extension = meta.mime_type === "image/png" ? "png" : "jpg";
  const generated = await generateProductImageDerivatives({ inputPath: path.join(capture, "originals", `${id}.${extension}`) });
  images[id] = {
    id, name: meta.title, modifiedTime: meta.modified_time,
    localPath: generated.derivatives.find((image) => image.shortEdge === 1080).path,
    sourceWidth: generated.source.width, sourceHeight: generated.source.height,
    sourceBytes: generated.source.bytes, sourceSha256: generated.source.sha256,
    transform: generated.transform, derivatives: generated.derivatives
  };
  imageCache[id] = images[id];
  await writeFile(imageCachePath, JSON.stringify(imageCache, null, 2) + "\n");
  console.log(`Generated ${id}: ${generated.source.width}x${generated.source.height}`);
}
const catalog = syncCatalog({ previous, sheet, documents, images, storeLink: links.shopee, syncedAt: new Date().toISOString() });
const report = {
  unmappedHeaders: mapSheetItemRow(sheet.rows[0], []).unmappedHeaders,
  items: catalog.items.length,
  visibleItems: catalog.items.filter((item) => item.variants.some((variant) => variant.visible)).length,
  variants: catalog.items.flatMap((item) => item.variants).length,
  docs: Object.keys(documents).length,
  downloadedImages: Object.keys(images).length,
  replacedGalleries: catalog.items.filter((item) => JSON.stringify(item.images) !== JSON.stringify(previous.items.find((old) => old.code === item.code)?.images || [])).map((item) => item.code),
  storeFallbacks: catalog.items.filter((item) => item.link === links.shopee).map((item) => item.code)
};
await writeFile(path.join(capture, "candidate.json"), JSON.stringify(catalog, null, 2) + "\n");
await writeFile(path.join(capture, "report.json"), JSON.stringify(report, null, 2) + "\n");
if (process.argv.includes("--apply")) {
  await writeFile(path.join(root, "data/products-source.json"), JSON.stringify(catalog, null, 2) + "\n");
  await writeFile(path.join(root, "data/products-sheet.json"), JSON.stringify(sheet, null, 2) + "\n");
}
console.log(JSON.stringify({ ...report, applied: process.argv.includes("--apply") }, null, 2));
