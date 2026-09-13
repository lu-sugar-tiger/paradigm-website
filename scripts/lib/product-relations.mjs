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
  const currentFamily = productFamilyKey(currentProduct.code);
  return products
    .map((product, catalogIndex) => ({ product, catalogIndex }))
    .filter(({ product }) => product.code !== currentProduct.code)
    .sort((left, right) => {
      const leftFamilyMatch = currentFamily !== null && productFamilyKey(left.product.code) === currentFamily;
      const rightFamilyMatch = currentFamily !== null && productFamilyKey(right.product.code) === currentFamily;
      if (leftFamilyMatch !== rightFamilyMatch) return Number(rightFamilyMatch) - Number(leftFamilyMatch);

      const leftCategoryMatch = left.product.category === currentProduct.category;
      const rightCategoryMatch = right.product.category === currentProduct.category;
      if (leftCategoryMatch !== rightCategoryMatch) return Number(rightCategoryMatch) - Number(leftCategoryMatch);

      return left.catalogIndex - right.catalogIndex;
    })
    .map(({ product }) => product);
}
