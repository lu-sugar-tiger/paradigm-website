import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { html, renderChoiceGroup, renderDocument, renderIcon } from "./lib/site-renderers.mjs";

const root = "../../..";
const previewPath = "/output/playwright/choice-overflow/";
const directory = new URL(`..${previewPath}`, import.meta.url);
const registry = JSON.parse(await readFile(new URL("../data/colors.json", import.meta.url), "utf8"));
const shadeNames = ["Black", "Graphite", "Charcoal", "Slate", "Grey", "Dove", "Silver", "Cloud", "White", "Burgundy", "Rosewood", "Cardinal", "Dusty rose", "Taupe rose", "Red", "Coral", "Blush", "Pale pink", "Mocha", "Mud", "Rust", "Camel", "Sand", "Orange", "Apricot", "Peach", "Cream"];
const colors = registry.palette.slice(0, shadeNames.length).map((color, index) => ({
  id: color.code, colorId: `overflow-${color.code.toLowerCase()}`, colorCode: color.code,
  label: registry.colors.find((entry) => entry.code === color.code)?.name || shadeNames[index]
}));
const sizes = (labels) => labels.map((label, index) => ({ id: `size-${index}`, label, availability: index === 1 ? "unavailable" : "available" }));
const scenes = [
  { id: "standard", title: "A few options", note: "The full set stays visible when it fits in two rows.", colors: [colors[0], colors[2], colors[8]], sizes: sizes(["S", "M", "L", "XL"]) },
  { id: "dense", title: "Many options", note: "27 colors and 16 sizes, with independent selections.", colors: colors.map((color, index) => ({ ...color, availability: [3, 11, 20].includes(index) ? "unavailable" : "available" })), sizes: sizes(["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL", "9XL", "10XL", "OS"]) },
  { id: "long", title: "Long labels", note: "Size labels keep their full text and remain easy to select.", colors, sizes: sizes(["XS / Short", "XS / Regular", "S / Short", "S / Regular", "M / Short", "M / Regular", "L / Tall", "XL / Tall", "Made to measure"]) }
];
const proposals = [
  { id: "disclosure", title: "Expand in place", note: "At smaller widths, show two rows with Show all when needed. At Large, every option wraps into rows." },
  { id: "rails", title: "Separate horizontal rails", note: "Drag or swipe colors and sizes independently. Chips share one width and overflow only when the longest label needs more room. At Large, every option wraps into rows." }
];
const group = (proposal, scene, kind, options) => {
  const railId = `rail-${proposal.id}-${scene.id}-${kind}`;
  const markup = renderChoiceGroup({ kind, overflow: proposal.id === "rails" ? "rail" : "wrap", title: kind === "swatch" ? "Color" : "Size", inputName: `overflow-${proposal.id}-${scene.id}-${kind}`, selectedValue: options[0].id, primaryActionId: "", options })
    .replace("data-choice-group", `data-choice-group data-overflow-mode="${proposal.id}"`)
    .replace('<div class="choice-group__options">', `<div class="choice-group__options" id="${railId}">`);
  return proposal.id === "rails" ? markup : markup.replace("</fieldset>", `<template data-overflow-toggle-icon>${renderIcon("expand", root)}</template></fieldset>`);
};
const main = `<main class="choice-overflow-preview" lang="en" data-language-shared="en">
  <header class="choice-overflow-intro"><h1 class="type-h3">Color and size options</h1>
    <p>Compact choices that stay readable as the range grows.</p>
    <p class="choice-overflow-note">Compare two approaches at smaller widths. At Large, all colors and sizes wrap into rows without Show all.</p>
    <nav class="choice-overflow-proposal-links" aria-label="Design proposals"><a href="#proposal-disclosure">Expand in place</a><a href="#proposal-rails">Horizontal rails</a></nav>
    <a href="/output/playwright/product-detail-experiment/">Product detail experiment</a>
  </header>
  ${proposals.map((proposal) => `<section class="choice-overflow-proposal" id="proposal-${proposal.id}" data-choice-proposal="${proposal.id}" aria-labelledby="${proposal.id}-title">
    <header class="choice-overflow-proposal-heading"><h2 class="type-h4" id="${proposal.id}-title">${html(proposal.title)}</h2><p class="choice-overflow-note">${html(proposal.note)}</p></header>
    <div class="choice-overflow-scenes">
      ${scenes.map((scene) => `<section class="choice-overflow-scene" data-overflow-scene="${scene.id}" aria-labelledby="${proposal.id}-${scene.id}-title">
        <header><h3 class="type-h5" id="${proposal.id}-${scene.id}-title">${html(scene.title)}</h3><p class="choice-overflow-note">${html(scene.note)}</p></header>
        <div class="choice-overflow-surface">${group(proposal, scene, "swatch", scene.colors)}${group(proposal, scene, "chip", scene.sizes)}</div>
      </section>`).join("\n")}
    </div>
  </section>`).join("\n")}
</main>`;
const files = await Promise.all(["css", "js"].map(async (extension) => {
  const content = await readFile(new URL(`./experiments/choice-overflow-preview.${extension}`, import.meta.url));
  return { extension, content, version: createHash("sha256").update(content).digest("hex").slice(0, 12) };
}));
const swatchStyles = colors.map((color) => `.choice-overflow-preview .choice-option--color-${color.colorId} { --choice-color: ${registry.palette.find((entry) => entry.code === color.colorCode).value}; }`).join("\n");
const page = renderDocument({ root, currentPath: previewPath, bodyClass: "reference-page choice-overflow-experiment", title: "Color and size overflow experiment | Paradigm", description: "Responsive color and size choice experiments.", canonical: "http://127.0.0.1:4178" + previewPath, main, head: '<meta name="robots" content="noindex,nofollow">' })
  .replace(/<link rel="canonical"[^>]*>\n/, "")
  .replace("</head>", `  <link rel="stylesheet" href="./experiment.css?v=${files[0].version}">\n  <link rel="stylesheet" href="./swatches.css">\n  <script defer src="./experiment.js?v=${files[1].version}"></script>\n</head>`);
await mkdir(directory, { recursive: true });
await writeFile(new URL("index.html", directory), page);
await writeFile(new URL("swatches.css", directory), swatchStyles + "\n");
for (const file of files) await writeFile(new URL(`experiment.${file.extension}`, directory), file.content);
console.log(`Choice overflow experiment: ${previewPath}`);
