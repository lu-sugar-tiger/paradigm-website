(function () {
  const media = [...document.querySelectorAll(".product-grid .product-card__media")];
  if (!media.length) return;
  const grids = [...new Set(media.map(element => element.closest(".product-grid")))];
  let observer;
  let resizeFrame;
  function configure() {
    observer?.disconnect();
    // Read geometry together before range attributes can invalidate styles.
    const boundsByMedia = media.map(element => element.getBoundingClientRect());
    media.forEach((media, index) => {
      const bounds = boundsByMedia[index];
      // Restore ordinary painting before media approaches the viewport. Paint
      // containment can otherwise change fractional-width image rasterization.
      media.toggleAttribute("data-media-in-range", bounds.bottom > -innerHeight && bounds.top < innerHeight * 2);
      if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.top >= innerHeight || bounds.right <= 0 || bounds.left >= innerWidth) return;
      const image = media.querySelector("img");
      if (!image) return;
      image.loading = "eager";
      if (image.fetchPriority !== "high") image.fetchPriority = "auto";
    });
    if (!("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.toggleAttribute("data-media-in-range", entry.isIntersecting));
    }, { rootMargin: `${innerHeight}px 0px` });
    grids.forEach(grid => { if (!grid.hasAttribute("data-catalog-loading")) grid.setAttribute("data-catalog-loading", ""); });
    media.forEach(media => observer.observe(media));
  }
  configure();
  window.addEventListener("pageshow", (event) => { if (event.persisted) configure(); });
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(configure);
  });
})();
