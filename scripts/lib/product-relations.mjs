export function categoryForTitle(title) {
  if (/Shorts/i.test(title)) return "Bottoms";
  if (/(Hoodie|Crewneck)/i.test(title)) return "AW Tops";
  return "SS Tops";
}

export function productFamilyKey(productNumber) {
  const normalized = String(productNumber ?? "").trim().toUpperCase();
  return normalized.match(/^[A-Z]+/)?.[0] ?? null;
}

export function rankRelatedProducts(products, currentProduct) {
  const currentFamily = productFamilyKey(currentProduct.productNumber);
  return products
    .map((product, catalogIndex) => ({ product, catalogIndex }))
    .filter(({ product }) => product.productNumber !== currentProduct.productNumber)
    .sort((left, right) => {
      const leftFamilyMatch = currentFamily !== null && productFamilyKey(left.product.productNumber) === currentFamily;
      const rightFamilyMatch = currentFamily !== null && productFamilyKey(right.product.productNumber) === currentFamily;
      if (leftFamilyMatch !== rightFamilyMatch) return Number(rightFamilyMatch) - Number(leftFamilyMatch);

      const leftCategoryMatch = left.product.category === currentProduct.category;
      const rightCategoryMatch = right.product.category === currentProduct.category;
      if (leftCategoryMatch !== rightCategoryMatch) return Number(rightCategoryMatch) - Number(leftCategoryMatch);

      return left.catalogIndex - right.catalogIndex;
    })
    .map(({ product }) => product);
}
