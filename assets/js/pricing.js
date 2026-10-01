(function () {
  const core = window.PARADIGM_PRICING_CORE;
  const config = window.PARADIGM_PRICING_CONFIG;
  if (!core || !config) return;

  function format(twd) {
    const currency = window.PARADIGM_STOREFRONT?.currency
      || config.storefronts.markets[config.storefronts.options.find((option) => option.value === config.storefronts.defaultValue).market].currency;
    return core.formatPrice(twd, currency, config.reference);
  }
  function update(root = document) {
    root.querySelectorAll("[data-price-twd]").forEach((element) => {
      element.textContent = format(Number(element.dataset.priceTwd));
    });
  }
  window.PARADIGM_PRICING = Object.freeze({ format, update });
  document.addEventListener("paradigm:storefront-change", () => update());
  update();
})();
