# Canonical item schema

`data/products-source.json` uses schema version `4`. The generated browser catalog also uses `items[]` and the same nested business-field names. Mapping, validation, migration, and display-price formatting live in `scripts/lib/item-schema.mjs`; the build consumes the canonical schema directly, without a legacy-name adapter.

## Naming

The default catalog order is newest to oldest: descending numeric `sequence` (the imported `itemSequence` / `ItemSequence`). Equal sequences retain source order. The home catalog and all subcollections inherit this order.

- JavaScript and JSON use lower camelCase: `name`, `salePrice`, `sku`, `colorCode`. Within an item, use `name` and `code`; within a lot, use `code` and `id`. The containing object supplies the context.
- Use singular names for one value or object (`link`, `descriptionSource`) and plural names for arrays (`items`, `variants`, `lots`, `images`, `localImages`).
- Flat import records and references to an item retain explicit `itemName`/`itemCode` names to avoid ambiguity. For example, a DOM reference uses `data-item-code`, whereas the referenced catalog item has `code`. Do not copy the flat names into nested catalog records.
- Keep semantic UI terms such as product cards, page titles, and `/products/{code}` routes. This is a data-field rename, not a redesign of CSS classes, public URLs, Google Doc metadata, or the separate Teamwear model.
- Chinese labels and PascalCase names such as `ItemName`, `SalePrice`, and `LotID` are import aliases, not additional stored fields. Other languages can use their own casing at a serialization boundary; the JSON keys remain stable.

## Field mapping

Paths below are relative to an item in `items[]`.

| Source label | Canonical path | Meaning |
| --- | --- | --- |
| 商品名稱 / ItemName | `name` | Item display name |
| 商品型號 / ItemCode | `code` | Item identity and public route code |
| 商品系列編號 / ItemLineCode | `lineCode` | Series code, e.g. `ED` |
| 商品款式編號 / ItemTypeCode | `typeCode` | Type code, e.g. `14` |
| 商品序號 / ItemSequence | `sequence` | Sequence string, e.g. `001` |
| 商品顏色編號 / ItemColorCode | `variants[].colorCode` | Color code, e.g. `C01` |
| 商品顏色名稱 / 商品顏色 / ItemColorName | `variants[].colorName` | Source color name |
| 商品尺寸編號 / ItemSizeCode | `variants[].sizeCode` | Size code, e.g. `S1` |
| 商品尺寸名稱 / 商品尺寸 / ItemSizeName | `variants[].sizeName` | Source size name; never inferred from its code |
| 存貨單位 / Sku | `variants[].sku` | Item + color + size identity |
| 存貨批次 / LotCode | `variants[].lots[].code` | Batch code, e.g. `L1` |
| 存貨批次單位 / LotID | `variants[].lots[].id` | SKU + batch identity |
| 商品定價 / ListPrice | `listPrice` | Numeric list price, or `null` when unknown |
| 商品售價 / SalePrice | `salePrice` | Numeric selling price, or `null` when unspecified |
| 商品連結 / 連結 / Link | `link` | Purchase destination; currently Shopee |
| 商品文案 | `descriptionSource` | Resolved Doc record, including exact `content` and `modifiedTime` |
| 商品圖片 0 | `variantImages[]`, `variants[].imageId` | Variant cover image; shared across blank rows of the same item and color; independent of gallery replacement |
| 商品圖片 1 … 商品圖片 9 | `images[]` | Ordered item gallery records; nonempty source replaces the old gallery |
| 隱藏 (current), 顯示 (legacy) | `variants[].visible` | Invert 隱藏; 顯示 is positive visibility; contradictory flags fail |
| 售罄 | `variants[].soldOut` | Boolean detail-page availability flag |

`colorCode` is a business identifier, not the website's semantic `colorId` in `data/colors.json`. They must not be substituted for one another.

Identity example (not a claim about the current Sheet's size names or lots):

```json
{
  "name": "PRDM Everyday Tee",
  "code": "ED14001",
  "lineCode": "ED",
  "typeCode": "14",
  "sequence": "001",
  "variants": [{
    "sku": "ED14001-C01-S1",
    "colorCode": "C01",
    "colorName": "Black",
    "sizeCode": "S1",
    "sizeName": "M",
    "lots": [{ "code": "L1", "id": "ED14001-C01-S1-L1" }]
  }]
}
```

## Import boundary

1. Resolve Google Sheets rich-link chips to actual URLs before mapping. The mapper does not fetch Google Drive or turn chip labels into URLs.
2. Call `mapSheetItemRow(headers, values, { aliases })` for each row. It returns a flat `record` plus `unmappedHeaders`. Group mapped records by flat `itemCode` during capture, then map into the nested paths in the table above: `itemCode → code`, `itemName → name`, `itemColorName → variants[].colorName`, `lotId → variants[].lots[].id`, etc. Resolve `descriptionSource.link` and image links into the existing content/media records before publishing the snapshot. This is a mapping utility, not an authenticated sync service.
3. Trim leading and trailing Sheet scalar whitespace, including ordinary, no-break, and ideographic spaces. Preserve interior spaces and text spelling. Header comparison also ignores case, whitespace, underscores, and hyphens, so `ItemCode`, `item_code`, and `ITEM-CODE` match. This does **not** normalize Google Docs content or table cells.
4. Keep all identifiers as strings to preserve leading zeros. Normalize identifier letters to uppercase and omit a leading display `#`. The current grammar is alphabetic series + two-digit type + three-digit sequence; SKU appends `-C{digits}-S{digits}`; lot identity appends `-L{digits}`. Derive missing components only from this unambiguous grammar; reject disagreements. If code formats evolve, change the grammar and its tests explicitly.
5. Accept explicit aliases only; do not guess translations or fuzzy-match unknown labels. `ProductName` and `ProductCode` are supported aliases. Add platform-specific labels with, for example, `{ aliases: { 商品名称: "itemName" } }`. Review `unmappedHeaders`; conflicting aliases or conflicting non-empty duplicate fields fail validation.
6. Empty row cells are omitted, so a blank variant row field cannot erase an item-level value supplied elsewhere. Conflicting non-empty item-level values across grouped rows require resolution, not last-row-wins behavior. An intentional deletion must be explicit in the capture workflow.
7. Prices are finite, non-negative numbers. The mapper accepts plain numbers and formatted strings such as `NT$ 1,180`; it rejects malformed values. Flags accept native booleans or `TRUE`/`FALSE`, not JavaScript truthiness. URLs must use HTTP or HTTPS.
8. Do not invent sale prices, size names, lot records, or inventory quantities. Store missing sale prices as `null` and absent lots as `[]`. `itemPriceLabel()` formats `salePrice ?? listPrice` into the generated `priceLabel`; zero is a supplied price, not a missing value. Numeric `listPrice` and `salePrice` remain numeric in the browser catalog. At least one price is needed to generate the website.
9. Preserve source variant rows during migration, including existing repeated SKUs. The current snapshot is not a normalized inventory database; do not merge rows or resolve stock conflicts silently. Lots are descriptive records only, not inventory synchronization.
10. Preserve descriptions, media relationships, derivative hashes/paths, local photography, and independent source modification times. Description rendering continues to follow [the exact-text contract](product-sync.md#rich-description-normalization-contract).

## Migration and website boundary

| Previous source field | Version 3 source field | Version 4 source and website field |
| --- | --- | --- |
| `products` | `items` | `items` |
| `productNumber` | `itemCode` | `code` |
| `title` | `itemName` | `name` |
| `price` | `listPrice`, plus nullable `salePrice` | `listPrice`, `salePrice`; website adds `priceLabel` |
| `shopeeUrl` | `link` | `link` |
| `document` | `descriptionSource` | Source retains `descriptionSource`; website derives `description` tokens |
| `variants[].color` | `variants[].itemColorName` | `variants[].colorName` |
| `variants[].size` | `variants[].itemSizeName` | `variants[].sizeName` |

The legacy-name adapter has been removed. Renderers, option availability, related products, and the generated browser catalog all read the context-based names. Search index schema version 2 uses `items[].name`, `code`, `type`, and `priceLabel`; its separate `pages[].title` field remains a page title. Search intentionally omits purchase links and full descriptions.

Do not store duplicate old/new aliases or hand-edit generated files. The validator rejects obsolete nested keys. Existing image record names remain unchanged; media schema redesign is separate work. All `/products/{code}` URLs remain unchanged. Changed scripts and the search-index URL are cache-versioned together.

```powershell
node scripts/migrate-item-schema.mjs          # Validate/dry run; no write
node scripts/migrate-item-schema.mjs --write  # Migrate v1/v2/v3 locally; v4 is unchanged
node scripts/migrate-item-schema.mjs --check
node scripts/validate-item-schema.mjs
node scripts/build-site.mjs --check
node scripts/validate-product-catalog.mjs
node scripts/validate-search.mjs
node scripts/validate-shared-components.mjs
```

The migration preserves supplied prices and lots, all source variant rows, exact Doc content, imagery, and modification metadata. For v1/v2 it adds derived identity components, `salePrice: null`, and `lots: []` where absent; for v3 it only renames the nested fields. It does not fetch new Sheet data. Re-running it on version 4 validates without rewriting the file.
