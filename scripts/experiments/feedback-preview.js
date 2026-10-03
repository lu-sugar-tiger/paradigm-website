(() => {
  const page = document.querySelector(".feedback-experiment");
  if (!page) return;
  const variants = ["current", "suggested"];
  const scene = document.getElementById("search-scene-native");
  const timers = new Map();
  const node = (tag, text, className = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
  };
  function renderSearch(variant, state) {
    clearTimeout(timers.get(variant));
    const result = page.querySelector(`[data-result="${variant}"]`);
    const query = document.getElementById(`${variant}-query`).value.trim();
    const announcement = page.querySelector(`[data-search-announcement="${variant}"]`);
    const note = page.querySelector(`[data-search-note="${variant}"]`);
    result.replaceChildren();
    result.dataset.state = state;
    result.setAttribute("aria-busy", String(state === "loading"));
    note.textContent = variant === "current" ? "Existing Search messages and recovery behavior." : "Visible empty-result guidance and an explicit retry. Same loading treatment.";
    announcement.textContent = "";
    if (state === "loading") {
      result.append(node("p", "Loading search…", "search-status-row"));
      announcement.textContent = "Loading search…";
    } else if (state === "success") {
      result.append(document.getElementById("experiment-results-template").content.cloneNode(true));
      announcement.textContent = "1 product result.";
    } else if (state === "idle") {
      announcement.textContent = "Search the product catalog.";
    } else if (variant === "current") {
      if (state === "error") result.append(node("p", "Search is unavailable. Please try again.", "search-status-row"));
      announcement.textContent = state === "error" ? "Search is unavailable." : `0 product results for ${query}.`;
      if (state === "empty") note.textContent = "No visible empty-result message. Result count is announced to assistive technology.";
    } else {
      const feedback = node("div", "", "experiment-feedback");
      feedback.append(node("p", state === "error" ? "Search is unavailable. Please try again." : `No results for “${query}”.`));
      if (state === "empty") feedback.append(node("p", "Try a product name, product number, or another keyword.", "experiment-note"));
      const actions = node("div", "", "experiment-feedback__actions");
      const action = node("button", state === "error" ? "Try again" : "Clear search", state === "error" ? "button" : "dropdown__text-action");
      action.type = "button";
      action.addEventListener("click", () => {
        if (state === "empty") {
          const input = document.getElementById(`${variant}-query`);
          input.value = "";
          renderSearch(variant, "idle");
          input.focus();
        } else {
          renderSearch(variant, "loading");
          timers.set(variant, setTimeout(() => renderSearch(variant, "success"), 900));
          // Keep keyboard focus when the retry control is replaced.
          document.getElementById(`${variant}-query`).focus();
        }
      });
      actions.append(action);
      if (state === "empty") {
        const browse = node("a", "Browse all", "dropdown__text-action");
        browse.href = "/collections/all";
        actions.append(browse);
      }
      feedback.append(actions);
      result.append(feedback);
      announcement.textContent = feedback.textContent;
    }
  }
  const replaySearch = () => variants.forEach((variant) => renderSearch(variant, scene.value));
  scene.addEventListener("change", replaySearch);
  page.querySelector("[data-replay-search]").addEventListener("click", replaySearch);
  variants.forEach((variant) => {
    page.querySelector(`[data-demo-search="${variant}"]`).addEventListener("submit", (event) => {
      event.preventDefault();
      renderSearch(variant, "loading");
      timers.set(variant, setTimeout(() => renderSearch(variant, scene.value === "loading" ? "success" : scene.value), 900));
    });
  });
  replaySearch();
})();
