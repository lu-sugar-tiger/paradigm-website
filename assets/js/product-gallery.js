(() => {
  const panel = document.querySelector(".product-detail__panel");
  const gallery = panel?.querySelector("[data-product-gallery], [data-builder-preview]");
  const rail = panel?.querySelector(".detail-thumbnails__rail");
  const related = document.querySelector(".product-feed-section .product-grid");
  if (!gallery || !rail || !gallery.querySelector("img:not([data-product-variant-image]):not([data-product-image-fallback])")) return;
  // Enhance navigation only; authored photos and the selection controller own media.
  rail.parentElement.hidden = false;
  panel.classList.add("has-thumbnail-rail");
  const large = matchMedia("(min-width: 64rem)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const buttons = new Map();
  let syncFrame = 0;

  function setAttribute(element, name, value) {
    if (element.getAttribute(name) !== String(value)) element.setAttribute(name, value);
  }

  function syncRail() {
    syncFrame = 0;
    if (!large.matches) return;
    if (related) {
      const gap = getComputedStyle(related).columnGap;
      if (panel.style.getPropertyValue("--detail-related-gap") !== gap) panel.style.setProperty("--detail-related-gap", gap);
    }
    const images = [...gallery.querySelectorAll("img:not([data-product-variant-image]):not([data-product-image-fallback])")];
    const visible = images.filter(image => getComputedStyle(image).display !== "none");
    const sizes = `${Math.ceil(rail.getBoundingClientRect().width)}px`;
    for (const [image, button] of buttons) {
      if (!visible.includes(image)) { button.remove(); buttons.delete(image); }
    }
    visible.forEach((image, index) => {
      let button = buttons.get(image);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "detail-thumbnail";
        const thumbnail = document.createElement("img");
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        thumbnail.decoding = "async";
        button.append(thumbnail);
        button.addEventListener("click", () => {
          if (!large.matches) return;
          const inset = Number.parseFloat(getComputedStyle(image).scrollMarginBlockStart) || 0;
          window.scrollTo({
            top: window.scrollY + image.getBoundingClientRect().top - inset,
            behavior: reducedMotion.matches ? "instant" : "smooth"
          });
        });
        buttons.set(image, button);
      }
      setAttribute(button, "aria-label", image.alt);
      const thumbnail = button.firstElementChild;
      setAttribute(thumbnail, "src", image.src);
      setAttribute(thumbnail, "srcset", image.srcset);
      setAttribute(thumbnail, "sizes", sizes);
      setAttribute(thumbnail, "width", image.width);
      setAttribute(thumbnail, "height", image.height);
      // Only the navigation nodes move; gallery photos stay in source order.
      if (rail.children[index] !== button) rail.insertBefore(button, rail.children[index] || null);
    });
  }

  function queueSyncRail() {
    if (!syncFrame) syncFrame = requestAnimationFrame(syncRail);
  }
  document.addEventListener("paradigm:product-media-change", queueSyncRail);
  document.addEventListener("paradigm:language-change", queueSyncRail);
  window.addEventListener("resize", queueSyncRail);
  large.addEventListener("change", queueSyncRail);
  syncRail();
})();
