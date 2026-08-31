(function () {
  const LARGE_VIEW_QUERY = "(min-width: 64rem)";
  const TOUCH_ZOOM_MIN = 1;
  const TOUCH_ZOOM_MAX = 4;
  const DESKTOP_ZOOM = 2;
  const LENS_GALLERY_RATIO = 0.5;
  const OVERLAY_GALLERY_RATIO = 2;
  const STATIONARY_CLICK_DISTANCE = 6;
  const largeView = window.matchMedia(LARGE_VIEW_QUERY);

  let touchGesture = null;
  let touchFrame = 0;
  let suppressedClickSource = null;
  let suppressClickUntil = 0;
  let lens = null;
  let lensImage = null;
  let lensSource = null;
  let lensPointer = null;
  let lensFrame = 0;
  let overlayState = null;
  let resizeFrame = 0;

  const largeImageAttributes = new WeakMap();

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function point(touch) {
    return { x: touch.clientX, y: touch.clientY };
  }

  function midpoint(first, second) {
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2
    };
  }

  function distance(first, second) {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  function mediaTarget(node) {
    if (!(node instanceof Element)) return null;
    return node.closest("[data-media-zoom-touch]");
  }

  function touchesForSource(touchList, source) {
    return Array.from(touchList).filter((touch) => mediaTarget(touch.target) === source);
  }

  function largestImageSource(image) {
    const candidates = (image.getAttribute("srcset") || "")
      .split(",")
      .map((candidate) => candidate.trim())
      .filter(Boolean)
      .map((candidate) => {
        const parts = candidate.split(/\s+/);
        const descriptor = parts.at(-1) || "";
        const numericValue = Number.parseFloat(descriptor);
        return {
          source: parts.slice(0, -1).join(" ") || parts[0],
          score: Number.isFinite(numericValue) ? numericValue : 0
        };
      })
      .sort((first, second) => second.score - first.score);
    return candidates[0]?.source || image.currentSrc || image.src;
  }

  function imagesWithin(element) {
    if (element instanceof HTMLImageElement) return [element];
    return Array.from(element.querySelectorAll("img"));
  }

  function copyImagePresentation(source, target, includeTransform) {
    const style = window.getComputedStyle(source);
    target.removeAttribute("srcset");
    target.removeAttribute("sizes");
    target.removeAttribute("loading");
    target.src = largestImageSource(source);
    target.draggable = false;
    target.style.objectFit = style.objectFit;
    target.style.objectPosition = style.objectPosition;
    target.style.filter = style.filter;
    target.style.clipPath = style.clipPath;
    target.style.backgroundColor = style.backgroundColor;
    target.style.borderRadius = style.borderRadius;
    if (includeTransform) {
      target.style.opacity = style.opacity;
      target.style.transform = style.transform;
      target.style.transformOrigin = style.transformOrigin;
    }
  }

  function removeInteractiveCloneAttributes(clone) {
    const clonedElements = [clone, ...clone.querySelectorAll("*")];
    clonedElements.forEach((element) => {
      element.removeAttribute("id");
      element.removeAttribute("data-media-zoom-touch");
      element.removeAttribute("data-media-zoom-gallery");
      element.removeAttribute("tabindex");
      element.removeAttribute("role");
      element.removeAttribute("aria-haspopup");
    });
  }

  function createFloatingClone(source) {
    const clone = source.cloneNode(true);
    const sourceImages = imagesWithin(source);
    const cloneImages = imagesWithin(clone);
    removeInteractiveCloneAttributes(clone);
    clone.classList.add("media-zoom-float");
    clone.setAttribute("aria-hidden", "true");
    clone.style.setProperty("--choice-color", window.getComputedStyle(source).getPropertyValue("--choice-color"));
    sourceImages.forEach((image, index) => {
      if (cloneImages[index]) copyImagePresentation(image, cloneImages[index], true);
    });
    document.body.appendChild(clone);
    return clone;
  }

  function queueTouchFrame() {
    if (touchFrame || !touchGesture) return;
    touchFrame = window.requestAnimationFrame(() => {
      touchFrame = 0;
      if (!touchGesture) return;
      const width = touchGesture.sourceWidth * touchGesture.zoom;
      const height = touchGesture.sourceHeight * touchGesture.zoom;
      touchGesture.clone.style.width = `${width}px`;
      touchGesture.clone.style.height = `${height}px`;
      touchGesture.clone.style.transform = `translate3d(${touchGesture.left}px, ${touchGesture.top}px, 0)`;
    });
  }

  function beginPinch(touches) {
    if (!touchGesture || touches.length < 2) return;
    const first = touches[0];
    const second = touches[1];
    const center = midpoint(first, second);
    const renderedWidth = touchGesture.sourceWidth * touchGesture.zoom;
    const renderedHeight = touchGesture.sourceHeight * touchGesture.zoom;
    touchGesture.mode = "pinch";
    touchGesture.touchIds = [first.identifier, second.identifier];
    touchGesture.baseDistance = Math.max(1, distance(first, second));
    touchGesture.baseZoom = touchGesture.zoom;
    touchGesture.anchorX = (center.x - touchGesture.left) / renderedWidth;
    touchGesture.anchorY = (center.y - touchGesture.top) / renderedHeight;
  }

  function updatePinch(touches) {
    const ordered = touchGesture.touchIds
      .map((identifier) => touches.find((touch) => touch.identifier === identifier))
      .filter(Boolean);
    if (ordered.length < 2) {
      beginPinch(touches);
      return;
    }
    const center = midpoint(ordered[0], ordered[1]);
    const nextZoom = clamp(
      touchGesture.baseZoom * distance(ordered[0], ordered[1]) / touchGesture.baseDistance,
      TOUCH_ZOOM_MIN,
      TOUCH_ZOOM_MAX
    );
    touchGesture.zoom = nextZoom;
    touchGesture.left = center.x - touchGesture.anchorX * touchGesture.sourceWidth * nextZoom;
    touchGesture.top = center.y - touchGesture.anchorY * touchGesture.sourceHeight * nextZoom;
    queueTouchFrame();
  }

  function beginDrag(touch) {
    if (!touchGesture) return;
    const currentPoint = point(touch);
    touchGesture.mode = "drag";
    touchGesture.touchIds = [touch.identifier];
    touchGesture.dragStartX = currentPoint.x;
    touchGesture.dragStartY = currentPoint.y;
    touchGesture.dragBaseLeft = touchGesture.left;
    touchGesture.dragBaseTop = touchGesture.top;
  }

  function updateDrag(touch) {
    const currentPoint = point(touch);
    touchGesture.left = touchGesture.dragBaseLeft + currentPoint.x - touchGesture.dragStartX;
    touchGesture.top = touchGesture.dragBaseTop + currentPoint.y - touchGesture.dragStartY;
    queueTouchFrame();
  }

  function updateTouchGesture(touchList) {
    if (!touchGesture) return;
    const touches = touchesForSource(touchList, touchGesture.source);
    if (!touches.length) {
      finishTouchGesture();
      return;
    }
    if (touches.length >= 2) {
      const continuingPinch = touchGesture.mode === "pinch"
        && touchGesture.touchIds.every((identifier) => touches.some((touch) => touch.identifier === identifier));
      if (!continuingPinch) beginPinch(touches);
      updatePinch(touches);
      return;
    }
    if (touchGesture.mode !== "drag" || touchGesture.touchIds[0] !== touches[0].identifier) beginDrag(touches[0]);
    updateDrag(touches[0]);
  }

  function startTouchGesture(source, touches) {
    const rect = source.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    touchGesture = {
      source,
      clone: createFloatingClone(source),
      sourceWidth: rect.width,
      sourceHeight: rect.height,
      left: rect.left,
      top: rect.top,
      zoom: TOUCH_ZOOM_MIN,
      mode: "pinch",
      touchIds: []
    };
    beginPinch(touches);
    queueTouchFrame();
    return true;
  }

  function finishTouchGesture() {
    if (!touchGesture) return;
    const { source, clone } = touchGesture;
    if (touchFrame) window.cancelAnimationFrame(touchFrame);
    touchFrame = 0;
    clone.remove();
    suppressedClickSource = source;
    suppressClickUntil = Date.now() + 700;
    touchGesture = null;
  }

  document.addEventListener("touchstart", (event) => {
    if (touchGesture) {
      event.preventDefault();
      updateTouchGesture(event.touches);
      return;
    }
    const groupedTouches = new Map();
    Array.from(event.touches).forEach((touch) => {
      const source = mediaTarget(touch.target);
      if (!source) return;
      if (!groupedTouches.has(source)) groupedTouches.set(source, []);
      groupedTouches.get(source).push(touch);
    });
    const match = Array.from(groupedTouches.entries()).find(([, touches]) => touches.length >= 2);
    if (!match) return;
    if (startTouchGesture(match[0], match[1])) event.preventDefault();
  }, { capture: true, passive: false });

  document.addEventListener("touchmove", (event) => {
    if (!touchGesture) return;
    event.preventDefault();
    updateTouchGesture(event.touches);
  }, { capture: true, passive: false });

  document.addEventListener("touchend", (event) => {
    if (!touchGesture) return;
    event.preventDefault();
    updateTouchGesture(event.touches);
  }, { capture: true, passive: false });

  document.addEventListener("touchcancel", (event) => {
    if (!touchGesture) return;
    const cancelledCurrentGesture = Array.from(event.changedTouches)
      .some((touch) => mediaTarget(touch.target) === touchGesture.source);
    if (!cancelledCurrentGesture) return;
    event.preventDefault();
    finishTouchGesture();
  }, { capture: true, passive: false });

  document.addEventListener("click", (event) => {
    if (Date.now() > suppressClickUntil || !suppressedClickSource) return;
    const path = event.composedPath();
    if (!path.includes(suppressedClickSource) && !suppressedClickSource.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function ensureLens() {
    if (lens) return;
    lens = document.createElement("div");
    lens.className = "media-zoom-lens";
    lens.hidden = true;
    lens.setAttribute("aria-hidden", "true");
    lensImage = document.createElement("img");
    lensImage.alt = "";
    lensImage.draggable = false;
    lens.appendChild(lensImage);
    document.body.appendChild(lens);
  }

  function hideLens() {
    lensPointer = null;
    lensSource = null;
    if (lensFrame) window.cancelAnimationFrame(lensFrame);
    lensFrame = 0;
    if (lens) lens.hidden = true;
  }

  function renderLens() {
    lensFrame = 0;
    if (!largeView.matches || overlayState || !lensSource || !lensSource.isConnected || !lensPointer) {
      hideLens();
      return;
    }
    const gallery = lensSource.closest("[data-media-zoom-gallery]");
    if (!gallery || (lensSource.complete && !lensSource.naturalWidth)) {
      hideLens();
      return;
    }
    ensureLens();
    const galleryRect = gallery.getBoundingClientRect();
    const imageRect = lensSource.getBoundingClientRect();
    const diameter = galleryRect.width * LENS_GALLERY_RATIO;
    if (!diameter || !imageRect.width || !imageRect.height) {
      hideLens();
      return;
    }
    copyImagePresentation(lensSource, lensImage, false);
    lens.style.width = `${diameter}px`;
    lens.style.height = `${diameter}px`;
    lens.style.transform = `translate3d(${lensPointer.x - diameter / 2}px, ${lensPointer.y - diameter / 2}px, 0)`;
    lensImage.style.width = `${imageRect.width * DESKTOP_ZOOM}px`;
    lensImage.style.height = `${imageRect.height * DESKTOP_ZOOM}px`;
    lensImage.style.transform = `translate3d(${diameter / 2 - (lensPointer.x - imageRect.left) * DESKTOP_ZOOM}px, ${diameter / 2 - (lensPointer.y - imageRect.top) * DESKTOP_ZOOM}px, 0)`;
    lens.hidden = false;
  }

  function queueLensFrame() {
    if (lensFrame) return;
    lensFrame = window.requestAnimationFrame(renderLens);
  }

  function galleryImage(node) {
    if (!(node instanceof Element)) return null;
    return node.closest("[data-media-zoom-gallery] img");
  }

  function storeLargeImageAttributes(image) {
    if (largeImageAttributes.has(image)) return;
    largeImageAttributes.set(image, {
      tabindex: image.getAttribute("tabindex"),
      role: image.getAttribute("role"),
      ariaHaspopup: image.getAttribute("aria-haspopup"),
      ariaLabel: image.getAttribute("aria-label")
    });
  }

  function restoreAttribute(element, name, value) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  function enableLargeGalleryImage(image) {
    storeLargeImageAttributes(image);
    image.setAttribute("tabindex", "0");
    image.setAttribute("role", "button");
    image.setAttribute("aria-haspopup", "dialog");
    image.setAttribute("aria-label", `${image.alt || "Product image"}. Open enlarged image gallery.`);
  }

  function disableLargeGalleryImage(image) {
    const attributes = largeImageAttributes.get(image);
    if (!attributes) return;
    restoreAttribute(image, "tabindex", attributes.tabindex);
    restoreAttribute(image, "role", attributes.role);
    restoreAttribute(image, "aria-haspopup", attributes.ariaHaspopup);
    restoreAttribute(image, "aria-label", attributes.ariaLabel);
    largeImageAttributes.delete(image);
  }

  function setLargeGalleryMode() {
    const images = Array.from(document.querySelectorAll("[data-media-zoom-gallery] img"));
    if (largeView.matches) images.forEach(enableLargeGalleryImage);
    else {
      closeOverlay();
      hideLens();
      images.forEach(disableLargeGalleryImage);
    }
  }

  function overlayImage(source) {
    const image = document.createElement("img");
    image.alt = source.alt;
    copyImagePresentation(source, image, false);
    return image;
  }

  function setSiblingsInert(overlay) {
    return Array.from(document.body.children)
      .filter((element) => element !== overlay)
      .map((element) => {
        const wasInert = element.hasAttribute("inert");
        element.setAttribute("inert", "");
        return { element, wasInert };
      });
  }

  function layoutOverlay() {
    if (!overlayState) return;
    const { gallery, overlay, column, images, selectedIndex } = overlayState;
    if (!gallery.isConnected) {
      closeOverlay();
      return;
    }
    const columnWidth = gallery.getBoundingClientRect().width * OVERLAY_GALLERY_RATIO;
    overlayState.columnWidth = columnWidth;
    column.style.width = `${columnWidth}px`;
    images.forEach((image) => {
      image.style.width = `${columnWidth}px`;
      image.style.height = `${columnWidth}px`;
    });
    overlay.scrollLeft = Math.max(0, (overlay.scrollWidth - overlay.clientWidth) / 2);
    overlay.scrollTop = images[selectedIndex]?.offsetTop || 0;
  }

  function closeOverlay(restoreFocus = true) {
    if (!overlayState) return;
    const state = overlayState;
    overlayState = null;
    state.overlay.remove();
    state.inertSiblings.forEach(({ element, wasInert }) => {
      if (!wasInert) element.removeAttribute("inert");
    });
    document.body.classList.remove("media-zoom-overlay-open");
    document.body.style.overflow = state.previousBodyOverflow;
    if (restoreFocus && state.trigger.isConnected) state.trigger.focus({ preventScroll: true });
  }

  function openOverlay(gallery, selectedIndex, trigger) {
    if (!largeView.matches) return;
    if (overlayState) closeOverlay(false);
    hideLens();
    const sourceImages = Array.from(gallery.querySelectorAll("img"));
    if (!sourceImages.length) return;

    const overlay = document.createElement("div");
    overlay.className = "media-zoom-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `${gallery.getAttribute("aria-label") || "Product images"} enlarged view`);
    overlay.setAttribute("tabindex", "-1");

    const column = document.createElement("div");
    column.className = "media-zoom-overlay__column";
    const images = sourceImages.map(overlayImage);
    column.append(...images);
    overlay.appendChild(column);
    document.body.appendChild(overlay);

    const previousBodyOverflow = document.body.style.overflow;
    document.body.classList.add("media-zoom-overlay-open");
    document.body.style.overflow = "hidden";
    overlayState = {
      gallery,
      trigger,
      selectedIndex,
      overlay,
      column,
      images,
      inertSiblings: setSiblingsInert(overlay),
      previousBodyOverflow,
      pointerDown: null,
      columnWidth: 0
    };

    overlay.addEventListener("pointerdown", (event) => {
      if (!overlayState || event.button > 0) return;
      overlayState.pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    overlay.addEventListener("pointerup", (event) => {
      const start = overlayState?.pointerDown;
      if (!start || start.id !== event.pointerId) return;
      overlayState.pointerDown = null;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) <= STATIONARY_CLICK_DISTANCE) closeOverlay();
    });
    overlay.addEventListener("pointercancel", () => {
      if (overlayState) overlayState.pointerDown = null;
    });
    overlay.addEventListener("click", (event) => {
      if (event.detail === 0) closeOverlay();
    });

    overlay.focus({ preventScroll: true });
    window.requestAnimationFrame(layoutOverlay);
  }

  document.addEventListener("pointermove", (event) => {
    if (!largeView.matches || overlayState || event.pointerType === "touch") return;
    const image = galleryImage(event.target);
    if (!image) return;
    lensSource = image;
    lensPointer = { x: event.clientX, y: event.clientY };
    queueLensFrame();
  }, true);

  document.addEventListener("pointerout", (event) => {
    const image = galleryImage(event.target);
    if (!image || image !== lensSource) return;
    if (event.relatedTarget instanceof Node && image.contains(event.relatedTarget)) return;
    hideLens();
  }, true);

  document.addEventListener("click", (event) => {
    if (!largeView.matches || overlayState || event.defaultPrevented) return;
    const image = galleryImage(event.target);
    if (!image) return;
    const gallery = image.closest("[data-media-zoom-gallery]");
    openOverlay(gallery, Array.from(gallery.querySelectorAll("img")).indexOf(image), image);
  });

  document.addEventListener("keydown", (event) => {
    if (overlayState) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      } else if (event.key === "Tab") {
        event.preventDefault();
        overlayState.overlay.focus({ preventScroll: true });
      }
      return;
    }
    if (!largeView.matches || !["Enter", " "].includes(event.key)) return;
    const image = galleryImage(event.target);
    if (!image) return;
    event.preventDefault();
    const gallery = image.closest("[data-media-zoom-gallery]");
    openOverlay(gallery, Array.from(gallery.querySelectorAll("img")).indexOf(image), image);
  });

  document.addEventListener("focusin", (event) => {
    if (overlayState && !overlayState.overlay.contains(event.target)) overlayState.overlay.focus({ preventScroll: true });
  });

  document.addEventListener("mouseout", (event) => {
    if (event.relatedTarget === null) hideLens();
  });
  window.addEventListener("blur", hideLens);
  window.addEventListener("scroll", hideLens, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hideLens();
  });
  document.addEventListener("error", (event) => {
    if (event.target === lensSource) hideLens();
  }, true);

  window.addEventListener("resize", () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (overlayState) layoutOverlay();
      else if (lensSource) queueLensFrame();
    });
  }, { passive: true });

  if (typeof largeView.addEventListener === "function") largeView.addEventListener("change", setLargeGalleryMode);
  else largeView.addListener(setLargeGalleryMode);
  setLargeGalleryMode();
})();
