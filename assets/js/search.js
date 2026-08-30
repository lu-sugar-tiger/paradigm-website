(function () {
  const core = window.PARADIGM_SEARCH_CORE;
  const overlay = document.querySelector("[data-search-overlay]");
  const input = overlay?.querySelector("[data-search-input]");
  const form = overlay?.querySelector("[data-search-form]");
  const submit = overlay?.querySelector("[data-search-submit]");
  const overlayResults = overlay?.querySelector("[data-search-results]");
  const overlayStatus = overlay?.querySelector("[data-search-status]");
  const pageResults = document.querySelector("[data-search-page-results]");
  const pageStatus = document.querySelector("[data-search-page-status]");
  const pageTitle = document.querySelector("[data-search-page-title]");
  let searchIndexPromise = null;
  let renderFrame = 0;
  let suggestionsSuppressed = false;

  if (!core || !overlay || !input || !form || !submit || !overlayResults || !overlayStatus) return;

  function searchIndex() {
    if (!searchIndexPromise) {
      searchIndexPromise = fetch("/assets/data/search-index.json?v=20260830a", { credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) throw new Error(`Search index request failed with ${response.status}`);
          return response.json();
        });
    }
    return searchIndexPromise;
  }

  function element(tagName, className = "", text = "") {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function assetPath(value) {
    if (!value) return "";
    return value.startsWith("/") ? value : `/${value}`;
  }

  function createProductCard(product) {
    const link = element("a", "product-card");
    link.href = product.url;
    const media = element("div", "product-card__media");
    if (product.media?.src) {
      const image = element("img");
      image.src = assetPath(product.media.src);
      image.alt = product.alt || "";
      image.width = product.media.width || 1;
      image.height = product.media.height || 1;
      image.loading = "lazy";
      image.sizes = "(min-width: 80rem) 426px, (min-width: 48rem) 33.333vw, 50vw";
      if (product.media.derivatives?.length) {
        image.srcset = product.media.derivatives
          .map((derivative) => `${assetPath(derivative.path)} ${derivative.width}w`)
          .join(", ");
      }
      media.append(image);
    }
    const body = element("div", "product-card__body");
    body.append(element("h3", "product-card__title", product.title));
    const footer = element("div", "product-card__footer");
    footer.append(element("span", "product-card__price", product.price));
    body.append(footer);
    link.append(media, body);
    return link;
  }

  function group(label, type, suffix) {
    const section = element("section", `search-result-group search-result-group--${type}`);
    section.setAttribute("aria-label", label);
    section.dataset.searchResultType = `${suffix}-${type}`;
    return section;
  }

  function suggestionGroup(labels, suffix) {
    const section = group("Suggested searches", "suggestions", suffix);
    const list = element("div", "search-suggestion-list");
    list.setAttribute("role", "list");
    labels.forEach((label) => {
      const item = element("div", "search-suggestion-list__item");
      item.setAttribute("role", "listitem");
      const button = element("button", "search-suggestion", label);
      button.type = "button";
      button.dataset.searchSuggestion = label;
      item.append(button);
      list.append(item);
    });
    const wrap = element("div", "search-result-group__content");
    wrap.append(list);
    section.append(wrap);
    return section;
  }

  function pageGroup(pages, suffix) {
    const section = group("Pages", "pages", suffix);
    const list = element("div", "search-page-result-list");
    pages.forEach((page) => {
      const link = element("a", `search-page-result${page.external ? " external-link" : ""}`);
      link.href = page.url;
      link.append(element("h3", `search-page-result__title${page.interfaceLabel ? " interface-label" : ""}`, page.title));
      if (page.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.dataset.externalLink = "true";
        const icon = element("span", "material-symbols-outlined material-icon external-link__indicator", "arrow_outward");
        icon.setAttribute("aria-hidden", "true");
        link.append(icon, element("span", "visually-hidden", " (opens in a new tab)"));
      }
      list.append(link);
    });
    const wrap = element("div", "search-result-group__content");
    wrap.append(list);
    section.append(wrap);
    return section;
  }

  function productGroup(products, suffix) {
    const section = group("Products", "products", suffix);
    const grid = element("div", "auto-grid product-grid search-product-grid");
    grid.dataset.generatedComponent = "product-grid";
    products.forEach((product) => grid.append(createProductCard(product)));
    section.append(grid);
    return section;
  }

  function loading(container) {
    container.replaceChildren(element("p", "search-status-row", "Loading search…"));
    container.setAttribute("aria-busy", "true");
  }

  function failed(container, status) {
    container.replaceChildren(element("p", "search-status-row", "Search is unavailable. Please try again."));
    container.setAttribute("aria-busy", "false");
    status.textContent = "Search is unavailable.";
  }

  function render(container, status, index, query, suffix, pageSurface = false) {
    const normalizedQuery = core.normalize(query);
    const suggestions = suggestionsSuppressed ? [] : core.suggestions(index, query);
    const children = [];
    let pages = [];
    let products = [];

    if (suggestions.length > 0) children.push(suggestionGroup(suggestions, suffix));

    if (normalizedQuery) {
      pages = core.rankRecords(index.pages, query);
      products = core.rankRecords(index.products, query);
      if (pages.length > 0) children.push(pageGroup(pages, suffix));
      if (products.length > 0) children.push(productGroup(products, suffix));
    }
    container.classList.toggle("search-results--page", pageSurface);
    container.replaceChildren(...children);
    container.setAttribute("aria-busy", "false");
    status.textContent = normalizedQuery
      ? `${pages.length} page results and ${products.length} product results for ${query.trim()}.`
      : `${suggestions.length} suggested searches.`;
  }

  function updateSubmit() {
    const query = input.value.trim();
    submit.disabled = !query;
    submit.setAttribute("aria-label", query ? `Search for ${query}` : "Search");
  }

  function renderOverlay() {
    window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(() => {
      updateSubmit();
      loading(overlayResults);
      searchIndex()
        .then((index) => render(overlayResults, overlayStatus, index, input.value, "overlay"))
        .catch(() => failed(overlayResults, overlayStatus));
    });
  }

  function searchUrl(query) {
    const params = new URLSearchParams({ q: query.trim() });
    return `/search?${params.toString()}`;
  }

  function setPageHeading(query) {
    if (!pageTitle) return;
    const label = query ? `Search for "${query}"` : "Search";
    pageTitle.textContent = label;
    document.title = query ? `Paradigm | ${label}` : "Paradigm | Search";
  }

  function renderSearchPage(query, updateUrl = false) {
    if (!pageResults || !pageStatus) return;
    const trimmed = query.trim();
    setPageHeading(trimmed);
    input.value = trimmed;
    updateSubmit();
    if (updateUrl) {
      const url = trimmed ? searchUrl(trimmed) : "/search";
      window.history.replaceState({}, "", url);
    }
    loading(pageResults);
    searchIndex()
      .then((index) => render(pageResults, pageStatus, index, trimmed, "page", true))
      .catch(() => failed(pageResults, pageStatus));
  }

  input.addEventListener("input", () => {
    suggestionsSuppressed = false;
    renderOverlay();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      input.focus();
      return;
    }
    window.location.assign(searchUrl(query));
  });

  document.addEventListener("click", (event) => {
    const suggestion = event.target.closest("[data-search-suggestion]");
    if (!suggestion) return;
    const query = suggestion.dataset.searchSuggestion;
    suggestionsSuppressed = true;
    if (suggestion.closest("[data-search-overlay]")) {
      input.value = query;
      renderOverlay();
      input.focus();
    } else if (pageResults?.contains(suggestion)) {
      renderSearchPage(query, true);
    }
  });

  overlay.addEventListener("paradigm:overlay-open", () => {
    updateSubmit();
    renderOverlay();
  });

  updateSubmit();
  if (pageResults) {
    const query = new URLSearchParams(window.location.search).get("q") || "";
    renderSearchPage(query);
  }
})();
