(() => {
  const large = matchMedia("(min-width: 64rem)");
  document.querySelectorAll(".choice-overflow-preview [data-choice-group]").forEach((group, index) => {
    const options = group.querySelector(".choice-group__options");
    const choices = [...options.querySelectorAll("[data-choice-option]")];
    const layout = group.querySelector(".choice-group__layout");
    const noun = group.dataset.choiceKind === "swatch" ? "colors" : "sizes";
    const selected = () => choices.find((choice) => choice.querySelector("input").checked);
    function syncSizeLabel() {
      if (noun !== "sizes") return;
      const label = group.querySelector(".choice-group__label");
      label.textContent = `Size · ${selected()?.dataset.choiceLabel || ""}`;
    }
    if (group.dataset.overflowMode === "rails") {
      // The approved proposal now uses the production rail controller.
      group.addEventListener("change", syncSizeLabel);
      syncSizeLabel();
      return;
    }
    const toggle = document.createElement("button");
    const text = document.createElement("span");
    const icon = group.querySelector("[data-overflow-toggle-icon]").content.firstElementChild.cloneNode(true);
    toggle.type = "button";
    toggle.className = "choice-overflow-toggle";
    toggle.hidden = true;
    options.id ||= `overflow-options-${index}`;
    toggle.setAttribute("aria-controls", options.id);
    text.className = "choice-overflow-toggle__label";
    toggle.append(text, icon);
    layout.append(toggle);
    let expanded = false;
    let collapsedChoices = choices;
    let lastWidth = -1;
    let frame;

    function applyVisibility() {
      const hasOverflow = collapsedChoices.length < choices.length;
      const visible = new Set(collapsedChoices);
      const current = selected();
      // Keep source order; substitute the last collapsed slot for a later selection.
      if (current && !visible.has(current)) {
        visible.delete(collapsedChoices.at(-1));
        visible.add(current);
      }
      choices.forEach((choice) => { choice.hidden = hasOverflow && !expanded && !visible.has(choice); });
      toggle.hidden = !hasOverflow;
      toggle.setAttribute("aria-expanded", String(expanded && hasOverflow));
      text.textContent = expanded ? `Show fewer ${noun}` : `Show all ${noun} (${choices.length})`;
      syncSizeLabel();
    }
    function measure() {
      // Measure natural wrapping before applying the collapsed view.
      choices.forEach((choice) => { choice.hidden = false; });
      if (large.matches) {
        toggle.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        syncSizeLabel();
        return;
      }
      const rows = [...new Set(choices.map((choice) => choice.offsetTop))].sort((a, b) => a - b);
      collapsedChoices = choices.filter((choice) => choice.offsetTop <= (rows[1] ?? rows[0]));
      applyVisibility();
      // A long selected label can make the collapsed composition taller. Trim
      // earlier choices until the selected option and the rest fit two rows.
      if (!expanded) {
        let visible = choices.filter((choice) => !choice.hidden);
        while (new Set(visible.map((choice) => choice.offsetTop)).size > 2) {
          const removable = visible.filter((choice) => choice !== selected()).at(-1);
          if (!removable) break;
          removable.hidden = true;
          visible = visible.filter((choice) => choice !== removable);
        }
      }
    }
    toggle.addEventListener("click", () => { expanded = !expanded; measure(); });
    group.addEventListener("change", measure);
    // Capture before the shared radio keyboard handler: reveal its target so
    // Arrow/Home/End can focus it without losing the native radio interaction.
    group.addEventListener("keydown", (event) => {
      if (!event.target.matches('input[type="radio"]')) return;
      const currentIndex = choices.findIndex((choice) => choice.contains(event.target));
      let next = currentIndex;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (next + 1) % choices.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (next - 1 + choices.length) % choices.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = choices.length - 1;
      else return;
      if (choices[next].hidden) { expanded = true; applyVisibility(); }
    }, true);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - lastWidth) < 0.5) return;
      lastWidth = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(options);
    large.addEventListener("change", measure);
    document.fonts.ready.then(measure);
    measure();
  });
})();
