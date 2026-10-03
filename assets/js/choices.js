(function () {
  const translate = (source, element) => window.PARADIGM_LANGUAGE.text(source, {}, element);
  function checkedOption(group) {
    const input = group?.querySelector("input:checked");
    return input?.closest("[data-choice-option]") || null;
  }

  function groupLabel(group) {
    return checkedOption(group)?.dataset.choiceLabel || (group?.dataset.choiceVariant === "add-on" ? "None" : "");
  }

  function optionDisplayLabel(option) {
    return option?.dataset.choiceDisplayLabel || option?.dataset.choiceLabel || "";
  }

  function syncChoiceStateSymbols(group) {
    group.querySelectorAll("[data-choice-option]").forEach((option) => {
      const input = option.querySelector("input");
      const symbol = option.querySelector("[data-choice-state-symbol]");
      if (!input || !symbol) return;
      symbol.textContent = input.checked ? symbol.dataset.choiceSelectedSymbol : symbol.dataset.choiceUnselectedSymbol;
    });
  }

  function announceSelection(group) {
    const option = checkedOption(group);
    const selectionLabel = optionDisplayLabel(option) || groupLabel(group);
    const labelValue = group.querySelector("[data-choice-label-value]");
    const status = group.querySelector("[data-choice-status]");
    syncChoiceStateSymbols(group);
    if (labelValue && option) window.PARADIGM_INLINE_TYPE.set(labelValue, optionDisplayLabel(option));
    if (status && selectionLabel) {
      status.textContent = `${translate(group.dataset.choiceTitle, group)}: ${window.PARADIGM_INLINE_TYPE.plain(translate(selectionLabel, group))}${option?.dataset.availability === "unavailable" ? `, ${translate("unavailable", group)}` : ""}`;
    }
  }

  function bindRadioKeyboard(group) {
    const inputs = Array.from(group.querySelectorAll('input[type="radio"]'));
    inputs.forEach((input, index) => {
      input.addEventListener("keydown", (event) => {
        let nextIndex = index;
        if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % inputs.length;
        else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + inputs.length) % inputs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = inputs.length - 1;
        else return;

        event.preventDefault();
        const nextInput = inputs[nextIndex];
        nextInput.checked = true;
        nextInput.focus();
        nextInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function productForGroup(group) {
    const detail = group.closest("[data-product-detail]");
    if (!detail) return null;
    const product = window.PARADIGM_PRODUCT;
    return product?.code === detail.dataset.itemCode ? product : null;
  }

  function bindChoiceRail(group) {
    if (!group.classList.contains("choice-group--rail")) return;
    const options = group.querySelector(".choice-group__options");
    const sizer = group.querySelector(".choice-group__sizer");
    const large = matchMedia("(min-width: 64rem)");
    let drag = null;
    let suppressClick = false;
    let refreshFrame = 0;
    function syncRail() {
      options.classList.toggle("is-grabbable", !large.matches && options.scrollWidth > options.clientWidth + 1);
    }
    function revealChoice(choice = checkedOption(group)) {
      if (large.matches) { options.scrollLeft = 0; return; }
      if (!choice) return;
      const rail = options.getBoundingClientRect();
      const target = choice.getBoundingClientRect();
      const inset = parseFloat(getComputedStyle(options).paddingInlineStart) || 0;
      const delta = target.left < rail.left + inset ? target.left - rail.left - inset
        : target.right > rail.right - inset ? target.right - rail.right + inset : 0;
      if (delta) options.scrollBy({ left: delta, behavior: "instant" });
    }
    function refresh() {
      refreshFrame = 0;
      if (sizer) {
        const minimum = `${Math.ceil(sizer.getBoundingClientRect().width)}px`;
        if (options.style.getPropertyValue("--choice-chip-min") !== minimum) options.style.setProperty("--choice-chip-min", minimum);
      }
      revealChoice(group.contains(document.activeElement) ? document.activeElement.closest("[data-choice-option]") : checkedOption(group));
      syncRail();
    }
    function queueRefresh() {
      if (!refreshFrame) refreshFrame = requestAnimationFrame(refresh);
    }
    options.addEventListener("pointerdown", (event) => {
      suppressClick = false;
      if (large.matches || !options.classList.contains("is-grabbable") || event.pointerType === "touch" || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: options.scrollLeft, active: false };
    });
    options.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const threshold = parseFloat(getComputedStyle(options).columnGap) / 2;
      if (!drag.active && Math.abs(event.clientX - drag.x) < threshold) return;
      if (!drag.active) {
        if (Math.abs(event.clientY - drag.y) > Math.abs(event.clientX - drag.x)) { drag = null; return; }
        drag.active = true;
        options.classList.add("is-pointer-dragging");
        options.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      options.scrollLeft = drag.left + drag.x - event.clientX;
    });
    function finishDrag(event) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const pointerId = drag.id;
      suppressClick = drag.active;
      drag = null;
      options.classList.remove("is-pointer-dragging");
      if (options.hasPointerCapture(pointerId)) options.releasePointerCapture(pointerId);
    }
    options.addEventListener("pointerup", finishDrag);
    options.addEventListener("pointercancel", finishDrag);
    options.addEventListener("lostpointercapture", finishDrag);
    options.addEventListener("pointerleave", (event) => { if (!drag?.active) finishDrag(event); });
    options.addEventListener("click", (event) => {
      if (suppressClick && event.detail !== 0) {
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    options.addEventListener("dragstart", (event) => event.preventDefault());
    group.addEventListener("change", (event) => { revealChoice(event.target.closest("[data-choice-option]")); syncRail(); });
    options.addEventListener("focusin", (event) => revealChoice(event.target.closest("[data-choice-option]")));
    const observer = new ResizeObserver(queueRefresh);
    observer.observe(options);
    if (sizer) observer.observe(sizer);
    large.addEventListener("change", () => { finishDrag(); queueRefresh(); });
    document.addEventListener("paradigm:language-change", queueRefresh);
    document.fonts.ready.then(queueRefresh);
    document.fonts.addEventListener("loadingdone", queueRefresh);
    refresh();
  }

  function selectedProductValues(detail) {
    const groups = Array.from(detail.querySelectorAll("[data-choice-group]"));
    const colorGroup = groups.find((group) => group.dataset.choiceKind === "swatch");
    const sizeGroup = groups.find((group) => group.dataset.choiceKind === "chip");
    return {
      colorId: checkedOption(colorGroup)?.dataset.choiceId || "",
      colorCode: checkedOption(colorGroup)?.dataset.colorCode || "",
      colorName: groupLabel(colorGroup),
      sizeName: groupLabel(sizeGroup)
    };
  }

  function recalculateProductAvailability(detail, product) {
    const selected = selectedProductValues(detail);
    const colorGroup = detail.querySelector('[data-choice-kind="swatch"]');
    const sizeGroup = detail.querySelector('[data-choice-kind="chip"]');

    colorGroup?.querySelectorAll("[data-choice-option]").forEach((option) => {
      const available = product.variants.some((variant) => variant.visible && !variant.soldOut && variant.colorCode === option.dataset.colorCode && variant.sizeName === selected.sizeName);
      option.dataset.availability = available ? "available" : "unavailable";
      updateAccessibleAvailability(option, !available);
    });
    sizeGroup?.querySelectorAll("[data-choice-option]").forEach((option) => {
      const available = product.variants.some((variant) => variant.visible && !variant.soldOut && variant.sizeName === option.dataset.choiceLabel && variant.colorCode === selected.colorCode);
      option.dataset.availability = available ? "available" : "unavailable";
      updateAccessibleAvailability(option, !available);
    });
  }

  function hasVariantImageChoices(gallery) {
    const panel = gallery.closest(".product-detail__panel");
    if (!panel) return false;
    const displayedOptions = (selector) => Array.from(panel.querySelectorAll(selector))
      .filter((option) => option.getClientRects().length > 0);
    const colors = displayedOptions('[data-choice-kind="swatch"] [data-choice-option]');
    if (colors.length > 1) return true;
    if (panel.querySelector("[data-teamwear-form]")) {
      return displayedOptions('[data-choice-title="Pattern"] [data-choice-option]').length > 1;
    }
    // Sizes only provide an image choice when their variant photographs differ.
    const product = window.PARADIGM_PRODUCT;
    if (product?.code !== panel.dataset.itemCode) return false;
    const sizes = displayedOptions('[data-choice-kind="chip"] [data-choice-option]');
    if (sizes.length < 2) return false;
    const colorCodes = new Set(colors.map((option) => option.dataset.colorCode));
    const sizeNames = new Set(sizes.map((option) => option.dataset.choiceLabel));
    return new Set(product.variants.filter((variant) => variant.visible
      && colorCodes.has(variant.colorCode) && sizeNames.has(variant.sizeName))
      .map((variant) => variant.imageId).filter(Boolean)).size > 1;
  }

  function syncVariantImage(gallery, media, { imageId = "", alt = "", reveal = false, root = "../.." } = {}) {
    if (!gallery) return;
    const resolve = (path) => new URL(`${root}/${path}`, document.baseURI).href;
    let image = gallery.querySelector("[data-product-variant-image]");
    if (!media?.src) {
      image?.remove();
      document.dispatchEvent(new CustomEvent("paradigm:product-media-change"));
      return;
    }
    if (!image) {
      image = document.createElement("img");
      image.setAttribute("data-product-variant-image", "");
      image.setAttribute("data-media-zoom-touch", "");
      image.sizes = "(min-width: 80rem) 768px, (min-width: 64rem) 60vw, 100vw";
      gallery.append(image);
    }
    const src = resolve(media.src);
    if ((imageId && image.dataset.productImageId !== imageId) || (!imageId && image.src !== src)) {
      image.src = src;
      if (media.derivatives?.length) image.srcset = media.derivatives.map((entry) => `${resolve(entry.path)} ${entry.width}w`).join(", ");
      else image.removeAttribute("srcset");
      image.width = media.width || 1;
      image.height = media.height || 1;
      if (imageId) image.dataset.productImageId = imageId;
    }
    image.removeAttribute("data-l10n-alt");
    image.removeAttribute("data-l10n-params");
    image.dataset.sourceAlt = alt;
    image.alt = window.PARADIGM_LANGUAGE.imageText(alt, image);
    gallery.setAttribute("data-media-zoom-gallery", "");
    if (reveal && hasVariantImageChoices(gallery)) {
      gallery.setAttribute("data-variant-revealed", "");
      image.loading = "eager";
      if (!window.matchMedia("(min-width: 64rem)").matches) gallery.scrollTo({ left: image.offsetLeft, behavior: "instant" });
    }
    document.dispatchEvent(new CustomEvent("paradigm:product-media-change"));
  }

  window.PARADIGM_VARIANT_GALLERY = { sync: syncVariantImage };

  function syncProductGallery(gallery, product, variant) {
    if (!product.galleryMedia) return;
    const ids = variant?.imageIds || product.galleryImageIds;
    const slides = Array.from(gallery.querySelectorAll("img:not([data-product-variant-image])"));
    if (JSON.stringify(slides.map((image) => image.dataset.productImageId)) === JSON.stringify(ids)) return;
    const template = slides[0];
    if (!template) return;
    const variantSlide = gallery.querySelector("[data-product-variant-image]");
    ids.forEach((id, index) => {
      const media = product.galleryMedia[id];
      const image = slides[index] || template.cloneNode();
      const resolve = (path) => new URL(`../../${path}`, document.baseURI).href;
      image.src = resolve(media.src);
      if (media.derivatives?.length) image.srcset = media.derivatives.map((entry) => `${resolve(entry.path)} ${entry.width}w`).join(", ");
      else image.removeAttribute("srcset");
      image.width = media.width || 1;
      image.height = media.height || 1;
      image.dataset.productImageId = id;
      image.loading = index ? "lazy" : "eager";
      image.removeAttribute("data-l10n-alt");
      image.removeAttribute("data-l10n-params");
      const alt = index ? `${product.name}, view ${index + 1}` : `${product.name} product image`;
      image.dataset.sourceAlt = alt;
      image.alt = window.PARADIGM_LANGUAGE.imageText(alt, image);
      if (!slides[index]) gallery.insertBefore(image, variantSlide);
    });
    slides.slice(ids.length).forEach((image) => image.remove());
  }

  function syncProductSource(detail, product, revealImage = false) {
    const selected = selectedProductValues(detail);
    const variant = product.variants.find((variant) => variant.visible && variant.colorCode === selected.colorCode && variant.sizeName === selected.sizeName);
    const action = detail.querySelector("[data-primary-action]");
    if (action) action.dataset.actionDefaultHref = variant?.link || product.link;
    if (revealImage) {
      const url = new URL(location.href);
      if (variant) url.searchParams.set("variant", variant.sku);
      else url.searchParams.delete("variant");
      history.replaceState(history.state, "", url);
    }

    const gallery = detail.querySelector("[data-product-gallery]");
    if (!gallery) return;
    syncProductGallery(gallery, product, variant);
    const colorImages = [...new Set(product.variants.filter((candidate) => candidate.visible && candidate.colorCode === selected.colorCode && candidate.imageId).map((candidate) => candidate.imageId))];
    const imageId = variant?.imageId || (colorImages.length === 1 ? colorImages[0] : "");
    const media = product.variantMedia?.[imageId];
    syncVariantImage(gallery, media, {
      imageId,
      alt: `${product.name}, ${selected.colorName}${colorImages.length > 1 ? `, ${selected.sizeName}` : ""}`,
      reveal: revealImage
    });
  }

  function selectLinkedProductVariant(detail, product) {
    const sku = new URLSearchParams(location.search).get("variant");
    const variant = product.variants.find((candidate) => candidate.visible && candidate.sku === sku);
    if (!variant) return;
    const colorId = product.colors.find((color) => color.colorCode === variant.colorCode)?.id;
    const color = Array.from(detail.querySelectorAll('[data-choice-kind="swatch"] [data-choice-option]')).find((option) => option.dataset.choiceId === colorId);
    const size = Array.from(detail.querySelectorAll('[data-choice-kind="chip"] [data-choice-option]')).find((option) => option.dataset.choiceLabel === variant.sizeName);
    if (!color || !size) return;
    color.querySelector("input").checked = true;
    size.querySelector("input").checked = true;
    announceSelection(color.closest("[data-choice-group]"));
    announceSelection(size.closest("[data-choice-group]"));
  }

  function updateAccessibleAvailability(option, unavailable) {
    const input = option.querySelector('input[type="radio"]');
    let text = option.querySelector("[data-choice-availability-text]");
    if (unavailable && !text) {
      text = document.createElement("span");
      text.className = "visually-hidden";
      text.dataset.choiceAvailabilityText = "";
      text.id = `${input.id}-availability`;
      text.setAttribute("data-l10n", "Unavailable");
      text.textContent = translate("Unavailable", option);
      option.appendChild(text);
    }
    if (unavailable) input.setAttribute("aria-describedby", text.id);
    else {
      input.removeAttribute("aria-describedby");
      text?.remove();
    }
  }

  function exactProductSelectionUnavailable(detail, product) {
    const selected = selectedProductValues(detail);
    const variants = product.variants.filter((variant) => variant.visible && variant.colorCode === selected.colorCode && variant.sizeName === selected.sizeName);
    return !variants.length || variants.every((variant) => variant.soldOut);
  }

  function boundGroups(action) {
    return Array.from(document.querySelectorAll(`[data-choice-group][data-primary-action-id="${CSS.escape(action.id)}"]`));
  }

  function selectionUnavailable(action) {
    const groups = boundGroups(action);
    const productDetail = action.closest("[data-product-detail]");
    if (productDetail) {
      const product = productForGroup(groups[0]);
      if (product) return exactProductSelectionUnavailable(productDetail, product);
    }
    return groups.some((group) => checkedOption(group)?.dataset.availability === "unavailable");
  }

  function actionSelectionText(action) {
    const groups = boundGroups(action);
    const values = groups.map((group) => `${group.dataset.choiceTitle}: ${groupLabel(group)}`);
    const context = action.closest("[data-notification-title], [data-product-detail], [data-teamwear-form]");
    const title = context?.dataset.notificationTitle || document.querySelector("h1")?.textContent?.trim() || document.title;
    const detail = action.closest("[data-product-detail]");
    const itemCode = detail?.dataset.itemCode;
    const teamwearForm = action.closest("[data-teamwear-form]");
    const modelCode = teamwearForm?.dataset.teamwearModel;
    const lines = ["Paradigm notification request", `Item: ${title}`];
    if (itemCode) lines.push(`Product number: ${itemCode}`);
    if (modelCode) lines.push(`Model: ${modelCode}`);
    lines.push(...values, "Please notify me when this selection is available.");
    return lines.join("\n");
  }

  function setActionState(action, notify) {
    const label = action.querySelector("[data-primary-action-label]");
    const intent = notify ? "notify" : action.dataset.actionDefaultIntent;
    const nextLabel = notify ? "Notify me" : action.dataset.actionDefaultLabel;
    const nextHref = notify ? action.dataset.actionNotifyHref : action.dataset.actionDefaultHref;
    const nextTarget = notify ? "_blank" : action.dataset.actionDefaultTarget;
    const nextExternal = notify
      ? action.dataset.actionNotifyExternal === "true"
      : action.dataset.actionDefaultExternal === "true";
    action.dataset.actionIntent = intent;
    action.dataset.externalLink = String(nextExternal);
    action.href = nextHref;
    if (nextTarget) {
      action.target = nextTarget;
      action.rel = "noopener noreferrer";
    } else {
      action.removeAttribute("target");
      action.removeAttribute("rel");
    }
    if (label) {
      label.setAttribute("data-l10n", nextLabel);
      label.textContent = translate(nextLabel, action);
    }
  }

  function syncAction(action) {
    setActionState(action, selectionUnavailable(action));
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.className = "clipboard-copy-buffer";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function copyNotification(action) {
    const text = actionSelectionText(action);
    fallbackCopy(text);
    navigator.clipboard?.writeText(text).catch(() => {});
    document.dispatchEvent(new CustomEvent("paradigm:notification-copied", { detail: { text } }));
  }

  function mountController(action) {
    if (action.dataset.actionBehavior !== "fixed-to-float") return;

    const inlineMount = document.querySelector(`[data-primary-action-inline-mount="${CSS.escape(action.id)}"]`);
    if (!inlineMount) return;

    const largeView = window.matchMedia("(min-width: 64rem)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inlineAboveViewport = false;
    let stateVersion = 0;
    let motionListener = null;

    function clearMotionListener() {
      if (motionListener) action.removeEventListener("transitionend", motionListener);
      motionListener = null;
    }

    function afterOpacityTransition(version, callback) {
      clearMotionListener();
      motionListener = (event) => {
        if (event.target !== action || event.propertyName !== "opacity" || version !== stateVersion) return;
        clearMotionListener();
        callback();
      };
      action.addEventListener("transitionend", motionListener);
    }

    function settleFloating() {
      ++stateVersion;
      clearMotionListener();
      action.classList.remove("is-floating-preparing");
      action.classList.add("is-floating", "is-floating-visible");
      action.dataset.floatingState = "floating";
    }

    function settleInline() {
      ++stateVersion;
      clearMotionListener();
      action.classList.remove("is-floating-preparing", "is-floating-visible", "is-floating");
      delete action.dataset.floatingState;
    }

    function enterFloating() {
      if (action.dataset.floatingState === "entering" || action.dataset.floatingState === "floating") return;
      const version = ++stateVersion;
      clearMotionListener();
      const startsInline = !action.classList.contains("is-floating");
      action.classList.add("is-floating");
      if (startsInline) action.classList.add("is-floating-preparing");
      action.dataset.floatingState = "entering";
      if (reducedMotion.matches) {
        settleFloating();
        return;
      }
      void action.offsetWidth;
      window.requestAnimationFrame(() => {
        if (version !== stateVersion || !largeView.matches || !inlineAboveViewport) return;
        action.classList.remove("is-floating-preparing");
        action.classList.add("is-floating-visible");
        afterOpacityTransition(version, () => {
          if (version === stateVersion) action.dataset.floatingState = "floating";
        });
      });
    }

    function exitFloating() {
      if (!action.classList.contains("is-floating")) {
        settleInline();
        return;
      }
      if (!action.classList.contains("is-floating-visible")) {
        settleInline();
        return;
      }
      if (action.dataset.floatingState === "exiting") return;
      const version = ++stateVersion;
      clearMotionListener();
      action.dataset.floatingState = "exiting";
      action.classList.remove("is-floating-visible");
      if (reducedMotion.matches) {
        settleInline();
        return;
      }
      afterOpacityTransition(version, () => {
        if (version === stateVersion) settleInline();
      });
    }

    function updateMount(immediate = false) {
      const shouldFloat = largeView.matches && inlineAboveViewport;
      if (immediate) {
        if (shouldFloat) settleFloating();
        else settleInline();
        return;
      }
      if (shouldFloat) enterFloating();
      else exitFloating();
    }

    if ("IntersectionObserver" in window) {
      const inlineObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          inlineAboveViewport = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
          updateMount();
        });
      }, { threshold: 0 });
      inlineObserver.observe(inlineMount);
    }
    largeView.addEventListener("change", (event) => updateMount(!event.matches));
    reducedMotion.addEventListener("change", (event) => updateMount(event.matches));
    updateMount();
  }

  const groups = Array.from(document.querySelectorAll("[data-choice-group]"));
  groups.forEach((group) => {
    bindRadioKeyboard(group);
    announceSelection(group);
    group.addEventListener("click", (event) => {
      if (!event.target.closest('input[type="radio"]')) return;
      const detail = group.closest("[data-product-detail]");
      const gallery = detail?.querySelector("[data-product-gallery]");
      if (!gallery || gallery.hasAttribute("data-variant-revealed")) return;
      const product = productForGroup(group);
      if (product) syncProductSource(detail, product, true);
    });
    group.addEventListener("change", () => {
      const detail = group.closest("[data-product-detail]");
      const product = productForGroup(group);
      if (detail && product) {
        recalculateProductAvailability(detail, product);
        syncProductSource(detail, product, true);
      }
      announceSelection(group);
      const action = document.getElementById(group.dataset.primaryActionId);
      if (action) syncAction(action);
      document.dispatchEvent(new CustomEvent("paradigm:choice-change", { detail: { group, option: checkedOption(group) } }));
    });
  });

  document.querySelectorAll("[data-product-detail]").forEach((detail) => {
    const group = detail.querySelector("[data-choice-group]");
    const product = group ? productForGroup(group) : null;
    if (product) {
      selectLinkedProductVariant(detail, product);
      recalculateProductAvailability(detail, product);
      syncProductSource(detail, product);
    }
  });

  groups.forEach(bindChoiceRail);

  document.querySelectorAll("[data-primary-action]").forEach((action) => {
    syncAction(action);
    mountController(action);
    action.addEventListener("click", () => {
      if (action.dataset.actionIntent === "notify") copyNotification(action);
    });
  });
  document.addEventListener("paradigm:language-change", () => {
    document.querySelectorAll("[data-choice-group]").forEach(announceSelection);
    document.querySelectorAll("[data-primary-action]").forEach(syncAction);
  });
})();
