# Teamwear landing media

The active uniform images now live in `../uniforms/`. They are imported from the 21 supplied square originals: Essential, Classic, and Signature, each in seven colors. The images show front and back views, without cropping, tinting, zooming, or opacity changes. Older `p01-*`, `p02-*`, and `p03-*` renders in this folder are retained but no longer referenced by the pages.

Each pattern's `mediaByColor` mapping in `data/teamwear-options.json` is shared by the landing colorway rail and the customizer cover. It records source filename/hash, transform settings, and content-hashed 540/1080/2160px WebP derivatives at quality 100. The 1080px image is the fallback `src`; responsive `srcset` supplies all three sizes.

Color codes: C01 Black, C11 Burgundy, C13 Cardinal, C21 Mocha, C41 Ivy, C61 Midnight, C63 Royalty. The supplied batch's C53 filenames mean C41 Ivy; Signature C61-20 means C61 Midnight and C61-21 means C63 Royalty. These aliases were confirmed by the owner. Corrected filenames are accepted too; duplicate candidates fail preflight.

`fabric-square.webp` is a 1200 × 1200 center crop of the existing campaign fabric macro. The landing section displays it full-width and 100svh tall with centered cover cropping. The heading is outside the photograph. No bento grid remains.

To reimport the supplied 0.4.0 artwork from `assets/temp`, run `node scripts/import-teamwear-images.mjs` with the existing Sharp tooling exposed via `NODE_PATH`, then `node scripts/build-site.mjs`. The old `generate-teamwear-rail-images.mjs` command delegates to this importer and no longer creates tinted renders. Source originals remain untouched; normal site builds use committed derivatives and do not need the temp folder. Validate with `node scripts/validate-teamwear-media.mjs`.
