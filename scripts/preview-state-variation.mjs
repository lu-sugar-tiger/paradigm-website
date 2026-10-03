import { mkdir, readFile, writeFile } from "node:fs/promises";
import { html, renderDocument, renderDropdown, renderIcon, renderPageHeadline, renderPrimaryAction, renderRailControls, renderResponsiveProductImage, renderSiteHeader } from "./lib/site-renderers.mjs";

const root = "../../..";
const photo = JSON.parse(await readFile(new URL("../data/teamwear-photography.json", import.meta.url), "utf8")).photos[0];
const store = JSON.parse(await readFile(new URL("../data/store-links.json", import.meta.url), "utf8"));
const modes = [
  { value: "screen", label: "Screen" },
  { value: "multiply", label: "Multiply" },
  { value: "opacity", label: "Opacity 85% → 100%" },
  { value: "transparency", label: "Transparency 100% → 85%" }
];
const icon = (name, label) => `<button class="icon-button" type="button" aria-label="${html(label)}">${renderIcon(name, root)}</button>`;
const action = (id, label, href, external = false, intent = "purchase") => renderPrimaryAction({ id, label, href, root, external, target: external ? "_blank" : "", intent, behavior: "fixed-to-static" });
const logo = renderSiteHeader({ root }).match(/<a class="site-logo"[^>]*>[\s\S]*?<\/a>/)[0];
const rows = [
  { id: "logo", title: "Logo", mode: "transparency", usage: "Live: header on every page. Pointer only.", background: "White header · #FFFFFF", className: "state-preview-white", selector: ".site-logo", content: logo },
  { id: "header-icons", title: "Header & Search icons", mode: "transparency", usage: "Live: Search, region/language, mobile menu, close, and Search submit.", background: "White header / Search field · #FFFFFF", className: "state-preview-white", selector: ".icon-button", content: [icon("search", "Search example"), icon("language", "Region example"), icon("menu", "Menu example"), icon("close", "Close example")].join("") },
  { id: "gallery-icons", title: "Gallery arrows", mode: "transparency", usage: "Live: previous/next beneath product and Teamwear Customize galleries at Base/Medium.", background: "White gallery controls row · #FFFFFF", className: "state-preview-white", selector: ".icon-button", content: `${icon("back", "Previous image example")}<span>1 / 3</span>${icon("chevron", "Next image example")}` },
  { id: "headline-icon", title: "Headline icon control", mode: "transparency", usage: "Reusable variant, currently unused on public pages. The 24px Search icon sits at the right of the breadcrumb/headline bar below.", background: "Off-white headline · #F7F7F7", className: "state-preview-headline", selector: ".page-headline__action--icon", content: renderPageHeadline({ root, breadcrumb: { variant: "hierarchy", items: [{ label: "All", current: true }] }, trailingAction: { kind: "icon", icon: "search", label: "Search products" } }) },
  { id: "image-action", title: "Image action artwork", mode: "transparency", usage: "Opt-in example, currently unused on public pages. Only the image varies; the separate label stays opaque. Browsing cards and gallery/rail photos keep their current appearance.", background: "Off-white containing surface · #F7F7F7", className: "state-preview-image", selector: "[data-state-variation]", content: `<button class="state-preview-image-control" type="button" data-state-variation="transparency">${renderResponsiveProductImage({ media: photo.media, alt: photo.alt, root, sizes: "(min-width: 48rem) 50vw, 100vw", dataAttribute: "data-state-variation-artwork" })}<span class="interface-label">Image action example</span></button>` },
  { id: "primary-actions", title: "Filled action buttons", mode: "screen", usage: "Live: Build yours, Direct Message, Buy on Shopee, Notify me. Skip to content also uses the shared button treatment.", background: "Off-white page here · #F7F7F7. Fixed/floating actions can overlap other content on the site.", className: "", selector: ".button", content: action("preview-build", "Build yours", "/teamwear/customize", false, "inquiry") + action("preview-message", "Direct Message", "https://www.instagram.com/prdm.tw/", true, "inquiry") + action("preview-buy", "Buy on Shopee", store.shopee, true) + action("preview-notify", "Notify me", "https://www.instagram.com/prdm.tw/", true, "notify") },
  { id: "secondary-dark", title: "Dark secondary button", mode: "screen", usage: "Reusable variant, currently unused on public pages. Dark grey rectangle with a white label.", background: "Containing surface; off-white here · #F7F7F7", className: "", selector: ".button", content: '<button class="button button--secondary" type="button">Secondary action</button>' },
  { id: "secondary-light", title: "Light secondary button", mode: "multiply", usage: "Reusable detail-page variant, currently unused on public pages. Pale rectangle with a dark label. Its fill matches this surface, so opacity alone barely changes its appearance.", background: "Off-white detail summary · #F7F7F7", className: "reference-page--detail", selector: ".button", content: '<button class="button button--secondary" type="button">Secondary action</button>' },
  { id: "rail", title: "Rail arrows", mode: "opacity", usage: "Live: Teamwear rail previous/next. The transparent chevron always reveals what is underneath.", background: "NTUESOE photograph here; the site also places arrows over rail gaps/page areas.", className: "state-preview-photo", selector: ".teamwear-rail-button", content: `${renderResponsiveProductImage({ media: photo.media, alt: photo.alt, root, sizes: "(min-width: 48rem) 50vw, 100vw" })}${renderRailControls({ label: "Example", railId: "preview-photo", root }).replaceAll(" hidden", "")}` }
];
const main = `<main class="container state-variation-preview">
  <header class="state-preview-intro"><h1 class="type-h3">State variation</h1>
    <p>One shared hover/press design with four interchangeable treatments: screen, multiply, opacity (85% → 100%), or transparency (100% → 85%).</p>
    <p class="state-preview-note">Each row starts with its current default. Change the mode, then hover or hold a press on the component. Overrides apply only to this preview; actions stay on this page.</p>
    <p class="state-preview-note">Both alpha treatments vary artwork or backing fill by 15 percentage points. Button labels and keyboard focus rings stay opaque. Screen/multiply keep the existing strength.</p>
  </header>
  ${rows.map((row) => `<section class="state-preview-row" data-preview-row="${row.id}" data-preview-selector="${html(row.selector)}" aria-labelledby="${row.id}-heading">
    <div class="state-preview-copy"><h2 class="type-h5" id="${row.id}-heading">${row.title}</h2><p>${row.usage}</p><p class="state-preview-note">${row.background}</p>
      ${renderDropdown({ id: `${row.id}-mode`, label: `${row.title} treatment`, name: `${row.id}-mode`, options: modes, selectedValue: row.mode })}
    </div>
    <div class="state-preview-surface ${row.className}">${row.content}</div>
  </section>`).join("\n")}
  <p class="state-preview-note">Outside this family: text/navigation links use underlines; approved chips/swatches retain selection treatments; product cards retain no hover/press decoration. Search feedback remains deferred.</p>
</main>`;
const directory = new URL("../output/playwright/state-variation/", import.meta.url);
await mkdir(directory, { recursive: true });
const page = renderDocument({ root, currentPath: "/output/playwright/state-variation/", bodyClass: "reference-page", title: "State variation | Paradigm", description: "Local component collection and interchangeable interaction treatments.", canonical: "http://127.0.0.1:4178/output/playwright/state-variation/", main, styles: ["teamwear-story.css?v=20260927a"], head: '<meta name="robots" content="noindex,nofollow">' });
await writeFile(new URL("index.html", directory), page.replace("</head>", '  <link rel="stylesheet" href="./experiment.css">\n  <script defer src="./experiment.js"></script>\n</head>'));
for (const [source, target] of [["state-variation-preview.css", "experiment.css"], ["state-variation-preview.js", "experiment.js"]]) {
  await writeFile(new URL(target, directory), await readFile(new URL(`./experiments/${source}`, import.meta.url)));
}
console.log("State variation preview: /output/playwright/state-variation/");
