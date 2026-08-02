(function () {
  const rootPath = document.body.dataset.root || ".";
  const catalog = window.PARADIGM_CATALOG || { products: [] };
  let lastFocusedElement = null;

  function asset(path) {
    return `${rootPath}/${path}`.replace(/\/\.\//g, "/").replace(/([^:])\/{2,}/g, "$1/");
  }

  function productUrl(product) {
    return `/products/${encodeURIComponent(product.productNumber)}`;
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
    document.body.style.setProperty(
      "--scrollbar-compensation",
      `${window.innerWidth - document.documentElement.clientWidth}px`
    );
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
    document.body.classList.add("nav-open");
    document.body.style.overflow = "hidden";

    const toggleIcon = toggle.querySelector("img");
    if (toggleIcon) {
      toggleIcon.src = asset("assets/icons/close.svg");
    }
    toggle.focus();
  }

  function closeDrawer() {
    const drawer = document.querySelector("[data-nav-drawer]");
    const toggle = document.querySelector("[data-nav-toggle]");

    if (!drawer || !toggle) {
      return;
    }

    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    document.body.classList.remove("nav-open");
    document.body.style.removeProperty("--scrollbar-compensation");
    document.body.style.overflow = "";

    const toggleIcon = toggle.querySelector("img");
    if (toggleIcon) {
      toggleIcon.src = asset("assets/icons/menu.svg");
    }
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

  function renderNavigation() {
    const nav = document.querySelector(".drawer-nav");

    if (!nav) {
      return;
    }

    const isTeamwear = window.location.pathname.replace(/\/$/, "") === "/teamwear";
    const categoryLinks = ["SS Tops", "AW Tops", "Outerwear", "Bottoms"]
      .map((category) => `<li><a href="/collections/all?category=${encodeURIComponent(category)}">${category}</a></li>`)
      .join("");

    nav.innerHTML = `
      <ul role="list">
        <li><a href="/collections/all"${isTeamwear ? "" : ' aria-current="page"'}>Products</a></li>
        ${categoryLinks}
      </ul>
      <div class="drawer-nav__divider"></div>
      <ul role="list">
        <li><a href="/teamwear"${isTeamwear ? ' aria-current="page"' : ""}>Teamwear</a></li>
      </ul>
    `;
  }

  function renderFigmaIcons() {
    const iconMap = [
      ['[aria-label^="Search"]', "assets/icons/search.svg"],
      ['[aria-label^="Shopping bag"]', "assets/icons/shopping-bag.svg"],
      ["[data-nav-toggle]", "assets/icons/menu.svg"],
      ["[data-nav-close]", "assets/icons/close.svg"],
      [".filter-button", "assets/icons/filter.svg"],
      [".product-detail__actions .button", "assets/icons/shopping-bag-light.svg"],
      [".teamwear-inquiry", "assets/icons/send.svg"]
    ];

    iconMap.forEach(([selector, path]) => {
      document.querySelectorAll(selector).forEach((control) => {
        const existingIcon = control.querySelector("svg, img");
        const icon = document.createElement("img");
        icon.src = asset(path);
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");

        if (existingIcon) {
          existingIcon.remove();
        }
        control.prepend(icon);
      });
    });

    const footerIcons = {
      Shopee: "assets/icons/globe.svg",
      Instagram: "assets/icons/instagram.svg",
      Discord: "assets/icons/discord.svg"
    };

    document.querySelectorAll(".footer-link").forEach((link) => {
      const label = link.textContent.trim();
      const path = footerIcons[label];

      if (!path) {
        return;
      }

      const existingIcon = link.querySelector("svg, img");
      const icon = document.createElement("img");
      icon.src = asset(path);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");

      if (existingIcon) {
        existingIcon.remove();
      }
      link.prepend(icon);
    });
  }

  function renderProductGrids() {
    const detail = document.querySelector("[data-product-detail]");
    const currentProductNumber = detail?.dataset.productNumber || null;

    document.querySelectorAll("[data-product-grid]").forEach((grid) => {
      const limit = Number.parseInt(grid.dataset.limit || "", 10);
      const exclude = grid.dataset.exclude;
      const collection = grid.dataset.collection;
      const excludeCurrent = grid.hasAttribute("data-exclude-current") ? currentProductNumber : null;
      const requestedCategory = grid.dataset.collection?.toLowerCase() === "all"
        ? new URLSearchParams(window.location.search).get("category")
        : null;
      let items = catalog.products.slice();

      if (exclude) {
        items = items.filter((product) => product.slug !== exclude);
      }

      if (collection && collection.toLowerCase() !== "all") {
        items = items.filter((product) => product.collection.toLowerCase() === collection.toLowerCase());
      }

      if (requestedCategory) {
        items = items.filter((product) => product.category.toLowerCase() === requestedCategory.toLowerCase());

        const headline = document.querySelector(".filter-bar h1");
        if (headline) {
          headline.textContent = requestedCategory;
        }
      }

      if (excludeCurrent) {
        items = items.filter((product) => product.productNumber !== excludeCurrent);
      }

      if (Number.isFinite(limit) && !grid.classList.contains("marquee-strip")) {
        items = items.slice(0, limit);
      }

      grid.innerHTML = "";
      items.forEach((product) => {
        grid.appendChild(buildProductCard(product));
      });

      if (grid.classList.contains("marquee-strip")) {
        grid.setAttribute("role", "region");
        grid.setAttribute("aria-label", "Related products");
        grid.tabIndex = 0;
        grid.addEventListener("keydown", (event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            grid.scrollBy({ left: event.key === "ArrowRight" ? 202 : -202, behavior: "smooth" });
          }
        });
        window.requestAnimationFrame(() => {
          grid.scrollLeft = Math.min(303, Math.max(0, grid.scrollWidth - grid.clientWidth));
        });
      }
    });
  }

  function renderProductDetail() {
    const detail = document.querySelector("[data-product-detail]");

    if (!detail) {
      return;
    }

    const productNumber = detail.dataset.productNumber;
    const product = catalog.products.find(
      (item) => item.productNumber.toLowerCase() === productNumber.toLowerCase()
    );

    if (!product) {
      return;
    }

    const image = detail.querySelector("[data-product-image]");
    const gallery = detail.querySelector(".product-detail__gallery");
    const title = detail.querySelector("[data-product-title]");
    const price = detail.querySelector("[data-product-price]");
    const category = detail.querySelector("[data-product-category]");
    const colors = Array.isArray(product.colors) ? product.colors : [];
    const productSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const productBullets = Array.isArray(product.bullets) ? product.bullets : [];
    const productDescription = Array.isArray(product.description) ? product.description : [];
    const productMeasurements = Array.isArray(product.measurements) ? product.measurements : [];

    document.title = `Paradigm | ${product.title}`;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = `${product.title} by Paradigm.`;
    }

    let breadcrumbCategory = document.querySelector("[data-product-breadcrumb-category]");
    const breadcrumbTitle = document.querySelector("[data-product-breadcrumb-title]");
    if (breadcrumbCategory) {
      if (breadcrumbCategory.tagName !== "A") {
        const categoryLink = document.createElement("a");
        categoryLink.dataset.productBreadcrumbCategory = "";
        breadcrumbCategory.replaceWith(categoryLink);
        breadcrumbCategory = categoryLink;
      }
      breadcrumbCategory.textContent = product.category;
      breadcrumbCategory.href = `/collections/all?category=${encodeURIComponent(product.category)}`;
    }
    if (breadcrumbTitle) {
      breadcrumbTitle.textContent = product.title.split(" ").pop();
    }

    const gallerySources = Array.isArray(product.images) && product.images.length
      ? product.images.slice()
      : [product.image];

    while (gallerySources.length < 3) {
      gallerySources.push(product.image);
    }

    if (gallery) {
      gallery.innerHTML = "";
      gallery.setAttribute("role", "region");
      gallery.setAttribute("aria-label", `${product.title} images`);
      gallery.tabIndex = 0;
      gallerySources.forEach((source, index) => {
        const galleryImage = document.createElement("img");
        galleryImage.src = asset(source);
        galleryImage.alt = index === 0 ? product.alt : `${product.title}, view ${index + 1}`;
        galleryImage.width = 800;
        galleryImage.height = 800;
        if (index > 0) {
          galleryImage.loading = "lazy";
        }
        gallery.appendChild(galleryImage);
      });

      gallery.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          gallery.scrollBy({
            left: event.key === "ArrowRight" ? gallery.clientWidth : -gallery.clientWidth,
            behavior: "smooth"
          });
        }
      });
    } else if (image) {
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
    if (colorLabel) {
      colorLabel.textContent = colors[1]?.label || colors[0]?.label || "Color details pending";
    }

    const swatches = detail.querySelector("[data-product-colors]");
    if (swatches) {
      swatches.innerHTML = "";
      colors.forEach((color, index) => {
        const swatch = document.createElement("button");
        const isActive = index === Math.min(1, colors.length - 1);
        swatch.type = "button";
        swatch.className = isActive ? "swatch is-active" : "swatch";
        swatch.style.backgroundColor = color.hex;
        swatch.setAttribute("title", color.label);
        swatch.setAttribute("aria-label", color.label);
        swatch.setAttribute("aria-pressed", String(isActive));
        if (index === colors.length - 1) {
          swatch.classList.add("is-muted");
          swatch.disabled = true;
        } else {
          swatch.addEventListener("click", () => {
            swatches.querySelectorAll(".swatch").forEach((item) => {
              item.classList.remove("is-active");
              item.setAttribute("aria-pressed", "false");
            });
            swatch.classList.add("is-active");
            swatch.setAttribute("aria-pressed", "true");
            if (colorLabel) {
              colorLabel.textContent = color.label;
            }
          });
        }
        swatches.appendChild(swatch);
      });

      for (let index = colors.length; index < 5; index += 1) {
        const blankSwatch = document.createElement("span");
        blankSwatch.className = "swatch swatch--blank";
        blankSwatch.setAttribute("aria-hidden", "true");
        swatches.appendChild(blankSwatch);
      }
    }

    const sizes = detail.querySelector("[data-product-sizes]");
    if (sizes) {
      sizes.innerHTML = "";
      productSizes.forEach((size, index) => {
        const chip = document.createElement("button");
        const isActive = index === Math.min(1, productSizes.length - 1);
        chip.type = "button";
        chip.className = isActive ? "size-chip is-active" : "size-chip";
        chip.setAttribute("aria-label", `Select size ${size}`);
        chip.setAttribute("aria-pressed", String(isActive));
        if (index === productSizes.length - 1) {
          chip.classList.add("is-muted");
          chip.disabled = true;
        } else {
          chip.addEventListener("click", () => {
            sizes.querySelectorAll(".size-chip").forEach((item) => {
              item.classList.remove("is-active");
              item.setAttribute("aria-pressed", "false");
            });
            chip.classList.add("is-active");
            chip.setAttribute("aria-pressed", "true");
          });
        }
        chip.textContent = size;
        sizes.appendChild(chip);
      });

      for (let index = productSizes.length; index < 5; index += 1) {
        const blankSize = document.createElement("span");
        blankSize.className = "size-chip size-chip--blank";
        blankSize.setAttribute("aria-hidden", "true");
        sizes.appendChild(blankSize);
      }
    }

    const bullets = detail.querySelector("[data-product-bullets]");
    if (bullets) {
      bullets.innerHTML = "";
      productBullets.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        bullets.appendChild(li);
      });
    }

    const description = detail.querySelector("[data-product-description]");
    if (description) {
      description.innerHTML = "";
      productDescription.forEach((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph.trim() ? paragraph : "\u00a0";
        description.appendChild(p);
      });
    }

    const rows = detail.querySelector("[data-product-measurements]");
    if (rows) {
      rows.innerHTML = "";
      productMeasurements.forEach((cells) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<th scope="row">${cells[0]}</th><td>${cells[1]}</td><td>${cells[2]}</td><td>${cells[3]}</td>`;
        rows.appendChild(tr);
      });
    }

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
    if (code) {
      code.textContent = product.code || `#${product.productNumber}`;
    }

    const shopeeLink = detail.querySelector("[data-product-shopee]");
    if (shopeeLink) {
      shopeeLink.href = product.shopeeUrl || "https://shopee.tw/";
      shopeeLink.setAttribute("aria-label", `${product.title} on Shopee — opens an external site`);

      const shopeeLabel = shopeeLink.querySelector("[data-product-shopee-label]");
      if (shopeeLabel) {
        shopeeLabel.textContent = "Buy on Shopee";
      }
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

    if (!drawer || !toggle) {
      return;
    }

    if (close) {
      close.hidden = true;
    }

    toggle.addEventListener("click", () => {
      if (drawer.getAttribute("aria-hidden") === "false") {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

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
        const focusable = [toggle, ...getFocusableNodes(drawer)];

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

  renderNavigation();
  setupDrawer();
  setupAccordions();
  renderProductDetail();
  renderProductGrids();
  renderFigmaIcons();
  setYear();
})();
