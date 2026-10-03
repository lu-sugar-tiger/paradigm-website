import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { productCategories } from "./lib/product-categories.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const exists = async (file) => access(new URL(`../${file}`, import.meta.url)).then(() => true, () => false);

// These checks match the current GitHub Pages main:/ Jekyll publishing contract.
assert.equal(await exists(".nojekyll"), false, "Do not bypass GitHub Pages archive exclusions");
const pagesConfig = await read("_config.yml");
assert.match(pagesConfig, /^exclude:\s*\n\s+- _archive\s*$/m, "GitHub Pages must exclude retained feature source");
assert.doesNotMatch(pagesConfig, /^include:/m, "Review explicit includes before publishing archived source");

const archived = [
  "catalog-refine/catalog-refine.json", "catalog-refine/catalog-refine.mjs",
  "catalog-refine/catalog-refine.js", "catalog-refine/catalog-refine.css",
  "catalog-refine/collection-renderer.mjs.txt", "catalog-refine/behavior.md",
  "teamwear-fabric/section.html", "teamwear-fabric/section.css", "teamwear-fabric/fabric-square.webp"
];
for (const file of archived) assert.ok(await exists(`_archive/${file}`), `Missing archived source: ${file}`);
for (const file of ["data/catalog-refine.json", "scripts/lib/catalog-refine.mjs", "assets/js/catalog-refine.js", "assets/images/teamwear/rail/fabric-square.webp"]) {
  assert.equal(await exists(file), false, `Archived feature must not remain at its active path: ${file}`);
}
assert.doesNotMatch(await read("scripts/build-site.mjs"), /_archive|refineConfig|catalog-refine|fabric-square|teamwear-material/, "Public generation must not load or enable archived features");
for (const file of ["index.html", "collections/all/index.html", ...productCategories.map(({ slug }) => `collections/${slug}/index.html`), "teamwear/index.html", "teamwear/customize/index.html"]) {
  assert.doesNotMatch(await read(file), /_archive|catalog-refine|data-dropdown-grouped|teamwear-material|material-title|fabric-square/, `${file} must not expose archived features`);
}
assert.doesNotMatch(await read("assets/css/teamwear-story.css"), /teamwear-material/, "Archived fabric styles must not ship");
assert.doesNotMatch(await read("assets/css/components.css"), /\.catalog-empty/, "Archived Refine empty-state styles must not ship");
const fragment = await read("_archive/teamwear-fabric/section.html");
assert.match(fragment, /Construction\./);
assert.match(fragment, /Made for players\./);
assert.match(fragment, /Light<wbr>Weight[\s\S]*Quick<wbr>Dry[\s\S]*Smooth<wbr>Print/);
assert.match(fragment, /fabric-square\.webp[^>]*width="1200" height="1200"/);
console.log("FEATURE_ARCHIVE_OK features=2 sourceRetained=true publicIntegration=false githubPagesExcluded=true");
