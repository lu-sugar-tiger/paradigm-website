(function () {
  const TRANSITION_STORAGE_KEY = "paradigm:page-motion";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function normalizedPath(value) {
    const path = new URL(value, window.location.href).pathname.replace(/\/+$/, "") || "/";
    return path === "/index.html" ? "/" : path;
  }

  function classifyPath(value) {
    const path = normalizedPath(value);
    if (path === "/" || path === "/collections/all") {
      return { family: "catalog", depth: 0, key: "catalog-all" };
    }
    if (/^\/collections\/(?:ss-tops|aw-tops|bottoms)$/.test(path)) {
      return { family: "catalog", depth: 1, key: path };
    }
    if (path === "/search") return { family: "catalog", depth: 1, key: "search" };
    if (/^\/products\/[^/]+$/.test(path)) return { family: "catalog", depth: 2, key: path };
    if (path === "/teamwear") return { family: "teamwear", depth: 0, key: "teamwear" };
    if (path === "/teamwear/customize") return { family: "teamwear", depth: 1, key: "teamwear-customize" };
    return { family: "peer", depth: 0, key: path };
  }

  function transitionBetween(fromValue, toValue, overlayOpen = false) {
    if (overlayOpen) return "overlay";
    const from = classifyPath(fromValue);
    const to = classifyPath(toValue);
    if (from.key === to.key) return "none";
    if (from.family === to.family && from.family !== "peer") {
      if (to.depth > from.depth) return "forward";
      if (to.depth < from.depth) return "backward";
    }
    return "peer";
  }

  function overlayIsOpen() {
    return Boolean(document.querySelector('[data-overlay-state="opening"], [data-overlay-state="open"]'));
  }

  function setMotionState(type, transition) {
    if (type === "none" || reducedMotion.matches) {
      transition?.skipTransition();
      return;
    }
    document.documentElement.dataset.pageMotion = type;
    transition?.finished.finally(() => {
      if (document.documentElement.dataset.pageMotion === type) {
        delete document.documentElement.dataset.pageMotion;
      }
    });
  }

  function storeMotion(destination, type) {
    try {
      window.sessionStorage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify({
        destination: new URL(destination, window.location.href).href,
        type
      }));
    } catch (_error) {
      // Storage can be unavailable in hardened browsing modes; route inference remains available.
    }
  }

  function storedMotion(destination) {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(TRANSITION_STORAGE_KEY) || "null");
      window.sessionStorage.removeItem(TRANSITION_STORAGE_KEY);
      return stored?.destination === new URL(destination, window.location.href).href ? stored.type : null;
    } catch (_error) {
      return null;
    }
  }

  window.addEventListener("pageswap", (event) => {
    if (!event.viewTransition || !event.activation?.entry?.url) return;
    const type = transitionBetween(window.location.href, event.activation.entry.url, overlayIsOpen());
    storeMotion(event.activation.entry.url, type);
    setMotionState(type, event.viewTransition);
  });

  window.addEventListener("pagereveal", (event) => {
    if (!event.viewTransition) return;
    const from = globalThis.navigation?.activation?.from?.url;
    const type = storedMotion(window.location.href)
      || (from ? transitionBetween(from, window.location.href) : "peer");
    setMotionState(type, event.viewTransition);
  });

  if (typeof globalThis.__PARADIGM_MOTION_TEST__ === "function") {
    globalThis.__PARADIGM_MOTION_TEST__({ classifyPath, transitionBetween });
  }
})();
