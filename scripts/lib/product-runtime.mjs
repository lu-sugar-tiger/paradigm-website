// Only the current product's choice controls need these fields in the browser.
export function productRuntimeData(product) {
  const variants = product.variants.filter((variant) => variant.visible).map((variant) => ({
    sku: variant.sku,
    colorCode: variant.colorCode,
    sizeName: variant.sizeName,
    visible: variant.visible,
    soldOut: variant.soldOut,
    link: variant.link,
    imageId: variant.imageId,
    ...(variant.images?.length ? { imageIds: variant.images.map((image) => image.id) } : {})
  }));
  const imageIds = new Set(variants.map((variant) => variant.imageId).filter(Boolean));
  return {
    code: product.code,
    name: product.name,
    link: product.link,
    colors: product.colors.map(({ id, colorCode }) => ({ id, colorCode })),
    variants,
    variantMedia: Object.fromEntries(Object.entries(product.variantMedia || {}).filter(([id]) => imageIds.has(id))),
    ...(product.galleryMedia ? { galleryImageIds: product.galleryImageIds, galleryMedia: product.galleryMedia } : {})
  };
}
