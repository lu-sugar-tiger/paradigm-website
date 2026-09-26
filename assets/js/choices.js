(function () {
  function checkedOption(group) {
    const input = group?.querySelector("input:checked");
    return input?.closest("[data-choice-option]") || null;
  }

  function groupLabel(group) {
    return checkedOption(group)?.dataset.choiceLabel || (group?.dataset.choiceVariant === "add-on" ? "None" : "");
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
    const selectionLabel = groupLabel(group);
    const labelValue = group.querySelector("[data-choice-label-value]");
    const status = group.querySelector("[data-choice-status]");
    syncChoiceStateSymbols(group);
    if (labelValue && option) labelValue.textContent = option.dataset.choiceLabel;
    if (status && selectionLabel) {
      status.textContent = `${group.dataset.choiceTitle}: ${selectionLabel}${option?.dataset.availability === "unavailable" ? ", unavailable" : ""}`;
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
    const catalog = window.PARADIGM_CATALOG || { items: [] };
    return catalog.items.find((product) => product.code === detail.dataset.itemCode) || null;
  }

  function selectedProductValues(detail) {
    const groups = Array.from(detail.querySelectorAll("[data-choice-group]"));
    const colorGroup = groups.find((group) => group.dataset.choiceKind === "swatch");
    const sizeGroup = groups.find((group) => group.dataset.choiceKind === "chip");
    return {
      colorId: checkedOption(colorGroup)?.dataset.choiceId || "",
      colorName: groupLabel(colorGroup),
      sizeName: groupLabel(sizeGroup)
    };
  }

  function recalculateProductAvailability(detail, product) {
    const selected = selectedProductValues(detail);
    const colorGroup = detail.querySelector('[data-choice-kind="swatch"]');
    const sizeGroup = detail.querySelector('[data-choice-kind="chip"]');

    colorGroup?.querySelectorAll("[data-choice-option]").forEach((option) => {
      const available = product.variants.some((variant) => variant.visible && !variant.soldOut && variant.colorName === option.dataset.choiceLabel && variant.sizeName === selected.sizeName);
      option.dataset.availability = available ? "available" : "unavailable";
      updateAccessibleAvailability(option, !available);
    });
    sizeGroup?.querySelectorAll("[data-choice-option]").forEach((option) => {
      const available = product.variants.some((variant) => variant.visible && !variant.soldOut && variant.sizeName === option.dataset.choiceLabel && variant.colorName === selected.colorName);
      option.dataset.availability = available ? "available" : "unavailable";
      updateAccessibleAvailability(option, !available);
    });
  }

  function syncProductSource(detail, product, revealImage = false) {
    const selected = selectedProductValues(detail);
    const variant = product.variants.find((variant) => variant.visible && variant.colorName === selected.colorName && variant.sizeName === selected.sizeName);
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
    const colorImages = [...new Set(product.variants.filter((candidate) => candidate.visible && candidate.colorName === selected.colorName && candidate.imageId).map((candidate) => candidate.imageId))];
    const imageId = variant?.imageId || (colorImages.length === 1 ? colorImages[0] : "");
    const media = product.variantMedia?.[imageId];
    const resolve = (path) => new URL(`../../${path}`, document.baseURI).href;
    let image = gallery.querySelector("[data-product-variant-image]");
    if (!media) {
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
    if (image.dataset.productImageId !== imageId) {
      image.src = resolve(media.src);
      if (media.derivatives?.length) image.srcset = media.derivatives.map((entry) => `${resolve(entry.path)} ${entry.width}w`).join(", ");
      else image.removeAttribute("srcset");
      image.width = media.width || 1;
      image.height = media.height || 1;
      image.dataset.productImageId = imageId;
    }
    image.alt = `${product.name}, ${selected.colorName}${colorImages.length > 1 ? `, ${selected.sizeName}` : ""}`;
    gallery.setAttribute("data-media-zoom-gallery", "");
    if (revealImage) {
      gallery.setAttribute("data-variant-revealed", "");
      image.loading = "eager";
      if (!window.matchMedia("(min-width: 64rem)").matches) gallery.scrollTo({ left: image.offsetLeft, behavior: "instant" });
    }
    document.dispatchEvent(new CustomEvent("paradigm:product-media-change"));
  }

  function selectLinkedProductVariant(detail, product) {
    const sku = new URLSearchParams(location.search).get("variant");
    const variant = product.variants.find((candidate) => candidate.visible && candidate.sku === sku);
    if (!variant) return;
    const colorId = product.colors.find((color) => color.label === variant.colorName)?.id;
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
      text.textContent = "Unavailable";
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
    const variants = product.variants.filter((variant) => variant.visible && variant.colorName === selected.colorName && variant.sizeName === selected.sizeName);
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
    if (label) label.textContent = nextLabel;
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

  document.querySelectorAll("[data-primary-action]").forEach((action) => {
    syncAction(action);
    mountController(action);
    action.addEventListener("click", () => {
      if (action.dataset.actionIntent === "notify") copyNotification(action);
    });
  });
})();
