(function () {
  const hero = document.querySelector("[data-teamwear-hero]");
  const video = hero?.querySelector("video");
  const button = hero?.querySelector("[data-hero-video-toggle]");
  if (!video || !button) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection;
  const variant = window.matchMedia("(min-width: 64rem)").matches ? "large"
    : window.matchMedia("(min-width: 48rem)").matches ? "medium" : "base";
  let wanted = !motion.matches && !connection?.saveData;
  const bounds = hero.getBoundingClientRect();
  let visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  let pending = false;
  let failed = false;
  let pageActive = true;
  let frameRequest = null;
  video.muted = true;
  video.defaultMuted = true;
  button.hidden = false;

  const eligible = () => wanted && visible && !document.hidden && pageActive && !failed;
  function reflect() {
    const playing = wanted && (pending || !video.paused) && !failed;
    button.setAttribute("aria-label", playing ? "Pause background video" : "Play background video");
    button.querySelector("[data-video-play]").hidden = playing;
    button.querySelector("[data-video-pause]").hidden = !playing;
  }
  function reveal() {
    if (eligible() && video.readyState >= 2) hero.classList.add("is-video-ready");
    frameRequest = null;
  }
  function showFrame() {
    if (frameRequest !== null) return;
    if (video.requestVideoFrameCallback) frameRequest = video.requestVideoFrameCallback(reveal);
    else reveal();
  }
  async function reconcile() {
    if (!eligible()) {
      video.pause();
      reflect();
      return;
    }
    if (pending || !video.paused) return;
    if (!video.getAttribute("src")) {
      video.src = video.dataset[`video${variant[0].toUpperCase()}${variant.slice(1)}`];
      video.load();
    }
    pending = true;
    reflect();
    let interrupted = false;
    try {
      await video.play();
      if (!eligible()) video.pause();
      else showFrame();
    } catch (error) {
      // Visibility/manual pause can abort a pending play without being a failure.
      if (error.name !== "AbortError") wanted = false;
      else interrupted = true;
    } finally {
      pending = false;
      reflect();
      if (interrupted && eligible()) queueMicrotask(reconcile);
    }
  }
  button.addEventListener("click", () => {
    if (failed) return;
    wanted = !(wanted && (pending || !video.paused));
    reconcile();
  });
  video.addEventListener("playing", () => { showFrame(); reflect(); });
  video.addEventListener("pause", reflect);
  video.addEventListener("error", () => {
    failed = true;
    wanted = false;
    video.pause();
    hero.classList.remove("is-video-ready");
    if (frameRequest !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameRequest);
    button.hidden = true;
  });
  document.addEventListener("visibilitychange", reconcile);
  window.addEventListener("pagehide", () => { pageActive = false; reconcile(); });
  window.addEventListener("pageshow", () => { pageActive = true; reconcile(); });
  function preferenceChanged() {
    if (motion.matches || connection?.saveData) {
      wanted = false;
      hero.classList.remove("is-video-ready");
      reconcile();
    }
  }
  motion.addEventListener("change", preferenceChanged);
  connection?.addEventListener("change", preferenceChanged);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      reconcile();
    });
    observer.observe(hero);
  }
  reflect();
  reconcile();
})();
