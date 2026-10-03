import { imageSrcset } from "./product-images.mjs";
import { regularTableFigures } from "./rich-description.mjs";
import { itemColors } from "./item-colors.mjs";
import inlineType from "../../assets/js/inline-type.js";
import { productCategories } from "./product-categories.mjs";
import { readFileSync } from "node:fs";
import { storefronts as STOREFRONTS, pricingConfigVersion } from "./pricing-config.mjs";
import { copyAttributes, dimensionCopy, recommendationCopy, formatCopy, localizationVersion, translations } from "./localization.mjs";

const STORE_LINKS = JSON.parse(readFileSync(new URL("../../data/store-links.json", import.meta.url), "utf8"));

const NAV_GROUPS = [
  {
    label: "Product",
    path: "/collections/all",
    aliases: ["/"],
    prefixes: ["/collections/", "/products/"],
    children: productCategories.map(({ title, path }) => ({ label: title, path }))
  },
  {
    label: "Teamwear",
    path: "/teamwear",
    prefixes: ["/teamwear/"],
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
  language: "language",
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

export function renderProductDetailPrice({ price, twd, dataAttribute = "" }) {
  if (!price) throw new Error("Product-detail prices require a display value.");
  if (dataAttribute && !/^data-[a-z0-9-]+$/.test(dataAttribute)) {
    throw new Error(`Invalid product-detail price data attribute: ${dataAttribute}`);
  }
  const attribute = (dataAttribute ? ` ${dataAttribute}` : "") + (twd == null ? "" : ` data-price-twd="${html(twd)}"`);
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
  const panelClass = media.some(image => !image.includes("data-product-variant-image") && !image.includes("data-product-image-fallback"))
    ? "product-detail__panel has-thumbnail-rail" : "product-detail__panel";
  const indent = (markup, spaces) => markup.split("\n").map((line) => `${" ".repeat(spaces)}${line}`).join("\n");
  const categoryMarkup = category ? `              <p class="product-detail__label" data-product-category>${html(category)}</p>\n` : "";

  return `  <section class="product-detail" data-generated-component="product-detail">
    <div class="container">
      <div class="${panelClass}"${panelAttributes}>
        <div class="product-detail__media">
          <aside class="detail-thumbnails" hidden><nav class="detail-thumbnails__rail" aria-label="${html(name)} images"${copyAttributes("{name} images", "aria-label", { name })}></nav></aside>
          <div class="product-detail__gallery" ${galleryAttribute}${zoom ? " data-media-zoom-gallery" : ""} aria-label="${html(name)} images"${copyAttributes("{name} images", "aria-label", { name })}>
${indent(media.join("\n"), 12)}
          </div>
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
  return `${renderIcon("external", root, "external-link__indicator")}<span class="visually-hidden" data-external-link-description${copyAttributes(" (opens in a new tab)")}> (opens in a new tab)</span>`;
}

export function renderDescription({ tokens, itemCodes = [], currentItemCode = "", colors = itemColors }) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("Rich descriptions require at least one token.");
  }

  const publishedCodes = new Map(itemCodes.map((code) => [code.toUpperCase(), code]));
  function descriptionCopy(text) {
    const attributes = copyAttributes(text);
    if (!attributes) return "";
    const en = colors.resolveHandles(text);
    const zh = colors.resolveHandles(translations[text]);
    return en !== text || zh !== translations[text]
      ? `${attributes} data-l10n-color-en="${html(en)}" data-l10n-color-zh="${html(zh)}"`
      : attributes;
  }
  function linkedText(text) {
    text = colors.resolveHandles(text);
    const mentions = /(?<![A-Za-z0-9_#\/])#([A-Za-z]+[0-9]{5})(?:-[A-Za-z0-9]+)*(?![A-Za-z0-9_-])/g;
    let result = "";
    let cursor = 0;
    for (const match of text.matchAll(mentions)) {
      if (/\b(?:https?:\/\/|www\.)\S*$/i.test(text.slice(0, match.index))) continue;
      const code = publishedCodes.get(match[1].toUpperCase());
      if (!code || code.toUpperCase() === currentItemCode.toUpperCase()) continue;
      result += inlineType.render(text.slice(cursor, match.index));
      result += `<a href="/products/${html(code)}">${html(match[0])}</a>`;
      cursor = match.index + match[0].length;
    }
    return result + inlineType.render(text.slice(cursor));
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
        ? `        <th scope="col" aria-label="Row heading"${copyAttributes("Row heading", "aria-label")}>${inlineType.render(colors.resolveHandles(regularTableFigures(cell)))}</th>`
        : `        <th scope="col">${inlineType.render(colors.resolveHandles(regularTableFigures(cell)))}</th>`).join("\n");
      const body = token.body.map((row) => `      <tr>\n${row.map((cell, index) => index === 0
        ? `        <th scope="row"${descriptionCopy(dimensionCopy(cell))}>${inlineType.render(colors.resolveHandles(regularTableFigures(dimensionCopy(cell))))}</th>`
        : `        <td>${inlineType.render(colors.resolveHandles(regularTableFigures(cell)))}</td>`).join("\n")}\n      </tr>`).join("\n");
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
      const recommendation = recommendationCopy(token.text);
      if (recommendation) {
        const tail = colors.resolveHandles(recommendation.text.slice(formatCopy(recommendation.key, recommendation.params).length));
        return `  <p class="rich-description__line"${copyAttributes(recommendation.key, "text", recommendation.params)} data-l10n-original="${html(colors.resolveHandles(recommendation.original))}" data-l10n-tail="${html(tail)}">${inlineType.render(colors.resolveHandles(recommendation.text))}</p>`;
      }
      const copy = descriptionCopy(token.text);
      const language = !copy && /\p{Script=Han}/u.test(token.text) && !/^[•●]/u.test(token.text) ? ' lang="zh-Hant"' : '';
      return `  <p class="rich-description__line"${copy}${language}>${linkedText(token.text)}</p>`;
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
    return `<nav class="${className}" lang="en" data-language-shared="en" aria-label="${html(ariaLabel)}" data-generated-component="breadcrumb">
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

  return `<nav class="${className}" lang="en" data-language-shared="en" aria-label="${html(ariaLabel)}" data-generated-component="breadcrumb">
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

function isCurrentPage(currentPath, item) {
  return currentPath === item.path || Boolean(item.aliases?.includes(currentPath));
}

function isWithinSection(currentPath, item) {
  return isCurrentPage(currentPath, item) || Boolean(item.prefixes?.some((prefix) => currentPath.startsWith(prefix)));
}

function navigationStateAttributes(currentPath, item, allowPage = true) {
  if (allowPage && isCurrentPage(currentPath, item)) return ' aria-current="page"';
  return isWithinSection(currentPath, item) ? ' data-current-section="true"' : "";
}

export function renderSiteHeader({ root = "", currentPath = "/" } = {}) {
  const desktopNavigation = NAV_GROUPS.map((group, index) => {
    const childIsCurrent = group.children.some((item) => isCurrentPage(currentPath, item));
    const parentState = navigationStateAttributes(currentPath, group, !childIsCurrent);
    return `<div class="header-directory__group" data-header-group>
        <a class="header-directory__parent interface-label" href="${group.path}"${parentState} aria-expanded="false" aria-controls="header-subcollections-${index}" aria-describedby="header-navigation-help" data-header-parent>${group.label}</a>
        <ul class="header-directory__panel" id="header-subcollections-${index}" role="list">
          ${group.children.map((item) => `<li><a class="header-directory__child interface-label" href="${item.path}"${navigationStateAttributes(currentPath, item)}>${item.label}</a></li>`).join("\n          ")}
        </ul>
      </div>`;
  }).join("\n      ");
  const navigationMarkup = NAV_GROUPS.map((group) => {
    const childMarkup = group.children.map((item) => {
      const state = navigationStateAttributes(currentPath, item);
      return `              <li><a class="drawer-nav__child interface-label" href="${item.path}"${state}>${item.label}</a></li>`;
    }).join("\n");
    const childIsCurrent = group.children.some((item) => isCurrentPage(currentPath, item));
    const parentState = navigationStateAttributes(currentPath, group, !childIsCurrent);
    return `          <li class="drawer-nav__group">
            <a class="drawer-nav__parent interface-label" href="${group.path}"${parentState}>${group.label}</a>
            <ul class="drawer-nav__children" role="list">
${childMarkup}
            </ul>
          </li>`;
  }).join("\n");

  return `  <header class="site-header" lang="en" data-language-shared="en">
    <div class="container site-header__inner">
      <nav class="header-directory" aria-label="Main navigation" data-header-directory>
        <span class="visually-hidden" id="header-navigation-help">Hover to preview subcollections. Click or Enter to visit the collection. On touch, tap once to keep subcollections open and again to visit. Arrow keys open the panel; Escape closes it.</span>
        ${desktopNavigation}
      </nav>
      <a class="site-logo" href="/" aria-label="Paradigm home" tabindex="-1"><img class="site-logo__image" src="${html(asset(root, "assets/images/brand/aesthetics-logo-initial-a.png"))}" alt=""></a>
      <div class="site-actions" aria-label="Quick actions">
        <button class="icon-button" type="button" aria-label="Open search" aria-expanded="false" data-search-toggle>${renderToggleIconPair("search", root)}</button>
        <button class="icon-button header-region" type="button" aria-label="Open region and language" aria-expanded="false" aria-controls="storefront-overlay" data-storefront-toggle>${renderToggleIconPair("language", root)}</button>
        <button class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" data-nav-toggle>${renderToggleIconPair("menu", root)}</button>
      </div>
    </div>
  </header>

  <div class="search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-overlay-title" aria-hidden="true" inert data-overlay-state="closed" data-search-overlay>
    <div class="search-overlay__panel">
      <div class="container search-overlay__inner">
        <h2 class="visually-hidden" id="search-overlay-title"${copyAttributes("Search")}>Search</h2>
        <div class="search-overlay__form-wrap">
          <form class="search-form" role="search" data-search-form>
            <label class="visually-hidden" for="site-search-input"${copyAttributes("Search Paradigm")}>Search Paradigm</label>
            <input class="search-form__input" id="site-search-input" type="search" name="q" placeholder="SEARCH PRDM.TW"${copyAttributes("SEARCH PRDM.TW", "placeholder")} autocomplete="off" autocapitalize="none" spellcheck="false" data-search-input>
            <button class="icon-button search-form__submit" type="submit" aria-label="Search" data-search-submit disabled>${renderIcon("search", root)}</button>
          </form>
        </div>
        <p class="visually-hidden" aria-live="polite" data-search-status></p>
        <div class="search-results" aria-busy="true" data-search-results>
          <p class="search-status-row"${copyAttributes("Loading search…")}>Loading search…</p>
        </div>
      </div>
    </div>
  </div>

  <div class="search-overlay storefront-overlay" id="storefront-overlay" lang="en" data-language-shared="en" role="dialog" aria-modal="true" aria-labelledby="storefront-overlay-title" aria-hidden="true" inert data-overlay-state="closed" data-storefront-overlay>
    <div class="search-overlay__panel">
      <div class="container search-overlay__inner">
        <h2 class="visually-hidden" id="storefront-overlay-title">Region and language</h2>
        <div class="search-overlay__form-wrap" data-storefront-slot></div>
      </div>
    </div>
  </div>

  <div class="nav-drawer" lang="en" data-language-shared="en" aria-hidden="true" inert data-overlay-state="closed" data-nav-drawer>
    <div class="nav-drawer__panel">
      <div class="container nav-drawer__inner">
        <nav class="drawer-nav" aria-label="Navigation">
          <ul class="drawer-nav__groups" role="list">
${navigationMarkup}
          </ul>
          ${renderDropdown({ id: "menu-language", label: "Language and currency", name: "storefront", selectedValue: STOREFRONTS.defaultValue, options: STOREFRONTS.options })}
        </nav>
      </div>
    </div>
  </div>`;
}

function dropdownOptionLabel(option) {
  return `${option.label}${option.detail ? ` ${option.detail}` : ""}`;
}

function renderDropdownValue(option, selected = false) {
  const label = `<span${selected ? " data-dropdown-value" : ""}>${html(option.label)}</span>`;
  return option.detail
    ? `<span class="dropdown__value-pair">${label} <span class="dropdown__detail"${selected ? " data-dropdown-detail" : ""}>${html(option.detail)}</span></span>`
    : label;
}

function renderDropdownTrigger({ id, label, selected, options, variant, grouped = false }) {
  const valueMarkup = renderDropdownValue(selected, true);
  const iconMarkup = `<span class="material-symbols-outlined material-icon choice-option__state-symbol${variant === "text" ? " dropdown__text-indicator" : ""}" aria-hidden="true">${MATERIAL_ICON_NAMES.expand}</span>`;
  return `<button type="button" class="dropdown__trigger" data-selected="true" data-availability="${selected.availability === "unavailable" ? "unavailable" : "available"}" aria-label="${html(grouped ? label : `${label}: ${dropdownOptionLabel(selected)}`)}" data-dropdown-label="${html(label)}"${grouped ? "" : ' aria-haspopup="listbox"'} aria-expanded="false" aria-controls="${html(id)}-list">
        <span class="dropdown__label interface-label">${variant === "text" ? `<span class="dropdown__text-content">${valueMarkup}${iconMarkup}</span>` : valueMarkup}${options.map((option) => `<span class="dropdown__sizer" aria-hidden="true">${html(dropdownOptionLabel(option))}</span>`).join("")}</span>
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
  return `<div class="dropdown${variant === "text" ? " dropdown--text" : ""}" data-dropdown${options.some((option) => option.detail) ? " data-dropdown-split" : ""} data-dropdown-align="${align}">
    <select id="${html(id)}-native" class="dropdown__native interface-label" name="${html(name)}" aria-label="${html(label)}" data-dropdown-native>
      ${options.map((option) => `<option value="${html(option.value)}"${option.detail ? ` data-dropdown-label="${html(option.label)}" data-dropdown-detail="${html(option.detail)}"` : ""}${option === selected ? " selected" : ""}>${html(dropdownOptionLabel(option))}</option>`).join("\n")}
    </select>
    <div class="dropdown__enhanced" hidden>
      ${renderDropdownTrigger({ id, label, selected, options, variant })}
      <div id="${html(id)}-list" class="dropdown__options" role="listbox" aria-label="${html(label)}" hidden>
        ${options.map((option, index) => `<div class="dropdown__option interface-label" role="option" tabindex="-1" data-value="${html(option.value)}" data-availability="${option.availability === "unavailable" ? "unavailable" : "available"}" aria-selected="${option === selected}"${option.availability === "unavailable" ? ` aria-describedby="${html(id)}-unavailable-${index}"` : ""}>${option.detail ? renderDropdownValue(option) : html(option.label)}${option.availability === "unavailable" ? `<span class="visually-hidden" id="${html(id)}-unavailable-${index}">Unavailable</span>` : ""}</div>`).join("\n")}
      </div>
    </div>
  </div>`;
}

export function renderSiteFooter() {
  return `  <footer class="site-footer" lang="en" data-language-shared="en" data-primary-action-footer-anchor>
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
  overflow = "rail",
  title,
  inputName,
  selectedValue,
  primaryActionId,
  showLabel = true,
  colors = itemColors,
  options
}) {
  if (!["swatch", "chip"].includes(kind)) throw new Error(`Unsupported choice kind: ${kind}`);
  if (!["default", "add-on"].includes(variant)) throw new Error(`Unsupported choice variant: ${variant}`);
  if (!["rail", "wrap"].includes(overflow)) throw new Error(`Unsupported choice overflow: ${overflow}`);
  if (variant === "add-on" && kind !== "chip") throw new Error("The add-on choice variant requires chip choices.");
  if (kind === "swatch") options = options.map((option) => ({ ...option, label: colors.name(option.colorCode, option.label) }));
  const isAddOn = variant === "add-on";
  const selectedOption = options.find((option) => option.id === selectedValue || option.selected) || (isAddOn ? null : options[0]);
  const groupId = `choice-${inputName.replace(/[^a-z0-9_-]+/gi, "-")}`;
  const displayLabel = (option) => option ? colors.label(option.colorCode, option.label) : title;
  const labelMarkup = kind === "swatch"
    ? `<span data-choice-label-value>${inlineType.render(displayLabel(selectedOption))}</span>`
    : `<span${copyAttributes(title)}>${html(title)}</span>`;
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
    return `      <label class="choice-option choice-option--${kind}${colorClass}${variantClass}" data-choice-option data-choice-id="${html(option.id)}" data-choice-label="${html(option.label)}" data-availability="${unavailable ? "unavailable" : "available"}"${kind === "swatch" ? ` data-color-id="${html(option.colorId)}" data-color-code="${html(option.colorCode || "")}" data-choice-display-label="${html(displayLabel(option))}" title="${html(option.label)}"` : ""}>
        <input class="visually-hidden" type="${isAddOn ? "checkbox" : "radio"}" id="${html(optionId)}" name="${html(inputName)}" value="${html(option.id)}"${selected ? " checked" : ""}${unavailable ? ` aria-describedby="${html(descriptionId)}"` : ""}>
        ${kind === "chip" ? `<span class="choice-option__label${isAddOn ? " interface-label" : ""}" aria-hidden="true"${copyAttributes(option.label)}>${html(option.label)}</span>` : ""}${addOnIcon}
        <span class="visually-hidden">${kind === "chip" ? `<span${copyAttributes(option.label)}>${html(option.label)}</span>` : `<span${copyAttributes(title)}>${html(title)}</span> ${html(inlineType.plain(displayLabel(option)))}`}</span>
        ${unavailable ? `<span class="visually-hidden" id="${html(descriptionId)}" data-choice-availability-text${copyAttributes("Unavailable")}>Unavailable</span>` : ""}
      </label>`;
  }).join("\n");

  const rail = overflow === "rail";
  const sizer = rail && kind === "chip" ? `<div class="choice-group__sizer${isAddOn ? " interface-label" : ""}" aria-hidden="true">${options.map((option) => `<span${copyAttributes(option.label)}>${html(option.label)}</span>`).join("")}</div>` : "";
  return `<fieldset class="choice-group choice-group--${kind}${isAddOn ? " choice-group--chip-add-on" : ""}${rail ? " choice-group--rail" : ""}" data-choice-group data-choice-kind="${kind}"${isAddOn ? ' data-choice-variant="add-on"' : ""} data-choice-title="${html(title)}" data-primary-action-id="${html(primaryActionId)}">
    <legend class="visually-hidden"${copyAttributes(title)}>${html(title)}</legend>
    <div class="choice-group__layout">
      ${showLabel ? `<div class="choice-group__label" aria-hidden="true">${labelMarkup}</div>` : ""}
      <div class="choice-group__options">
${rail ? `        <div class="choice-group__track">\n${optionMarkup}\n        </div>` : optionMarkup}
      </div>
    </div>
    <span class="visually-hidden" aria-live="polite" data-choice-status></span>
    ${sizer}
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
      <span class="primary-action__content"><span class="external-link__label interface-label" data-primary-action-label${copyAttributes(actionLabel)}>${html(actionLabel)}</span>${renderExternalLinkIndicator(root)}</span>
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

export function renderProductCard(product, root = "", { priority = false } = {}) {
  const media = product.cardMedia || product.media?.[0] || (product.image ? { src: product.image, derivatives: [] } : null);
  const image = media
    ? renderResponsiveProductImage({
      media,
      alt: product.cardAlt || product.alt,
      root,
      sizes: "(min-width: 80rem) 426px, (min-width: 48rem) 33.333vw, 50vw",
      loading: priority ? "eager" : "lazy",
      fetchPriority: priority ? "high" : "low"
    })
    : "";
  const touchZoom = image && !media?.isFallback ? " data-media-zoom-touch" : "";
  return `<a class="product-card" href="${html(product.cardUrl || `/products/${product.code}`)}">
  <div class="product-card__media"${touchZoom}>${image}</div>
  <div class="product-card__body">
    <h3 class="product-card__title">${html(productCardDisplayName(product.name))}</h3>
    <span class="product-card__price"${product.salePrice != null || product.listPrice != null ? ` data-price-twd="${html(product.salePrice ?? product.listPrice)}"` : ""}>${html(product.priceLabel)}</span>
  </div>
</a>`;
}

export function renderResponsiveProductImage({ media, alt, root = "", sizes, loading = "", fetchPriority = "", touchZoom = false, dataAttribute = "", imageId = "", variantImage = false }) {
  if (!media?.src) throw new Error("Responsive product images require a fallback source.");
  const resolvedPath = (source) => asset(root, source);
  const srcset = imageSrcset(media, resolvedPath);
  const responsiveAttributes = srcset ? ` srcset="${html(srcset)}" sizes="${html(sizes)}"` : "";
  const loadingAttribute = loading ? ` loading="${html(loading)}"` : "";
  if (fetchPriority && !["high", "low", "auto"].includes(fetchPriority)) throw new Error("Invalid image fetch priority.");
  const priorityAttribute = fetchPriority ? ` fetchpriority="${fetchPriority}"` : "";
  const zoomAttribute = touchZoom ? " data-media-zoom-touch" : "";
  const fallbackAttribute = media.isFallback ? " data-product-image-fallback" : "";
  if (dataAttribute && !/^data-[a-z][a-z0-9-]*$/.test(dataAttribute)) throw new Error("Invalid image data attribute.");
  const behaviorAttribute = dataAttribute ? ` ${dataAttribute}` : "";
  const identityAttributes = `${imageId ? ` data-product-image-id="${html(imageId)}"` : ""}${variantImage ? " data-product-variant-image" : ""}`;
  const width = media.width || 1;
  const height = media.height || 1;
  let key = alt;
  let params = {};
  const uniform = alt?.match(/^(.*?) (PE Basketball Teamwear) in (.*), front and back$/);
  const view = alt?.match(/^(.*), view (\d+)$/);
  const product = alt?.match(/^(.*) product image$/);
  if (uniform) { key = "{pattern} {name} in {color}, front and back"; params = { pattern: uniform[1], name: uniform[2], color: uniform[3] }; }
  else if (view) { key = "{name}, view {number}"; params = { name: view[1], number: view[2] }; }
  else if (product) { key = "{name} product image"; params = { name: product[1] }; }
  return `<img src="${html(resolvedPath(media.src))}"${responsiveAttributes} alt="${html(alt)}"${copyAttributes(key, "alt", params)} width="${html(width)}" height="${html(height)}"${loadingAttribute}${priorityAttribute}${zoomAttribute}${fallbackAttribute}${behaviorAttribute}${identityAttributes}>`;
}

export function renderProductGrid(products, root = "", { initialViewport = false } = {}) {
  return `<div class="auto-grid product-grid" data-generated-component="product-grid">
${products.map((product, index) => renderProductCard(product, root, { priority: initialViewport && index === 0 })).join("\n")}
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
  const baseStyles = ["fonts.css?v=20260909b", "tokens.css?v=20261003b", "motion.css?v=20260831a", "reset.css?v=20260829a", "base.css?v=20261003b", "layout.css", "components.css?v=20261003d", "state-variation.css?v=20261003b", "header-directory.css?v=20261001b", "pages.css?v=20261003a", "color-options.css?v=20261003a"];
  const styleMarkup = [...baseStyles, ...styles].map((file) => `  <link rel="stylesheet" href="${html(asset(root, `assets/css/${file}`))}">`).join("\n");
  const isDataScript = (file) => ["catalog.js", "teamwear-options.js"].includes(file.split("?")[0]) || /^products\/[^/]+\.js(?:\?|$)/.test(file);
  const dataScripts = scripts.filter(isDataScript);
  const interactionScripts = scripts.filter((file) => !isDataScript(file));
  const earlyMotionScript = `  <script src="${html(asset(root, "assets/js/page-transitions.js?v=20261003d"))}"></script>`;
  const scriptMarkup = ["app.js?v=20261001a", "dropdown.js?v=20261001b", `pricing-config.js?v=${pricingConfigVersion}`, "pricing-core.js?v=20261003a", `localization-data.js?v=${localizationVersion}`, "inline-type.js?v=20261003a", "localization.js?v=20261003a", "language-preference.js?v=20261001b", "pricing.js?v=20261003a", "header-directory.js?v=20261002a", "search-core.js?v=20260927b", "search.js?v=20261003d", ...dataScripts, "choices.js?v=20261003e", ...interactionScripts].map((file) => `  <script defer src="${html(asset(root, `assets/js/${file}`))}"></script>`).join("\n");
  const mainMarkup = main.replace(/<main\b[^>]*>/, (openingTag) => {
    let result = openingTag;
    if (!result.includes('id="main-content"')) result = result.replace(/>$/, ' id="main-content">');
    if (!result.includes('tabindex=')) result = result.replace(/>$/, ' tabindex="-1">');
    if (["/teamwear", "/font-credits/"].includes(currentPath)) result = result.replace(/>$/, ' lang="en" data-language-shared="en">');
    return result;
  });
  const productDescription = description.match(/^(.*) by Paradigm\.$/);
  const descriptionAttributes = productDescription ? copyAttributes("{name} by Paradigm.", "content", { name: productDescription[1] }) : copyAttributes(description, "content");
  const document = `<!doctype html>
<!-- Generated by scripts/build-site.mjs. Do not edit this file directly. -->
<html lang="${html(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title${copyAttributes(title)}>${html(title)}</title>
  <meta name="description" content="${html(description)}"${descriptionAttributes}>
  <link rel="canonical" href="${html(canonical)}">
  <link rel="icon" href="${html(asset(root, "favicon.svg"))}" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${html(ROBOTO_SEMI_CONDENSED_STYLESHEET)}">
  <link rel="stylesheet" href="${html(MATERIAL_SYMBOLS_STYLESHEET)}">
${head ? `${head}\n` : ""}${styleMarkup}
${earlyMotionScript}
${scriptMarkup}
</head>
<body class="${html(bodyClass)}" data-root="${html(root)}">
  <a class="button skip-link" href="#main-content"${copyAttributes("Skip to content")}>Skip to content</a>
${renderSiteHeader({ root, currentPath })}

${mainMarkup}

${renderSiteFooter()}
</body>
</html>
`;
  return document.replace(/[ \t]+$/gm, "");
}
