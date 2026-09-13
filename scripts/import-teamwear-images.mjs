import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateProductImageDerivatives } from "./generate-product-images.mjs";

// Import supplied artwork, never tint or crop a different style/color to invent it.
const root = fileURLToPath(new URL("../", import.meta.url));
const inputDirectory = path.join(root, "assets/temp");
const optionsPath = path.join(root, "data/teamwear-options.json");
const data = JSON.parse(await readFile(optionsPath, "utf8"));
const model = data.models.find((entry) => entry.id === "basketball-01");
const colorOptions = [
  ["C01", "black"], ["C11", "burgundy"], ["C13", "cardinal"],
  ["C21", "mocha"], ["C41", "ivy"], ["C61", "midnight"], ["C63", "royalty"]
];
const filenames = await readdir(inputDirectory);
const jobs = [];
for (const pattern of model.patterns) {
  for (const [code, colorId] of colorOptions) {
    // Confirmed filename aliases in the supplied 0.4.0 artwork batch.
    const legacyCode = code === "C41" ? "C53"
      : pattern.id === "P03" && code === "C61" ? "C61-20"
      : pattern.id === "P03" && code === "C63" ? "C61-21" : code;
    const matches = filenames.filter((filename) =>
      filename.startsWith("#HW12999_PeBasketballJersey_Drawing[0.4.0]_")
      && [code, legacyCode].some((suffix) => filename.endsWith(`_${pattern.name}_${suffix}.jpg`)));
    if (matches.length !== 1) throw new Error(`Expected one original for ${pattern.name}/${code}; found ${matches.length}.`);
    jobs.push({ pattern, code, colorId, filename: matches[0] });
  }
}

// Resolve all source files before generating assets or changing the manifest.
for (const pattern of model.patterns) {
  pattern.mediaByColor = {};
  delete pattern.preview;
  delete pattern.railImages;
}
for (const { pattern, code, colorId, filename } of jobs) {
  const result = await generateProductImageDerivatives({
    inputPath: path.join(inputDirectory, filename),
    outputDir: path.join(root, "assets/images/teamwear/uniforms")
  });
  const fallback = result.derivatives.find((image) => image.shortEdge === 1080);
  pattern.mediaByColor[colorId] = {
    src: fallback.path, width: fallback.width, height: fallback.height,
    source: { filename, ...result.source },
    transform: result.transform, derivatives: result.derivatives
  };
  console.log(`${pattern.name} ${code} ${colorId}: ${result.derivatives.length} WebP sizes`);
}
model.colors = colorOptions.map(([id, colorId]) => ({ id, colorId, availability: "available" }));
await writeFile(optionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Imported ${jobs.length} originals. Run scripts/build-site.mjs to update the pages.`);
