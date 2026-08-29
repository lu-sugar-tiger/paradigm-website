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
- `scripts/lib/rich-description.mjs` preserves ordinary source text and blank paragraphs in source order, turns dash-only lines into horizontal dividers without changing their neighbors, identifies hashtag lines, and turns positively detected rectangular size blocks into semantic tables. The same contract serves Product Detail and Teamwear Customize.
- `scripts/build-site.mjs` builds the catalog and every shared static page. `scripts/build-product-catalog.mjs` delegates to it for backward compatibility.
- `scripts/templates/product-page.html` is product composition only; the shared shell, choices, actions, product cards, navigation, and footer come from `scripts/lib/site-renderers.mjs`.
- `data/colors.json` is the canonical product and Teamwear color registry. Option data stores `colorId`, never a local hex value.
- `scripts/validate-product-catalog.mjs` verifies source coverage, colorway completeness, routes, images, purchase links, product-detail sold-out behavior, and the exact copy-token contract.
- `assets/images/products/{商品型號}/` stores downloaded product imagery when the sheet supplies images.

## Refresh workflow

1. Read spreadsheet metadata first and record its `modifiedTime`. Resolve the exact `網站參照` tab and read a bounded range, currently `A1:U200`.
2. Read rich-link chip metadata for `商品文案` and `商品圖片` cells. Plain cell values contain chip labels, not the underlying Drive URLs.
3. Group rows by `商品型號`. Carry product-level values from whichever row contains them and retain variant SKU, visibility, and sold-out flags.
4. For every linked Google Doc, read the current file and record its file ID and `modifiedTime`. Copy from the first bullet through the last non-empty line, then apply the complete product-description contract below.
5. For every linked image, record file ID and `modifiedTime`, then download the original through an authenticated Drive session. Pass that local source to `scripts/generate-product-images.mjs`; `商品圖片 0` remains first only in the product-media relationship and is never encoded into a generated filename.
6. If a product has no sheet image links, preserve existing real product photography in `localImages`. If no real photography exists, keep `localImages` empty and render an unlabelled blank media surface. Do not create or reuse placeholder artwork.
7. Update `data/products-source.json`, then regenerate and validate:

   ```powershell
   node scripts/build-site.mjs
   node scripts/build-site.mjs --check
   node scripts/validate-product-catalog.mjs
   node scripts/validate-shared-components.mjs
   ```

## Product-image derivatives

- Generate exactly three lossy WebP derivatives at quality `100`, with short edges of `540`, `1080`, and `2160` pixels.
- Preserve the source aspect ratio without cropping. For example, a 5:4 landscape image produces `675x540`, `1350x1080`, and `2700x2160` derivatives.
- Generated paths are content-addressed and contain no product number, filename, or gallery index: `assets/images/catalog/{hash-prefix}/{hash-prefix}-{width}x{height}.webp`.
- Store the complete 64-character SHA-256 in `data/products-source.json`. Public filenames start with a 20-character prefix; if that candidate collides with different bytes, the generator extends the prefix until it is unique.
- Hash the final WebP bytes. Different resolutions therefore have different hashes and paths. Their shared source identity and gallery order remain database relationships.
- The generated catalog retains `image` and `images` as fallback paths and adds `media[].derivatives` for native `srcset` rendering. Cards and product-detail galleries use the same derivative family with context-specific `sizes` values.
- The generator requires Sharp to be resolvable by Node. No runtime image library is shipped to website visitors.

Generate one image record:

```powershell
node scripts/generate-product-images.mjs --input path/to/downloaded-source.jpg
```

Refresh derivative records for the current Sheet-backed image entries whose `localPath` files are available:

```powershell
node scripts/generate-product-images.mjs --catalog data/products-source.json
```

8. Serve the repository over HTTP and check the all-products page plus representative available, sold-out-detail, blank-image, and multi-image products on mobile and desktop. Confirm collection cards never display sold-out or placeholder labels.

## Rich-description normalization contract

Apply these rules in this order. This is the complete contract; do not add inferred formatting.

1. **Source range:** Import from the first bullet line through the last line containing a non-space character. Ignore content before the first bullet and trailing empty paragraphs after the final line.
2. **Ordinary text is exact:** Never trim, normalize, retype, split, join, or change an ordinary text line. Preserve leading/trailing spaces, repeated spaces inside the line, Unicode space types, punctuation, letter width, mathematical glyphs, and number formats.
3. **Blank paragraphs are exact:** Google Docs represents every paragraph terminator, including an otherwise empty paragraph, with `U+000A`. Preserve every source blank paragraph one-for-one and render its `U+000A` as a one-line selectable character. Preserve any whitespace preceding that terminator. Do not replace it with `U+00A0`, collapse consecutive blank paragraphs, or insert or remove blank paragraphs. A stored snapshot may contain `U+000D U+000A`; normalize that transport-level line ending to the Google Docs `U+000A` representation while parsing.
4. **One-line horizontal divider:** Treat a line whose only non-space character is the ASCII `-` as a divider. Render one `divider` token containing the literal selectable `-`, visually replaced by an On Surface Low horizontal line, with the same one-line height as ordinary copy. Do not insert, remove, or collapse neighboring blank paragraphs.
5. **Size-table recognition:** Detect a table from the raw source lines before transforming dash-only lines. A candidate must be blank-separated, have at least two header cells, and have at least two following rows whose cell counts form a compatible rectangle with one row-heading cell and at most one optional trailing cell. Split candidate cells using all Unicode whitespace plus `U+180E`, `U+200B`, `U+2060`, and `U+FEFF`.
6. **No table-content assumptions:** Never identify or reject a table based on particular size names, dimension names, languages, units, or numeric formats. Preserve every detected cell value exactly; do not apply `trim`, `NFKC`, numeric parsing, or typography substitution to cell contents.
7. **Uncertainty stays plain:** If a candidate has fewer than two body rows, inconsistent widths, or an unbounded non-blank continuation, do not make a table. Leave every line in that candidate as ordinary text.
8. **Gridless semantic output:** Render a confirmed table with `<table>`, column headers, and row headers. Do not show grid lines. Preserve the source blank paragraphs before and after the table one-for-one.
9. **Hashtag recognition:** Outside a confirmed table, treat any line whose first non-space character is `#` as a `hashtag` token. Preserve the complete source line exactly and render it in On Surface Low without changing its Body role, spacing, wrapping, or emphasis.
10. **No other transformations:** Do not infer bullet groups, prose sections, fit guidance, product codes, measurement types, or separator spacing. The only content transforms are dash-only dividers, hashtag classification, and confirmed tables.
11. **Required validation:** For every description, verify ordinary text character equality, source token sequence equality, one-for-one blank-paragraph preservation using `U+000A`, no inserted divider spacing, one-line/selectable blank and divider elements, exact hashtag text, exact table cell equality, gridless table borders, and responsive overflow.

Teamwear stores the current copy as a normalized `descriptionSource` record in `data/teamwear-options.json`. Local records require `{ type: "local", content }`; future Google Doc records require `{ type: "google-doc", content, documentId, modifiedTime }`. The current build does not fetch Teamwear Docs, but changing the source type later does not change parsing, rendering, or templates.

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
- Removed automatic blank insertion and collapse around horizontal dividers. A dash-only line changes only into the one-line visual divider and does not modify either neighbor.
- Kept the shared table detector and exact ordinary-text/table-cell preservation intact.
- Added regression coverage for preserved consecutive blanks, unchanged missing divider blanks, hashtags, Unicode and zero-width spacing, arbitrary table labels, arbitrary cell formats, and uncertain non-table blocks.

## Improvement notes

- Add a small authenticated exporter when a stable Google service credential is available; until then, the Drive/Sheets connector plus the signed-in browser is the supported capture path.
- If category becomes a sheet column, replace title inference with that explicit field.
- If per-color galleries are added, extend the image columns with an explicit color association instead of inferring it from filenames.
- Keep this document's sync record and edge cases current after each import.
