import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { documentText, syncCatalog } from "./lib/catalog-sync.mjs";
import { mapSheetItemRow } from "./lib/item-schema.mjs";

assert.equal(mapSheetItemRow(["隱藏"], [true]).record.visible, false);
assert.equal(mapSheetItemRow(["隱藏"], [false]).record.visible, true);
assert.throws(() => mapSheetItemRow(["隱藏", "顯示"], [true, true]), /Conflicting visible/);
assert.throws(() => mapSheetItemRow(["隱藏"], ["yes"]), /Invalid hidden/);
const exact = "Intro\n\n•  Keep　all spaces  \n\n-\n\nText\n\n#ED14001\n\n";
assert.equal(documentText({ documentId: "doc", tabs: [{ body: { content: [{ paragraph: { elements: [{ textRun: { content: exact } }] } }] } }] }), "•  Keep　all spaces  \n\n-\n\nText\n\n#ED14001");
assert.throws(() => documentText({ tabs: [{ body: { content: [{ table: {} }] } }] }), /Unsupported Doc/);

const previous = { schemaVersion: 4, source: {}, items: [{
  name: "Old Tee", code: "ED14001", lineCode: "ED", typeCode: "14", sequence: "001",
  listPrice: 590, salePrice: null, link: "https://shopee.tw/old",
  descriptionSource: { id: "old-doc", content: "• Original", modifiedTime: "old" },
  images: [{ id: "old", localPath: "old.webp" }], localImages: ["local.webp"], imageSource: "preserved-existing",
  variants: []
}] };
const headers = ["存貨單位", "商品名稱", "商品顏色", "商品尺寸", "商品定價", "隱藏", "售罄", "商品連結", "商品文案", "商品圖片 0", "商品圖片 1", "商品圖片 9"];
const url = (id) => `https://drive.google.com/file/d/${id}/view`;
const rows = [
  headers,
  ["ED14001-C01-S1", "　New Tee", "Black", "M", 590, false, false, "", "", "", "", url("black")],
  ["ED14001-C01-S2", "New Tee", "Black", "L", 590, false, true, "https://shopee.tw/item", url("doc"), url("main"), "", ""],
  ["ED14001-C09-S1", "New Tee", "White", "M", 590, true, false, "", "", "", url("back"), url("white")],
  ["ED14001-C09-S2", "New Tee", "White", "L", 590, false, false, "", "", "", "", ""]
];
const documents = { doc: { id: "doc", content: "• Exact  text\n\n-\n\nEnd", modifiedTime: "new" } };
const images = Object.fromEntries(["main", "back", "black", "white"].map((id) => [id, { id, localPath: `${id}.webp`, modifiedTime: "new" }]));
const sheet = { rows, sheetName: "網站參照", sheetId: 2112278065 };
const options = { previous, sheet, documents, images, storeLink: "https://shopee.tw/sugar.tiger", syncedAt: "fixed" };
const before = structuredClone(options);
const result = syncCatalog(options);
assert.deepEqual(options, before, "Sync must not mutate captured inputs or existing data");
const item = result.items[0];
assert.equal(item.name, "New Tee");
assert.equal(item.link, "https://shopee.tw/item");
assert.equal(item.descriptionSource.content, documents.doc.content);
assert.deepEqual(item.images.map((image) => image.id), ["main", "back"], "Sparse gallery slots inherit across item rows, replacing all old slots");
assert.deepEqual(item.localImages, []);
assert.deepEqual(item.variants.map((variant) => variant.imageId), ["black", "black", "white", "white"]);
assert.equal(item.variants[2].visible, false);
assert.equal(item.variants[1].soldOut, true);
assert.equal(item.variantImages.length, 2, "Color media is stored once, not once per size");

const noGallery = structuredClone(options);
noGallery.sheet.rows.slice(1).forEach((row) => { row[7] = ""; row[8] = ""; row[9] = ""; row[10] = ""; });
const retained = syncCatalog(noGallery).items[0];
assert.equal(retained.link, options.storeLink, "A missing link must not reuse a stale product URL");
assert.deepEqual(retained.images, previous.items[0].images, "Image 9 alone never replaces the gallery");
assert.deepEqual(retained.localImages, previous.items[0].localImages);
assert.deepEqual(retained.descriptionSource, previous.items[0].descriptionSource);
const noWhite9 = structuredClone(noGallery);
noWhite9.sheet.rows[3][11] = "";
assert.equal(syncCatalog(noWhite9).items[0].variants[2].imageId, undefined, "Never assign another color's photo");
const conflicting = structuredClone(options);
conflicting.sheet.rows[2][1] = "Another name";
assert.throws(() => syncCatalog(conflicting), /Conflicting ED14001 name/);
const duplicate = structuredClone(options);
duplicate.sheet.rows.push(duplicate.sheet.rows[1]);
assert.throws(() => syncCatalog(duplicate), /Duplicate SKU/);
const incomplete = structuredClone(options);
incomplete.sheet.rows = [headers];
assert.throws(() => syncCatalog(incomplete), /absent from capture/);
const unresolved = { ...options, images: {} };
assert.throws(() => syncCatalog(unresolved), /Unresolved image/);
const current = JSON.parse(await readFile(new URL("../data/products-source.json", import.meta.url), "utf8"));
for (const item of current.items) {
  const mediaIds = new Set((item.variantImages || []).map((image) => image.id));
  for (const variant of item.variants) if (variant.imageId) assert.ok(mediaIds.has(variant.imageId));
}
const capturedSheet = JSON.parse(await readFile(new URL("../data/products-sheet.json", import.meta.url), "utf8"));
const storeLinks = JSON.parse(await readFile(new URL("../data/store-links.json", import.meta.url), "utf8"));
const capturedDocs = Object.fromEntries(current.items.flatMap((item) => [item.descriptionSource, ...item.variants.map((variant) => variant.descriptionSource)]).filter(Boolean).map((doc) => [doc.id, doc]));
const capturedImages = Object.fromEntries(current.items.flatMap((item) => [...item.images, ...(item.variantImages || []), ...item.variants.flatMap((variant) => variant.images || [])]).map((image) => [image.id, image]));
const replayed = syncCatalog({ previous: current, sheet: capturedSheet, documents: capturedDocs, images: capturedImages, storeLink: storeLinks.shopee, syncedAt: current.source.syncedAt });
assert.deepEqual(replayed.items, current.items, "Captured Sheet rows must reproduce every current item, variant, flag, link and inherited relationship");
console.log("CATALOG_SYNC_OK hidden=true sparseInheritance=true replaceOrPreserve=true colorIsolation=true copyExact=true atomic=true");
