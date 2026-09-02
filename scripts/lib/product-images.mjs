export const PRODUCT_IMAGE_SHORT_EDGES = Object.freeze([540, 1080, 2160]);
export const PRODUCT_IMAGE_WEBP_QUALITY = 100;
export const PRODUCT_IMAGE_HASH_PREFIX_LENGTH = 20;

function byShortEdge(left, right) {
  return left.shortEdge - right.shortEdge;
}

function normalizeDerivative(derivative) {
  if (!derivative?.path || !Number.isInteger(derivative.width) || !Number.isInteger(derivative.height)) return null;
  return {
    shortEdge: derivative.shortEdge || Math.min(derivative.width, derivative.height),
    width: derivative.width,
    height: derivative.height,
    path: derivative.path
  };
}

function responsiveMediaFromSource(image) {
  const derivatives = (image.derivatives || []).map(normalizeDerivative).filter(Boolean).sort(byShortEdge);
  if (!derivatives.length) {
    return image.localPath ? { src: image.localPath, width: image.width, height: image.height, derivatives: [] } : null;
  }

  const fallback = derivatives.find((derivative) => derivative.shortEdge === 1080)
    || derivatives[Math.floor(derivatives.length / 2)];
  return {
    src: fallback.path,
    width: fallback.width,
    height: fallback.height,
    derivatives
  };
}

export function resolveProductMedia(product, fallbackMedia = null) {
  const sheetMedia = (product.images || []).map(responsiveMediaFromSource).filter(Boolean);
  if (sheetMedia.length) return sheetMedia;
  const localMedia = (product.localImages || []).filter(Boolean).map((src) => ({ src, derivatives: [] }));
  if (localMedia.length) return localMedia;
  return fallbackMedia?.src ? [{ ...fallbackMedia, isFallback: true }] : [];
}

export function imageSrcset(media, resolvePath = (value) => value) {
  if (!media?.derivatives?.length) return "";
  return media.derivatives
    .map((derivative) => `${resolvePath(derivative.path)} ${derivative.width}w`)
    .join(", ");
}
