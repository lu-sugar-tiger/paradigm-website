(function () {
  const rootPath = document.body.dataset.root || ".";
  const catalog = window.PARADIGM_CATALOG || { products: [] };
  const searchParams = new URLSearchParams(window.location.search);
  const requestedProductSlug = searchParams.get("product");
  let lastFocusedElement = null;

  function asset(path) {
    return `${rootPath}/${path}`.replace(/\/\.\//g, "/").replace(/([^:])\/{2,}/g, "$1/");
  }

  function productUrl(product) {
    return `${rootPath}/products/prdm-cosmos-hoodie/index.html?product=${encodeURIComponent(product.slug)}`;
  }

  function getFocusableNodes(scope) {
    return Array.from(
      scope.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((node) => !node.hasAttribute("hidden"));
  }

  function openDrawer() {
    const drawer = document.querySelector("[data-nav-drawer]");
    const toggle = document.querySelector("[data-nav-toggle]");

    if (!drawer || !toggle) {
      return;
    }

    lastFocusedElement = document.activeElement;
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";

    const closeButton = drawer.querySelector("[data-nav-close]");
    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeDrawer() {
    const drawer = document.querySelector("[data-nav-drawer]");
    const toggle = document.querySelector("[data-nav-toggle]");

    if (!drawer || !toggle) {
      return;
    }

    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    (lastFocusedElement || toggle).focus();
  }

  function buildProductCard(product) {
    const link = document.createElement("a");
    link.className = "product-card";
    link.href = productUrl(product);

    link.innerHTML = `
      <div class="product-card__media">
        <img src="${asset(product.image)}" alt="${product.alt}" loading="lazy" width="400" height="460">
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${product.title}</h3>
        <div class="product-card__footer">
          <span class="product-card__price">${product.price}</span>
        </div>
      </div>
    `;

    return link;
  }

  function renderProductGrids() {
    document.querySelectorAll("[data-product-grid]").forEach((grid) => {
      const limit = Number.parseInt(grid.dataset.limit || "", 10);
      const exclude = grid.dataset.exclude;
      const excludeCurrent = grid.hasAttribute("data-exclude-current") ? requestedProductSlug : null;
      let items = catalog.products.slice();

      if (exclude) {
        items = items.filter((product) => product.slug !== exclude);
      }

      if (excludeCurrent) {
        items = items.filter((product) => product.slug !== excludeCurrent);
      }

      if (Number.isFinite(limit)) {
        items = items.slice(0, limit);
      }

      grid.innerHTML = "";
      items.forEach((product) => {
        grid.appendChild(buildProductCard(product));
      });
    });
  }

  function renderProductDetail() {
    const detail = document.querySelector("[data-product-detail]");

    if (!detail) {
      return;
    }

    const slug = requestedProductSlug || detail.dataset.productSlug;
    const product = catalog.products.find((item) => item.slug === slug);

    if (!product) {
      return;
    }

    const image = detail.querySelector("[data-product-image]");
    const title = detail.querySelector("[data-product-title]");
    const price = detail.querySelector("[data-product-price]");
    const category = detail.querySelector("[data-product-category]");

    if (image) {
      image.src = asset(product.image);
      image.alt = product.alt;
    }

    if (title) {
      title.textContent = product.title;
    }

    if (price) {
      price.textContent = product.price;
    }

    if (category) {
      category.textContent = product.category;
    }
    const colorLabel = detail.querySelector("[data-product-color-label]");
    if (colorLabel && product.colors?.[1]) {
      colorLabel.textContent = product.colors[1].label;
    }

    const swatches = detail.querySelector("[data-product-colors]");
    swatches.innerHTML = "";
    product.colors.forEach((color, index) => {
      const swatch = document.createElement("span");
      swatch.className = index === 1 ? "swatch is-active" : "swatch";
      swatch.style.backgroundColor = color.hex;
      swatch.setAttribute("title", color.label);
      swatch.setAttribute("aria-label", color.label);
      if (index === product.colors.length - 1) {
        swatch.classList.add("is-muted");
      }
      swatches.appendChild(swatch);
    });

    const sizes = detail.querySelector("[data-product-sizes]");
    sizes.innerHTML = "";
    product.sizes.forEach((size, index) => {
      const chip = document.createElement("span");
      chip.className = index === 1 ? "size-chip is-active" : "size-chip";
      if (index === product.sizes.length - 1) {
        chip.classList.add("is-muted");
      }
      chip.textContent = size;
      sizes.appendChild(chip);
    });

    const bullets = detail.querySelector("[data-product-bullets]");
    bullets.innerHTML = "";
    product.bullets.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      bullets.appendChild(li);
    });

    const description = detail.querySelector("[data-product-description]");
    description.innerHTML = "";
    product.description.forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      description.appendChild(p);
    });

    const rows = detail.querySelector("[data-product-measurements]");
    rows.innerHTML = "";
    product.measurements.forEach((cells) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<th scope="row">${cells[0]}</th><td>${cells[1]}</td><td>${cells[2]}</td><td>${cells[3]}</td>`;
      rows.appendChild(tr);
    });

    const fitGuide = detail.querySelector("[data-product-fit-guide]");
    if (fitGuide) {
      fitGuide.innerHTML = "";
      (product.fitGuide || []).forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        fitGuide.appendChild(p);
      });
    }

    const code = detail.querySelector("[data-product-code]");
    if (code && product.code) {
      code.textContent = product.code;
    }
  }

  function setupAccordions() {
    document.querySelectorAll("[data-accordion-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(button.getAttribute("aria-controls"));

        button.setAttribute("aria-expanded", String(!expanded));
        if (panel) {
          panel.hidden = expanded;
        }
      });
    });
  }

  function setupDrawer() {
    const drawer = document.querySelector("[data-nav-drawer]");
    const toggle = document.querySelector("[data-nav-toggle]");
    const close = document.querySelector("[data-nav-close]");

    if (!drawer || !toggle || !close) {
      return;
    }

    toggle.addEventListener("click", openDrawer);
    close.addEventListener("click", closeDrawer);

    drawer.addEventListener("click", (event) => {
      if (event.target === drawer) {
        closeDrawer();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (drawer.getAttribute("aria-hidden") !== "false") {
        return;
      }

      if (event.key === "Escape" && drawer.getAttribute("aria-hidden") === "false") {
        closeDrawer();
        return;
      }

      if (event.key === "Tab") {
        const focusable = getFocusableNodes(drawer);

        if (!focusable.length) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function setYear() {
    document.querySelectorAll("[data-current-year]").forEach((node) => {
      node.textContent = "2026";
    });
  }

  setupDrawer();
  setupAccordions();
  renderProductDetail();
  renderProductGrids();
  setYear();
})();
