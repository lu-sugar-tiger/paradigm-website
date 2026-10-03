(() => {
  const page = document.querySelector(".product-detail-experiment");
  const panel = page?.querySelector("[data-product-detail]");
  const gallery = panel?.querySelector("[data-product-gallery]");
  const rail = panel?.querySelector(".detail-thumbnails__rail");
  const related = page?.querySelector(".product-feed-section .product-grid");
  if (!gallery || !rail || !related) return;
  const large = matchMedia("(min-width: 64rem)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const buttons = new Map();

  function syncRail() {
    panel.style.setProperty("--experiment-related-gap", getComputedStyle(related).columnGap);
    const images = [...gallery.querySelectorAll("img:not([data-product-variant-image])")];
    const visible = images.filter(image => getComputedStyle(image).display !== "none");
    for (const [image, button] of buttons) {
      if (!visible.includes(image)) { button.remove(); buttons.delete(image); }
    }
    visible.forEach((image) => {
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
      button.setAttribute("aria-label", image.alt);
      const thumbnail = button.firstElementChild;
      thumbnail.src = image.src;
      thumbnail.srcset = image.srcset;
      thumbnail.sizes = `${Math.ceil(rail.getBoundingClientRect().width)}px`;
      thumbnail.width = image.width;
      thumbnail.height = image.height;
      // Only the navigation nodes move; gallery photos stay in source order.
      rail.append(button);
    });
  }

  document.addEventListener("paradigm:product-media-change", syncRail);
  document.addEventListener("paradigm:language-change", syncRail);
  window.addEventListener("resize", syncRail);
  syncRail();
})();
