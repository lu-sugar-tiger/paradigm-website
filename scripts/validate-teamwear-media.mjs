import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");
const model = JSON.parse(await read("data/teamwear-options.json")).models[0];
const colors = new Map(JSON.parse(await read("data/colors.json")).colors.map((color) => [color.id, color.name]));
const expectedColors = [
  ["C01", "black", "Black"], ["C11", "burgundy", "Burgundy"], ["C13", "cardinal", "Cardinal"],
  ["C21", "mocha", "Mocha"], ["C41", "ivy", "Ivy"], ["C61", "midnight", "Midnight"], ["C63", "royalty", "Royalty"]
];
assert.deepEqual(model.colors.map(({ id, colorId }) => [id, colorId, colors.get(colorId)]), expectedColors);
assert.deepEqual(model.patterns.map(({ id, name }) => [id, name]), [["P01", "Essential"], ["P02", "Classic"], ["P03", "Signature"]]);
const paths = new Set();
for (const pattern of model.patterns) {
  assert.deepEqual(Object.keys(pattern.mediaByColor), model.colors.map((color) => color.colorId));
  for (const color of model.colors) {
    const media = pattern.mediaByColor[color.colorId];
    assert.equal(media.source.width, 4500);
    assert.equal(media.source.height, 4500);
    assert.equal(media.transform.quality, 100);
    assert.equal(media.transform.resize, "short-edge");
    assert.deepEqual(media.derivatives.map((entry) => entry.shortEdge), [540, 1080, 2160]);
    assert.equal(media.src, media.derivatives[1].path);
    assert.equal(media.width, 1080);
    assert.equal(media.height, 1080);
    for (const derivative of media.derivatives) {
      const bytes = await readFile(path.join(root, derivative.path));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, derivative.shortEdge);
      assert.equal(metadata.height, derivative.shortEdge);
      assert.equal(metadata.hasAlpha, false);
      assert.equal(bytes.length, derivative.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), derivative.sha256);
      assert.ok(!paths.has(derivative.path), "Every configuration/size must have its own image");
      paths.add(derivative.path);
    }
  }
}
const landing = await read("teamwear/index.html");
const customize = await read("teamwear/customize/index.html");
const railImages = landing.match(/<img[^>]+data-colorway-image[^>]*>/g) || [];
assert.equal(railImages.length, 7);
for (const [index, image] of railImages.entries()) {
  assert.ok(image.includes(model.patterns[1].mediaByColor[model.colors[index].colorId].src));
  assert.match(image, /srcset="[^"]+540w, [^"]+1080w, [^"]+2160w"/);
  assert.match(image, /loading="lazy"/);
}
const cover = customize.match(/<img[^>]+data-builder-cover[^>]*>/)?.[0];
assert.ok(cover?.includes(model.patterns[1].mediaByColor.mocha.src));
assert.match(cover, /srcset="[^"]+540w, [^"]+1080w, [^"]+2160w"/);
assert.match(cover, /data-media-zoom-touch/);
assert.doesNotMatch(cover, /loading="lazy"/);
console.log(`Teamwear media OK: ${model.patterns.length * model.colors.length} configurations, ${paths.size} verified WebPs, responsive rail and default cover.`);
