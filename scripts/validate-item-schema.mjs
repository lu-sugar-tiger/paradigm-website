import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  completeItemIdentifiers,
  mapSheetItemRow,
  migrateItemCatalog,
  itemPriceLabel,
  validateItemCatalog
} from "./lib/item-schema.mjs";

const sample = completeItemIdentifiers({ lotId: "　#ed14001-c01-s1-l1 " });
assert.deepEqual(sample, {
  lotId: "ED14001-C01-S1-L1", sku: "ED14001-C01-S1", lotCode: "L1",
  itemCode: "ED14001", itemColorCode: "C01", itemSizeCode: "S1",
  itemLineCode: "ED", itemTypeCode: "14", itemSequence: "001"
});
assert.equal(completeItemIdentifiers({ itemLineCode: "ED", itemTypeCode: "14", itemSequence: "001", itemColorCode: "C01", itemSizeCode: "S1", lotCode: "L1" }).lotId, sample.lotId);
assert.throws(() => completeItemIdentifiers({ itemCode: "ED14001", itemSequence: "002" }), /Conflicting itemSequence/);
assert.throws(() => completeItemIdentifiers({ itemCode: "ED14001", sku: "PD14007-C01-S1" }), /Conflicting itemCode/);
assert.throws(() => completeItemIdentifiers({ itemCode: "ED14001", itemSequence: 1 }), /strings/);

const mapped = mapSheetItemRow(
  ["　商品名称", "ITEM_CODE", "item_color_code", "ItemSizeCode", "ItemColorName", "商品尺寸", "商品定價", "SalePrice", " link ", "顯示", "售罄", "商品文案", "商品圖片 1", "商品圖片 0", "備註"],
  ["　PRDM  Everyday　Tee", " #ed14001", " C01", " S1", " Black", " M", "  NT$ 1,180  ", " 0", " https://shopee.tw/example", " TRUE", " FALSE", " https://docs.google.com/document/d/example/edit", " https://drive.google.com/file/d/second/view", " https://drive.google.com/file/d/main/view", "keep as unmapped"],
  { aliases: { 商品名称: "itemName" } }
);
assert.equal(mapped.record.itemName, "PRDM  Everyday　Tee", "Interior spaces must survive");
assert.equal(mapped.record.itemSequence, "001");
assert.equal(mapped.record.sku, "ED14001-C01-S1");
assert.equal(mapped.record.listPrice, 1180);
assert.equal(mapped.record.salePrice, 0, "Zero is a supplied price");
assert.equal(mapped.record.link, "https://shopee.tw/example");
assert.equal(mapped.record.visible, true);
assert.equal(mapped.record.soldOut, false);
assert.deepEqual(mapped.record.descriptionSource, { link: "https://docs.google.com/document/d/example/edit" });
assert.deepEqual(mapped.record.images.map((image) => image.index), [0, 1]);
assert.deepEqual(mapped.unmappedHeaders, ["備註"]);
assert.deepEqual(mapSheetItemRow(["SalePrice"], ["　"]).record, {});
assert.equal(mapSheetItemRow(["\u00a0商品名稱\u00a0"], ["\u00a0PRDM  Tee\u00a0"]).record.itemName, "PRDM  Tee");
assert.throws(() => mapSheetItemRow(["商品型號", "item_code"], ["ED14001", "ED14002"]), /Conflicting/);
assert.throws(() => mapSheetItemRow(["SalePrice"], ["1,2abc"]), /Invalid salePrice/);
assert.throws(() => mapSheetItemRow(["顯示"], ["perhaps"]), /Invalid visible/);
assert.throws(() => mapSheetItemRow(["商品文案"], ["Doc chip label"]), /Invalid URL/);
assert.throws(() => mapSheetItemRow(["link"], ["javascript:alert(1)"]), /HTTP/);
assert.throws(() => mapSheetItemRow([], [], { aliases: { 商品名稱: "itemCode" } }), /Ambiguous alias/);

const content = "　•  Keep  every　space\n\n-\n\n  M　XL\n胸寬 50 55\n衣長 60 65\n\n#ED14001  \n";
const legacy = {
  schemaVersion: 2, source: { sheetName: "網站參照" },
  products: [{
    productNumber: "ED14001", title: "PRDM Everyday Tee", price: 590,
    shopeeUrl: "https://shopee.tw/example", document: { id: "doc", content, modifiedTime: "unchanged" },
    images: [{ index: 0, id: "image", derivatives: [{ sha256: "retained" }] }],
    localImages: ["existing.webp"], imageSource: "preserved-existing",
    variants: [
      { sku: "ED14001-C01-S1", color: "Black", size: "M", visible: true, soldOut: false },
      { sku: "ED14001-C01-S1", color: "Black", size: "M", visible: false, soldOut: true }
    ]
  }]
};
const before = structuredClone(legacy);
const migrated = migrateItemCatalog(legacy);
assert.deepEqual(legacy, before, "Migration must not mutate its input");
assert.equal(migrated.items[0].descriptionSource.content, content, "Document text is outside scalar trimming");
assert.deepEqual(migrated.items[0].images, legacy.products[0].images, "Image metadata must be exact");
assert.equal(migrated.items[0].salePrice, null, "Missing prices are not invented");
assert.equal(migrated.items[0].variants.length, 2, "Source rows must not be silently merged");
assert.deepEqual(migrated.items[0].variants[0].lots, [], "Missing lots are not invented");
assert.equal(migrated.items[0].code, legacy.products[0].productNumber);
assert.equal(migrated.items[0].name, legacy.products[0].title);
assert.equal(migrated.items[0].listPrice, legacy.products[0].price);
assert.equal(migrated.items[0].sequence, "001");
assert.equal(migrated.items[0].variants[0].colorName, "Black");
assert.equal(migrated.items[0].variants[0].sizeName, "M");
assert.equal(itemPriceLabel(migrated.items[0]), "NT$590");
assert.deepEqual(migrateItemCatalog(migrated), migrated, "Migration must be idempotent");
const unpriced = structuredClone(migrated);
unpriced.items[0].listPrice = null;
validateItemCatalog(unpriced);
assert.throws(() => itemPriceLabel(unpriced.items[0]), /Missing website price/);
migrated.items[0].salePrice = 0;
assert.equal(itemPriceLabel(migrated.items[0]), "NT$0");
migrated.items[0].variants[0].lots.push({ code: "L1", id: "ED14001-C01-S1-L1" });
validateItemCatalog(migrated);
const version3 = {
  ...structuredClone(migrated), schemaVersion: 3,
  items: migrated.items.map(({ name, code, lineCode, typeCode, sequence, variants, ...item }) => ({
    ...item, itemName: name, itemCode: code, itemLineCode: lineCode, itemTypeCode: typeCode, itemSequence: sequence,
    variants: variants.map(({ colorCode, colorName, sizeCode, sizeName, lots, ...variant }) => ({
      ...variant, itemColorCode: colorCode, itemColorName: colorName, itemSizeCode: sizeCode, itemSizeName: sizeName,
      lots: lots.map(({ code, id }) => ({ lotCode: code, lotId: id }))
    }))
  }))
};
const version3Before = structuredClone(version3);
assert.deepEqual(migrateItemCatalog(version3), migrated, "Version 3 values and supplied lots must survive renaming");
assert.deepEqual(version3, version3Before, "Version 3 migration must not mutate input");
version3.items[0].name = "Conflicting mixed-schema name";
assert.throws(() => migrateItemCatalog(version3), /Mixed schema/);
migrated.items[0].itemName = "Obsolete alias";
assert.throws(() => validateItemCatalog(migrated), /Legacy source field/);
delete migrated.items[0].itemName;
migrated.items[0].variants[0].lots[0].id = "ED14001-C01-S2-L1";
assert.throws(() => validateItemCatalog(migrated), /Conflicting sku/);

const current = validateItemCatalog(JSON.parse(await readFile(new URL("../data/products-source.json", import.meta.url), "utf8")));
console.log(`ITEM_SCHEMA_OK items=${current.items.length} aliases=true codes=true lots=true prices=true copyExact=true migrationIdempotent=true`);
