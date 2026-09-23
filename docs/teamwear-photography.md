# Teamwear photography

`data/teamwear-photography.json` is the shared source for supplied photographs and their placement. It is separate from the configurable uniform artwork in `data/teamwear-options.json`.

The current batch contains seven square NTUESOE basketball photos from `assets/temp`. Each is imported without cropping, tinting, or opacity changes through `generateProductImageDerivatives`: quality-100 WebP at 540, 1080, and 2160px short edges, content-hashed filenames, source and derivative SHA-256 records, and intrinsic image dimensions. Existing face blurring and player labels in the originals are preserved. The 1080px derivative is the fallback source; the shared renderer supplies all three responsive sizes. Originals are never modified or deleted.

| Placement | Source suffixes |
| --- | --- |
| Highlights: Complete set, Two sides, Team identity, Print detail | 02, 03, 04, 07 |
| Athletes | 01, 06, 08 |
| Custom-page gallery after the configurable cover | 01, 02, 03, 04, 06, 07, 08 |

All athlete-card captions say NTUESOE, matching the supplied batch rather than attributing its photographs to other teams. The custom-page cover continues to follow the selected pattern and color; the seven subsequent photographs are real-life examples and do not change with that selection.

To reimport, keep the manifest's named originals in `assets/temp`, expose the existing Sharp package through `NODE_PATH`, and run:

```powershell
node scripts/import-teamwear-photography.mjs
node scripts/build-site.mjs
node scripts/validate-teamwear-media.mjs
node scripts/build-site.mjs --check
```

Normal site builds use the committed derivatives and manifest, not the staging folder. The importer processes only explicitly listed photos, ignores the supplied `10.mp4`, and preserves unrelated files. Reruns reuse matching content-hashed derivatives.

This update replaces the imagery in the highlights, athletes, and custom-page gallery only. Hero and fabric-section images remain unchanged. Older unused photo files remain available on disk but are not rendered in the replaced sections.
