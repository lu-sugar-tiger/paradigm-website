import { access, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateProductImageDerivatives } from "./generate-product-images.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = path.join(root, "data/teamwear-photography.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const inputDirectory = path.join(root, "assets/temp");

// Import only the explicitly assigned photos, never unrelated files in the staging folder.
for (const photo of manifest.photos) {
  if (path.basename(photo.source.filename) !== photo.source.filename) {
    throw new Error(`Expected a source filename, not a path: ${photo.id}`);
  }
  await access(path.join(inputDirectory, photo.source.filename));
}
for (const photo of manifest.photos) {
  const result = await generateProductImageDerivatives({
    inputPath: path.join(inputDirectory, photo.source.filename),
    outputDir: path.join(root, "assets/images/teamwear/photography")
  });
  const fallback = result.derivatives.find((image) => image.shortEdge === 1080);
  photo.source = { filename: photo.source.filename, ...result.source };
  photo.transform = result.transform;
  photo.media = {
    src: fallback.path, width: fallback.width, height: fallback.height,
    derivatives: result.derivatives
  };
  console.log(`${photo.id}: ${result.derivatives.length} uncropped WebP sizes`);
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Imported ${manifest.photos.length} photos; originals are unchanged. Run scripts/build-site.mjs.`);
