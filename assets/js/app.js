(function () {
  let activeOverlay = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const STATES = Object.freeze({ closed: "closed", opening: "opening", open: "open", closing: "closing" });

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

  function setupOverlay({ overlay, toggle, openClass, openLabel, closeLabel, initialFocus }) {
    if (!overlay || !toggle) return null;
    let lastFocusedElement = null;
    let stateVersion = 0;
    let fallbackTimer = 0;
    let surfaceTransitionListener = null;

    function setBodyState(state) {
      document.body.dataset.overlayState = state;
    }

    function clearFallback() {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (surfaceTransitionListener) overlay.removeEventListener("transitionend", surfaceTransitionListener);
      fallbackTimer = 0;
      surfaceTransitionListener = null;
    }

    function afterSurfaceTransition(version, callback) {
      clearFallback();
      if (reducedMotion.matches) {
        callback();
        return;
      }
      surfaceTransitionListener = (event) => {
        if (event.target !== overlay || event.propertyName !== "clip-path" || version !== stateVersion) return;
        clearFallback();
        callback();
      };
      overlay.addEventListener("transitionend", surfaceTransitionListener);
      fallbackTimer = window.setTimeout(() => {
        clearFallback();
        if (version === stateVersion) callback();
      }, 360);
    }

    function finishClose(version) {
      if (version !== stateVersion || overlay.dataset.overlayState !== STATES.closing) return;
      overlay.dataset.overlayState = STATES.closed;
      document.body.classList.remove(openClass);
      document.body.style.overflow = "";
      setPageInert(false);
      if (activeOverlay === controller) activeOverlay = null;
      delete document.body.dataset.overlayState;
    }

    const controller = {
      open() {
        if (activeOverlay && activeOverlay !== controller) activeOverlay.close(false, true);
        const version = ++stateVersion;
        clearFallback();
        lastFocusedElement = document.activeElement;
        overlay.dataset.overlayState = STATES.opening;
        overlay.setAttribute("aria-hidden", "false");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", closeLabel);
        document.body.classList.add(openClass);
        setBodyState(STATES.opening);
        document.body.style.overflow = "hidden";
        setPageInert(true);
        activeOverlay = controller;
        overlay.dispatchEvent(new CustomEvent("paradigm:overlay-open", { bubbles: true }));
        window.requestAnimationFrame(() => (initialFocus?.() || toggle).focus());
        afterSurfaceTransition(version, () => {
          if (overlay.dataset.overlayState !== STATES.opening) return;
          overlay.dataset.overlayState = STATES.open;
          setBodyState(STATES.open);
        });
      },
      close(restoreFocus = true, immediate = false) {
        const version = ++stateVersion;
        clearFallback();
        overlay.dataset.overlayState = immediate ? STATES.closed : STATES.closing;
        overlay.setAttribute("aria-hidden", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", openLabel);
        if (restoreFocus) (lastFocusedElement || toggle).focus();
        if (immediate || reducedMotion.matches) {
          overlay.dataset.overlayState = STATES.closing;
          finishClose(version);
          return;
        }
        setBodyState(STATES.closing);
        afterSurfaceTransition(version, () => finishClose(version));
      }
    };

    toggle.addEventListener("click", () => {
      if ([STATES.opening, STATES.open].includes(overlay.dataset.overlayState)) controller.close();
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
  setupOverlay({
    overlay: drawer,
    toggle: navToggle,
    openClass: "nav-open",
    openLabel: "Open navigation",
    closeLabel: "Close navigation",
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
    initialFocus: () => searchOverlay?.querySelector("[data-search-input]")
  });

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
