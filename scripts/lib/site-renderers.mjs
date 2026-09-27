import { imageSrcset } from "./product-images.mjs";
import { regularTableFigures } from "./rich-description.mjs";
import { readFileSync } from "node:fs";

const STORE_LINKS = JSON.parse(readFileSync(new URL("../../data/store-links.json", import.meta.url), "utf8"));

const NAV_GROUPS = [
  {
    label: "Product",
    path: "/collections/all",
    aliases: ["/"],
    children: [
      { label: "SS Tops", path: "/collections/ss-tops" },
      { label: "AW Tops", path: "/collections/aw-tops" },
      { label: "Bottoms", path: "/collections/bottoms" }
    ]
  },
  {
    label: "Teamwear",
    path: "/teamwear",
    children: [
      { label: "Basketball", path: "/teamwear", prefixes: ["/teamwear/"] }
    ]
  }
];

export const MATERIAL_ICON_NAMES = Object.freeze({
  add: "add",
  arrow: "arrow_forward",
  back: "chevron_left",
  care: "laundry",
  chevron: "chevron_right",
  check: "check",
  close: "close",
  drop: "water_drop",
  expand: "expand_more",
  external: "arrow_outward",
  grid: "grid_view",
  image: "image",
  layers: "layers",
  menu: "menu",
  search: "search",
  shirt: "apparel"
});

const MATERIAL_SYMBOLS_STYLESHEET = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,100..700,0,0&icon_names=${[...new Set(Object.values(MATERIAL_ICON_NAMES))].sort().join(",")}&display=block`;
const ROBOTO_SEMI_CONDENSED_STYLESHEET = "https://fonts.googleapis.com/css2?family=Roboto:wdth,wght@87.5,100..900&display=swap";

export function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderProductDetailPrice({ price, dataAttribute = "" }) {
  if (!price) throw new Error("Product-detail prices require a display value.");
  if (dataAttribute && !/^data-[a-z0-9-]+$/.test(dataAttribute)) {
    throw new Error(`Invalid product-detail price data attribute: ${dataAttribute}`);
  }
  const attribute = dataAttribute ? ` ${dataAttribute}` : "";
  return `<p class="product-detail__price"${attribute} data-generated-component="product-detail-price">${html(price)}</p>`;
}

// Page adapters supply already-rendered content; this component owns its structure.
// Media is rendered in the supplied order. Selection-driven image updates belong
// to the existing product and Teamwear controllers.
export function renderProductDetail({
  variant = "product",
  code,
  name,
  category = "",
  media,
  zoom = true,
  price,
  choices,
  primaryAction,
  description
}) {
  if (!["product", "teamwear"].includes(variant)) throw new Error(`Unsupported product-detail variant: ${variant}`);
  const isTeamwear = variant === "teamwear";
  const panelAttributes = isTeamwear ? "" : ` data-product-detail data-item-code="${html(code)}" data-notification-title="${html(name)}"`;
  const summaryAttributes = isTeamwear ? ` data-teamwear-form data-teamwear-model="${html(code)}" data-notification-title="${html(name)}"` : "";
  const galleryAttribute = isTeamwear ? "data-builder-preview" : "data-product-gallery";
  const titleAttribute = isTeamwear ? 'id="builder-title"' : "data-product-name";
  const indent = (markup, spaces) => markup.split("\n").map((line) => `${" ".repeat(spaces)}${line}`).join("\n");
  const categoryMarkup = category ? `              <p class="product-detail__label" data-product-category>${html(category)}</p>\n` : "";

  return `  <section class="product-detail" data-generated-component="product-detail">
    <div class="container">
      <div class="product-detail__panel"${panelAttributes}>
        <div class="product-detail__gallery" ${galleryAttribute}${zoom ? " data-media-zoom-gallery" : ""} aria-label="${html(name)} images">
${indent(media.join("\n"), 10)}
        </div>
        <article class="product-detail__summary"${summaryAttributes}>
          <div class="product-detail__header">
            <div>
${categoryMarkup}              <h1 ${titleAttribute}>${html(name)}</h1>
            </div>
            ${price}
          </div>

          <div class="stack-md">
${indent(choices.join("\n"), 12)}
          </div>

${indent(primaryAction, 10)}

${indent(description, 10)}
        </article>
      </div>
    </div>
  </section>`;
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

function renderToggleIconPair(restingName, root = "") {
  return `<span class="toggle-icon-stack" aria-hidden="true">${renderIcon(restingName, root, "toggle-icon toggle-icon--resting")}${renderIcon("close", root, "toggle-icon toggle-icon--close")}</span>`;
}

function renderExternalLinkIndicator(root = "") {
  return `${renderIcon("external", root, "external-link__indicator")}<span class="visually-hidden" data-external-link-description> (opens in a new tab)</span>`;
}

export function renderDescription({ tokens, itemCodes = [], currentItemCode = "" }) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("Rich descriptions require at least one token.");
  }

  const publishedCodes = new Map(itemCodes.map((code) => [code.toUpperCase(), code]));
  function linkedText(text) {
    const mentions = /(?<![A-Za-z0-9_#\/])#([A-Za-z]+[0-9]{5})(?:-[A-Za-z0-9]+)*(?![A-Za-z0-9_-])/g;
    let result = "";
    let cursor = 0;
    for (const match of text.matchAll(mentions)) {
      if (/\b(?:https?:\/\/|www\.)\S*$/i.test(text.slice(0, match.index))) continue;
      const code = publishedCodes.get(match[1].toUpperCase());
      if (!code || code.toUpperCase() === currentItemCode.toUpperCase()) continue;
      result += html(text.slice(cursor, match.index));
      result += `<a href="/products/${html(code)}">${html(match[0])}</a>`;
      cursor = match.index + match[0].length;
    }
    return result + html(text.slice(cursor));
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
      return `  <p class="rich-description__line rich-description__hashtag">${linkedText(token.text)}</p>`;
    }
    if (token.type === "table") {
      const header = token.header.map((cell, index) => index === 0
        ? `        <th scope="col" aria-label="Row heading">${html(regularTableFigures(cell))}</th>`
        : `        <th scope="col">${html(regularTableFigures(cell))}</th>`).join("\n");
      const body = token.body.map((row) => `      <tr>\n${row.map((cell, index) => index === 0
        ? `        <th scope="row">${html(regularTableFigures(cell))}</th>`
        : `        <td>${html(regularTableFigures(cell))}</td>`).join("\n")}\n      </tr>`).join("\n");
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
      return `  <p class="rich-description__line">${linkedText(token.text)}</p>`;
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
  <a class="breadcrumb__back-link" href="${html(item.href)}"${breadcrumbDataAttribute(item.dataAttribute)}>${renderIcon("back", root, "breadcrumb__icon breadcrumb__icon--back")}<span class="breadcrumb__link-label interface-label">${html(item.label)}</span></a>
</nav>`;
  }

  const itemMarkup = items.map((item, index) => {
    const current = Boolean(item.current);
    const attributes = `${current ? ' aria-current="page"' : ""}${breadcrumbDataAttribute(item.dataAttribute)}`;
    const currentClassName = `breadcrumb__current${item.interfaceLabel ? " interface-label" : ""}`;
    let content;
    if (item.href && !current) {
      content = `<a href="${html(item.href)}"${attributes}><span class="breadcrumb__link-label interface-label">${html(item.label)}</span></a>`;
    } else if (item.headingLevel) {
      if (!Number.isInteger(item.headingLevel) || item.headingLevel < 1 || item.headingLevel > 6) throw new Error(`Invalid breadcrumb heading level: ${item.headingLevel}`);
      content = `<h${item.headingLevel} class="${currentClassName}"${attributes}>${html(item.label)}</h${item.headingLevel}>`;
    } else {
      content = `<span class="${currentClassName}"${attributes}>${html(item.label)}</span>`;
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
    if (!["icon", "text", "dropdown"].includes(trailingAction.kind)) throw new Error(`Unsupported page-headline action kind: ${trailingAction.kind}`);
    if (!trailingAction.label) throw new Error("Page-headline actions require a label.");
    if (trailingAction.kind === "dropdown") {
      trailingMarkup = `\n    ${renderDropdown(trailingAction)}`;
    } else {
    if (trailingAction.kind === "icon" && !trailingAction.icon) throw new Error("Icon page-headline actions require an icon.");
    const actionContent = trailingAction.kind === "icon"
      ? renderIcon(trailingAction.icon, root, "page-headline__action-icon")
      : `<span class="interface-label">${html(trailingAction.label)}</span>`;
    const accessibleLabel = trailingAction.kind === "icon" ? ` aria-label="${html(trailingAction.label)}"` : "";
    trailingMarkup = `
    <button class="page-headline__action page-headline__action--${html(trailingAction.kind)}" type="button"${accessibleLabel}>${actionContent}</button>`;
    }
  }
  return `<section class="page-headline" data-generated-component="page-headline">
  <div class="container page-headline__row">
    ${breadcrumbMarkup.split("\n").join("\n    ")}${trailingMarkup}
  </div>
</section>`;
}

function isCurrentPath(currentPath, item) {
  return currentPath === item.path || item.aliases?.includes(currentPath) || item.prefixes?.some((prefix) => currentPath.startsWith(prefix));
}

export function renderSiteHeader({ root = "", currentPath = "/" } = {}) {
  const desktopNavigation = NAV_GROUPS.map((group, index) => {
    const childIsCurrent = group.children.some((item) => isCurrentPath(currentPath, item));
    const parentCurrent = !childIsCurrent && isCurrentPath(currentPath, group) ? ' aria-current="page"' : "";
    return `<div class="header-directory__group" data-header-group>
        <a class="header-directory__parent interface-label" href="${group.path}"${parentCurrent} aria-expanded="false" aria-controls="header-subcollections-${index}" aria-describedby="header-navigation-help" data-header-parent>${group.label}</a>
        <ul class="header-directory__panel" id="header-subcollections-${index}" role="list">
          ${group.children.map((item) => `<li><a class="header-directory__child interface-label" href="${item.path}"${isCurrentPath(currentPath, item) ? ' aria-current="page"' : ""}>${item.label}</a></li>`).join("\n          ")}
        </ul>
      </div>`;
  }).join("\n      ");
  const navigationMarkup = NAV_GROUPS.map((group) => {
    const childMarkup = group.children.map((item) => {
      const current = isCurrentPath(currentPath, item) ? ' aria-current="page"' : "";
      return `              <li><a class="drawer-nav__child interface-label" href="${item.path}"${current}>${item.label}</a></li>`;
    }).join("\n");
    const childIsCurrent = group.children.some((item) => isCurrentPath(currentPath, item));
    const parentCurrent = !childIsCurrent && isCurrentPath(currentPath, group) ? ' aria-current="page"' : "";
    return `          <li class="drawer-nav__group">
            <a class="drawer-nav__parent interface-label" href="${group.path}"${parentCurrent}>${group.label}</a>
            <ul class="drawer-nav__children" role="list">
${childMarkup}
            </ul>
          </li>`;
  }).join("\n");

  return `  <header class="site-header">
    <div class="container site-header__inner">
      <nav class="header-directory" aria-label="Main navigation" data-header-directory>
        <span class="visually-hidden" id="header-navigation-help">Activate once to keep subcollections open. Activate again to visit the collection. Escape closes the panel.</span>
        ${desktopNavigation}
      </nav>
      <a class="site-logo" href="/" aria-label="Paradigm home"><img class="site-logo__image" src="${html(asset(root, "assets/images/brand/aesthetics-logo-initial-a.png"))}" alt=""></a>
      <div class="site-actions" aria-label="Quick actions">
        <div class="header-region" data-header-region></div>
        <button class="icon-button" type="button" aria-label="Open search" aria-expanded="false" data-search-toggle>${renderToggleIconPair("search", root)}</button>
        <button class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" data-nav-toggle>${renderToggleIconPair("menu", root)}</button>
      </div>
    </div>
  </header>

  <div class="search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-overlay-title" aria-hidden="true" data-overlay-state="closed" data-search-overlay>
    <div class="search-overlay__panel">
      <div class="container search-overlay__inner">
        <h2 class="visually-hidden" id="search-overlay-title">Search</h2>
        <div class="search-overlay__form-wrap">
          <form class="search-form" role="search" data-search-form>
            <label class="visually-hidden" for="site-search-input">Search Paradigm</label>
            <input class="search-form__input" id="site-search-input" type="search" name="q" placeholder="SEARCH PRDM.TW" autocomplete="off" autocapitalize="none" spellcheck="false" data-search-input>
            <button class="icon-button search-form__submit" type="submit" aria-label="Search" data-search-submit disabled>${renderIcon("search", root)}</button>
          </form>
        </div>
        <p class="visually-hidden" aria-live="polite" data-search-status></p>
        <div class="search-results" aria-busy="true" data-search-results>
          <p class="search-status-row">Loading search…</p>
        </div>
      </div>
    </div>
  </div>

  <div class="nav-drawer" aria-hidden="true" data-overlay-state="closed" data-nav-drawer>
    <div class="nav-drawer__panel">
      <div class="container nav-drawer__inner">
        <nav class="drawer-nav" aria-label="Navigation">
          <ul class="drawer-nav__groups" role="list">
${navigationMarkup}
          </ul>
          ${renderDropdown({ id: "menu-language", label: "Language", name: "language", selectedValue: "taiwan", variant: "text", options: [{ value: "taiwan", label: "Taiwan" }, { value: "international", label: "International" }] })}
        </nav>
      </div>
    </div>
  </div>`;
}

function renderDropdownTrigger({ id, label, selected, options, variant, grouped = false }) {
  const valueMarkup = `<span data-dropdown-value>${html(selected.label)}</span>`;
  const iconMarkup = `<span class="material-symbols-outlined material-icon choice-option__state-symbol${variant === "text" ? " dropdown__text-indicator" : ""}" aria-hidden="true">${MATERIAL_ICON_NAMES.expand}</span>`;
  return `<button type="button" class="dropdown__trigger" data-selected="true" data-availability="${selected.availability === "unavailable" ? "unavailable" : "available"}" aria-label="${html(grouped ? label : `${label}: ${selected.label}`)}" data-dropdown-label="${html(label)}"${grouped ? "" : ' aria-haspopup="listbox"'} aria-expanded="false" aria-controls="${html(id)}-list">
        <span class="dropdown__label interface-label">${variant === "text" ? `<span class="dropdown__text-content">${valueMarkup}${iconMarkup}</span>` : valueMarkup}${options.map((option) => `<span class="dropdown__sizer" aria-hidden="true">${html(option.label)}</span>`).join("")}</span>
        ${variant === "text" ? "" : `<span class="choice-option__state-icon" aria-hidden="true">${iconMarkup}</span>`}
      </button>`;
}

function renderDropdownGroups(id, groups) {
  if (!groups.length || new Set(groups.map((group) => group.name)).size !== groups.length) throw new Error("Dropdown requires unique groups");
  return groups.map((group) => {
    if (!["single", "multiple", "range"].includes(group.kind)) throw new Error(`Unsupported dropdown group: ${group.kind}`);
    const groupId = `${id}-${group.name}`;
    let controls;
    if (group.kind === "range") {
      controls = `<div class="dropdown__range">${["min", "max"].map((bound) => `<label class="dropdown__range-label" for="${html(groupId)}-${bound}"><span>${bound === "min" ? "Min" : "Max"}${group.unit ? ` (${html(group.unit)})` : ""}</span><input id="${html(groupId)}-${bound}" type="number" inputmode="decimal" name="${html(group.name)}-${bound}" min="${html(group.min)}" max="${html(group.max)}" step="${html(group.step || 1)}" placeholder="${html(group[bound])}" data-range-bound="${bound}"></label>`).join("")}</div>`;
    } else {
      if (!group.options?.length || new Set(group.options.map((option) => option.value)).size !== group.options.length) throw new Error("Dropdown group requires unique options");
      controls = `<div class="dropdown__choices">${group.options.map((option) => `<label class="dropdown__option dropdown__choice interface-label" data-availability="available"><input class="visually-hidden" type="${group.kind === "single" ? "radio" : "checkbox"}" name="${html(group.name)}" value="${html(option.value)}"${option.value === group.selectedValue || option.selected ? " checked" : ""}><span>${html(option.label)}</span>${renderIcon("check", "", "dropdown__choice-check")}</label>`).join("\n")}</div>`;
    }
    return `<fieldset class="dropdown__group" data-dropdown-group="${html(group.kind)}"><legend class="interface-label">${html(group.label)}</legend>${controls}</fieldset>`;
  }).join("\n");
}

export function renderDropdown({ id, label, name, options, selectedValue, variant = "boxed", groups, align = "start" }) {
  if (!["boxed", "text"].includes(variant)) throw new Error(`Unsupported dropdown variant: ${variant}`);
  if (!["start", "end"].includes(align)) throw new Error(`Unsupported dropdown alignment: ${align}`);
  if (groups) {
    return `<div class="dropdown${variant === "text" ? " dropdown--text" : ""}" data-dropdown data-dropdown-grouped data-dropdown-align="${align}">
    <div class="dropdown__enhanced" hidden>
      ${renderDropdownTrigger({ id, label, selected: { label }, options: [{ label }], variant, grouped: true })}
      <form id="${html(id)}-list" class="dropdown__options dropdown__panel" aria-label="${html(label)}" novalidate hidden>
        <div class="dropdown__groups">${renderDropdownGroups(id, groups)}</div>
        <p class="dropdown__error" role="alert" data-dropdown-error hidden></p>
        <div class="dropdown__footer"><output aria-live="polite" data-dropdown-status></output><button class="dropdown__text-action interface-label" type="reset">Clear all</button><button class="dropdown__text-action interface-label" type="button" data-dropdown-close>Done</button></div>
      </form>
    </div>
  </div>`;
  }
  if (!options?.length || new Set(options.map((option) => option.value)).size !== options.length) throw new Error("Dropdown requires unique options");
  const selected = options.find((option) => option.value === selectedValue) || options[0];
  return `<div class="dropdown${variant === "text" ? " dropdown--text" : ""}" data-dropdown data-dropdown-align="${align}">
    <select id="${html(id)}-native" class="dropdown__native interface-label" name="${html(name)}" aria-label="${html(label)}" data-dropdown-native>
      ${options.map((option) => `<option value="${html(option.value)}"${option === selected ? " selected" : ""}>${html(option.label)}</option>`).join("\n")}
    </select>
    <div class="dropdown__enhanced" hidden>
      ${renderDropdownTrigger({ id, label, selected, options, variant })}
      <div id="${html(id)}-list" class="dropdown__options" role="listbox" aria-label="${html(label)}" hidden>
        ${options.map((option, index) => `<div class="dropdown__option interface-label" role="option" tabindex="-1" data-value="${html(option.value)}" data-availability="${option.availability === "unavailable" ? "unavailable" : "available"}" aria-selected="${option === selected}"${option.availability === "unavailable" ? ` aria-describedby="${html(id)}-unavailable-${index}"` : ""}>${html(option.label)}${option.availability === "unavailable" ? `<span class="visually-hidden" id="${html(id)}-unavailable-${index}">Unavailable</span>` : ""}</div>`).join("\n")}
      </div>
    </div>
  </div>`;
}

export function renderSiteFooter() {
  return `  <footer class="site-footer" data-primary-action-footer-anchor>
    <div class="container site-footer__grid">
      <a class="footer-link external-link" href="https://www.instagram.com/prdm.tw/" target="_blank" rel="noopener noreferrer" data-external-link="true"><span class="footer-link__content"><span class="external-link__label interface-label">Instagram</span>${renderExternalLinkIndicator()}</span></a>
      <a class="footer-link external-link" href="${html(STORE_LINKS.shopee)}" target="_blank" rel="noopener noreferrer" data-external-link="true"><span class="footer-link__content"><span class="external-link__label interface-label">Shopee</span>${renderExternalLinkIndicator()}</span></a>
      <a class="footer-link interface-label" href="/font-credits/">Credits</a>
      <div class="footer-meta">
        <span>Paradigm Co., Ltd.</span>
        <span>Copyright © <span data-current-year>2026</span> All Rights Reserved.</span>
      </div>
    </div>
  </footer>`;
}

export function renderChoiceGroup({
  kind,
  variant = "default",
  title,
  inputName,
  selectedValue,
  primaryActionId,
  showLabel = true,
  options
}) {
  if (!["swatch", "chip"].includes(kind)) throw new Error(`Unsupported choice kind: ${kind}`);
  if (!["default", "add-on"].includes(variant)) throw new Error(`Unsupported choice variant: ${variant}`);
  if (variant === "add-on" && kind !== "chip") throw new Error("The add-on choice variant requires chip choices.");
  const isAddOn = variant === "add-on";
  const selectedOption = options.find((option) => option.id === selectedValue || option.selected) || (isAddOn ? null : options[0]);
  const groupId = `choice-${inputName.replace(/[^a-z0-9_-]+/gi, "-")}`;
  const labelMarkup = kind === "swatch"
    ? `<span data-choice-label-value>${html(selectedOption?.label || title)}</span>`
    : html(title);
  const optionMarkup = options.map((option) => {
    const optionId = `${groupId}-${String(option.id).replace(/[^a-z0-9_-]+/gi, "-")}`;
    const unavailable = option.availability === "unavailable";
    const selected = isAddOn ? Boolean(option.selected || option.id === selectedValue) : option.id === selectedOption?.id;
    const colorClass = kind === "swatch" ? ` choice-option--color-${html(option.colorId)}` : "";
    const variantClass = isAddOn ? " choice-option--chip-add-on" : "";
    const descriptionId = `${optionId}-availability`;
    const stateSymbol = selected ? MATERIAL_ICON_NAMES.check : MATERIAL_ICON_NAMES.add;
    const addOnIcon = isAddOn ? `
        <span class="choice-option__state-icon" aria-hidden="true"><span class="material-symbols-outlined material-icon choice-option__state-symbol" data-choice-state-symbol data-choice-unselected-symbol="${html(MATERIAL_ICON_NAMES.add)}" data-choice-selected-symbol="${html(MATERIAL_ICON_NAMES.check)}" aria-hidden="true">${html(stateSymbol)}</span></span>` : "";
    return `      <label class="choice-option choice-option--${kind}${colorClass}${variantClass}" data-choice-option data-choice-id="${html(option.id)}" data-choice-label="${html(option.label)}" data-availability="${unavailable ? "unavailable" : "available"}"${kind === "swatch" ? ` data-color-id="${html(option.colorId)}" title="${html(option.label)}"` : ""}>
        <input class="visually-hidden" type="${isAddOn ? "checkbox" : "radio"}" id="${html(optionId)}" name="${html(inputName)}" value="${html(option.id)}"${selected ? " checked" : ""}${unavailable ? ` aria-describedby="${html(descriptionId)}"` : ""}>
        ${kind === "chip" ? `<span class="choice-option__label${isAddOn ? " interface-label" : ""}" aria-hidden="true">${html(option.label)}</span>` : ""}${addOnIcon}
        <span class="visually-hidden">${kind === "chip" ? html(option.label) : html(`${title} ${option.label}`)}</span>
        ${unavailable ? `<span class="visually-hidden" id="${html(descriptionId)}" data-choice-availability-text>Unavailable</span>` : ""}
      </label>`;
  }).join("\n");

  return `<fieldset class="choice-group choice-group--${kind}${isAddOn ? " choice-group--chip-add-on" : ""}" data-choice-group data-choice-kind="${kind}"${isAddOn ? ' data-choice-variant="add-on"' : ""} data-choice-title="${html(title)}" data-primary-action-id="${html(primaryActionId)}">
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
  const actionLabel = isNotify ? "Notify me" : label;
  const actionHref = isNotify ? notificationChannel : href;
  const actionTarget = isNotify ? "_blank" : target;
  const actionExternal = isNotify || external;
  const targetAttributes = actionTarget
    ? ` target="${html(actionTarget)}" rel="noopener noreferrer"`
    : "";
  return `<div class="primary-action-mount primary-action-mount--inline" data-primary-action-inline-mount="${html(id)}">
    <a class="button primary-action external-link" id="${html(id)}" href="${html(actionHref)}"${targetAttributes} data-primary-action data-action-intent="${html(initialIntent)}" data-action-default-intent="${html(intent)}" data-action-default-label="${html(label)}" data-action-default-href="${html(href)}" data-action-default-target="${html(target)}" data-action-default-external="${html(external)}" data-action-notify-href="${html(notificationChannel)}" data-action-notify-external="true" data-action-behavior="${html(behavior)}" data-external-link="${html(actionExternal)}">
      <span class="primary-action__content"><span class="external-link__label interface-label" data-primary-action-label>${html(actionLabel)}</span>${renderExternalLinkIndicator(root)}</span>
    </a>
  </div>`;
}

export function renderRailControls({ label, railId, root = "" }) {
  return `<div class="teamwear-rail-controls" role="group" aria-label="${html(label)} carousel controls">
    <button class="teamwear-rail-button teamwear-rail-button--previous" type="button" aria-label="Previous ${html(label.toLowerCase())}" aria-controls="${html(railId)}" data-rail-previous hidden>${renderIcon("back", root)}</button>
    <button class="teamwear-rail-button" type="button" aria-label="Next ${html(label.toLowerCase())}" aria-controls="${html(railId)}" data-rail-next hidden>${renderIcon("chevron", root)}</button>
  </div>`;
}

export function productCardDisplayName(name) {
  return name.startsWith("PRDM ") ? name.slice(5) : name;
}

export function renderProductCard(product, root = "") {
  const media = product.cardMedia || product.media?.[0] || (product.image ? { src: product.image, derivatives: [] } : null);
  const image = media
    ? renderResponsiveProductImage({
      media,
      alt: product.cardAlt || product.alt,
      root,
      sizes: "(min-width: 80rem) 426px, (min-width: 48rem) 33.333vw, 50vw",
      loading: "lazy"
    })
    : "";
  const touchZoom = image && !media?.isFallback ? " data-media-zoom-touch" : "";
  return `<a class="product-card" href="${html(product.cardUrl || `/products/${product.code}`)}">
  <div class="product-card__media"${touchZoom}>${image}</div>
  <div class="product-card__body">
    <h3 class="product-card__title">${html(productCardDisplayName(product.name))}</h3>
    <span class="product-card__price">${html(product.priceLabel)}</span>
  </div>
</a>`;
}

export function renderResponsiveProductImage({ media, alt, root = "", sizes, loading = "", touchZoom = false, dataAttribute = "", imageId = "", variantImage = false }) {
  if (!media?.src) throw new Error("Responsive product images require a fallback source.");
  const resolvedPath = (source) => asset(root, source);
  const srcset = imageSrcset(media, resolvedPath);
  const responsiveAttributes = srcset ? ` srcset="${html(srcset)}" sizes="${html(sizes)}"` : "";
  const loadingAttribute = loading ? ` loading="${html(loading)}"` : "";
  const zoomAttribute = touchZoom ? " data-media-zoom-touch" : "";
  const fallbackAttribute = media.isFallback ? " data-product-image-fallback" : "";
  if (dataAttribute && !/^data-[a-z][a-z0-9-]*$/.test(dataAttribute)) throw new Error("Invalid image data attribute.");
  const behaviorAttribute = dataAttribute ? ` ${dataAttribute}` : "";
  const identityAttributes = `${imageId ? ` data-product-image-id="${html(imageId)}"` : ""}${variantImage ? " data-product-variant-image" : ""}`;
  const width = media.width || 1;
  const height = media.height || 1;
  return `<img src="${html(resolvedPath(media.src))}"${responsiveAttributes} alt="${html(alt)}" width="${html(width)}" height="${html(height)}"${loadingAttribute}${zoomAttribute}${fallbackAttribute}${behaviorAttribute}${identityAttributes}>`;
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
  head = ""
}) {
const baseStyles = ["fonts.css?v=20260909b", "tokens.css?v=20260916a", "motion.css?v=20260831a", "reset.css?v=20260829a", "base.css?v=20260916b", "layout.css", "components.css?v=20260927e", "header-directory.css?v=20260914a", "pages.css?v=20260927a", "color-options.css?v=20260922a"];
  const styleMarkup = [...baseStyles, ...styles].map((file) => `  <link rel="stylesheet" href="${html(asset(root, `assets/css/${file}`))}">`).join("\n");
  const isDataScript = (file) => ["catalog.js", "teamwear-options.js"].includes(file.split("?")[0]);
  const dataScripts = scripts.filter(isDataScript);
  const interactionScripts = scripts.filter((file) => !isDataScript(file));
  const earlyMotionScript = `  <script src="${html(asset(root, "assets/js/page-transitions.js?v=20260831a"))}"></script>`;
  const scriptMarkup = ["app.js?v=20260914a", "dropdown.js?v=20260914a", "language-preference.js?v=20260908a", "header-directory.js?v=20260914a", "search-core.js?v=20260927b", "search.js?v=20260927b", ...dataScripts, "choices.js?v=20260924a", ...interactionScripts].map((file) => `  <script defer src="${html(asset(root, `assets/js/${file}`))}"></script>`).join("\n");
  const document = `<!doctype html>
<!-- Generated by scripts/build-site.mjs. Do not edit this file directly. -->
<html lang="${html(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${html(title)}</title>
  <meta name="description" content="${html(description)}">
  <link rel="canonical" href="${html(canonical)}">
  <link rel="icon" href="${html(asset(root, "favicon.svg"))}" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${html(ROBOTO_SEMI_CONDENSED_STYLESHEET)}">
  <link rel="stylesheet" href="${html(MATERIAL_SYMBOLS_STYLESHEET)}">
${earlyMotionScript}
${head ? `${head}\n` : ""}${styleMarkup}
${scriptMarkup}
</head>
<body class="${html(bodyClass)}" data-root="${html(root)}">
${renderSiteHeader({ root, currentPath })}

${main}

${renderSiteFooter()}
</body>
</html>
`;
  return document.replace(/[ \t]+$/gm, "");
}
