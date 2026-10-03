import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../../data/product-categories.json", import.meta.url), "utf8"));
export const productCategories = Object.freeze(config.categories.map((category) => Object.freeze({
  ...category,
  path: `/collections/${category.slug}`
})));
export const legacyCollectionRedirects = Object.freeze(config.legacyRedirects);

export function productInCollection(product, collection) {
  return String(product.typeCode) === collection.typeCode;
}

export function collectionForTypeCode(typeCode) {
  const category = productCategories.find((category) => category.typeCode === String(typeCode));
  if (!category) throw new Error(`Unconfigured product typeCode: ${typeCode}`);
  return category;
}

export function categoryForTypeCode(typeCode) {
  return collectionForTypeCode(typeCode).title;
}

export const collectionSearchPages = productCategories.map(({ title, path, summary, keywords }) => ({
  title, interfaceLabel: true, url: path, summary, keywords
}));
