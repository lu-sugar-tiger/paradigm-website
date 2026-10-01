(function () {
  document.querySelectorAll("[data-dropdown]").forEach((root) => {
    const native = root.querySelector("select");
    const grouped = root.hasAttribute("data-dropdown-grouped");
    const enhanced = root.querySelector(".dropdown__enhanced");
    const trigger = root.querySelector(".dropdown__trigger");
    const list = root.querySelector(".dropdown__options");
    const options = Array.from(list.querySelectorAll('[role="option"]'));
    let typed = "";
    let typedAt = 0;
    let positionFrame = 0;

    function position() {
      if (list.hidden) return;
      const viewport = window.visualViewport;
      const gutter = parseFloat(getComputedStyle(list).scrollMarginLeft) || 0;
      const left = (viewport?.offsetLeft || 0) + gutter;
      const right = Math.min(document.documentElement.clientWidth, (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth)) - gutter;
      const top = (viewport?.offsetTop || 0) + gutter;
      const bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - gutter;
      const anchor = trigger.getBoundingClientRect();
      if (anchor.bottom < top || anchor.top > bottom) { close(); return; }
      list.style.setProperty("--dropdown-max-width", `${Math.max(0, right - left)}px`);
      list.style.setProperty("--dropdown-offset-x", "0px");
      const above = Math.max(0, anchor.top - top);
      const below = Math.max(0, bottom - anchor.bottom);
      const opensAbove = below < list.scrollHeight && above > below;
      list.dataset.dropdownSide = opensAbove ? "above" : "below";
      list.style.setProperty("--dropdown-max-height", `${opensAbove ? above : below}px`);
      const rect = list.getBoundingClientRect();
      const targetLeft = Math.max(left, Math.min(rect.left, right - rect.width));
      list.style.setProperty("--dropdown-offset-x", `${targetLeft - rect.left}px`);
    }
    function queuePosition() {
      if (list.hidden || positionFrame) return;
      positionFrame = requestAnimationFrame(() => { positionFrame = 0; position(); });
    }
    function sync() {
      if (grouped) return;
      options.forEach((option) => option.setAttribute("aria-selected", String(option.dataset.value === native.value)));
      const selectedOption = native.selectedOptions[0];
      const label = selectedOption.textContent;
      trigger.dataset.selected = "true";
      trigger.dataset.availability = options.find((option) => option.dataset.value === native.value)?.dataset.availability || "available";
      root.querySelector("[data-dropdown-value]").textContent = selectedOption.dataset.dropdownLabel || label;
      const detail = trigger.querySelector("[data-dropdown-detail]");
      if (detail) detail.textContent = selectedOption.dataset.dropdownDetail || "";
      trigger.setAttribute("aria-label", `${trigger.dataset.dropdownLabel}: ${label}${trigger.dataset.availability === "unavailable" ? ", unavailable" : ""}`);
    }
    function close(restore = false) {
      list.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      typed = "";
      if (restore) trigger.focus({ preventScroll: true });
    }
    function open() {
      root.dispatchEvent(new CustomEvent("paradigm:dropdown-open", { bubbles: true }));
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      position();
      const selected = grouped ? list.querySelector("input:checked, input") : options.find((option) => option.dataset.value === native.value);
      selected?.focus({ preventScroll: true });
    }
    function select(option) {
      const changed = native.value !== option.dataset.value;
      native.value = option.dataset.value;
      sync();
      close(true);
      if (changed) native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function emitGroups() {
      const error = root.querySelector("[data-dropdown-error]");
      let message = "";
      list.querySelectorAll('[data-dropdown-group="range"]').forEach((group) => {
        const min = group.querySelector('[data-range-bound="min"]');
        const max = group.querySelector('[data-range-bound="max"]');
        min.setCustomValidity("");
        max.setCustomValidity("");
        if (!min.validity.valid || !max.validity.valid) message = `Enter a value between ${min.min} and ${min.max}.`;
        else if (min.value !== "" && max.value !== "" && min.valueAsNumber > max.valueAsNumber) {
          message = "Minimum price must not exceed maximum price.";
          max.setCustomValidity(message);
        }
        for (const input of [min, max]) {
          input.setAttribute("aria-invalid", String(!input.validity.valid));
          input.setAttribute("aria-describedby", `${list.id}-error`);
        }
      });
      error.id = `${list.id}-error`;
      error.hidden = !message;
      error.textContent = message;
      queuePosition();
      if (message) return;
      const values = {};
      for (const [name, value] of new FormData(list)) (values[name] ||= []).push(value);
      root.dispatchEvent(new CustomEvent("paradigm:dropdown-change", { bubbles: true, detail: { values } }));
    }
    if (grouped) {
      list.addEventListener("change", emitGroups);
      list.addEventListener("submit", (event) => { event.preventDefault(); emitGroups(); });
      list.addEventListener("reset", () => requestAnimationFrame(emitGroups));
      list.querySelector("[data-dropdown-close]").addEventListener("click", () => close(true));
    } else {
      native.addEventListener("change", () => {
        sync();
        root.dispatchEvent(new CustomEvent("paradigm:dropdown-change", { bubbles: true, detail: { name: native.name, value: native.value } }));
      });
      options.forEach((option) => option.addEventListener("click", () => select(option)));
    }
    trigger.addEventListener("click", () => list.hidden ? open() : close());
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !list.hidden) {
        event.preventDefault(); event.stopPropagation(); close(true); return;
      }
      if (event.key === "Tab" && !grouped) {
        if (!list.hidden) close(true);
        return;
      }
      if (event.target === trigger && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); open(); return;
      }
      if (list.hidden || grouped) return;
      const index = options.indexOf(document.activeElement);
      let next = index;
      if (event.key === "ArrowDown") next = (index + 1) % options.length;
      else if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      else if (["Enter", " "].includes(event.key)) {
        event.preventDefault(); if (index >= 0) select(options[index]); return;
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const now = Date.now();
        typed = (now - typedAt > 700 ? "" : typed) + event.key.toLowerCase();
        typedAt = now;
        next = options.findIndex((option) => option.textContent.toLowerCase().startsWith(typed));
        if (next < 0) return;
      } else return;
      event.preventDefault(); options[next].focus();
    });
    document.addEventListener("pointerdown", (event) => { if (!root.contains(event.target)) close(); });
    // Labels briefly transfer focus through the document before their native input.
    root.addEventListener("focusout", (event) => { if (event.relatedTarget && !root.contains(event.relatedTarget)) close(); });
    document.addEventListener("paradigm:dropdown-open", (event) => { if (event.target !== root) close(); });
    document.addEventListener("paradigm:overlay-open", (event) => { if (!event.target.contains(root)) close(); });
    root.addEventListener("paradigm:dropdown-close", () => close());
    document.addEventListener("paradigm:overlay-close", (event) => { if (event.target.contains(root)) close(); });
    window.addEventListener("resize", queuePosition);
    document.addEventListener("scroll", (event) => { if (!list.contains(event.target)) queuePosition(); }, true);
    window.visualViewport?.addEventListener("resize", queuePosition);
    window.visualViewport?.addEventListener("scroll", queuePosition);
    sync();
    enhanced.hidden = false;
    if (native) native.hidden = true;
  });
})();
