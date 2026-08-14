(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hero = document.querySelector("[data-teamwear-hero]");

  if (hero) {
    if (reducedMotion) hero.classList.add("is-ready");
    else window.requestAnimationFrame(() => hero.classList.add("is-ready"));
  }

  const wordReveal = document.querySelector("[data-word-reveal]");

  if (wordReveal) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      wordReveal.classList.add("is-visible");
    } else {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -28%", threshold: 0.35 });

      revealObserver.observe(wordReveal);
    }
  }

  const storyPage = document.querySelector(".teamwear-story-page");
  const sectionReveals = Array.from(document.querySelectorAll("[data-section-reveal]"));

  if (sectionReveals.length) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      sectionReveals.forEach((element) => element.classList.add("is-visible"));
    } else {
      storyPage?.classList.add("reveal-ready");
      const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12%", threshold: 0.12 });

      sectionReveals.forEach((element) => sectionObserver.observe(element));
    }
  }

  const form = document.querySelector("[data-teamwear-form]");

  if (!form) return;

  const patternNames = {
    P01: "Essential",
    P02: "Classic",
    P03: "Signature"
  };
  const colorNames = {
    C01: "Wine",
    C02: "Cardinal",
    C03: "Azure",
    C04: "Midnight",
    C05: "Sapphire",
    C06: "Mocha",
    C07: "Black"
  };
  const summaryCode = document.querySelector("[data-summary-code]");
  const colorChoiceName = document.querySelector("[data-color-choice-name]");
  const dmAction = document.querySelector("[data-dm-action]");
  let currentSelection = null;

  function selectedValue(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  }

  function updateBuilder() {
    const pattern = selectedValue("pattern");
    const color = selectedValue("color");
    const complete = Boolean(pattern && color);
    const patternLabel = patternNames[pattern] || "";
    const colorLabel = colorNames[color] || "";
    const code = complete ? `B01-${pattern}-${color}` : "";

    form.querySelectorAll('input[name="pattern"], input[name="color"]').forEach((input) => {
      input.closest("label")?.classList.toggle("is-active", input.checked);
    });

    if (summaryCode) summaryCode.textContent = code;
    if (colorChoiceName) colorChoiceName.textContent = colorLabel;

    if (!dmAction) return;

    dmAction.setAttribute("aria-disabled", complete ? "false" : "true");
    if (complete) {
      dmAction.removeAttribute("tabindex");
      currentSelection = {
        text: `Paradigm Teamwear\nModel: Basketball 01\nPattern: ${patternLabel}\nColor: ${colorLabel}\nSelection code: ${code}`
      };
    } else {
      dmAction.setAttribute("tabindex", "-1");
      currentSelection = null;
    }
  }

  form.addEventListener("change", updateBuilder);

  ["pattern", "color"].forEach((name) => {
    const options = Array.from(form.querySelectorAll(`input[name="${name}"]`));

    options.forEach((option, index) => {
      option.addEventListener("keydown", (event) => {
        const nextKeys = ["ArrowRight", "ArrowDown"];
        const previousKeys = ["ArrowLeft", "ArrowUp"];
        let nextIndex = index;

        if (nextKeys.includes(event.key)) nextIndex = (index + 1) % options.length;
        else if (previousKeys.includes(event.key)) nextIndex = (index - 1 + options.length) % options.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = options.length - 1;
        else return;

        event.preventDefault();
        const nextOption = options[nextIndex];
        nextOption.checked = true;
        nextOption.focus();
        nextOption.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function copyCurrentSelection() {
    if (!currentSelection) return;

    fallbackCopy(currentSelection.text);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(currentSelection.text).catch(() => {});
    }
  }

  dmAction?.addEventListener("click", (event) => {
    if (dmAction.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }

    copyCurrentSelection();
  });

  updateBuilder();
})();
