(function () {
  const LARGE_QUERY = "(min-width: 64rem)";

  function checkedOption(group) {
    const input = group.querySelector('input[type="radio"]:checked');
    return input?.closest("[data-choice-option]") || null;
  }

  function groupLabel(group) {
    return checkedOption(group)?.dataset.choiceLabel || "";
  }

  function announceSelection(group) {
    const option = checkedOption(group);
    const labelValue = group.querySelector("[data-choice-label-value]");
    const status = group.querySelector("[data-choice-status]");
    if (labelValue && option) labelValue.textContent = option.dataset.choiceLabel;
    if (status && option) {
      status.textContent = `${group.dataset.choiceTitle}: ${option.dataset.choiceLabel}${option.dataset.availability === "unavailable" ? ", unavailable" : ""}`;
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
    const catalog = window.PARADIGM_CATALOG || { products: [] };
    return catalog.products.find((product) => product.productNumber === detail.dataset.productNumber) || null;
  }

  function selectedProductValues(detail) {
    const groups = Array.from(detail.querySelectorAll("[data-choice-group]"));
    const colorGroup = groups.find((group) => group.dataset.choiceKind === "swatch");
    const sizeGroup = groups.find((group) => group.dataset.choiceKind === "chip");
    return {
      colorId: checkedOption(colorGroup)?.dataset.choiceId || "",
      color: groupLabel(colorGroup),
      size: groupLabel(sizeGroup)
    };
  }

  function recalculateProductAvailability(detail, product) {
    const selected = selectedProductValues(detail);
    const colorGroup = detail.querySelector('[data-choice-kind="swatch"]');
    const sizeGroup = detail.querySelector('[data-choice-kind="chip"]');

    colorGroup?.querySelectorAll("[data-choice-option]").forEach((option) => {
      const available = product.variants.some((variant) => variant.visible && !variant.soldOut && variant.color === option.dataset.choiceLabel && variant.size === selected.size);
      option.dataset.availability = available ? "available" : "unavailable";
      updateAccessibleAvailability(option, !available);
    });
    sizeGroup?.querySelectorAll("[data-choice-option]").forEach((option) => {
      const available = product.variants.some((variant) => variant.visible && !variant.soldOut && variant.size === option.dataset.choiceLabel && variant.color === selected.color);
      option.dataset.availability = available ? "available" : "unavailable";
      updateAccessibleAvailability(option, !available);
    });
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
    const variants = product.variants.filter((variant) => variant.visible && variant.color === selected.color && variant.size === selected.size);
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
    const productNumber = detail?.dataset.productNumber;
    const teamwearForm = action.closest("[data-teamwear-form]");
    const modelCode = teamwearForm?.dataset.teamwearModel;
    const lines = ["Paradigm notification request", `Item: ${title}`];
    if (productNumber) lines.push(`Product number: ${productNumber}`);
    if (modelCode) lines.push(`Model: ${modelCode}`);
    lines.push(...values, "Please notify me when this selection is available.");
    return lines.join("\n");
  }

  function setActionState(action, notify) {
    const label = action.querySelector("[data-primary-action-label]");
    const icon = action.querySelector(".primary-action__icon");
    const intent = notify ? "notify" : action.dataset.actionDefaultIntent;
    const nextLabel = notify ? "Notify Me" : action.dataset.actionDefaultLabel;
    const nextSymbol = notify ? action.dataset.actionNotifySymbol : action.dataset.actionDefaultSymbol;
    const nextHref = notify ? action.dataset.actionNotifyHref : action.dataset.actionDefaultHref;
    const nextTarget = notify ? "_blank" : action.dataset.actionDefaultTarget;
    action.dataset.actionIntent = intent;
    action.href = nextHref;
    if (nextTarget) {
      action.target = nextTarget;
      action.rel = "noopener noreferrer";
    } else {
      action.removeAttribute("target");
      action.removeAttribute("rel");
    }
    if (label) label.textContent = nextLabel;
    if (icon) icon.textContent = nextSymbol;
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

  function preserveFocusWhileMoving(action, mount) {
    if (!mount || action.parentElement === mount) return;
    const hadFocus = action.contains(document.activeElement);
    mount.appendChild(action);
    if (hadFocus) action.focus({ preventScroll: true });
  }

  function mountController(action) {
    if (action.dataset.actionBehavior !== "fixed-to-float") return;

    const inlineMount = document.querySelector(`[data-primary-action-inline-mount="${CSS.escape(action.id)}"]`);
    const dockMount = document.querySelector(`[data-primary-action-dock-mount="${CSS.escape(action.id)}"]`);
    const footer = document.querySelector("[data-primary-action-footer-anchor]");
    if (!inlineMount || !dockMount || !footer) return;

    const largeQuery = window.matchMedia(LARGE_QUERY);
    let inlineAboveViewport = false;
    let footerVisible = false;

    function updateMount() {
      const isLarge = largeQuery.matches;
      const shouldDock = isLarge && footerVisible;
      const shouldFloat = isLarge && !shouldDock && inlineAboveViewport;
      action.classList.toggle("is-docked", shouldDock);
      action.classList.toggle("is-floating", shouldFloat);
      if (shouldDock) preserveFocusWhileMoving(action, dockMount);
      else preserveFocusWhileMoving(action, inlineMount);
    }

    if ("IntersectionObserver" in window) {
      const inlineObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          inlineAboveViewport = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
          updateMount();
        });
      }, { threshold: 0 });
      inlineObserver.observe(inlineMount);
      const footerObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          footerVisible = entry.isIntersecting;
          updateMount();
        });
      }, { threshold: 0 });
      footerObserver.observe(footer);
    }
    largeQuery.addEventListener("change", updateMount);
    updateMount();
  }

  const groups = Array.from(document.querySelectorAll("[data-choice-group]"));
  groups.forEach((group) => {
    bindRadioKeyboard(group);
    announceSelection(group);
    group.addEventListener("change", () => {
      const detail = group.closest("[data-product-detail]");
      const product = productForGroup(group);
      if (detail && product) recalculateProductAvailability(detail, product);
      announceSelection(group);
      const action = document.getElementById(group.dataset.primaryActionId);
      if (action) syncAction(action);
      document.dispatchEvent(new CustomEvent("paradigm:choice-change", { detail: { group, option: checkedOption(group) } }));
    });
  });

  document.querySelectorAll("[data-product-detail]").forEach((detail) => {
    const group = detail.querySelector("[data-choice-group]");
    const product = group ? productForGroup(group) : null;
    if (product) recalculateProductAvailability(detail, product);
  });

  document.querySelectorAll("[data-primary-action]").forEach((action) => {
    syncAction(action);
    mountController(action);
    action.addEventListener("click", () => {
      if (action.dataset.actionIntent === "notify") copyNotification(action);
    });
  });
})();
