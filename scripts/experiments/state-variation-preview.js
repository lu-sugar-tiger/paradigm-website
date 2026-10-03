(() => {
  const preview = document.querySelector(".state-variation-preview");
  if (!preview) return;
  preview.querySelectorAll("[data-preview-row]").forEach((row) => {
    const select = row.querySelector("[data-dropdown-native]");
    const controls = row.querySelector(".state-preview-surface").querySelectorAll(row.dataset.previewSelector);
    // Read the default from the centralized mapping, rather than keeping a
    // separate live configuration in the experiment.
    select.value = getComputedStyle(controls[0]).getPropertyValue("--state-variation-mode").trim();
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const apply = () => controls.forEach((control) => {
      control.dataset.stateVariation = select.value;
    });
    select.addEventListener("change", apply);
    apply();
  });
  // Capture before shared action handlers; demonstration never copies or navigates.
  preview.addEventListener("click", (event) => {
    if (!event.target.closest(".state-preview-surface")) return;
    if (!event.target.closest("a, button")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
