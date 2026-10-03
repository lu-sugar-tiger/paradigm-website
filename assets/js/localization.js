(function () {
  const translations = window.PARADIGM_TRANSLATIONS;
  if (!translations) return;
  let language = "en";
  const format = (text, params) => text.replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
  function text(source, params = {}, element = null) {
    const shared = element?.closest?.('[data-language-shared="en"]');
    return format(language === "zh-Hant" && !shared ? translations[source] || source : source, params);
  }
  function update(root = document) {
    root.querySelectorAll("[data-l10n], [data-l10n-alt], [data-l10n-aria-label], [data-l10n-placeholder], [data-l10n-content]").forEach((element) => {
      const params = JSON.parse(element.dataset.l10nParams || "{}");
      for (const attribute of ["text", "alt", "aria-label", "placeholder", "content"]) {
        const key = attribute === "text" ? "data-l10n" : `data-l10n-${attribute}`;
        const source = element.getAttribute(key);
        if (source === null) continue;
        const value = text(source, params, element);
        if (attribute === "text") {
          const tail = element.dataset.l10nTail || "";
          const colorText = language === "zh-Hant" && !element.closest('[data-language-shared="en"]')
            ? element.dataset.l10nColorZh : element.dataset.l10nColorEn;
          window.PARADIGM_INLINE_TYPE.set(element, colorText ?? (language === "zh-Hant" && element.dataset.l10nOriginal ? element.dataset.l10nOriginal : value + tail));
        } else element.setAttribute(attribute, value);
      }
    });
  }
  function imageText(source, element) {
    const uniform = source.match(/^(.*?) (PE Basketball Teamwear) in (.*), front and back$/);
    const view = source.match(/^(.*), view (\d+)$/);
    const product = source.match(/^(.*) product image$/);
    if (uniform) return text("{pattern} {name} in {color}, front and back", { pattern: uniform[1], name: uniform[2], color: uniform[3] }, element);
    if (view) return text("{name}, view {number}", { name: view[1], number: view[2] }, element);
    if (product) return text("{name} product image", { name: product[1] }, element);
    return text(source, {}, element);
  }
  function publish() {
    language = window.PARADIGM_STOREFRONT?.language === "zh-Hant" ? "zh-Hant" : "en";
    const sharedPage = document.querySelector('main[data-language-shared="en"]');
    document.documentElement.lang = sharedPage ? "en" : language;
    document.documentElement.dataset.contentLanguage = language;
    update();
    document.querySelectorAll("img[data-source-alt]").forEach((image) => { image.alt = imageText(image.dataset.sourceAlt, image); });
    document.dispatchEvent(new CustomEvent("paradigm:language-change", { detail: { language } }));
    document.dispatchEvent(new CustomEvent("paradigm:product-media-change"));
  }
  window.PARADIGM_LANGUAGE = Object.freeze({ text, imageText, update, get language() { return language; } });
  document.addEventListener("paradigm:storefront-change", publish);
  publish();
})();
