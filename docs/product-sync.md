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
| `存貨單位` | Variant SKU. It may be kept in the repository snapshot and browser catalog, but is not rendered on the website. |
| `商品顏色`, `商品尺寸` | Variant options, deduplicated from visible rows. |
| `顯示` | A product is published when at least one of its variant rows is `TRUE`. Hidden rows do not create visible options. |
| `售罄` | Disables the corresponding option on product detail pages. The purchase action becomes `Sold out` when every visible variant is sold out. Collection cards do not show a sold-out state. |

Category is not present in the sheet. The current deterministic mapping is: shorts → `Bottoms`; hoodies and crewnecks → `AW Tops`; tees and jerseys → `SS Tops`.

## Files and responsibilities

- `data/products-source.json` is the connector-captured snapshot used for generation. It includes grouped product fields, Doc copy, local image paths, source modification times, and variant SKUs when captured.
- `scripts/lib/product-copy.mjs` preserves ordinary Google Docs text and blank paragraphs in source order, turns dash-only lines into horizontal rules without changing their neighbors, and turns positively detected rectangular size blocks into semantic tables.
- `scripts/build-product-catalog.mjs` builds `assets/js/catalog.js` and creates one static route per visible product model.
- `scripts/templates/product-page.html` is the reusable no-JavaScript product-page template.
- `data/product-colorways.json` is the complete merchandising colorway registry; it is separate from semantic interface colors.
- `scripts/validate-product-catalog.mjs` verifies source coverage, colorway completeness, routes, images, purchase links, product-detail sold-out behavior, and the exact copy-token contract.
- `assets/images/products/{商品型號}/` stores downloaded product imagery when the sheet supplies images.

## Refresh workflow

1. Read spreadsheet metadata first and record its `modifiedTime`. Resolve the exact `網站參照` tab and read a bounded range, currently `A1:U200`.
2. Read rich-link chip metadata for `商品文案` and `商品圖片` cells. Plain cell values contain chip labels, not the underlying Drive URLs.
3. Group rows by `商品型號`. Carry product-level values from whichever row contains them and retain variant SKU, visibility, and sold-out flags.
4. For every linked Google Doc, read the current file and record its file ID and `modifiedTime`. Copy from the first bullet through the last non-empty line, then apply the complete product-description contract below.
5. For every linked image, record file ID and `modifiedTime`. Download through an authenticated Drive session and store an optimized WebP locally. `商品圖片 0` must remain first.
6. If a product has no sheet image links, preserve existing real product photography in `localImages`. If no real photography exists, keep `localImages` empty and render an unlabelled blank media surface. Do not create or reuse placeholder artwork.
7. Update `data/products-source.json`, then regenerate and validate:

   ```powershell
   node scripts/build-product-catalog.mjs
   node scripts/validate-product-catalog.mjs
   ```

8. Serve the repository over HTTP and check the all-products page plus representative available, sold-out-detail, blank-image, and multi-image products on mobile and desktop. Confirm collection cards never display sold-out or placeholder labels.

## Product-description normalization contract

Apply these rules in this order. This is the complete contract; do not add inferred formatting.

1. **Source range:** Import from the first bullet line through the last line containing a non-space character. Ignore content before the first bullet and trailing empty paragraphs after the final line.
2. **Ordinary text is exact:** Never trim, normalize, retype, split, join, or change an ordinary text line. Preserve leading/trailing spaces, repeated spaces inside the line, Unicode space types, punctuation, letter width, mathematical glyphs, and number formats.
3. **Blank paragraphs are exact:** Google Docs represents every paragraph terminator, including an otherwise empty paragraph, with `U+000A`. Preserve every source blank paragraph one-for-one and render its `U+000A` as a one-line selectable character. Preserve any whitespace preceding that terminator. Do not replace it with `U+00A0`, collapse consecutive blank paragraphs, or insert or remove blank paragraphs. A stored snapshot may contain `U+000D U+000A`; normalize that transport-level line ending to the Google Docs `U+000A` representation while parsing.
4. **One-line horizontal rule:** Treat a line whose only non-space character is the ASCII `-` as a rule. Render one `rule` token containing the literal selectable `-`, visually replaced by a horizontal line, with the same one-line height as ordinary copy. Do not insert, remove, or collapse neighboring blank paragraphs.
5. **Size-table recognition:** Detect a table from the raw source lines before transforming dash-only lines. A candidate must be blank-separated, have at least two header cells, and have at least two following rows whose cell counts form a compatible rectangle with one row-heading cell and at most one optional trailing cell. Split candidate cells using all Unicode whitespace plus `U+180E`, `U+200B`, `U+2060`, and `U+FEFF`.
6. **No table-content assumptions:** Never identify or reject a table based on particular size names, dimension names, languages, units, or numeric formats. Preserve every detected cell value exactly; do not apply `trim`, `NFKC`, numeric parsing, or typography substitution to cell contents.
7. **Uncertainty stays plain:** If a candidate has fewer than two body rows, inconsistent widths, or an unbounded non-blank continuation, do not make a table. Leave every line in that candidate as ordinary text.
8. **Gridless semantic output:** Render a confirmed table with `<table>`, column headers, and row headers. Do not show grid lines. Preserve the source blank paragraphs before and after the table one-for-one.
9. **No other transformations:** Do not infer bullet groups, prose sections, fit guidance, product codes, measurement types, or separator spacing. The only content transforms are dash-only rules and confirmed size tables.
10. **Required validation:** For every product, verify ordinary text character equality, source paragraph/rule sequence equality, one-for-one blank-paragraph preservation using `U+000A`, no inserted rule spacing, one-line/selectable blank and rule elements, exact table cell equality, gridless table borders, and responsive overflow.

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
- Blank media surfaces remain for `ED23002`, `PD23006`, `PD14007`, `TL14009`, `PH14011`, `ED24014`, `AE23016`, `AE24017`, and `TL24019` until real photography is supplied.
- Former `PL-*` placeholder URLs and `/products/prdm-cosmos-hoodie` redirect to the matching synced product-number routes.

## Sync correction: 2026-08-09

- Re-read `網站參照!A1:U200` and retained all 139 sheet SKUs on their matching variants. SKUs remain data-only and are not rendered.
- Replaced generic product illustrations with unlabelled blank media for products without real photography.
- Rebuilt Doc copy so ordinary text characters remain exact; dash-only lines and structurally confirmed size tables are transformed.
- Audited all 19 current Docs: each contains one confirmed size table; two use two data columns and 17 use three.

## Copy-spacing correction: 2026-08-10

- Verified through the live Google Docs API that Docs paragraph terminators and blank paragraphs use `U+000A`; the checked-in snapshot's `U+000D U+000A` is a transport-level Windows line ending.
- Removed the `U+00A0` blank-line substitute. Each source blank paragraph now renders one-for-one as its selectable `U+000A`, preserving any whitespace before it.
- Removed automatic blank insertion and collapse around horizontal rules. A dash-only line changes only into the one-line visual rule and does not modify either neighbor.
- Kept the size-table detector and exact ordinary-text/table-cell preservation intact.
- Added regression coverage for preserved consecutive blanks, unchanged missing rule blanks, Unicode and zero-width spacing, arbitrary table labels, arbitrary cell formats, and uncertain non-table blocks.

## Improvement notes

- Add a small authenticated exporter when a stable Google service credential is available; until then, the Drive/Sheets connector plus the signed-in browser is the supported capture path.
- If category becomes a sheet column, replace title inference with that explicit field.
- If per-color galleries are added, extend the image columns with an explicit color association instead of inferring it from filenames.
- Keep this document's sync record and edge cases current after each import.
