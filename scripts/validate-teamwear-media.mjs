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
const variantImage = customize.match(/<img[^>]+data-product-variant-image[^>]*>/)?.[0];
assert.ok(variantImage?.includes(model.patterns[1].mediaByColor.mocha.src));
assert.match(variantImage, /srcset="[^"]+540w, [^"]+1080w, [^"]+2160w"/);
assert.match(variantImage, /data-media-zoom-touch/);
assert.match(variantImage, /loading="lazy"/);
assert.doesNotMatch(customize, /data-builder-cover/, "Teamwear must not keep the old first-slide cover behavior");
console.log(`Teamwear media OK: ${model.patterns.length * model.colors.length} configurations, ${paths.size} verified WebPs, responsive rail and default variant image.`);

const photography = JSON.parse(await read("data/teamwear-photography.json"));
const photoById = new Map(photography.photos.map((photo) => [photo.id, photo]));
assert.equal(photoById.size, 7);
assert.equal(photography.photos.length, photoById.size, "Photograph IDs must be unique");
const photographPaths = new Set();
for (const photo of photography.photos) {
  assert.equal(photo.team, "NTUESOE");
  assert.ok(photo.alt.length > 20, "Meaningful photographs need descriptive alt text");
  assert.deepEqual([photo.source.width, photo.source.height], [4500, 4500]);
  assert.equal(photo.transform.quality, 100);
  assert.equal(photo.transform.resize, "short-edge");
  assert.deepEqual(photo.media.derivatives.map((entry) => entry.shortEdge), [540, 1080, 2160]);
  assert.equal(photo.media.src, photo.media.derivatives[1].path);
  assert.deepEqual([photo.media.width, photo.media.height], [1080, 1080]);
  for (const derivative of photo.media.derivatives) {
    const bytes = await readFile(path.join(root, derivative.path));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.hasAlpha, false);
    assert.deepEqual([metadata.width, metadata.height], [derivative.shortEdge, derivative.shortEdge]);
    assert.equal(bytes.length, derivative.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), derivative.sha256);
    assert.ok(!photographPaths.has(derivative.path));
    photographPaths.add(derivative.path);
  }
}
const highlightSection = landing.match(/<section class="teamwear-highlights"[\s\S]*?<\/section>/)[0];
const athleteSection = landing.match(/<section class="teamwear-gallery"[\s\S]*?<\/section>/)[0];
const customGallery = customize.match(/<div class="product-detail__gallery"[\s\S]*?<\/div>/)[0];
function assertPhotoSequence(markup, ids, { variantLast = false, eagerFirst = false, captions = false } = {}) {
  const images = markup.match(/<img\b[^>]*>/g) || [];
  assert.equal(images.length, ids.length + Number(variantLast));
  ids.forEach((id, index) => {
    const photo = photoById.get(id);
    assert.ok(photo, `Unknown photograph reference: ${id}`);
    const image = images[index];
    assert.ok(image.includes(photo.media.src), `Wrong image or order for ${id}`);
    assert.ok(image.includes(`alt="${photo.alt}"`));
    assert.match(image, /srcset="[^"]+540w, [^"]+1080w, [^"]+2160w"/);
    if (eagerFirst && index === 0) assert.doesNotMatch(image, /loading="lazy"/);
    else assert.match(image, /loading="lazy"/);
    assert.match(image, /width="1080" height="1080"/);
    if (variantLast) assert.match(image, /data-media-zoom-touch/);
  });
  if (variantLast) assert.match(images.at(-1), /data-product-variant-image/, "The separate variant image must be last in the horizontal gallery");
  assert.doesNotMatch(markup, /teamwear-court-|teamwear-hero-product-|campaign\//);
  if (captions) {
    const names = [...markup.matchAll(/<h3 class="type-h5">([^<]+)<\/h3>/g)].map((match) => match[1]);
    assert.deepEqual(names, ids.map((id) => photoById.get(id).team));
  }
}
assertPhotoSequence(highlightSection, Object.values(photography.highlights));
assertPhotoSequence(athleteSection, photography.athletes, { captions: true });
assertPhotoSequence(customGallery, photography.customGallery, { variantLast: true, eagerFirst: true });
assert.deepEqual(new Set([...Object.values(photography.highlights), ...photography.athletes]), new Set(photoById.keys()));
assert.deepEqual(new Set(photography.customGallery), new Set(photoById.keys()));
assert.equal(new Set(photography.customGallery).size, photography.customGallery.length);
console.log(`Teamwear photography OK: ${photoById.size} supplied photos, ${photographPaths.size} verified WebPs, four highlights, three athlete cards, seven gallery photos plus a separate variant image.`);
