import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeDescriptionSource,
  transformDescription
} from "./lib/rich-description.mjs";
import { categoryForTitle, rankRelatedProducts } from "./lib/product-relations.mjs";
import { resolveProductMedia } from "./lib/product-images.mjs";
import {
  html,
  renderChoiceGroup,
  renderDescription,
  renderDocument,
  renderIcon,
  renderPageHeadline,
  renderPrimaryAction,
  renderProductDetailPrice,
  renderProductGrid,
  renderResponsiveProductImage,
  renderRailControls
} from "./lib/site-renderers.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CHECK_MODE = process.argv.includes("--check");
const readJson = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8").then(JSON.parse);
const readTemplate = (name) => readFile(path.join(ROOT, "scripts", "templates", name), "utf8");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slugFor(title) {
  return title.replace(/^PRDM\s+/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function priceLabel(price) {
  return `NT$${Number(price).toLocaleString("en-US")}`;
}

function categoryPath(category) {
  return category.toLowerCase().replace(" ", "-");
}

function productType(title) {
  return title.match(/(Football Jersey|Crewneck|Hoodie|Shorts|Tee)$/i)?.[1] || "Apparel";
}

function productFamily(title) {
  const type = productType(title);
  return title.replace(/^PRDM\s+/i, "").replace(new RegExp(`\\s+${type}$`, "i"), "").trim();
}

function uniqueLabels(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
}

function optionAvailability(product, field, value, selected) {
  const otherField = field === "color" ? "size" : "color";
  return product.variants.some((variant) => (
    variant.visible &&
    !variant.soldOut &&
    variant[field] === value &&
    variant[otherField] === selected[otherField]
  )) ? "available" : "unavailable";
}

function selectedProductVariant(product) {
  return product.variants.find((variant) => variant.visible && !variant.soldOut)
    || product.variants.find((variant) => variant.visible);
}

function renderProductMain(template, product, relatedProducts) {
  const selectedVariant = selectedProductVariant(product);
  const selected = { color: selectedVariant?.color || product.colors[0]?.label, size: selectedVariant?.size || product.sizes[0] };
  const resolvedUnavailable = !selectedVariant || selectedVariant.soldOut;
  const colorChoices = renderChoiceGroup({
    kind: "swatch",
    title: "Color",
    inputName: `product-${product.productNumber}-color`,
    selectedValue: product.colors.find((color) => color.label === selected.color)?.id,
    primaryActionId: "product-primary-action",
    options: product.colors.map((color) => ({
      id: color.id,
      label: color.label,
      colorId: color.colorId,
      availability: optionAvailability(product, "color", color.label, selected)
    }))
  });
  const sizeChoices = renderChoiceGroup({
    kind: "chip",
    title: "Size",
    inputName: `product-${product.productNumber}-size`,
    selectedValue: selected.size,
    primaryActionId: "product-primary-action",
    showLabel: false,
    options: product.sizes.map((size) => ({
      id: size,
      label: size,
      availability: optionAvailability(product, "size", size, selected)
    }))
  });
  const primaryAction = renderPrimaryAction({
    id: "product-primary-action",
    intent: "purchase",
    initialIntent: resolvedUnavailable ? "notify" : "purchase",
    behavior: "fixed-to-static",
    label: "Buy on Shopee",
    href: product.shopeeUrl,
    target: "_blank",
    external: true,
    root: "../.."
  });
  const media = product.media.map((image, index) => `          ${renderResponsiveProductImage({
    media: image,
    alt: index === 0 ? product.alt : `${product.title}, view ${index + 1}`,
    root: "../..",
    sizes: "(min-width: 80rem) 768px, (min-width: 64rem) 60vw, 100vw",
    loading: index ? "lazy" : "",
    touchZoom: true
  })}`).join("\n");
  const pageHeadline = renderPageHeadline({
    root: "../..",
    breadcrumb: {
      variant: "hierarchy",
      items: [
        { label: "All", href: "/collections/all" },
        { label: product.category, href: `/collections/${categoryPath(product.category)}`, dataAttribute: "data-product-breadcrumb-category" },
        { label: product.title, current: true, dataAttribute: "data-product-breadcrumb-title" }
      ]
    }
  });

  return applyTemplate(template, {
    PAGE_HEADLINE: pageHeadline.split("\n").map((line) => `  ${line}`).join("\n"),
    TITLE: html(product.title),
    PRODUCT_NUMBER: html(product.productNumber),
    CATEGORY: html(product.category),
    PRODUCT_MEDIA: media,
    PRICE: renderProductDetailPrice({ price: product.price, dataAttribute: "data-product-price" }),
    COLOR_CHOICES: colorChoices.split("\n").map((line) => `            ${line}`).join("\n"),
    SIZE_CHOICES: sizeChoices.split("\n").map((line) => `            ${line}`).join("\n"),
    PRIMARY_ACTION: primaryAction.split("\n").map((line) => `          ${line}`).join("\n"),
    DESCRIPTION: renderDescription({ tokens: product.description }).split("\n").map((line) => `          ${line}`).join("\n"),
    RELATED_PRODUCTS: renderProductGrid(relatedProducts, "../..")
  });
}

function renderCollectionPage({ title, category, pathName, root, products }) {
  const currentPath = pathName === "home" ? "/" : `/collections/${pathName}`;
  const filtered = category === "all" ? products : products.filter((product) => product.category === category);
  const items = category === "all"
    ? [{ label: title, current: true, headingLevel: 1, interfaceLabel: true }]
    : [{ label: "All", href: "/collections/all" }, { label: title, current: true, headingLevel: 1, interfaceLabel: true }];
  const pageHeadline = renderPageHeadline({
    root,
    breadcrumb: { variant: "hierarchy", items },
    trailingAction: { kind: "text", label: "Refine" }
  });
  const main = `  <main class="page">
${pageHeadline.split("\n").map((line) => `    ${line}`).join("\n")}
    <section class="section section--tight"><div class="container">
${renderProductGrid(filtered, root).split("\n").map((line) => `      ${line}`).join("\n")}
    </div></section>
  </main>`;
  return renderDocument({
    lang: "zh-Hant",
    title: pathName === "home" ? "Paradigm" : `Paradigm | ${title}`,
    description: category === "all" ? "Browse all Paradigm products and collections." : `Browse Paradigm ${title}.`,
    canonical: pathName === "home" ? "https://prdm.tw/" : `https://prdm.tw/collections/${pathName}`,
    root,
    currentPath,
    bodyClass: "site-shell reference-page product-page",
    main,
    scripts: ["media-zoom.js?v=20260830a"]
  });
}

function renderSearchPage() {
  const pageHeadline = renderPageHeadline({
    root: "..",
    breadcrumb: {
      variant: "hierarchy",
      items: [{ label: "Search", current: true, headingLevel: 1, dataAttribute: "data-search-page-title" }]
    }
  });
  const main = `  <main class="page search-page__main" id="main-content">
${pageHeadline.split("\n").map((line) => `    ${line}`).join("\n")}
    <section class="search-page__results" aria-label="Search results">
      <p class="visually-hidden" aria-live="polite" data-search-page-status></p>
      <div class="container search-results search-results--page" aria-busy="true" data-search-page-results>
        <p class="search-status-row">Loading search…</p>
        <noscript><p class="noscript-note">JavaScript is required to search the Paradigm catalog.</p></noscript>
      </div>
    </section>
  </main>`;
  return renderDocument({
    lang: "en",
    title: "Paradigm | Search",
    description: "Search Paradigm pages and products.",
    canonical: "https://prdm.tw/search",
    root: "..",
    currentPath: "/search",
    bodyClass: "site-shell reference-page search-page",
    main,
    head: '  <meta name="robots" content="noindex,follow">'
  });
}

function buildSearchIndex(searchConfig, products) {
  if (searchConfig.schemaVersion !== 1) throw new Error("Unsupported search data schema.");
  if (!Array.isArray(searchConfig.popularKeywords) || searchConfig.popularKeywords.length === 0) {
    throw new Error("Search data requires popular keywords.");
  }
  if (!Array.isArray(searchConfig.pages) || searchConfig.pages.length === 0) {
    throw new Error("Search data requires canonical pages.");
  }
  if (searchConfig.pages.some((page) => typeof page.interfaceLabel !== "boolean")) {
    throw new Error("Every Search page requires an explicit interface-label casing contract.");
  }

  const pages = searchConfig.pages.map((page) => ({
    title: page.title,
    interfaceLabel: Boolean(page.interfaceLabel),
    url: page.url,
    summary: page.summary,
    keywords: page.keywords,
    external: Boolean(page.external),
    searchTerms: [page.title, page.summary, ...page.keywords]
  }));
  const searchProducts = products.map((product) => {
    const type = productType(product.title);
    const family = productFamily(product.title);
    const colors = product.colors.map((color) => color.label);
    return {
      productNumber: product.productNumber,
      title: product.title,
      category: product.category,
      colors,
      productType: type,
      family,
      price: product.price,
      url: `/products/${product.productNumber}`,
      media: product.media[0] || null,
      alt: product.alt,
      searchTerms: [product.title, product.productNumber, product.category, ...colors, type, family]
    };
  });
  const vocabulary = uniqueLabels([
    ...searchConfig.popularKeywords,
    ...pages.flatMap((page) => [page.title, ...page.keywords]),
    ...searchProducts.flatMap((product) => [product.family, product.productType, product.category, ...product.colors])
  ]);
  return {
    schemaVersion: 1,
    popularKeywords: searchConfig.popularKeywords,
    vocabulary,
    pages,
    products: searchProducts
  };
}

function renderColorOptionsCss(colors) {
  const variables = colors.map((color) => `  --color-option-${color.id}: ${color.value};`).join("\n");
  const classes = colors.map((color) => `.choice-option--color-${color.id},\n.teamwear-colorway--${color.id} {\n  --choice-color: var(--color-option-${color.id});\n}`).join("\n\n");
  return `/* Generated by scripts/build-site.mjs from data/colors.json. */\n:root {\n${variables}\n}\n\n${classes}\n`;
}

function renderTeamwearColorwayCards(model, colorById) {
  const selectedPattern = model.patterns.find((pattern) => pattern.id === "P02") || model.patterns[0];
  return model.colors.map((option) => {
    const color = colorById.get(option.colorId);
    return `        <article class="teamwear-rail-card teamwear-colorway-card teamwear-colorway--${html(color.id)}" data-colorway-card data-color-id="${html(color.id)}" data-color-name="${html(color.name)}" data-section-reveal>
          <div class="teamwear-rail-card__surface"><div class="teamwear-rail-card__media teamwear-colorway-card__media" data-media-zoom-touch><img src="../${html(selectedPattern.preview)}" alt="${html(selectedPattern.name)} ${html(model.name)} ${html(color.name)} Road uniform rendering" width="1254" height="1254" loading="lazy" data-colorway-image></div></div>
          <div class="teamwear-rail-card__copy"><h3 class="type-h5">${html(color.name)}</h3></div>
        </article>`;
  }).join("\n");
}

function renderTeamwearLanding(template, model, colorById, instagramUrl) {
  const actionId = "teamwear-primary-action";
  const primaryAction = renderPrimaryAction({
    id: actionId,
    intent: "build",
    behavior: "fixed-to-float",
    label: "Build yours",
    href: "/teamwear/customize",
    root: "..",
    notificationChannel: instagramUrl
  });
  const patterns = renderChoiceGroup({
    kind: "chip",
    title: "Pattern",
    inputName: "landing-pattern",
    selectedValue: "P02",
    primaryActionId: actionId,
    showLabel: false,
    options: model.patterns.map((pattern) => ({ id: pattern.id, label: pattern.name, availability: pattern.availability }))
  });
  const main = applyTemplate(template, {
    MODEL_NAME: html(model.name),
    PRIMARY_ACTION: primaryAction.split("\n").map((line) => `      ${line}`).join("\n"),
    ICON_GRID_STACKED: renderIcon("grid", "..", "teamwear-stacked-row__icon"),
    ICON_DROP_STACKED: renderIcon("drop", "..", "teamwear-stacked-row__icon"),
    ICON_SHIRT_STACKED: renderIcon("shirt", "..", "teamwear-stacked-row__icon"),
    ICON_DROP: renderIcon("drop", ".."),
    ICON_CARE: renderIcon("care", ".."),
    ICON_GRID: renderIcon("grid", ".."),
    ICON_SHIRT: renderIcon("shirt", ".."),
    ICON_LAYERS: renderIcon("layers", ".."),
    ICON_IMAGE: renderIcon("image", ".."),
    HIGHLIGHT_CONTROLS: renderRailControls({ label: "Highlights", railId: "teamwear-highlights-rail", root: ".." }).split("\n").map((line) => `      ${line}`).join("\n"),
    COLORWAY_CONTROLS: renderRailControls({ label: "Colorway", railId: "teamwear-colorways-rail", root: ".." }).split("\n").map((line) => `      ${line}`).join("\n"),
    GALLERY_CONTROLS: renderRailControls({ label: "Customer stories", railId: "teamwear-gallery-rail", root: ".." }).split("\n").map((line) => `      ${line}`).join("\n"),
    COLORWAY_CARDS: renderTeamwearColorwayCards(model, colorById),
    PATTERN_CHOICES: patterns.split("\n").map((line) => `      ${line}`).join("\n")
  });
  return renderDocument({
    title: `${model.name} | Paradigm`,
    description: `${model.name} is Paradigm's reversible basketball teamwear system, composed for teams that want one complete visual identity.`,
    canonical: "https://prdm.tw/teamwear",
    root: "..",
    currentPath: "/teamwear",
    bodyClass: "site-shell reference-page teamwear-page teamwear-story-shell",
    main,
    styles: ["teamwear.css?v=20260829c", "teamwear-story.css?v=20260831a"],
    scripts: ["teamwear-options.js?v=20260828a", "teamwear.js?v=20260830a", "media-zoom.js?v=20260830a"],
    head: `  <meta property="og:title" content="${html(model.name)} | Paradigm">\n  <meta property="og:description" content="${html(`${model.name} is a reversible basketball uniform system composed by Paradigm for the whole roster.`)}">\n  <meta property="og:image" content="https://prdm.tw/assets/images/teamwear/campaign/hero-desktop.webp">\n  <meta property="og:type" content="website">`
  });
}

function renderTeamwearCustomize(template, model, colorById, instagramUrl) {
  const actionId = "teamwear-customize-primary-action";
  const selectedPattern = model.patterns.find((pattern) => pattern.id === "P02") || model.patterns[0];
  const selectedColor = model.colors.find((color) => color.id === "C06") || model.colors[0];
  const colors = renderChoiceGroup({
    kind: "swatch",
    title: "Color",
    inputName: "teamwear-color",
    selectedValue: selectedColor.id,
    primaryActionId: actionId,
    options: model.colors.map((option) => ({ id: option.id, label: colorById.get(option.colorId).name, colorId: option.colorId, availability: option.availability }))
  });
  const patterns = renderChoiceGroup({
    kind: "chip",
    title: "Pattern",
    inputName: "teamwear-pattern",
    selectedValue: selectedPattern.id,
    primaryActionId: actionId,
    options: model.patterns.map((pattern) => ({ id: pattern.id, label: pattern.name, availability: pattern.availability }))
  });
  const selectedQuantity = model.quantities.find((quantity) => quantity.id === "Q03") || model.quantities.at(-1);
  const quantities = renderChoiceGroup({
    kind: "chip",
    title: "Quantity",
    inputName: "teamwear-quantity",
    selectedValue: selectedQuantity.id,
    primaryActionId: actionId,
    options: model.quantities.map((quantity) => ({ id: quantity.id, label: quantity.label, availability: quantity.availability }))
  });
  const addOns = renderChoiceGroup({
    kind: "chip",
    variant: "add-on",
    title: "Add-On",
    inputName: "teamwear-add-on",
    primaryActionId: actionId,
    options: model.addOns.map((addOn) => ({ id: addOn.id, label: addOn.name, selected: false, availability: addOn.availability }))
  });
  const primaryAction = renderPrimaryAction({
    id: actionId,
    intent: "inquiry",
    behavior: "fixed-to-static",
    label: "Direct Message",
    href: instagramUrl,
    target: "_blank",
    external: true,
    root: "../..",
    notificationChannel: instagramUrl
  });
  const pageHeadline = renderPageHeadline({
    root: "../..",
    breadcrumb: {
      variant: "back",
      ariaLabel: "Back to Teamwear",
      items: [{ label: "Teamwear", href: "/teamwear" }]
    }
  });
  const descriptionSource = normalizeDescriptionSource(model.descriptionSource, `${model.id} description`);
  const description = renderDescription({ tokens: transformDescription(descriptionSource.content) });
  const main = applyTemplate(template, {
    PAGE_HEADLINE: pageHeadline.split("\n").map((line) => `  ${line}`).join("\n"),
    MODEL_CODE: html(model.code),
    MODEL_NAME: html(model.name),
    PRICE: renderProductDetailPrice({ price: priceLabel(model.price), dataAttribute: "data-teamwear-price" }),
    COLOR_CHOICES: colors.split("\n").map((line) => `          ${line}`).join("\n"),
    PATTERN_CHOICES: patterns.split("\n").map((line) => `          ${line}`).join("\n"),
    QUANTITY_CHOICES: quantities.split("\n").map((line) => `          ${line}`).join("\n"),
    ADD_ON_CHOICES: addOns.split("\n").map((line) => `          ${line}`).join("\n"),
    PRIMARY_ACTION: primaryAction.split("\n").map((line) => `        ${line}`).join("\n"),
    DESCRIPTION: description.split("\n").map((line) => `          ${line}`).join("\n")
  });
  return renderDocument({
    title: `Build ${model.name} | Paradigm Teamwear`,
    description: `Preview ${model.name} in three patterns and seven colors, with Home and Road sides shown together.`,
    canonical: "https://prdm.tw/teamwear/customize",
    root: "../..",
    currentPath: "/teamwear/customize",
    bodyClass: "site-shell reference-page reference-page--detail teamwear-customize-page",
    main,
    styles: ["teamwear.css?v=20260829c"],
    scripts: ["teamwear-options.js?v=20260828a", "teamwear.js?v=20260830a", "media-zoom.js?v=20260830a"]
  });
}

const [source, colorRegistry, teamwearData, searchConfig, productTemplate, teamwearTemplate, customizeTemplate] = await Promise.all([
  readJson("data/products-source.json"),
  readJson("data/colors.json"),
  readJson("data/teamwear-options.json"),
  readJson("data/search.json"),
  readTemplate("product-page.html"),
  readTemplate("teamwear-page.html"),
  readTemplate("teamwear-customize.html")
]);

const colorByName = new Map(colorRegistry.colors.map((color) => [color.name, color]));
const colorById = new Map(colorRegistry.colors.map((color) => [color.id, color]));
const products = source.products.filter((entry) => entry.variants.some((variant) => variant.visible)).map((entry) => {
  const visibleVariants = entry.variants.filter((variant) => variant.visible);
  const colors = unique(visibleVariants.map((variant) => variant.color)).map((label) => {
    const color = colorByName.get(label);
    if (!color) throw new Error(`Missing canonical color definition for "${label}".`);
    return { id: color.id, colorId: color.id, label: color.name };
  });
  const media = resolveProductMedia(entry);
  const localImages = media.map((image) => image.src);
  const descriptionSource = normalizeDescriptionSource({
    type: "google-doc",
    content: entry.document?.content || "",
    documentId: entry.document?.id || "",
    modifiedTime: entry.document?.modifiedTime || ""
  }, `${entry.productNumber} description`);
  return {
    slug: slugFor(entry.title),
    productNumber: entry.productNumber,
    title: entry.title,
    category: categoryForTitle(entry.title),
    price: priceLabel(entry.price),
    image: localImages[0] || null,
    images: localImages,
    media,
    imageSource: localImages.length ? entry.imageSource : "blank",
    alt: localImages.length ? `${entry.title} product image` : "",
    colors,
    sizes: unique(visibleVariants.map((variant) => variant.size)),
    variants: entry.variants.map(({ sku, color, size, visible, soldOut }) => ({ ...(sku ? { sku } : {}), color, size, visible, soldOut })),
    soldOut: visibleVariants.every((variant) => variant.soldOut),
    description: transformDescription(descriptionSource.content),
    shopeeUrl: entry.shopeeUrl,
    source: {
      spreadsheetModifiedTime: source.source.spreadsheetModifiedTime,
      documentId: entry.document?.id || null,
      documentModifiedTime: entry.document?.modifiedTime || null,
      imageFiles: entry.images.map((image) => ({ id: image.id, modifiedTime: image.modifiedTime, localPath: image.localPath }))
    }
  };
});

const outputs = new Map();
const catalogBanner = `// Generated by scripts/build-site.mjs.\n// Source: ${source.source.spreadsheetUrl} (${source.source.sheetName})\n// Spreadsheet modified: ${source.source.spreadsheetModifiedTime}\n// Edit centralized data sources and rerun the build; do not hand-edit this file.\n`;
outputs.set("assets/js/catalog.js", `${catalogBanner}window.PARADIGM_CATALOG = ${JSON.stringify({ products }, null, 2)};\n`);
outputs.set("assets/js/teamwear-options.js", `// Generated by scripts/build-site.mjs from data/teamwear-options.json.\nwindow.PARADIGM_TEAMWEAR = ${JSON.stringify(teamwearData, null, 2)};\n`);
outputs.set("assets/css/color-options.css", renderColorOptionsCss(colorRegistry.colors));
outputs.set("assets/data/search-index.json", `${JSON.stringify(buildSearchIndex(searchConfig, products), null, 2)}\n`);

const collectionPages = [
  { output: "index.html", title: "All", category: "all", pathName: "home", root: "" },
  { output: "collections/all/index.html", title: "All", category: "all", pathName: "all", root: "../.." },
  { output: "collections/ss-tops/index.html", title: "SS Tops", category: "SS Tops", pathName: "ss-tops", root: "../.." },
  { output: "collections/aw-tops/index.html", title: "AW Tops", category: "AW Tops", pathName: "aw-tops", root: "../.." },
  { output: "collections/bottoms/index.html", title: "Bottoms", category: "Bottoms", pathName: "bottoms", root: "../.." }
];
collectionPages.forEach((page) => outputs.set(page.output, renderCollectionPage({ ...page, products })));
outputs.set("search/index.html", renderSearchPage());

products.forEach((product) => {
  const related = rankRelatedProducts(products, product);
  const main = renderProductMain(productTemplate, product, related);
  outputs.set(`products/${product.productNumber}/index.html`, renderDocument({
    lang: "zh-Hant",
    title: `Paradigm | ${product.title}`,
    description: `${product.title} by Paradigm.`,
    canonical: `https://prdm.tw/products/${product.productNumber}`,
    root: "../..",
    currentPath: `/products/${product.productNumber}`,
    bodyClass: "site-shell reference-page reference-page--detail",
    main,
    scripts: ["catalog.js", "media-zoom.js?v=20260830a"]
  }));
});

const teamwearModel = teamwearData.models[0];
outputs.set("teamwear/index.html", renderTeamwearLanding(teamwearTemplate, teamwearModel, colorById, teamwearData.instagramUrl));
outputs.set("teamwear/customize/index.html", renderTeamwearCustomize(customizeTemplate, teamwearModel, colorById, teamwearData.instagramUrl));

const mismatches = [];
for (const [relativePath, content] of outputs) {
  const destination = path.join(ROOT, relativePath);
  if (CHECK_MODE) {
    const existing = await readFile(destination, "utf8").catch(() => null);
    if (existing !== content) mismatches.push(relativePath);
  } else {
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, "utf8");
  }
}

if (CHECK_MODE && mismatches.length) {
  console.error(`Generated output is stale:\n${mismatches.map((file) => `- ${file}`).join("\n")}`);
  process.exitCode = 1;
} else if (CHECK_MODE) {
  console.log(`Generated output is current (${outputs.size} files).`);
} else {
  console.log(`Generated ${products.length} products and ${outputs.size} centralized outputs.`);
}
