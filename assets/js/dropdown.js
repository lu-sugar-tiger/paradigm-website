(function () {
  document.querySelectorAll("[data-dropdown]").forEach((root) => {
    const native = root.querySelector("select");
    const enhanced = root.querySelector(".dropdown__enhanced");
    const trigger = root.querySelector(".dropdown__trigger");
    const list = root.querySelector('[role="listbox"]');
    const options = Array.from(list.querySelectorAll('[role="option"]'));
    let typed = "";
    let typedAt = 0;

    function sync() {
      options.forEach((option) => option.setAttribute("aria-selected", String(option.dataset.value === native.value)));
      const label = native.selectedOptions[0].textContent;
      trigger.dataset.selected = "true";
      trigger.dataset.availability = options.find((option) => option.dataset.value === native.value)?.dataset.availability || "available";
      root.querySelector("[data-dropdown-value]").textContent = label;
      trigger.setAttribute("aria-label", `${trigger.dataset.dropdownLabel}: ${label}${trigger.dataset.availability === "unavailable" ? ", unavailable" : ""}`);
    }
    function close(restore = false) {
      list.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      typed = "";
      if (restore) trigger.focus();
    }
    function open() {
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      options.find((option) => option.dataset.value === native.value)?.focus();
    }
    function select(option) {
      const changed = native.value !== option.dataset.value;
      native.value = option.dataset.value;
      sync();
      close(true);
      if (changed) native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    native.addEventListener("change", () => {
      sync();
      root.dispatchEvent(new CustomEvent("paradigm:dropdown-change", { bubbles: true, detail: { name: native.name, value: native.value } }));
    });
    trigger.addEventListener("click", () => list.hidden ? open() : close());
    options.forEach((option) => option.addEventListener("click", () => select(option)));
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !list.hidden) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      }
      if (event.key === "Tab") {
        if (!list.hidden) close(true);
        return;
      }
      if (event.target === trigger && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); open(); return;
      }
      if (list.hidden) return;
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
    root.addEventListener("focusout", (event) => { if (!root.contains(event.relatedTarget)) close(); });
    root.closest("[data-nav-drawer], [data-search-overlay]")?.addEventListener("paradigm:overlay-close", () => close());
    sync();
    enhanced.hidden = false;
    native.hidden = true;
  });
})();
