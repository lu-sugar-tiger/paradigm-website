export function catalogEntriesForProduct(product) {
  const groups = new Map();
  for (const variant of product.variants) {
    if (!variant.visible || !variant.imageId || !product.variantMedia?.[variant.imageId]) continue;
    const key = `${variant.colorCode}:${variant.imageId}`;
    const existing = groups.get(key);
    if (!existing || (existing.soldOut && !variant.soldOut)) groups.set(key, variant);
  }
  if (!groups.size) return [{ ...product, cardMedia: product.media[0], cardAlt: product.alt, cardUrl: `/products/${product.code}` }];

  const imageCountByColor = new Map();
  for (const variant of groups.values()) {
    imageCountByColor.set(variant.colorCode, (imageCountByColor.get(variant.colorCode) || 0) + 1);
  }
  return [...groups.values()].map((variant) => ({
    ...product,
    cardMedia: product.variantMedia[variant.imageId],
    cardAlt: `${product.name}, ${variant.colorName}${imageCountByColor.get(variant.colorCode) > 1 ? `, ${variant.sizeName}` : ""}`,
    cardUrl: `/products/${product.code}?variant=${encodeURIComponent(variant.sku)}`,
    variantLabel: imageCountByColor.get(variant.colorCode) > 1 ? `${variant.colorName} · ${variant.sizeName}` : variant.colorName,
    cardVariantSku: variant.sku
  }));
}
