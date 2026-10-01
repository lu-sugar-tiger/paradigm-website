(function () {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  const data = window.PARADIGM_TEAMWEAR || { models: [] };
  const model = data.models[0];

  const hero = document.querySelector("[data-teamwear-hero]");
  if (hero) {
    if (reducedMotion) hero.classList.add("is-ready");
    else window.requestAnimationFrame(() => hero.classList.add("is-ready"));
  }

  const storyPage = document.querySelector(".teamwear-story-page");
  const rails = Array.from(document.querySelectorAll("[data-card-rail]"));
  const railUpdates = new WeakMap();
  const railCards = rails.flatMap((rail) => Array.from(rail.querySelectorAll(".teamwear-rail-card[data-section-reveal]")));
  const sectionReveals = Array.from(document.querySelectorAll("[data-section-reveal]"))
    .filter((element) => !element.classList.contains("teamwear-rail-card"));
  if (sectionReveals.length || railCards.length) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      [...sectionReveals, ...railCards].forEach((element) => element.classList.add("is-visible"));
    } else {
      storyPage?.classList.add("reveal-ready");
      const sectionObserver = new IntersectionObserver((entries, revealObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12%", threshold: 0.12 });
      sectionReveals.forEach((element) => sectionObserver.observe(element));

      const railObserver = new IntersectionObserver((entries, revealObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          Array.from(entry.target.querySelectorAll(".teamwear-rail-card[data-section-reveal]")).forEach((card, index) => {
            card.style.setProperty("--rail-card-delay", `calc(${index} * var(--motion-stagger-short))`);
            card.classList.add("is-visible");
          });
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12%", threshold: 0.12 });
      rails.forEach((rail) => railObserver.observe(rail));
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  // Evaluate shared CSS curves against spatial progress as well as settle time.
  function motionCurve(value) {
    const values = value.match(/-?\d*\.?\d+/g)?.map(Number);
    if (values?.length !== 4) return (progress) => progress;
    const [x1, y1, x2, y2] = values;
    const sample = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    return (progress) => {
      if (progress <= 0 || progress >= 1) return clamp(progress, 0, 1);
      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 20; iteration += 1) {
        const middle = (low + high) / 2;
        if (sample(middle, x1, x2) < progress) low = middle;
        else high = middle;
      }
      return sample((low + high) / 2, y1, y2);
    };
  }

  rails.forEach((rail) => {
    const controls = document.querySelector(`[aria-controls="${rail.id}"]`)?.closest(".teamwear-rail-controls");
    const previousButton = controls?.querySelector("[data-rail-previous]");
    const nextButton = controls?.querySelector("[data-rail-next]");
    const cards = Array.from(rail.querySelectorAll(".teamwear-rail-card"));
    let railFrame = 0;
    let settleFrame = 0;
    let geometry;

    function refreshGeometry() {
      const style = getComputedStyle(rail);
      const width = cards[0]?.getBoundingClientRect().width || 1;
      const gap = parseFloat(style.columnGap) || 0;
      const edge = parseFloat(style.paddingLeft) || 0;
      const slots = Math.max(1, Math.floor((rail.clientWidth - edge + gap + 1) / (width + gap)));
      geometry = {
        width, step: width + gap, start: edge,
        end: edge + (slots - 1) * (width + gap),
        enterRange: width * parseFloat(style.getPropertyValue("--rail-copy-enter-range")),
        exitRange: width * parseFloat(style.getPropertyValue("--rail-copy-exit-range")),
        enterCurve: motionCurve(style.getPropertyValue("--rail-copy-enter-curve")),
        exitCurve: motionCurve(style.getPropertyValue("--rail-copy-exit-curve")),
        settleCurve: motionCurve(style.getPropertyValue("--rail-settle-ease")),
        duration: parseFloat(style.getPropertyValue("--rail-settle-duration"))
      };
    }

    function updateCopyVisibility() {
      railFrame = 0;
      const railRect = rail.getBoundingClientRect();
      const positions = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        const position = rect.left - railRect.left;
        // The plateau spans every complete presentation slot, not one active card.
        const left = Math.max(0, geometry.start - position - 1);
        const right = Math.max(0, position - geometry.end - 1);
        if (reducedMotion || (!left && !right)) return { opacity: 1, travel: 0 };
        const progress = clamp((left || right) / (left ? geometry.exitRange : geometry.enterRange), 0, 1);
        // Spatial curves are independent of velocity: reversing retraces exactly.
        const opacity = left ? 1 - geometry.exitCurve(progress) : geometry.enterCurve(1 - progress);
        return { opacity, travel: (left ? -1 : 1) * progress };
      });
      cards.forEach((card, index) => {
        card.style.setProperty("--rail-copy-opacity", positions[index].opacity);
        card.style.setProperty("--rail-copy-travel", positions[index].travel);
      });
    }

    function queueRailFrame() {
      if (railFrame) return;
      railFrame = window.requestAnimationFrame(() => {
        updateControls();
        updateCopyVisibility();
      });
    }
    railUpdates.set(rail, queueRailFrame);

    function cancelSettle() {
      cancelAnimationFrame(settleFrame);
      settleFrame = 0;
      rail.classList.remove("is-settling");
    }

    function settleTo(target) {
      cancelSettle();
      const start = rail.scrollLeft;
      const end = clamp(target, 0, Math.max(0, rail.scrollWidth - rail.clientWidth));
      if (reducedMotion || Math.abs(end - start) <= 1) {
        rail.scrollTo({ left: end, behavior: "instant" });
        return;
      }
      rail.classList.add("is-settling");
      const started = performance.now();
      function tick(now) {
        const progress = clamp((now - started) / geometry.duration, 0, 1);
        rail.scrollLeft = start + (end - start) * geometry.settleCurve(progress);
        if (progress < 1) settleFrame = requestAnimationFrame(tick);
        else cancelSettle();
      }
      settleFrame = requestAnimationFrame(tick);
    }

    function updateControls() {
      if (!previousButton || !nextButton) return;
      const maximumScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const atStart = rail.scrollLeft <= 1;
      const lastCard = rail.querySelector(".teamwear-rail-card:last-child");
      const railRight = rail.getBoundingClientRect().right;
      const lastCardRight = lastCard?.getBoundingClientRect().right || railRight;
      const atEnd = maximumScroll <= 1 || lastCardRight <= railRight + 1;
      previousButton.disabled = atStart;
      previousButton.hidden = atStart;
      nextButton.disabled = atEnd;
      nextButton.hidden = atEnd;
    }

    function scrollRail(direction) {
      const firstCard = rail.querySelector(".teamwear-rail-card");
      const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
      const distance = (firstCard?.getBoundingClientRect().width || rail.clientWidth * 0.8) + gap;
      const currentIndex = Math.round(rail.scrollLeft / distance);
      const targetIndex = clamp(currentIndex + direction, 0, Math.max(0, cards.length - 1));
      settleTo(targetIndex * distance);
    }

    previousButton?.addEventListener("click", () => scrollRail(-1));
    nextButton?.addEventListener("click", () => scrollRail(1));
    let drag = null;
    rail.addEventListener("pointerdown", (event) => {
      cancelSettle();
      const media = event.target.closest(".teamwear-rail-card__media");
      if (!media || event.pointerType !== "mouse" || event.button !== 0) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, left: rail.scrollLeft };
      rail.classList.add("is-pointer-dragging");
      rail.setPointerCapture(event.pointerId);
    });
    rail.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      rail.scrollLeft = drag.left + drag.x - event.clientX;
    });
    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
      const step = cards[0].getBoundingClientRect().width + gap;
      const target = Math.round(rail.scrollLeft / step) * step;
      const pointerId = drag.id;
      drag = null;
      settleTo(target);
      rail.classList.remove("is-pointer-dragging");
      if (rail.hasPointerCapture(pointerId)) rail.releasePointerCapture(pointerId);
    }
    rail.addEventListener("pointerup", finishDrag);
    rail.addEventListener("pointercancel", finishDrag);
    rail.addEventListener("lostpointercapture", finishDrag);
    rail.addEventListener("dragstart", (event) => {
      if (event.target.closest(".teamwear-rail-card__media")) event.preventDefault();
    });
    rail.addEventListener("scroll", queueRailFrame, { passive: true });
    rail.addEventListener("wheel", cancelSettle, { passive: true });
    rail.addEventListener("keydown", cancelSettle);
    reducedMotionQuery.addEventListener("change", cancelSettle);
    function resizeRail() {
      cancelSettle();
      refreshGeometry();
      queueRailFrame();
    }
    if ("ResizeObserver" in window) new ResizeObserver(resizeRail).observe(rail);
    else window.addEventListener("resize", resizeRail, { passive: true });
    refreshGeometry();
    queueRailFrame();
  });

  reducedMotionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      hero?.classList.add("is-ready");
      [...sectionReveals, ...railCards].forEach((element) => element.classList.add("is-visible"));
    }
    rails.forEach((rail) => railUpdates.get(rail)?.());
  });

  const patternPicker = document.querySelector("[data-teamwear-pattern-picker]");
  const colorwayRail = document.querySelector("[data-colorway-rail]");
  const patternById = new Map((model?.patterns || []).map((pattern) => [pattern.id, pattern]));

  function checkedChoice(scope, kind) {
    return scope?.querySelector(`[data-choice-kind="${kind}"] [data-choice-option]:has(input:checked)`);
  }

  function updateUniformImage(image, media, root, alt) {
    if (!image || !media) return false;
    const src = `${root}/${media.src}`;
    if (image.getAttribute("src") === src) return false;
    image.srcset = media.derivatives.map((entry) => `${root}/${entry.path} ${entry.width}w`).join(", ");
    image.width = media.width;
    image.height = media.height;
    image.alt = alt;
    if (image.getAttribute("aria-haspopup") === "dialog") {
      image.setAttribute("aria-label", `${alt}. Open enlarged image gallery.`);
    }
    image.src = src;
    return true;
  }

  function updateColorwayRail() {
    if (!patternPicker || !colorwayRail) return;
    const option = checkedChoice(patternPicker, "chip");
    const preview = patternById.get(option?.dataset.choiceId);
    if (!preview) return;

    colorwayRail.querySelectorAll("[data-colorway-card]").forEach((card) => {
      const image = card.querySelector("[data-colorway-image]");
      const colorName = card.dataset.colorName || "Road";
      if (!image) return;
      card.classList.add("is-updating");
      updateUniformImage(image, preview.mediaByColor[card.dataset.colorId], "..",
        `${preview.name} ${model.name} in ${colorName}, front and back`);
      const finishUpdate = () => {
        card.classList.remove("is-updating");
        railUpdates.get(colorwayRail)?.();
      };
      if (image.complete) window.requestAnimationFrame(finishUpdate);
      else image.addEventListener("load", finishUpdate, { once: true });
    });
    const status = patternPicker.querySelector("[data-pattern-status]");
    if (status) status.textContent = `${preview.name} pattern shown across seven Road colors.`;
  }

  patternPicker?.addEventListener("change", updateColorwayRail);
  updateColorwayRail();

  const form = document.querySelector("[data-teamwear-form]");
  if (!form || !model) return;

  const colorByOptionId = new Map(model.colors.map((color) => [color.id, color]));
  const colorNameById = new Map();
  form.querySelectorAll('[data-choice-kind="swatch"] [data-choice-option]').forEach((option) => {
    colorNameById.set(option.dataset.choiceId, option.dataset.choiceLabel);
  });

  function selectedOption(kind) {
    return checkedChoice(form, kind);
  }

  function selectedAddOns() {
    return Array.from(form.querySelectorAll('[data-choice-variant="add-on"] [data-choice-option]:has(input:checked)'));
  }

  function selectedQuantity() {
    return form.querySelector('[name="teamwear-quantity"]:checked')?.closest("[data-choice-option]") || null;
  }

  function priceLabel(value) {
    return window.PARADIGM_PRICING.format(value);
  }

  function totalPrice() {
    const selectedIds = new Set(selectedAddOns().map((option) => option.dataset.choiceId));
    const addOnAdjustment = (model.addOns || []).reduce((total, addOn) => total + (selectedIds.has(addOn.id) ? addOn.priceAdjustment : 0), 0);
    const quantityId = selectedQuantity()?.dataset.choiceId;
    const quantityAdjustment = (model.quantities || []).find((quantity) => quantity.id === quantityId)?.priceAdjustment || 0;
    return model.price + quantityAdjustment + addOnAdjustment;
  }

  function updateBuilderPrice() {
    const price = form.querySelector("[data-teamwear-price]");
    if (price) {
      const total = totalPrice();
      price.dataset.priceTwd = total;
      price.textContent = priceLabel(total);
    }
  }

  function updateBuilderVariantImage(reveal = false) {
    const pattern = patternById.get(selectedOption("chip")?.dataset.choiceId);
    const color = colorByOptionId.get(selectedOption("swatch")?.dataset.choiceId);
    if (!pattern || !color) return;
    const gallery = form.closest(".product-detail__panel")?.querySelector("[data-builder-preview]");
    window.PARADIGM_VARIANT_GALLERY?.sync(gallery, pattern.mediaByColor[color.colorId], {
      alt: `${pattern.name} ${model.name} in ${colorNameById.get(color.id)}, front and back`,
      reveal
    });
  }

  function isBuilderImageChoice(target) {
    const group = target.closest("[data-choice-group]");
    return group && ["Color", "Pattern"].includes(group.dataset.choiceTitle);
  }

  function inquiryText() {
    const pattern = selectedOption("chip");
    const color = selectedOption("swatch");
    const quantity = selectedQuantity();
    const addOns = selectedAddOns();
    return [
      "Paradigm Teamwear inquiry",
      `Model: ${model.name}`,
      `Pattern: ${pattern?.dataset.choiceLabel || ""}`,
      `Color: ${color?.dataset.choiceLabel || colorNameById.get(colorByOptionId.get(color?.dataset.choiceId)?.id) || ""}`,
      `Quantity: ${quantity?.dataset.choiceLabel || ""}`,
      `Add-on: ${addOns.length ? addOns.map((option) => option.dataset.choiceLabel).join(", ") : "None"}`,
      `Price: ${priceLabel(totalPrice())}`,
      `Selection code: ${model.code}-${pattern?.dataset.choiceId || ""}-${color?.dataset.choiceId || ""}`
    ].join("\n");
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

  form.addEventListener("click", (event) => {
    if (!event.target.closest('input[type="radio"]') || !isBuilderImageChoice(event.target)) return;
    const gallery = form.closest(".product-detail__panel")?.querySelector("[data-builder-preview]");
    if (!gallery?.hasAttribute("data-variant-revealed")) updateBuilderVariantImage(true);
  });
  form.addEventListener("change", (event) => {
    updateBuilderPrice();
    if (isBuilderImageChoice(event.target)) updateBuilderVariantImage(true);
  });
  const action = form.querySelector("[data-primary-action]");
  action?.addEventListener("click", () => {
    if (action.dataset.actionIntent === "notify") return;
    const text = inquiryText();
    fallbackCopy(text);
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  updateBuilderPrice();
  updateBuilderVariantImage();
  document.addEventListener("paradigm:language-change", () => {
    updateBuilderPrice();
    updateBuilderVariantImage();
  });
})();
