# Google Drive product sync

Paradigm's product source is the Google Sheet [商品列表](https://docs.google.com/spreadsheets/d/1vt4wTxgUujj6L_p_I-zqzcpWvWZwACp4O1JRQlf2t9M/edit), tab `網站參照`. The website remains static: Google Drive is read during a maintenance sync, then the resulting local catalog and product routes are committed with the site.

## Source mapping

| Sheet field | Website behavior |
| --- | --- |
| `商品型號` | Groups all rows into one product and becomes `/products/{商品型號}`. |
| `商品名稱` | Product title. |
| `商品定價` | Display price. |
| `商品連結` | External Shopee purchase URL. |
| `商品文案` | Google Doc source. Import from the first bullet through the last non-empty line. |
| `商品圖片 0` | Main image. |
| `商品圖片 1` … `商品圖片 9` | Gallery images in column order. |
| `存貨單位` | Source-only SKU. It is never copied into the repository snapshot, browser catalog, or rendered HTML. |
| `商品顏色`, `商品尺寸` | Variant options, deduplicated from visible rows. |
| `顯示` | A product is published when at least one of its variant rows is `TRUE`. Hidden rows do not create visible options. |
| `售罄` | Disables the corresponding option. The purchase action becomes `Sold out` when every visible variant is sold out. |

Category is not present in the sheet. The current deterministic mapping is: shorts → `Bottoms`; hoodies and crewnecks → `AW Tops`; tees and jerseys → `SS Tops`.

## Files and responsibilities

- `data/products-source.json` is the connector-captured snapshot used for generation. It includes grouped public product fields, Doc copy, local image paths, and source modification times. It intentionally omits SKUs and private sharing URLs.
- `scripts/build-product-catalog.mjs` parses Doc copy, builds `assets/js/catalog.js`, and creates one static route per visible product model.
- `scripts/templates/product-page.html` is the reusable no-JavaScript product-page template.
- `scripts/validate-product-catalog.mjs` verifies source coverage, routes, images, purchase links, sold-out behavior, and the no-SKU rule.
- `assets/images/products/{商品型號}/` stores downloaded product imagery when the sheet supplies images.

## Refresh workflow

1. Read spreadsheet metadata first and record its `modifiedTime`. Resolve the exact `網站參照` tab and read a bounded range, currently `A1:U200`.
2. Read rich-link chip metadata for `商品文案` and `商品圖片` cells. Plain cell values contain chip labels, not the underlying Drive URLs.
3. Group rows by `商品型號`. Carry product-level values from whichever row contains them and retain variant visibility and sold-out flags without copying `存貨單位`.
4. For every linked Google Doc, read the current file and record its file ID and `modifiedTime`. Copy from the first `•` bullet through the last non-empty line. The generator separates the two `-` dividers into description, measurements, fit guidance, and product code.
5. For every linked image, record file ID and `modifiedTime`. Download through an authenticated Drive session and store an optimized WebP locally. `商品圖片 0` must remain first.
6. If a product has no sheet image links, preserve its existing `localImages` exactly. Do not empty the gallery and do not delete the local files. A new product with no matching existing photography uses an identifiable SVG placeholder until imagery is supplied.
7. Update `data/products-source.json`, then regenerate and validate:

   ```powershell
   node scripts/build-product-catalog.mjs
   node scripts/validate-product-catalog.mjs
   ```

8. Serve the repository over HTTP and check the all-products page plus representative available, sold-out, placeholder-image, and multi-image products on mobile and desktop.

## Change detection

The spreadsheet, each Doc, and each Drive image keep independent `modifiedTime` values. On a later sync:

- re-read the sheet when its `modifiedTime` changes;
- re-read every known Doc's metadata even when its URL/file ID is unchanged;
- re-download an image only when its file ID is new, its `modifiedTime` changed, or the local file is missing;
- preserve the existing local image when the current sheet contains no image link;
- review the generated diff before publishing.

This avoids missing in-place edits to Docs and photos while keeping unchanged images stable.

## Sync record: 2026-08-06

- Spreadsheet modified: `2026-08-06T06:44:34.564Z`.
- Imported: 19 visible product models and all linked Google Docs.
- Fully sold out: `PD24015`, `TL24019`, `GM42022`, `GM42023`.
- Downloaded: eight `ED14024` images, each normalized to a 1600 × 1600 WebP; image 0 is the catalog card and main detail image.
- Preserved existing photography for `ED14001`, `AE14008`, `PH14010`, `PD24015`, `TL23018`, `BT24020`, `BD24021`, `GM42022`, and `GM42023` because their sheet rows contain no images.
- Placeholder imagery remains for `ED23002`, `PD23006`, `PD14007`, `TL14009`, `PH14011`, `ED24014`, `AE23016`, `AE24017`, and `TL24019`.
- Former `PL-*` placeholder URLs and `/products/prdm-cosmos-hoodie` redirect to the matching synced product-number routes.

## Improvement notes

- Add a small authenticated exporter when a stable Google service credential is available; until then, the Drive/Sheets connector plus the signed-in browser is the supported capture path.
- If category becomes a sheet column, replace title inference with that explicit field.
- If per-color galleries are added, extend the image columns with an explicit color association instead of inferring it from filenames.
- Keep this document's sync record and edge cases current after each import.
