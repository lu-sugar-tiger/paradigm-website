# Teamwear landing media

The 21 square WebP files are flattened temporary Road-side renders: three patterns by seven colors. The white canvas, legacy monochrome filter, and color blend are baked into each file. The landing page displays a normal image without runtime recoloring or half-image cropping. Original pair images and customizer assets are unchanged.

Replace individual files with real square product photography, or change each pattern's `railImages` mapping in `data/teamwear-options.json`, then rebuild with `scripts/build-site.mjs`. The current files are 1080 × 1080. Keep replacement dimensions consistent and update generated image dimensions if changing that size.

`fabric-square.webp` is a 1200 × 1200 center crop of the existing campaign fabric macro. The landing section displays it full-width and 100svh tall with centered cover cropping. The heading is outside the photograph. No bento grid remains.

To reproduce these temporary assets, run `scripts/generate-teamwear-rail-images.mjs` with the existing Sharp and Playwright tooling exposed via `NODE_PATH`. Do not rerun it after replacing the files with real photography: it deliberately rewrites this generated set from the original renders.
