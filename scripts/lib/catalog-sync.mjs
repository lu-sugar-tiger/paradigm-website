import assert from "node:assert/strict";
import { mapSheetItemRow, validateItemCatalog } from "./item-schema.mjs";
import { extractDescriptionLines } from "./rich-description.mjs";

export function driveFileId(link) {
  const id = new URL(link).pathname.match(/\/d\/([^/]+)/)?.[1];
  assert.ok(id, `Missing Drive file ID: ${link}`);
  return id;
}

// Native paragraph text only. Do not flatten unrecognized structures silently.
export function documentText(document) {
  const bodies = document.tabs?.map((tab) => tab.body).filter(Boolean) || [document.body];
  assert.equal(bodies.length, 1, `Choose an explicit description tab: ${document.documentId}`);
  const text = bodies[0].content.map((node) => {
    if (node.sectionBreak) return "";
    assert.ok(node.paragraph, `Unsupported Doc structure: ${document.documentId}`);
    assert.ok(!node.paragraph.bullet, "Native list markers need an explicit extraction rule");
    return node.paragraph.elements.map((element) => {
      assert.ok(element.textRun, `Non-text Doc element: ${document.documentId}`);
      return element.textRun.content;
    }).join("");
  }).join("");
  return extractDescriptionLines(text).join("\n");
}

function firstValue(rows, getter) {
  return rows.map(getter).find((value) => value != null && value !== "" && (!Array.isArray(value) || value.length));
}

function sameValue(rows, getter, label) {
  const values = rows.map(getter).filter((value) => value != null && value !== "");
  const distinct = [...new Set(values.map((value) => JSON.stringify(value)))];
  assert.ok(distinct.length <= 1, `Conflicting ${label}`);
  return values[0];
}

export function syncCatalog({ previous, sheet, documents, images, storeLink, syncedAt, imageLayout = "variant-zero" }) {
  assert.ok(["variant-zero", "legacy"].includes(imageLayout), `Unsupported image layout: ${imageLayout}`);
  const variantIndex = imageLayout === "legacy" ? 9 : 0;
  const galleryStart = imageLayout === "legacy" ? 0 : 1;
  const [headers, ...values] = sheet.rows;
  assert.ok(headers.some((header) => String(header).trim() === "隱藏"), "This import requires the verified 隱藏 column");
  const mapped = values.map((values, index) => ({ ...mapSheetItemRow(headers, values), row: index + 2 }));
  const groups = new Map();
  for (const { record, row } of mapped) {
    if (!record.sku && !record.itemCode) continue;
    assert.ok(record.sku && record.itemCode, `Incomplete identity at row ${row}`);
    assert.equal(typeof record.visible, "boolean", `Missing 隱藏 at row ${row}`);
    assert.equal(typeof record.soldOut, "boolean", `Missing 售罄 at row ${row}`);
    if (!groups.has(record.itemCode)) groups.set(record.itemCode, []);
    groups.get(record.itemCode).push(record);
  }
  const oldItems = new Map(previous.items.map((item) => [item.code, item]));
  const imageRecord = ({ index, link }) => {
    const id = driveFileId(link);
    assert.ok(images[id], `Unresolved image: ${id}`);
    return { ...images[id], index, link };
  };
  const description = (link, fallback) => {
    if (!link) return fallback ?? null;
    const id = driveFileId(link);
    assert.ok(documents[id], `Unresolved Doc: ${id}`);
    return { ...documents[id], link };
  };
  const items = [...groups].map(([code, rows]) => {
    const old = oldItems.get(code);
    const identity = rows[0];
    const colors = new Map();
    for (const row of rows) {
      if (!colors.has(row.itemColorCode)) colors.set(row.itemColorCode, []);
      colors.get(row.itemColorCode).push(row);
    }
    const gallery = (candidates, fallback = []) => Array.from({ length: 9 }, (_, offset) => galleryStart + offset).map((index) =>
      firstValue(candidates, (row) => row.images?.find((image) => image.index === index))
        || fallback?.find((image) => image.index === index)).filter(Boolean);
    const suppliedGallery = gallery(rows);
    const itemLink = firstValue(rows, (row) => row.link) || storeLink;
    const itemDocLink = firstValue(rows, (row) => row.descriptionSource?.link);
    const visibleRows = rows.filter((row) => row.visible);
    const listPrice = firstValue(visibleRows, (row) => row.listPrice) ?? firstValue(rows, (row) => row.listPrice) ?? null;
    const salePrice = firstValue(visibleRows, (row) => row.salePrice) ?? firstValue(rows, (row) => row.salePrice) ?? null;
    sameValue(visibleRows, (row) => row.listPrice, `${code} visible list price`);
    sameValue(visibleRows, (row) => row.salePrice, `${code} visible sale price`);
    const itemImages = suppliedGallery.length ? suppliedGallery.map(imageRecord) : structuredClone(old?.images || []);
    const variantImages = new Map();
    const variants = rows.map((row) => {
      const siblings = colors.get(row.itemColorCode);
      const oldVariant = old?.variants.find((variant) => variant.sku === row.sku);
      const link = row.link || firstValue(siblings, (row) => row.link) || itemLink;
      const docLink = row.descriptionSource?.link || firstValue(siblings, (row) => row.descriptionSource?.link) || itemDocLink;
      const colorGallery = gallery([row], gallery(siblings, suppliedGallery));
      const variantImage = row.images?.find((image) => image.index === variantIndex)
        || firstValue(siblings, (row) => row.images?.find((image) => image.index === variantIndex));
      // A variant image may come from a sibling size, never a different color.
      const image = variantImage ? imageRecord(variantImage) : old?.variantImages?.find((image) => image.id === oldVariant?.imageId);
      if (image) variantImages.set(image.id, image);
      const variant = {
        visible: row.visible, soldOut: row.soldOut, sku: row.sku,
        lots: row.lotId ? [{ code: row.lotCode, id: row.lotId }] : structuredClone(oldVariant?.lots || []),
        colorCode: row.itemColorCode, colorName: row.itemColorName,
        sizeCode: row.itemSizeCode, sizeName: row.itemSizeName
      };
      if (image) variant.imageId = image.id;
      if (row.listPrice != null && row.listPrice !== listPrice) variant.listPrice = row.listPrice;
      if (row.salePrice != null && row.salePrice !== salePrice) variant.salePrice = row.salePrice;
      if (link !== itemLink) variant.link = link;
      if (docLink !== itemDocLink) variant.descriptionSource = description(docLink);
      if (colorGallery.length && JSON.stringify(colorGallery) !== JSON.stringify(suppliedGallery)) {
        variant.images = colorGallery.map(imageRecord);
      }
      return variant;
    });
    assert.equal(new Set(variants.map((variant) => variant.sku)).size, variants.length, `Duplicate SKU in ${code}`);
    return {
      ...old,
      code, name: sameValue(rows, (row) => row.itemName, `${code} name`),
      lineCode: identity.itemLineCode, typeCode: identity.itemTypeCode, sequence: identity.itemSequence,
      listPrice, salePrice,
      link: itemLink, descriptionSource: description(itemDocLink, old?.descriptionSource),
      images: itemImages,
      localImages: suppliedGallery.length ? [] : structuredClone(old?.localImages || []),
      imageSource: suppliedGallery.length ? "google-drive" : old?.imageSource || "none",
      variantImages: [...variantImages.values()], variants
    };
  });
  // Do not silently remove an item omitted from an incomplete capture.
  const absent = previous.items.filter((item) => !groups.has(item.code));
  assert.equal(absent.length, 0, `Items absent from capture; review removal explicitly: ${absent.map((item) => item.code)}`);
  return validateItemCatalog({
    ...previous,
    source: { ...previous.source, spreadsheetId: sheet.spreadsheetId, sheetName: sheet.sheetName,
      sheetId: sheet.sheetId, range: sheet.range, spreadsheetModifiedTime: sheet.spreadsheetModifiedTime, syncedAt },
    items
  });
}
