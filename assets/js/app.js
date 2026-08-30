(function () {
  let activeOverlay = null;

  document.documentElement.dataset.inputModality = "pointer";
  document.addEventListener("pointerdown", () => {
    document.documentElement.dataset.inputModality = "pointer";
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!["Alt", "Control", "Meta", "Shift"].includes(event.key)) {
      document.documentElement.dataset.inputModality = "keyboard";
    }
  }, true);

  function focusableNodes(scope) {
    return Array.from(scope.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hidden);
  }

  function setPageInert(inert) {
    document.querySelectorAll("main, footer").forEach((node) => node.toggleAttribute("inert", inert));
  }

  function setupOverlay({ overlay, toggle, openClass, openLabel, closeLabel, openSymbol, closeSymbol, initialFocus }) {
    if (!overlay || !toggle) return null;
    let lastFocusedElement = null;

    const controller = {
      open() {
        if (activeOverlay && activeOverlay !== controller) activeOverlay.close(false);
        lastFocusedElement = document.activeElement;
        overlay.setAttribute("aria-hidden", "false");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", closeLabel);
        const icon = toggle.querySelector(".material-icon");
        if (icon) icon.textContent = closeSymbol;
        document.body.classList.add(openClass);
        document.body.style.overflow = "hidden";
        setPageInert(true);
        activeOverlay = controller;
        overlay.dispatchEvent(new CustomEvent("paradigm:overlay-open", { bubbles: true }));
        window.requestAnimationFrame(() => (initialFocus?.() || toggle).focus());
      },
      close(restoreFocus = true) {
        overlay.setAttribute("aria-hidden", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", openLabel);
        const icon = toggle.querySelector(".material-icon");
        if (icon) icon.textContent = openSymbol;
        document.body.classList.remove(openClass);
        document.body.style.overflow = "";
        setPageInert(false);
        if (activeOverlay === controller) activeOverlay = null;
        if (restoreFocus) (lastFocusedElement || toggle).focus();
      }
    };

    toggle.addEventListener("click", () => {
      if (overlay.getAttribute("aria-hidden") === "false") controller.close();
      else controller.open();
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) controller.close();
    });
    document.addEventListener("keydown", (event) => {
      if (overlay.getAttribute("aria-hidden") !== "false") return;
      if (event.key === "Escape") {
        controller.close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [toggle, ...focusableNodes(overlay)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    return controller;
  }

  const drawer = document.querySelector("[data-nav-drawer]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navClose = document.querySelector("[data-nav-close]");
  if (navClose) navClose.hidden = true;
  setupOverlay({
    overlay: drawer,
    toggle: navToggle,
    openClass: "nav-open",
    openLabel: "Open navigation",
    closeLabel: "Close navigation",
    openSymbol: navToggle?.dataset.navOpenSymbol,
    closeSymbol: navToggle?.dataset.navCloseSymbol,
    initialFocus: () => navToggle
  });

  const searchOverlay = document.querySelector("[data-search-overlay]");
  const searchToggle = document.querySelector("[data-search-toggle]");
  setupOverlay({
    overlay: searchOverlay,
    toggle: searchToggle,
    openClass: "search-open",
    openLabel: "Open search",
    closeLabel: "Close search",
    openSymbol: searchToggle?.dataset.searchOpenSymbol,
    closeSymbol: searchToggle?.dataset.searchCloseSymbol,
    initialFocus: () => searchOverlay?.querySelector("[data-search-input]")
  });

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
