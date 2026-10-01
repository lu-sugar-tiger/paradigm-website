(function () {
  const native = document.querySelector('#menu-language-native');
  if (!native) return;
  const key = "paradigm.storefrontPreference";
  const valid = (value) => Array.from(native.options).some((option) => option.value === value);
  try {
    let saved = localStorage.getItem(key);
    if (!saved) {
      const legacy = localStorage.getItem("paradigm.languagePreference");
      saved = legacy === "international" ? "en-USD" : legacy === "taiwan" ? "en-TWD" : null;
    }
    if (valid(saved)) {
      native.value = saved;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch { /* Preference remains usable when storage is unavailable. */ }
  function publish() {
    if (!valid(native.value)) return;
    const config = window.PARADIGM_PRICING_CONFIG.storefronts;
    const option = config.options.find((option) => option.value === native.value);
    const preference = Object.freeze({
      value: native.value,
      language: option.language,
      currency: config.markets[option.market].currency,
      market: option.market
    });
    window.PARADIGM_STOREFRONT = preference;
    document.documentElement.dataset.storefrontPreference = preference.value;
    document.dispatchEvent(new CustomEvent("paradigm:storefront-change", { detail: preference }));
  }
  native.addEventListener("change", () => {
    if (!valid(native.value)) return;
    try { localStorage.setItem(key, native.value); } catch { /* Keep the current selection. */ }
    publish();
  });
  publish();
})();
