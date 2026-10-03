import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderDocument, renderDropdown, renderProductCard } from "./lib/site-renderers.mjs";

const root = "../../..";
const index = JSON.parse(await readFile(new URL("../assets/data/search-index.json", import.meta.url), "utf8"));
const product = index.items[0];
const scenes = [
  { value: "loading", label: "Loading" },
  { value: "empty", label: "No results" },
  { value: "error", label: "Search error" },
  { value: "success", label: "Results" }
];
const searchPane = (variant) => `<section class="experiment-pane" aria-labelledby="${variant}-search-heading">
  <header><h3 class="type-h5" id="${variant}-search-heading">${variant === "current" ? "Current" : "Suggested"}</h3>
  <p class="experiment-note" data-search-note="${variant}"></p></header>
  <div class="experiment-search-surface">
    <form class="experiment-search-form" data-demo-search="${variant}" role="search" aria-label="${variant} search example">
      <label class="visually-hidden" for="${variant}-query">Search products</label>
      <input id="${variant}-query" type="search" value="raincoat" placeholder="Search products" autocomplete="off">
      <button class="icon-button" type="submit" aria-label="Search"><span class="material-symbols-outlined material-icon" aria-hidden="true">search</span></button>
    </form>
    <div class="experiment-result" data-result="${variant}"></div>
    <p class="visually-hidden" role="status" data-search-announcement="${variant}"></p>
  </div>
</section>`;
const main = `<main class="container feedback-experiment">
  <header class="experiment-intro"><h1 class="type-h3">Feedback experiment</h1>
    <p>Compare current feedback with suggestions. Existing colors, focus rings, and hover/press rules are shared.</p>
    <p class="experiment-note">Search feedback is deferred. These search outcomes are simulated for later review.</p>
  </header>
  <section class="experiment-section" aria-labelledby="search-comparison-heading">
    <div class="experiment-section-heading"><h2 class="type-h4" id="search-comparison-heading">Search</h2>
      <div class="experiment-toolbar">${renderDropdown({ id: "search-scene", label: "Search scenario", name: "search-scene", options: scenes, selectedValue: "empty" })}
        <button class="dropdown__text-action" type="button" data-replay-search>Replay</button>
      </div>
    </div>
    <p class="experiment-note">Try each scenario. Retry resolves after a short simulated load; Clear search keeps focus in the field. Loading and successful results keep their existing treatment.</p>
    <div class="experiment-comparison">${searchPane("current")}${searchPane("suggested")}</div>
  </section>
  <template id="experiment-results-template"><div class="experiment-result-cards">${renderProductCard({ ...product, cardUrl: product.url, media: [product.media] }, root)}</div></template>
</main>`;

const directory = new URL("../output/playwright/feedback-experiment/", import.meta.url);
await mkdir(directory, { recursive: true });
const page = renderDocument({ root, currentPath: "/output/playwright/feedback-experiment/", bodyClass: "reference-page", title: "Feedback experiment | Paradigm", description: "Local comparison of current and suggested feedback.", canonical: "http://127.0.0.1:4178/output/playwright/feedback-experiment/", main,
  head: '<meta name="robots" content="noindex,nofollow">',
  // Place experiment assets after shared resources so their scope stays local.
});
await writeFile(new URL("index.html", directory), page.replace("</head>", '  <link rel="stylesheet" href="./experiment.css">\n  <script defer src="./experiment.js"></script>\n</head>'));
for (const [source, target] of [["feedback-preview.css", "experiment.css"], ["feedback-preview.js", "experiment.js"]]) {
  await writeFile(new URL(target, directory), await readFile(new URL(`./experiments/${source}`, import.meta.url)));
}
console.log("Feedback experiment: /output/playwright/feedback-experiment/");
