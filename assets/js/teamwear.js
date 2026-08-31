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
            card.style.setProperty("--rail-card-delay", `${index * 40}ms`);
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

  rails.forEach((rail) => {
    const controls = document.querySelector(`[aria-controls="${rail.id}"]`)?.closest(".teamwear-rail-controls");
    const previousButton = controls?.querySelector("[data-rail-previous]");
    const nextButton = controls?.querySelector("[data-rail-next]");
    const cards = Array.from(rail.querySelectorAll(".teamwear-rail-card"));
    let railFrame = 0;

    function updateParallax() {
      railFrame = 0;
      if (reducedMotion) {
        cards.forEach((card) => {
          card.style.setProperty("--rail-photo-offset", "0px");
          card.style.setProperty("--rail-copy-offset", "0px");
        });
        return;
      }
      const railRect = rail.getBoundingClientRect();
      const railCenter = railRect.left + railRect.width / 2;
      const positions = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        const range = Math.max(1, (railRect.width + rect.width) / 2);
        return clamp((rect.left + rect.width / 2 - railCenter) / range, -1, 1);
      });
      cards.forEach((card, index) => {
        card.style.setProperty("--rail-photo-offset", `${positions[index] * -16}px`);
        card.style.setProperty("--rail-copy-offset", `${positions[index] * 8}px`);
      });
    }

    function queueRailFrame() {
      if (railFrame) return;
      railFrame = window.requestAnimationFrame(() => {
        updateControls();
        updateParallax();
      });
    }
    railUpdates.set(rail, queueRailFrame);

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
      rail.scrollBy({ left: direction * distance, behavior: reducedMotion ? "auto" : "smooth" });
    }

    previousButton?.addEventListener("click", () => scrollRail(-1));
    nextButton?.addEventListener("click", () => scrollRail(1));
    rail.addEventListener("scroll", queueRailFrame, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(queueRailFrame).observe(rail);
    else window.addEventListener("resize", queueRailFrame, { passive: true });
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

  function updateColorwayRail() {
    if (!patternPicker || !colorwayRail) return;
    const option = checkedChoice(patternPicker, "chip");
    const preview = patternById.get(option?.dataset.choiceId);
    if (!preview) return;

    colorwayRail.querySelectorAll("[data-colorway-card]").forEach((card) => {
      const image = card.querySelector("[data-colorway-image]");
      const colorName = card.dataset.colorName || "Road";
      card.classList.add("is-updating");
      if (!image) return;
      image.src = `../${preview.preview}`;
      image.alt = `${preview.name} ${model.name} ${colorName} Road uniform rendering`;
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
    return `NT$${Number(value).toLocaleString("en-US")}`;
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
    if (price) price.textContent = priceLabel(totalPrice());
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

  form.addEventListener("change", updateBuilderPrice);
  const action = form.querySelector("[data-primary-action]");
  action?.addEventListener("click", () => {
    if (action.dataset.actionIntent === "notify") return;
    const text = inquiryText();
    fallbackCopy(text);
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  updateBuilderPrice();
})();
