(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const data = window.PARADIGM_TEAMWEAR || { models: [] };
  const model = data.models[0];

  const hero = document.querySelector("[data-teamwear-hero]");
  if (hero) {
    if (reducedMotion) hero.classList.add("is-ready");
    else window.requestAnimationFrame(() => hero.classList.add("is-ready"));
  }

  const storyPage = document.querySelector(".teamwear-story-page");
  const sectionReveals = Array.from(document.querySelectorAll("[data-section-reveal]"));
  if (sectionReveals.length) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      sectionReveals.forEach((element) => element.classList.add("is-visible"));
    } else {
      storyPage?.classList.add("reveal-ready");
      const observer = new IntersectionObserver((entries, revealObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12%", threshold: 0.12 });
      sectionReveals.forEach((element) => observer.observe(element));
    }
  }

  document.querySelectorAll("[data-card-rail]").forEach((rail) => {
    const controls = document.querySelector(`[aria-controls="${rail.id}"]`)?.closest(".teamwear-rail-controls");
    const previousButton = controls?.querySelector("[data-rail-previous]");
    const nextButton = controls?.querySelector("[data-rail-next]");
    if (!previousButton || !nextButton) return;

    function updateControls() {
      const maximumScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      previousButton.disabled = rail.scrollLeft <= 1;
      nextButton.disabled = rail.scrollLeft >= maximumScroll - 1;
    }

    function scrollRail(direction) {
      const firstCard = rail.querySelector(".teamwear-rail-card");
      const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
      const distance = (firstCard?.getBoundingClientRect().width || rail.clientWidth * 0.8) + gap;
      rail.scrollBy({ left: direction * distance, behavior: reducedMotion ? "auto" : "smooth" });
    }

    previousButton.addEventListener("click", () => scrollRail(-1));
    nextButton.addEventListener("click", () => scrollRail(1));
    rail.addEventListener("scroll", updateControls, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(updateControls).observe(rail);
    else window.addEventListener("resize", updateControls, { passive: true });
    updateControls();
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
      if (image.complete) window.requestAnimationFrame(() => card.classList.remove("is-updating"));
      else image.addEventListener("load", () => card.classList.remove("is-updating"), { once: true });
    });
    const status = patternPicker.querySelector("[data-pattern-status]");
    if (status) status.textContent = `${preview.name} pattern shown across seven Road colors.`;
  }

  patternPicker?.addEventListener("change", updateColorwayRail);
  updateColorwayRail();

  const faqList = document.querySelector(".teamwear-faq__list");
  if (faqList) {
    const faqItems = Array.from(faqList.querySelectorAll("details"));
    const faqQuestions = faqItems.map((item) => item.querySelector("summary")).filter(Boolean);
    let faqMeasureFrame = 0;

    function measureClosedFaqQuestions() {
      if (faqItems.some((item) => item.open)) return;
      faqList.style.removeProperty("--teamwear-faq-question-height");
      const tallestQuestion = Math.max(...faqQuestions.map((question) => question.getBoundingClientRect().height));
      if (tallestQuestion > 0) {
        faqList.style.setProperty("--teamwear-faq-question-height", `${Math.ceil(tallestQuestion)}px`);
      }
    }

    function scheduleFaqMeasurement() {
      window.cancelAnimationFrame(faqMeasureFrame);
      faqMeasureFrame = window.requestAnimationFrame(measureClosedFaqQuestions);
    }

    faqItems.forEach((item) => item.addEventListener("toggle", () => {
      if (!faqItems.some((candidate) => candidate.open)) scheduleFaqMeasurement();
    }));
    window.addEventListener("resize", scheduleFaqMeasurement, { passive: true });
    document.fonts?.ready.then(scheduleFaqMeasurement);
    scheduleFaqMeasurement();
  }

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

  function updateBuilder() {
    const pattern = selectedOption("chip");
    const color = selectedOption("swatch");
    const summaryCode = form.querySelector("[data-summary-code]");
    if (summaryCode && pattern && color) summaryCode.textContent = `${model.code}-${pattern.dataset.choiceId}-${color.dataset.choiceId}`;
  }

  function inquiryText() {
    const pattern = selectedOption("chip");
    const color = selectedOption("swatch");
    return [
      "Paradigm Teamwear inquiry",
      `Model: ${model.name}`,
      `Pattern: ${pattern?.dataset.choiceLabel || ""}`,
      `Color: ${color?.dataset.choiceLabel || colorNameById.get(colorByOptionId.get(color?.dataset.choiceId)?.id) || ""}`,
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

  form.addEventListener("change", updateBuilder);
  const action = form.querySelector("[data-primary-action]");
  action?.addEventListener("click", () => {
    if (action.dataset.actionIntent === "notify") return;
    const text = inquiryText();
    fallbackCopy(text);
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  updateBuilder();
})();
