(function () {
  let lastFocusedElement = null;

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

  function openDrawer(drawer, toggle) {
    lastFocusedElement = document.activeElement;
    document.body.style.setProperty("--scrollbar-compensation", `${window.innerWidth - document.documentElement.clientWidth}px`);
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
    const icon = toggle.querySelector(".material-icon");
    if (icon) icon.textContent = toggle.dataset.navCloseSymbol;
    document.body.classList.add("nav-open");
    document.body.style.overflow = "hidden";
    setPageInert(true);
    toggle.focus();
  }

  function closeDrawer(drawer, toggle) {
    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    const icon = toggle.querySelector(".material-icon");
    if (icon) icon.textContent = toggle.dataset.navOpenSymbol;
    document.body.classList.remove("nav-open");
    document.body.style.removeProperty("--scrollbar-compensation");
    document.body.style.overflow = "";
    setPageInert(false);
    (lastFocusedElement || toggle).focus();
  }

  const drawer = document.querySelector("[data-nav-drawer]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (drawer && toggle) {
    const close = document.querySelector("[data-nav-close]");
    if (close) close.hidden = true;
    toggle.addEventListener("click", () => {
      if (drawer.getAttribute("aria-hidden") === "false") closeDrawer(drawer, toggle);
      else openDrawer(drawer, toggle);
    });
    drawer.addEventListener("click", (event) => {
      if (event.target === drawer) closeDrawer(drawer, toggle);
    });
    document.addEventListener("keydown", (event) => {
      if (drawer.getAttribute("aria-hidden") !== "false") return;
      if (event.key === "Escape") {
        closeDrawer(drawer, toggle);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [toggle, ...focusableNodes(drawer)];
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
  }

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
