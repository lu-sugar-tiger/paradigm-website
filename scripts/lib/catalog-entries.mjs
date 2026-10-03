import { itemColors } from "./item-colors.mjs";

export function catalogEntriesForProduct(product) {
  const colorName = (variant) => product.colors?.find((color) => color.colorCode === variant.colorCode)?.label
    || itemColors.name(variant.colorCode, variant.colorName);
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
    cardAlt: `${product.name}, ${colorName(variant)}${imageCountByColor.get(variant.colorCode) > 1 ? `, ${variant.sizeName}` : ""}`,
    cardUrl: `/products/${product.code}?variant=${encodeURIComponent(variant.sku)}`,
    variantLabel: imageCountByColor.get(variant.colorCode) > 1 ? `${colorName(variant)} · ${variant.sizeName}` : colorName(variant),
    cardVariantSku: variant.sku
  }));
}
