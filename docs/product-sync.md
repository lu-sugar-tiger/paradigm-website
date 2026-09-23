# Google Drive product sync

Paradigm's product source is the Google Sheet [商品列表](https://docs.google.com/spreadsheets/d/1vt4wTxgUujj6L_p_I-zqzcpWvWZwACp4O1JRQlf2t9M/edit), tab `網站參照`. The website remains static: Google Drive is read during a maintenance sync, then the resulting local catalog and product routes are committed with the site.

## Source mapping

The local snapshot uses schema version 4 and canonical lower-camelCase item fields. See [the complete item schema](item-schema.md) for all identifier components, color/size codes, lots, aliases, normalization rules, and the source-to-website generation. Sheet labels are import aliases, not JSON keys.

| Sheet field | Website behavior |
| --- | --- |
| `商品型號` | `code`: groups all rows into one item and becomes `/products/{code}`. |
| `商品名稱` | `name`: product name. |
| `商品定價` | `listPrice`: numeric list price. |
| `商品售價` | `salePrice`: numeric selling price, or `null` when unspecified; display this when supplied, otherwise `listPrice`. |
| `商品連結`, `連結` | `link`: external purchase URL. If absent throughout the item, use `data/store-links.json` → `shopee`, also used by the footer. |
| `商品文案` | `descriptionSource`: Google Doc source. Import from the first bullet through the last non-empty line. |
| `商品圖片 0` | Main image. |
| `商品圖片 1` … `商品圖片 8` | Gallery images in column order. |
| `商品圖片 9` | Color/variant photo: stored once in `variantImages[]`, referenced by `variants[].imageId`. |
| `存貨單位` | `variants[].sku`: kept in the repository snapshot and browser catalog, but not rendered on the website. |
| `商品顏色名稱` / `商品顏色`, `商品尺寸名稱` / `商品尺寸` | `variants[].colorName`, `variants[].sizeName`: source option names; website options are deduplicated from visible rows. |
| `存貨批次`, `存貨批次單位` | `variants[].lots[].code`, `variants[].lots[].id`: optional batch identities, without inventory logic. |
| `隱藏` | `TRUE` → `visible: false`; `FALSE` → `visible: true`. Publish an item if any variant is visible. Require explicit flags. Legacy `顯示` remains a positive alias; contradictory simultaneous flags fail. |
| `售罄` | Disables the corresponding option on product detail pages. The purchase action becomes `Sold out` when every visible variant is sold out. Collection cards do not show a sold-out state. |

Category is not present in the sheet. The current deterministic mapping is: shorts → `Bottoms`; hoodies and crewnecks → `AW Tops`; tees and jerseys → `SS Tops`.

## Files and responsibilities

- `data/products-source.json` is the connector-captured snapshot used for generation. Version 4 stores grouped `items`, Doc copy, local image paths, source modification times, and variant SKUs.
- `data/products-sheet.json` retains the bounded resolved Sheet values and metadata, including all hidden rows and SKUs, for audit/replay.
- `scripts/lib/catalog-sync.mjs` owns sparse inheritance and replacement rules. `scripts/sync-product-catalog.mjs` prepares derivatives and a candidate snapshot; only `--apply` replaces the active catalog.
- `scripts/lib/item-schema.mjs` defines canonical aliases, resolved Sheet-row mapping, identity validation, migration, and the shared display-price formatter. `scripts/validate-item-schema.mjs` exercises that contract without accessing Drive.
- `scripts/lib/rich-description.mjs` preserves ordinary source text and blank paragraphs in source order, turns dash-only lines into horizontal dividers without changing their neighbors, identifies hashtag lines, and turns positively detected rectangular size blocks into semantic tables. The same contract serves Product Detail and Teamwear Customize.
- `scripts/build-site.mjs` builds the catalog and every shared static page. `scripts/build-product-catalog.mjs` delegates to it for backward compatibility.
- `scripts/templates/product-page.html` is product composition only; the shared shell, choices, actions, product cards, navigation, and footer come from `scripts/lib/site-renderers.mjs`.
- `data/colors.json` is the canonical product and Teamwear color registry. Option data stores `colorId`, never a local hex value.
- `scripts/validate-product-catalog.mjs` verifies source coverage, colorway completeness, routes, images, purchase links, product-detail sold-out behavior, and the exact copy-token contract.
- `assets/images/catalog/` stores published content-addressed derivatives. Original downloads remain in a local staging directory, not public assets.

## Sparse rows and replacement rules

1. Resolve a populated cell first, then matching item-code + color-code rows, then the item-code group. Apply independently to purchase links, Doc links, and gallery slots 0–8. Blank size rows must not erase populated siblings.
2. The first populated value in Sheet order is the item default. Explicit row/color differences remain variant overrides (`link`, `descriptionSource`, `images`). Conflicting item names, duplicate SKUs, missing flags, unresolved files, and omitted previous item codes stop the import. Visible prices must agree; differing hidden-row prices remain variant overrides.
3. Any supplied gallery slot 0–8 replaces the entire old gallery relationship. Rebuild only from the new resolved slots and clear old `localImages`; never append stale old slots. If every 0–8 cell is blank, preserve existing `images`, `localImages`, and `imageSource` exactly.
4. Image 9 is independent of gallery replacement. Inherit it within the same item and color regardless of which size row supplies it. Image 9 alone never clears the gallery. Missing image 9 retains that color's previous image when available, never another color's photo.
5. Missing purchase links use the shared store URL, never a stale previous product link. Missing Doc links retain previous copy when present. A new visible item still requires a valid description before the site builds.
6. Initial page/card media remains image 0. Changing color moves its matching photo to the front of the existing gallery without duplicating it. A color photo not already in the gallery is added with responsive sizes and keyboard enlargement. Missing image 9 leaves the gallery unchanged.
7. Purchase actions honor variant link overrides. This capture has no differing per-color descriptions/galleries; review their presentation if a future source introduces them rather than silently assuming one description fits all colors.

## Refresh workflow

1. Read spreadsheet metadata first and record its `modifiedTime`. `商品列表` is the file title; `網站參照` is the website tab (currently ID `2112278065`). Inspect bounded headers and key columns before reading data. The 2026-09-22 capture is `A1:U188`; do not use the separate inventory tab named `商品列表`.
2. Read rich-link chip metadata for `商品文案` and `商品圖片` cells. Plain cell values contain chip labels, not the underlying Drive URLs.
3. Map resolved rows with `mapSheetItemRow()` and group by flat `itemCode`, then map to nested `items[].code` and the schema paths documented above. Trim alignment whitespace only at the Sheet scalar/header boundary, never in fetched Doc text. Carry item-level values from whichever row contains them; resolve conflicts explicitly. Retain variant SKU, color/size codes and names, visibility, sold-out flags, and any supplied lot records. Review unmapped headers. Do not silently deduplicate source rows.
4. For every linked Google Doc, read the current file and record its file ID and `modifiedTime`. Copy from the first bullet through the last non-empty line, then apply the complete product-description contract below.
5. For every linked image, record file ID and `modifiedTime`, then download the original through an authenticated Drive session. Pass that local source to `scripts/generate-product-images.mjs`; `商品圖片 0` remains first only in the product-media relationship and is never encoded into a generated filename.
6. Apply the sparse/replacement rules above. Do not delete shared image files merely because an item stopped referencing them. If no real photography exists, retain the existing shared decorative fallback defined in `data/product-image-fallback.json`.
7. Update `data/products-source.json`, then regenerate and validate:

   ```powershell
   node scripts/validate-item-schema.mjs
   node scripts/build-site.mjs
   node scripts/build-site.mjs --check
   node scripts/validate-product-catalog.mjs
   node scripts/validate-shared-components.mjs
   ```

## Product-image derivatives

### Connector capture and repeatable import

Capture reads without writing to Google Drive. Use one local staging directory containing:

- `sheet.json`: `{ spreadsheetId, sheetName, sheetId, range, spreadsheetModifiedTime, rows }`. The first row contains headers. Prefer typed `effectiveValue`; resolve `hyperlink`, rich-link `chipRuns`, or `textFormatRuns` URLs instead of chip display labels.
- `resources.json`: keyed by Drive file ID, each value `{ url, metadata, document? }`. Metadata uses connector fields `title`, `mime_type`, `modified_time`. Docs use the native response's paragraph `textRun.content`, not Markdown extraction.
- `originals/{fileId}.jpg` or `.png`: original bytes from the authenticated Drive connector's returned download reference.

Run `node scripts/sync-product-catalog.mjs <capture-directory>` first. Review `candidate.json` and `report.json`, then rerun with `--apply`. The importer updates the source catalog and resolved Sheet snapshot only after all resources resolve. Generated image families are cached by file ID and modification time; local derivative files must also exist before reuse. Keep staging inputs locally for comparison, but never commit signed download URLs.

Run `validate-catalog-sync.mjs`, `validate-item-schema.mjs`, `build-site.mjs`, `build-site.mjs --check`, `validate-description-rendering.mjs`, and `validate-product-catalog.mjs`. The strict catalog validator requires the original ignored fallback artwork. When it is unavailable, `--published-assets-only` explicitly omits only that original-artwork hash check and still checks every published derivative, image relationship, route, and description. Do not report this mode as a complete original-source audit.

- Generate exactly three lossy WebP derivatives at quality `100`, with short edges of `540`, `1080`, and `2160` pixels.
- Preserve the source aspect ratio without cropping. For example, a 5:4 landscape image produces `675x540`, `1350x1080`, and `2700x2160` derivatives.
- Generated paths are content-addressed and contain no product number, filename, or gallery index: `assets/images/catalog/{hash-prefix}/{hash-prefix}-{width}x{height}.webp`.
- Store the complete 64-character SHA-256 in `data/products-source.json`. Public filenames start with a 20-character prefix; if that candidate collides with different bytes, the generator extends the prefix until it is unique.
- Hash the final WebP bytes. Different resolutions therefore have different hashes and paths. Their shared source identity and gallery order remain database relationships.
- The generated catalog retains `image` and `images` as fallback paths and adds `media[].derivatives` for native `srcset` rendering. Cards and product-detail galleries use the same derivative family with context-specific `sizes` values.
- The shared missing-photo fallback uses the square `assets/temp/Aesthetics_Logo_InitialA[0.1.1].png` source at `6.25%` opacity over white. It is flattened to opaque RGB WebP at the same three sizes without cropping and is excluded from product-image zoom behavior.
- The generator requires Sharp to be resolvable by Node. No runtime image library is shipped to website visitors.

Generate one image record:

```powershell
node scripts/generate-product-images.mjs --input path/to/downloaded-source.jpg
```

Refresh derivative records for the current Sheet-backed image entries whose `localPath` files are available:

```powershell
node scripts/generate-product-images.mjs --catalog data/products-source.json
```

8. Serve the repository over HTTP and check the all-products page plus representative available, sold-out-detail, fallback-image, and multi-image products on mobile and desktop. Confirm collection cards never display sold-out or placeholder labels.

## Rich-description normalization contract

Apply these rules in this order. This is the complete contract; do not add inferred formatting.

1. **Source range:** Import from the first bullet line through the last line containing a non-space character. Ignore content before the first bullet and trailing empty paragraphs after the final line.
2. **Ordinary text is exact:** Never trim, normalize, retype, split, join, or change an ordinary text line. Preserve leading/trailing spaces, repeated spaces inside the line, Unicode space types, punctuation, letter width, mathematical glyphs, and number formats.
3. **Blank paragraphs are exact:** Google Docs represents every paragraph terminator, including an otherwise empty paragraph, with `U+000A`. Preserve every source blank paragraph one-for-one and render its `U+000A` as a one-line selectable character. Preserve any whitespace preceding that terminator. Do not replace it with `U+00A0`, collapse consecutive blank paragraphs, or insert or remove blank paragraphs. A stored snapshot may contain `U+000D U+000A`; normalize that transport-level line ending to the Google Docs `U+000A` representation while parsing.
4. **One-line horizontal divider:** Treat a line whose only non-space character is the ASCII `-` as a divider. Render one `divider` token containing the literal selectable `-`, visually replaced by an On Surface Low horizontal line, with the same one-line height as ordinary copy. Do not insert, remove, or collapse neighboring blank paragraphs.
5. **Size-table recognition:** Detect a table from the raw source lines before transforming dash-only lines. A candidate must be blank-separated, have at least two header cells, and have at least two following rows whose cell counts form a compatible rectangle with one row-heading cell and at most one optional trailing cell. Split candidate cells using all Unicode whitespace plus `U+180E`, `U+200B`, `U+2060`, and `U+FEFF`.
6. **No table-content assumptions:** Never identify or reject a table based on particular size names, dimension names, languages, units, or numeric formats. Preserve every detected cell value in the source and tokens exactly. At rendering only, convert mathematical sans-serif digits `𝟢`–`𝟫` (`U+1D7E2`–`U+1D7EB`) to regular `0`–`9` inside confirmed table cells. Do not apply `trim`, `NFKC`, numeric parsing, other character substitutions, or this conversion outside tables. Decimal places, punctuation, units, labels, and spacing remain unchanged.
7. **Uncertainty stays plain:** If a candidate has fewer than two body rows, inconsistent widths, or an unbounded non-blank continuation, do not make a table. Leave every line in that candidate as ordinary text.
8. **Gridless semantic output:** Render a confirmed table with `<table>`, column headers, and row headers. Do not show grid lines. Preserve the source blank paragraphs before and after the table one-for-one.
9. **Hashtag recognition and links:** Outside a confirmed table, treat any line whose first non-space character is `#` as a `hashtag` token. Preserve the complete source line exactly and render it in On Surface Low without changing its Body role, spacing, wrapping, or emphasis. At rendering only, wrap a hashtag referencing another published item in a native link to `/products/{code}`, including inline mentions in ordinary text. Match codes case-insensitively and preserve the original hashtag spelling and any hyphenated suffix in the linked text. Self-references, unknown/unpublished codes, larger nonmatching identifiers, and URL fragments remain plain text. Links inherit the existing color and typography with no added underline, icon, label, or spacing; retain native keyboard focus.
10. **No other transformations:** Do not infer bullet groups, prose sections, fit guidance, product codes, measurement types, or separator spacing. Apart from dash-only dividers, hashtag classification, and confirmed tables, the only rendering changes are the specific table-digit substitution and native cross-product hashtag links described above.
11. **Required validation:** For every description, verify ordinary text character equality, source token sequence equality, one-for-one blank-paragraph preservation using `U+000A`, no inserted divider spacing, one-line/selectable blank and divider elements, exact hashtag text, exact table cells except the specified rendered digit substitution, gridless table borders, and responsive overflow. Run `node scripts/validate-description-rendering.mjs` for table-digit and hashtag-link regressions, including fixtures when the current snapshot contains only self-references.

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
- The shared logo fallback appears for `ED23002`, `PD23006`, `PD14007`, `TL14009`, `PH14011`, `ED24014`, `AE23016`, `AE24017`, and `TL24019` until real photography is supplied.
- Former `PL-*` placeholder URLs and `/products/prdm-cosmos-hoodie` redirect to the matching synced product-number routes.

## Sync correction: 2026-08-09

- Re-read `網站參照!A1:U200` and retained all 139 sheet SKUs on their matching variants. SKUs remain data-only and are not rendered.
- Replaced blank media with one unlabelled, low-opacity brand fallback for products without real photography.
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
- Variant image associations use explicit row item/color codes, not filenames. Review future differing per-color descriptions/galleries before publication.
- Keep this document's sync record and edge cases current after each import.

## Sync record: 2026-09-22

- Spreadsheet modified `2026-09-22T07:20:39.047Z`; captured `網站參照!A1:U188`.
- Imported 28 item codes and all 187 SKU rows: 23 visible items and five fully hidden `ZZ` items. Refreshed all 23 linked Docs with exact native paragraph text. Every visible description has one confirmed table.
- Added `PD14025`, `AE14026`, `TL14027`, and `BD14028`; empty purchase links use the footer store URL.
- Replaced `ED14001` and `ED23002` galleries with eight photos each. Generated 48 quality-100 WebPs from 16 originals. Image 9 references three and two color photos respectively, reusing matching gallery derivatives.
- Preserved all other previous image relationships, including eight `ED14024` photos despite its now-empty Sheet image cells.
- C03 Charcoal retains the former Shadow swatch value. C06 Dove uses the user-specified `#A1A1A1`.
- `ZZ23004` has differing prices on hidden rows; retained as variant overrides without publishing it.
- Original `assets/temp/Aesthetics_Logo_InitialA[0.1.1].png` is unavailable locally. Its deployed fallback derivatives are unchanged and independently verified.
- Verification: capture replay, schema, exact description rendering, deployed image hashes, shared components, search, catalog filters, generation freshness, and whitespace checks passed. Browser checks covered all 23 routes and 390/768/1440px, color-photo selection, native gallery positioning, keyboard enlargement, and overflow. No application errors or failed local assets. Google Fonts requests failed in the test environment, so final external font/icon appearance was not verified.

## Sync record: 2026-09-23

- Spreadsheet modified `2026-09-23T06:17:47.866Z`. The website tab remains `網站參照!A1:U188`, with 28 item codes, 23 visible items, and 187 SKU rows. The only changed Sheet cells are image links; the layout, visibility, prices, purchase links, and Doc links are unchanged.
- Checked the metadata of all 23 linked Docs and all 168 linked image files. Every Doc and the 16 previously processed images retained its file ID and `modifiedTime`. The Docs' native paragraph text was read again without changing the rendered copy.
- Imported 152 new original photos. Verified downloaded byte counts, then generated three quality-100, aspect-preserving WebPs per new photo. The catalog now references 168 unique Drive images and 504 responsive derivatives. Original downloads remain in the ignored local sync staging folder.
- Replaced the galleries of the 21 items that gained image links, including `ED14024` whose earlier gallery had different files. The two items without new gallery links, `ED14001` and `ED23002`, retained their existing photo relationships. `商品圖片 9` still belongs to each row's color code, including when only one size row supplies it.
- All 23 visible items now have real product photography; none uses the shared decorative fallback. The old fallback assets are untouched. The `--published-assets-only` catalog check verifies deployed derivatives while the ignored original logo source remains unavailable locally.
- Validation passed for captured-row replay, item schema, product catalog and image hashes, exact description rendering, search, shared components, generation freshness, and `git diff --check`. HTTP browser checks at 390, 768, and 1440px covered all 23 product routes, representative new and retained galleries, color selection, keyboard enlargement, and positive horizontal overflow; no application errors or failed local assets were found. Google Fonts requests failed in the test environment, so external font/icon appearance could not be verified there.
