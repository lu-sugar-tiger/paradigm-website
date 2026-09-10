(function () {
  const native = document.querySelector('#menu-language-native');
  if (!native) return;
  const key = "paradigm.languagePreference";
  try {
    const saved = localStorage.getItem(key);
    if (Array.from(native.options).some((option) => option.value === saved)) {
      native.value = saved;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch { /* Preference remains usable when storage is unavailable. */ }
  native.addEventListener("change", () => {
    try { localStorage.setItem(key, native.value); } catch { /* Keep the current selection. */ }
  });
})();
