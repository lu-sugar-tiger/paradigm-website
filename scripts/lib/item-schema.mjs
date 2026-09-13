import assert from "node:assert/strict";

export const ITEM_SCHEMA_VERSION = 4;

// Field meaning is fixed here; source-specific labels belong in explicit aliases.
export const ITEM_FIELDS = Object.freeze({
  itemName: ["商品名稱", "ItemName", "ProductName"],
  itemCode: ["商品型號", "ItemCode", "ProductCode"],
  itemLineCode: ["商品系列編號", "ItemLineCode"],
  itemTypeCode: ["商品款式編號", "ItemTypeCode"],
  itemSequence: ["商品序號", "ItemSequence"],
  itemColorCode: ["商品顏色編號", "ItemColorCode"],
  itemColorName: ["商品顏色名稱", "商品顏色", "ItemColorName"],
  itemSizeCode: ["商品尺寸編號", "ItemSizeCode"],
  itemSizeName: ["商品尺寸名稱", "商品尺寸", "ItemSizeName"],
  sku: ["存貨單位", "Sku"],
  lotCode: ["存貨批次", "LotCode"],
  lotId: ["存貨批次單位", "LotID"],
  listPrice: ["商品定價", "ListPrice"],
  salePrice: ["商品售價", "SalePrice"],
  link: ["商品連結", "連結", "Link"],
  descriptionSource: ["商品文案", "DescriptionSource"],
  visible: ["顯示", "Visible"],
  soldOut: ["售罄", "SoldOut"]
});

// Only sheet headers/scalars use this. Never pass document content through it.
export function trimSheetScalar(value) {
  return typeof value === "string" ? value.trim() : value;
}

function headerKey(value) {
  return String(value ?? "").trim().replace(/[\s_-]+/gu, "").toLowerCase();
}

function code(value) {
  assert.equal(typeof value, "string", "Identifiers must be strings to preserve leading zeros");
  return value.trim().replace(/^#/, "").toUpperCase();
}

function assignMatching(record, key, value) {
  if (record[key] != null && record[key] !== "") {
    assert.equal(record[key], value, `Conflicting ${key}: ${record[key]} versus ${value}`);
  }
  record[key] = value;
}

export function completeItemIdentifiers(input) {
  const record = { ...input };
  const keys = ["itemCode", "itemLineCode", "itemTypeCode", "itemSequence", "itemColorCode", "itemSizeCode", "sku", "lotCode", "lotId"];
  for (const key of keys) {
    if (record[key] != null && record[key] !== "") record[key] = code(record[key]);
  }
  if (record.lotId) {
    const match = record.lotId.match(/^([A-Z]+\d{5}-C\d+-S\d+)-(L\d+)$/);
    assert.ok(match, `Invalid lotId: ${record.lotId}`);
    assignMatching(record, "sku", match[1]);
    assignMatching(record, "lotCode", match[2]);
  }
  if (record.sku) {
    const match = record.sku.match(/^([A-Z]+\d{5})-(C\d+)-(S\d+)$/);
    assert.ok(match, `Invalid sku: ${record.sku}`);
    assignMatching(record, "itemCode", match[1]);
    assignMatching(record, "itemColorCode", match[2]);
    assignMatching(record, "itemSizeCode", match[3]);
  }
  if (!record.itemCode && record.itemLineCode && record.itemTypeCode && record.itemSequence) {
    record.itemCode = `${record.itemLineCode}${record.itemTypeCode}${record.itemSequence}`;
  }
  if (record.itemCode) {
    const match = record.itemCode.match(/^([A-Z]+)(\d{2})(\d{3})$/);
    assert.ok(match, `Invalid itemCode: ${record.itemCode}`);
    assignMatching(record, "itemLineCode", match[1]);
    assignMatching(record, "itemTypeCode", match[2]);
    assignMatching(record, "itemSequence", match[3]);
  }
  if (record.itemColorCode) assert.match(record.itemColorCode, /^C\d+$/);
  if (record.itemSizeCode) assert.match(record.itemSizeCode, /^S\d+$/);
  if (record.lotCode) assert.match(record.lotCode, /^L\d+$/);
  if (record.itemCode && record.itemColorCode && record.itemSizeCode) {
    assignMatching(record, "sku", `${record.itemCode}-${record.itemColorCode}-${record.itemSizeCode}`);
  }
  if (record.sku && record.lotCode) assignMatching(record, "lotId", `${record.sku}-${record.lotCode}`);
  return record;
}

function price(value, field) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value) && value >= 0, `Invalid ${field}`);
    return value;
  }
  assert.equal(typeof value, "string", `Invalid ${field}`);
  const number = value.trim().replace(/^(?:NT\$|TWD|\$)\s*/i, "");
  assert.match(number, /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/, `Invalid ${field}: ${value}`);
  const result = Number(number.replaceAll(",", ""));
  assert.ok(Number.isFinite(result), `Invalid ${field}`);
  return result;
}

function boolean(value, field) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  throw new Error(`Invalid ${field}: ${value}`);
}

function linkValue(value) {
  assert.equal(typeof value, "string", "Links must be strings");
  const url = new URL(value);
  assert.ok(["https:", "http:"].includes(url.protocol), "Links must use HTTP or HTTPS");
  return value;
}

/** Maps one row of resolved cell values. Resolve smart-chip URLs before calling. */
export function mapSheetItemRow(headers, values, { aliases = {} } = {}) {
  const lookup = new Map();
  const register = (label, field) => {
    const key = headerKey(label);
    assert.ok(!lookup.has(key) || lookup.get(key) === field, `Ambiguous alias: ${label}`);
    lookup.set(key, field);
  };
  for (const [field, labels] of Object.entries(ITEM_FIELDS)) {
    for (const label of [field, ...labels]) register(label, field);
  }
  for (const [label, field] of Object.entries(aliases)) {
    assert.ok(Object.hasOwn(ITEM_FIELDS, field), `Unknown canonical field: ${field}`);
    register(label, field);
  }
  const fields = {};
  const images = new Map();
  const unmappedHeaders = [];
  for (let index = 0; index < headers.length; index += 1) {
    const label = String(headers[index] ?? "");
    const value = trimSheetScalar(values[index]);
    const imageMatch = headerKey(label).match(/^(?:商品圖片|itemimage|productimage|image)([0-9])$/);
    if (imageMatch) {
      if (value == null || value === "") continue;
      assert.equal(typeof value, "string", `Image link must be text: ${label}`);
      linkValue(value);
      const imageIndex = Number(imageMatch[1]);
      assert.ok(!images.has(imageIndex) || images.get(imageIndex) === value, `Conflicting image ${imageIndex}`);
      images.set(imageIndex, value);
      continue;
    }
    const field = lookup.get(headerKey(label));
    if (!field) {
      if (label.trim()) unmappedHeaders.push(label);
      continue;
    }
    if (value == null || value === "") continue;
    let normalized = value;
    if (["listPrice", "salePrice"].includes(field)) normalized = price(value, field);
    else if (["visible", "soldOut"].includes(field)) normalized = boolean(value, field);
    else {
      assert.equal(typeof value, "string", `${field} must be text`);
      if (["link", "descriptionSource"].includes(field)) linkValue(value);
      if (["itemCode", "itemLineCode", "itemTypeCode", "itemSequence", "itemColorCode", "itemSizeCode", "sku", "lotCode", "lotId"].includes(field)) normalized = code(value);
    }
    assignMatching(fields, field, normalized);
  }
  const record = completeItemIdentifiers(fields);
  if (record.descriptionSource) record.descriptionSource = { link: record.descriptionSource };
  if (images.size) record.images = [...images].sort(([a], [b]) => a - b).map(([index, link]) => ({ index, link }));
  return { record, unmappedHeaders };
}

// Flat import records keep explicit names; nested business objects use their context.
const ITEM_KEYS = { itemName: "name", itemCode: "code", itemLineCode: "lineCode", itemTypeCode: "typeCode", itemSequence: "sequence" };
const VARIANT_KEYS = { itemColorCode: "colorCode", itemColorName: "colorName", itemSizeCode: "sizeCode", itemSizeName: "sizeName" };
const LOT_KEYS = { lotCode: "code", lotId: "id" };

function renameFields(record, names) {
  const result = { ...record };
  for (const [from, to] of Object.entries(names)) {
    if (!Object.hasOwn(result, from)) continue;
    assert.ok(!Object.hasOwn(result, to), `Mixed schema fields: ${from} and ${to}`);
    result[to] = result[from];
    delete result[from];
  }
  return result;
}

export function validateItemCatalog(catalog) {
  assert.equal(catalog.schemaVersion, ITEM_SCHEMA_VERSION, "Migrate the source catalog to schema version 4");
  assert.ok(!Object.hasOwn(catalog, "products"), "Canonical source uses items, not products");
  assert.ok(Array.isArray(catalog.items), "items must be an array");
  const codes = new Set();
  for (const item of catalog.items) {
    for (const key of ["productNumber", "title", "price", "shopeeUrl", "document", ...Object.keys(ITEM_KEYS)]) assert.ok(!Object.hasOwn(item, key), `Legacy source field: ${key}`);
    for (const key of ["name", "code", "lineCode", "typeCode", "sequence", "link"]) {
      assert.equal(typeof item[key], "string", `Missing ${key}`);
      assert.ok(item[key].length && item[key] === item[key].trim(), `Unnormalized ${key}`);
    }
    const identity = completeItemIdentifiers({ itemCode: item.code, itemLineCode: item.lineCode, itemTypeCode: item.typeCode, itemSequence: item.sequence });
    linkValue(item.link);
    for (const key of ["itemCode", "itemLineCode", "itemTypeCode", "itemSequence"]) assert.equal(item[ITEM_KEYS[key]], identity[key]);
    assert.ok(!codes.has(item.code), `Duplicate item code: ${item.code}`);
    codes.add(item.code);
    for (const field of ["listPrice", "salePrice"]) {
      assert.ok(Object.hasOwn(item, field), `Missing ${field}`);
      assert.ok(item[field] === null || typeof item[field] === "number", `${field} must be a number or null`);
      price(item[field], field);
    }
    assert.ok(item.descriptionSource === null || (typeof item.descriptionSource === "object" && !Array.isArray(item.descriptionSource)), "descriptionSource must be an object or null");
    for (const field of ["variants", "images", "localImages"]) assert.ok(Array.isArray(item[field]), `${field} must be an array`);
    for (const variant of item.variants) {
      for (const field of ["color", "size", ...Object.keys(VARIANT_KEYS)]) assert.ok(!Object.hasOwn(variant, field), `Legacy variant field: ${field}`);
      const identity = completeItemIdentifiers({ sku: variant.sku, itemCode: item.code, itemColorCode: variant.colorCode, itemSizeCode: variant.sizeCode });
      assert.ok(variant.sku && variant.sku === identity.sku, "Invalid sku");
      for (const field of ["itemColorCode", "itemSizeCode"]) assert.ok(variant[VARIANT_KEYS[field]] && variant[VARIANT_KEYS[field]] === identity[field], `Invalid ${VARIANT_KEYS[field]}`);
      for (const field of ["colorName", "sizeName"]) assert.ok(typeof variant[field] === "string" && variant[field].length && variant[field] === variant[field].trim(), `Invalid ${field}`);
      for (const field of ["visible", "soldOut"]) assert.equal(typeof variant[field], "boolean", `Invalid ${field}`);
      assert.ok(Array.isArray(variant.lots), "lots must be an array");
      const lotIds = new Set();
      for (const lot of variant.lots) {
        for (const field of Object.keys(LOT_KEYS)) assert.ok(!Object.hasOwn(lot, field), `Legacy lot field: ${field}`);
        const identity = completeItemIdentifiers({ lotCode: lot.code, lotId: lot.id, sku: variant.sku });
        assert.ok(lot.code && lot.id && lot.id === identity.lotId && lot.code === identity.lotCode, "Invalid lot identity");
        assert.ok(!lotIds.has(lot.id), `Duplicate lot id: ${lot.id}`);
        lotIds.add(lot.id);
      }
    }
  }
  return catalog;
}

function migrateLegacyCatalog(legacy) {
  assert.ok([1, 2].includes(legacy.schemaVersion) && Array.isArray(legacy.products), "Unsupported source schema");
  const { products, ...metadata } = structuredClone(legacy);
  const items = products.map(({ productNumber, title, price: oldPrice, shopeeUrl, document, variants, ...rest }) => {
    const identity = completeItemIdentifiers({ itemCode: productNumber });
    return {
      ...rest,
      itemName: trimSheetScalar(title),
      ...identity,
      listPrice: price(oldPrice, "listPrice"),
      salePrice: null,
      link: trimSheetScalar(shopeeUrl),
      descriptionSource: document ?? null,
      variants: variants.map(({ sku, color, size, ...rest }) => {
        const identity = completeItemIdentifiers({ itemCode: productNumber, sku });
        return {
          ...rest,
          sku: identity.sku,
          itemColorCode: identity.itemColorCode,
          itemColorName: trimSheetScalar(color),
          itemSizeCode: identity.itemSizeCode,
          itemSizeName: trimSheetScalar(size),
          lots: []
        };
      })
    };
  });
  return { ...metadata, schemaVersion: 3, items };
}

export function migrateItemCatalog(legacy) {
  if (legacy.schemaVersion === ITEM_SCHEMA_VERSION) return structuredClone(validateItemCatalog(legacy));
  const source = legacy.schemaVersion === 3 ? structuredClone(legacy) : migrateLegacyCatalog(legacy);
  assert.ok(Array.isArray(source.items), "Version 3 source requires items");
  const items = source.items.map((item) => ({
    ...renameFields(item, ITEM_KEYS),
    variants: item.variants.map((variant) => ({
      ...renameFields(variant, VARIANT_KEYS),
      lots: variant.lots.map((lot) => renameFields(lot, LOT_KEYS))
    }))
  }));
  return validateItemCatalog({ ...source, schemaVersion: ITEM_SCHEMA_VERSION, items });
}

export function itemPriceLabel(item) {
  const value = item.salePrice ?? item.listPrice;
  assert.ok(value != null, `Missing website price: ${item.code}`);
  assert.equal(typeof value, "number", "Website price must be numeric");
  price(value, "website price");
  return `NT$${value.toLocaleString("en-US")}`;
}
