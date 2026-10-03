import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../assets/js/choices.js", import.meta.url), "utf8");
const ruleSource = source.match(/function hasVariantImageChoices\(gallery\) \{[\s\S]*?\n  \}/)?.[0];
const syncSource = source.match(/function syncVariantImage\(gallery, media,[\s\S]*?\n  \}/)?.[0];
assert.ok(ruleSource && syncSource);
const option = (dataset, displayed = true) => ({ dataset, getClientRects: () => displayed ? [{}] : [] });
function fixture({ colors = 1, patterns = 1, teamwear = false, sizeImages = ["same", "same"], hiddenColor = false } = {}) {
  const colorOptions = Array.from({ length: colors }, (_, index) => option({ colorCode: `C${index}` }));
  if (hiddenColor) colorOptions.push(option({ colorCode: "hidden" }, false));
  const sizes = sizeImages.map((_, index) => option({ choiceLabel: `S${index}` }));
  const panel = {
    dataset: { itemCode: "fixture" },
    querySelector: () => teamwear ? {} : null,
    querySelectorAll: selector => selector.includes("swatch") ? colorOptions
      : selector.includes("Pattern") ? Array.from({ length: patterns }, () => option({})) : sizes
  };
  const product = { code: "fixture", variants: sizeImages.map((imageId, index) => ({ visible: true, colorCode: "C0", sizeName: `S${index}`, imageId })) };
  const window = { PARADIGM_PRODUCT: product };
  const gallery = { closest: () => panel };
  const canReveal = runInNewContext(`(${ruleSource})`, { window });
  return { gallery, window, canReveal };
}

for (const [settings, expected] of [
  [{}, false],
  [{ colors: 0 }, false],
  [{ hiddenColor: true }, false],
  [{ sizeImages: [null, null] }, false],
  [{ colors: 2 }, true],
  [{ sizeImages: ["small-photo", "large-photo"] }, true],
  [{ teamwear: true }, false],
  [{ teamwear: true, colors: 2 }, true],
  [{ teamwear: true, patterns: 2 }, true]
]) {
  const { gallery, canReveal } = fixture(settings);
  assert.equal(canReveal(gallery), expected, JSON.stringify(settings));
}

// Exercise the shared sync path: a lone option must not reveal or auto-scroll.
for (const large of [true, false]) {
  for (const colors of [1, 2]) {
    const { gallery, window, canReveal } = fixture({ colors });
    const attributes = new Set();
    let scrolls = 0;
    const image = {
      dataset: { productImageId: "variant-photo" }, loading: "lazy", offsetLeft: 123,
      removeAttribute() {}
    };
    gallery.querySelector = () => image;
    gallery.setAttribute = name => attributes.add(name);
    gallery.scrollTo = () => scrolls++;
    window.PARADIGM_LANGUAGE = { imageText: text => text };
    window.matchMedia = () => ({ matches: large });
    const sync = runInNewContext(`(${syncSource})`, {
      window, hasVariantImageChoices: canReveal, URL,
      document: { baseURI: "http://localhost/products/fixture/", dispatchEvent() {} },
      CustomEvent: function () {}
    });
    sync(gallery, { src: "photo.webp" }, { imageId: "variant-photo", alt: "Variant", reveal: true });
    assert.equal(attributes.has("data-variant-revealed"), colors > 1);
    assert.equal(scrolls, !large && colors > 1 ? 1 : 0);
    assert.equal(image.loading, colors > 1 ? "eager" : "lazy");
  }
}
console.log("VARIANT_IMAGE_CHOICE_OK lone option blocked; displayed alternatives, size-specific photos and Teamwear Color/Pattern supported; reveal and horizontal auto-scroll guarded");
