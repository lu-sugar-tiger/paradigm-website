const NAV_ITEMS = [
  { label: "All", path: "/collections/all", aliases: ["/"] },
  { label: "SS Tops", path: "/collections/ss-tops" },
  { label: "AW Tops", path: "/collections/aw-tops" },
  { label: "Bottoms", path: "/collections/bottoms" }
];

export const MATERIAL_ICON_NAMES = Object.freeze({
  arrow: "arrow_forward",
  back: "arrow_back",
  bag: "shopping_bag",
  care: "laundry",
  chevron: "chevron_right",
  close: "close",
  drop: "water_drop",
  external: "arrow_outward",
  filter: "filter_alt",
  grid: "grid_view",
  image: "image",
  layers: "layers",
  menu: "menu",
  search: "search",
  shirt: "apparel"
});

const MATERIAL_SYMBOLS_STYLESHEET = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${[...new Set(Object.values(MATERIAL_ICON_NAMES))].sort().join(",")}&display=block`;

export function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asset(root, path) {
  return `${root ? `${root}/` : ""}${path}`;
}

export function renderIcon(name, root = "", className = "") {
  const materialName = MATERIAL_ICON_NAMES[name];
  if (!materialName) throw new Error(`Unsupported Material icon: ${name}`);
  const classes = `material-symbols-outlined material-icon${className ? ` ${className}` : ""}`;
  return `<span class="${html(classes)}" aria-hidden="true">${html(materialName)}</span>`;
}

function renderExternalLinkIndicator(root = "") {
  return `${renderIcon("external", root, "external-link__indicator")}<span class="visually-hidden" data-external-link-description> (opens in a new tab)</span>`;
}

export function renderDescription({ tokens }) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("Rich descriptions require at least one token.");
  }

  const content = tokens.map((token) => {
    if (token.type === "blank") {
      const selectableBlank = html(token.text).replaceAll("\n", "&#10;");
      return `  <div class="rich-description__line rich-description__blank-line">${selectableBlank}</div>`;
    }
    if (token.type === "divider") {
      return `  <div class="rich-description__line rich-description__divider" role="separator">${html(token.text)}</div>`;
    }
    if (token.type === "hashtag") {
      return `  <p class="rich-description__line rich-description__hashtag">${html(token.text)}</p>`;
    }
    if (token.type === "table") {
      const header = token.header.map((cell, index) => index === 0
        ? `        <th scope="col" aria-label="Row heading">${html(cell)}</th>`
        : `        <th scope="col">${html(cell)}</th>`).join("\n");
      const body = token.body.map((row) => `      <tr>\n${row.map((cell, index) => index === 0
        ? `        <th scope="row">${html(cell)}</th>`
        : `        <td>${html(cell)}</td>`).join("\n")}\n      </tr>`).join("\n");
      return `  <div class="rich-description__table-wrap">
    <table class="rich-description__table">
      <thead><tr>
${header}
      </tr></thead>
      <tbody>
${body}
      </tbody>
    </table>
  </div>`;
    }
    if (token.type === "text") {
      return `  <p class="rich-description__line">${html(token.text)}</p>`;
    }
    throw new Error(`Unsupported rich-description token type: ${token.type}`);
  }).join("\n");

  return `<div class="rich-description" data-generated-component="rich-description">
${content}
</div>`;
}

function breadcrumbDataAttribute(name) {
  if (!name) return "";
  if (!/^data-[a-z0-9-]+$/.test(name)) throw new Error(`Invalid breadcrumb data attribute: ${name}`);
  return ` ${name}`;
}

export function renderBreadcrumb({
  variant = "hierarchy",
  items,
  ariaLabel = "Breadcrumb",
  root = ""
}) {
  if (!["hierarchy", "back"].includes(variant)) throw new Error(`Unsupported breadcrumb variant: ${variant}`);
  if (!Array.isArray(items) || items.length === 0) throw new Error("Breadcrumbs require at least one item.");

  const className = `breadcrumb breadcrumb--${variant}`;
  if (variant === "back") {
    if (items.length !== 1 || !items[0].href) throw new Error("Back breadcrumbs require one linked item.");
    const item = items[0];
    return `<nav class="${className}" aria-label="${html(ariaLabel)}" data-generated-component="breadcrumb">
  <a class="breadcrumb__back-link" href="${html(item.href)}"${breadcrumbDataAttribute(item.dataAttribute)}>${renderIcon("back", root, "breadcrumb__icon breadcrumb__icon--back")}<span class="breadcrumb__link-label">${html(item.label)}</span></a>
</nav>`;
  }

  const itemMarkup = items.map((item, index) => {
    const current = Boolean(item.current);
    const attributes = `${current ? ' aria-current="page"' : ""}${breadcrumbDataAttribute(item.dataAttribute)}`;
    let content;
    if (item.href && !current) {
      content = `<a href="${html(item.href)}"${attributes}><span class="breadcrumb__link-label">${html(item.label)}</span></a>`;
    } else if (item.headingLevel) {
      if (!Number.isInteger(item.headingLevel) || item.headingLevel < 1 || item.headingLevel > 6) throw new Error(`Invalid breadcrumb heading level: ${item.headingLevel}`);
      content = `<h${item.headingLevel} class="breadcrumb__current"${attributes}>${html(item.label)}</h${item.headingLevel}>`;
    } else {
      content = `<span class="breadcrumb__current"${attributes}>${html(item.label)}</span>`;
    }
    const separator = index === 0
      ? ""
      : `<span class="breadcrumb__separator" aria-hidden="true">${renderIcon("chevron", root, "breadcrumb__icon breadcrumb__icon--forward")}</span>`;
    return `    <li class="breadcrumb__item">${separator}${content}</li>`;
  }).join("\n");

  return `<nav class="${className}" aria-label="${html(ariaLabel)}" data-generated-component="breadcrumb">
  <ol class="breadcrumb__list" role="list">
${itemMarkup}
  </ol>
</nav>`;
}

export function renderPageHeadline({ breadcrumb, trailingAction, root = "" }) {
  if (!breadcrumb || typeof breadcrumb !== "object") throw new Error("Page headlines require breadcrumb parameters.");
  const breadcrumbMarkup = renderBreadcrumb({ ...breadcrumb, root: breadcrumb.root ?? root });
  let trailingMarkup = "";
  if (trailingAction) {
    if (!["icon", "text"].includes(trailingAction.kind)) throw new Error(`Unsupported page-headline action kind: ${trailingAction.kind}`);
    if (!trailingAction.label) throw new Error("Page-headline actions require a label.");
    if (trailingAction.kind === "icon" && !trailingAction.icon) throw new Error("Icon page-headline actions require an icon.");
    const actionContent = trailingAction.kind === "icon"
      ? renderIcon(trailingAction.icon, root, "page-headline__action-icon")
      : `<span>${html(trailingAction.label)}</span>`;
    const accessibleLabel = trailingAction.kind === "icon" ? ` aria-label="${html(trailingAction.label)}"` : "";
    trailingMarkup = `
    <button class="page-headline__action page-headline__action--${html(trailingAction.kind)}" type="button"${accessibleLabel}>${actionContent}</button>`;
  }
  return `<section class="page-headline" data-generated-component="page-headline">
  <div class="container page-headline__row">
    ${breadcrumbMarkup.split("\n").join("\n    ")}${trailingMarkup}
  </div>
</section>`;
}

function isCurrentPath(currentPath, item) {
  return currentPath === item.path || item.aliases?.includes(currentPath);
}

export function renderSiteHeader({ root = "", currentPath = "/" } = {}) {
  const [allItem, ...subcollections] = NAV_ITEMS;
  const allCurrent = isCurrentPath(currentPath, allItem) ? ' aria-current="page"' : "";
  const subcollectionMarkup = subcollections.map((item) => {
    const current = isCurrentPath(currentPath, item) ? ' aria-current="page"' : "";
    return `              <li><a href="${item.path}"${current}>${item.label}</a></li>`;
  }).join("\n");
  const teamwearCurrent = currentPath === "/teamwear" || currentPath.startsWith("/teamwear/")
    ? ' aria-current="page"'
    : "";

  return `  <header class="site-header">
    <div class="container site-header__inner">
      <a class="site-logo" href="/" aria-label="Paradigm home">PARADIGM</a>
      <div class="site-actions" aria-label="Quick actions">
        <button class="icon-button" type="button" aria-label="Search">${renderIcon("search", root)}</button>
        <button class="icon-button" type="button" aria-label="Shopping bag">${renderIcon("bag", root)}</button>
        <button class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" data-nav-toggle data-nav-open-symbol="${html(MATERIAL_ICON_NAMES.menu)}" data-nav-close-symbol="${html(MATERIAL_ICON_NAMES.close)}">${renderIcon("menu", root)}</button>
      </div>
    </div>
  </header>

  <div class="nav-drawer" aria-hidden="true" data-nav-drawer>
    <div class="nav-drawer__panel">
      <button class="icon-button nav-drawer__close" type="button" aria-label="Close navigation" data-nav-close>${renderIcon("close", root)}</button>
      <nav class="drawer-nav" aria-label="Navigation">
        <ul role="list">
          <li>
            <a href="${allItem.path}"${allCurrent}>${allItem.label}</a>
            <ul class="drawer-nav__subcollections" role="list">
${subcollectionMarkup}
            </ul>
          </li>
        </ul>
        <div class="drawer-nav__divider"></div>
        <ul role="list">
          <li><a href="/teamwear"${teamwearCurrent}>Teamwear</a></li>
        </ul>
      </nav>
    </div>
  </div>`;
}

export function renderSiteFooter() {
  return `  <footer class="site-footer" data-primary-action-footer-anchor>
    <div class="container site-footer__grid">
      <a class="footer-link external-link" href="https://www.instagram.com/prdm.tw/" target="_blank" rel="noopener noreferrer" data-external-link="true"><span class="footer-link__content"><span class="external-link__label">Instagram</span>${renderExternalLinkIndicator()}</span></a>
      <a class="footer-link external-link" href="https://shopee.tw/" target="_blank" rel="noopener noreferrer" data-external-link="true"><span class="footer-link__content"><span class="external-link__label">Shopee</span>${renderExternalLinkIndicator()}</span></a>
      <div class="footer-meta">
        <span>PARADIGM Co., Ltd.</span>
        <span>Copyright © <span data-current-year>2026</span> All Rights Reserved.</span>
      </div>
    </div>
  </footer>`;
}

export function renderChoiceGroup({
  kind,
  title,
  inputName,
  selectedValue,
  primaryActionId,
  showLabel = true,
  options
}) {
  if (!["swatch", "chip"].includes(kind)) throw new Error(`Unsupported choice kind: ${kind}`);
  const selectedOption = options.find((option) => option.id === selectedValue || option.selected) || options[0];
  const groupId = `choice-${inputName.replace(/[^a-z0-9_-]+/gi, "-")}`;
  const labelMarkup = kind === "swatch"
    ? `<span data-choice-label-value>${html(selectedOption?.label || title)}</span>`
    : html(title);
  const optionMarkup = options.map((option) => {
    const optionId = `${groupId}-${String(option.id).replace(/[^a-z0-9_-]+/gi, "-")}`;
    const unavailable = option.availability === "unavailable";
    const selected = option.id === selectedOption?.id;
    const colorClass = kind === "swatch" ? ` choice-option--color-${html(option.colorId)}` : "";
    const descriptionId = `${optionId}-availability`;
    return `      <label class="choice-option choice-option--${kind}${colorClass}" data-choice-option data-choice-id="${html(option.id)}" data-choice-label="${html(option.label)}" data-availability="${unavailable ? "unavailable" : "available"}"${kind === "swatch" ? ` data-color-id="${html(option.colorId)}" title="${html(option.label)}"` : ""}>
        <input class="visually-hidden" type="radio" id="${html(optionId)}" name="${html(inputName)}" value="${html(option.id)}"${selected ? " checked" : ""}${unavailable ? ` aria-describedby="${html(descriptionId)}"` : ""}>
        ${kind === "chip" ? `<span aria-hidden="true">${html(option.label)}</span>` : ""}
        <span class="visually-hidden">${kind === "chip" ? html(option.label) : html(`${title} ${option.label}`)}</span>
        ${unavailable ? `<span class="visually-hidden" id="${html(descriptionId)}" data-choice-availability-text>Unavailable</span>` : ""}
      </label>`;
  }).join("\n");

  return `<fieldset class="choice-group choice-group--${kind}" data-choice-group data-choice-kind="${kind}" data-choice-title="${html(title)}" data-primary-action-id="${html(primaryActionId)}">
    <legend class="visually-hidden">${html(title)}</legend>
    <div class="choice-group__layout">
      ${showLabel ? `<div class="choice-group__label" aria-hidden="true">${labelMarkup}</div>` : ""}
      <div class="choice-group__options">
${optionMarkup}
      </div>
    </div>
    <span class="visually-hidden" aria-live="polite" data-choice-status></span>
  </fieldset>`;
}

export function renderPrimaryAction({
  id,
  intent,
  behavior,
  label,
  href,
  root = "",
  target = "",
  external = false,
  initialIntent = intent,
  notificationChannel = "https://www.instagram.com/prdm.tw/"
}) {
  if (!["fixed-to-static", "fixed-to-float"].includes(behavior)) {
    throw new Error(`Unsupported primary-action behavior: ${behavior}`);
  }
  if (external !== (target === "_blank")) {
    throw new Error("Primary-action external state must match its new-tab target.");
  }
  const isNotify = initialIntent === "notify";
  const actionLabel = isNotify ? "Notify Me" : label;
  const actionHref = isNotify ? notificationChannel : href;
  const actionTarget = isNotify ? "_blank" : target;
  const actionExternal = isNotify || external;
  const targetAttributes = actionTarget
    ? ` target="${html(actionTarget)}" rel="noopener noreferrer"`
    : "";
  return `<div class="primary-action-mount primary-action-mount--inline" data-primary-action-inline-mount="${html(id)}">
    <a class="button primary-action external-link" id="${html(id)}" href="${html(actionHref)}"${targetAttributes} data-primary-action data-action-intent="${html(initialIntent)}" data-action-default-intent="${html(intent)}" data-action-default-label="${html(label)}" data-action-default-href="${html(href)}" data-action-default-target="${html(target)}" data-action-default-external="${html(external)}" data-action-notify-href="${html(notificationChannel)}" data-action-notify-external="true" data-action-behavior="${html(behavior)}" data-external-link="${html(actionExternal)}">
      <span class="primary-action__content"><span class="external-link__label" data-primary-action-label>${html(actionLabel)}</span>${renderExternalLinkIndicator(root)}</span>
    </a>
  </div>`;
}

export function renderPrimaryActionDock(id) {
  if (!id) return "";
  return `  <div class="primary-action-dock" data-primary-action-dock-mount="${html(id)}"></div>`;
}

export function renderRailControls({ label, railId, root = "" }) {
  return `<div class="teamwear-rail-controls" role="group" aria-label="${html(label)} carousel controls">
    <button class="teamwear-rail-button teamwear-rail-button--previous" type="button" aria-label="Previous ${html(label.toLowerCase())}" aria-controls="${html(railId)}" data-rail-previous>${renderIcon("arrow", root)}</button>
    <button class="teamwear-rail-button" type="button" aria-label="Next ${html(label.toLowerCase())}" aria-controls="${html(railId)}" data-rail-next>${renderIcon("arrow", root)}</button>
  </div>`;
}

export function renderProductCard(product, root = "") {
  const image = product.image
    ? `<img src="${html(asset(root, product.image))}" alt="${html(product.alt)}" loading="lazy" width="400" height="460">`
    : "";
  return `<a class="product-card" href="/products/${html(product.productNumber)}">
  <div class="product-card__media">${image}</div>
  <div class="product-card__body">
    <h3 class="product-card__title">${html(product.title)}</h3>
    <div class="product-card__footer"><span class="product-card__price">${html(product.price)}</span></div>
  </div>
</a>`;
}

export function renderProductGrid(products, root = "") {
  return `<div class="auto-grid product-grid" data-generated-component="product-grid">
${products.map((product) => renderProductCard(product, root)).join("\n")}
</div>`;
}

export function renderDocument({
  lang = "en",
  title,
  description,
  canonical,
  root = "",
  currentPath = "/",
  bodyClass,
  main,
  styles = [],
  scripts = [],
  head = "",
  primaryActionDockId = ""
}) {
  const baseStyles = ["tokens.css", "reset.css", "base.css", "layout.css", "components.css", "pages.css", "color-options.css"];
  const styleMarkup = [...baseStyles, ...styles].map((file) => `  <link rel="stylesheet" href="${html(asset(root, `assets/css/${file}`))}">`).join("\n");
  const dataScripts = scripts.filter((file) => ["catalog.js", "teamwear-options.js"].includes(file));
  const interactionScripts = scripts.filter((file) => !["catalog.js", "teamwear-options.js"].includes(file));
  const scriptMarkup = ["app.js", ...dataScripts, "choices.js", ...interactionScripts].map((file) => `  <script defer src="${html(asset(root, `assets/js/${file}`))}"></script>`).join("\n");
  const document = `<!doctype html>
<!-- Generated by scripts/build-site.mjs. Do not edit this file directly. -->
<html lang="${html(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(title)}</title>
  <meta name="description" content="${html(description)}">
  <link rel="canonical" href="${html(canonical)}">
  <link rel="icon" href="${html(asset(root, "favicon.svg"))}" type="image/svg+xml">
  <link rel="stylesheet" href="${html(MATERIAL_SYMBOLS_STYLESHEET)}">
${head ? `${head}\n` : ""}${styleMarkup}
${scriptMarkup}
</head>
<body class="${html(bodyClass)}" data-root="${html(root)}">
${renderSiteHeader({ root, currentPath })}

${main}

${renderPrimaryActionDock(primaryActionDockId)}
${renderSiteFooter()}
</body>
</html>
`;
  return document.replace(/[ \t]+$/gm, "");
}
