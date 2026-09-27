import searchCore from "../../assets/js/search-core.js";

export function categoryForName(name) {
  if (/Shorts/i.test(name)) return "Bottoms";
  if (/(Hoodie|Crewneck)/i.test(name)) return "AW Tops";
  return "SS Tops";
}

export function productFamilyKey(code) {
  const normalized = String(code ?? "").trim().toUpperCase();
  return normalized.match(/^[A-Z]+/)?.[0] ?? null;
}

export function rankRelatedProducts(products, currentProduct) {
  return searchCore.rankRelatedProducts(products, currentProduct);
}
