import searchCore from "../../assets/js/search-core.js";
import { catalogEntriesForProduct } from "./catalog-entries.mjs";

export function productFamilyKey(code) {
  const normalized = String(code ?? "").trim().toUpperCase();
  return normalized.match(/^[A-Z]+/)?.[0] ?? null;
}

export function rankRelatedProducts(products, currentProduct) {
  return searchCore.rankRelatedProducts(products, currentProduct);
}

export function relatedCatalogEntries(products, currentProduct) {
  const entries = new Map();
  for (const product of rankRelatedProducts(products, currentProduct)) {
    if (product.code === currentProduct.code) continue;
    for (const entry of catalogEntriesForProduct(product)) {
      if (!entries.has(entry.cardUrl)) entries.set(entry.cardUrl, entry);
    }
  }
  return [...entries.values()];
}
