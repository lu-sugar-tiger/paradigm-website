import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CSS_DIRECTORY = path.join(ROOT, "assets", "css");

function propertyValue(source, property) {
  const match = source.match(new RegExp(`${property.replaceAll("-", "\\-")}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

function blockAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing ${marker}`);
  const open = source.indexOf("{", markerIndex);
  assert.notEqual(open, -1, `missing opening block for ${marker}`);
  let depth = 1;
  let close = open + 1;
  while (close < source.length && depth > 0) {
    if (source[close] === "{") depth += 1;
    if (source[close] === "}") depth -= 1;
    close += 1;
  }
  assert.equal(depth, 0, `unbalanced block for ${marker}`);
  return source.slice(open + 1, close - 1);
}

function ruleDeclarations(source, selector) {
  const declarations = [];
  let cursor = 0;
  while (cursor < source.length) {
    const selectorIndex = source.indexOf(selector, cursor);
    if (selectorIndex < 0) break;
    const open = source.indexOf("{", selectorIndex + selector.length);
    if (open < 0) break;
    const nextRuleBoundary = source.indexOf("}", selectorIndex + selector.length);
    if (nextRuleBoundary >= 0 && nextRuleBoundary < open) {
      cursor = selectorIndex + selector.length;
      continue;
    }
    let depth = 1;
    let close = open + 1;
    while (close < source.length && depth > 0) {
      if (source[close] === "{") depth += 1;
      if (source[close] === "}") depth -= 1;
      close += 1;
    }
    declarations.push(source.slice(open + 1, close - 1));
    cursor = close;
  }
  return declarations;
}

const tokens = await readFile(path.join(CSS_DIRECTORY, "tokens.css"), "utf8");
const layout = await readFile(path.join(CSS_DIRECTORY, "layout.css"), "utf8");
const components = await readFile(path.join(CSS_DIRECTORY, "components.css"), "utf8");
const pages = await readFile(path.join(CSS_DIRECTORY, "pages.css"), "utf8");
const teamwear = await readFile(path.join(CSS_DIRECTORY, "teamwear.css"), "utf8");
const teamwearStory = await readFile(path.join(CSS_DIRECTORY, "teamwear-story.css"), "utf8");

const spacingScale = new Map([
  ["--space-1", "0.125rem"],
  ["--space-2", "0.25rem"],
  ["--space-3", "0.5rem"],
  ["--space-4", "0.75rem"],
  ["--space-5", "1rem"],
  ["--space-6", "1.5rem"],
  ["--space-7", "2rem"],
  ["--space-8", "3rem"],
  ["--space-9", "4rem"]
]);
for (const [token, value] of spacingScale) {
  assert.equal(propertyValue(tokens, token), value, `${token} must remain ${value}`);
}
assert.doesNotMatch(tokens, /--space-0-5\s*:/, "The former fractional spacing token must be removed");
assert.doesNotMatch(tokens, /--space-(?:10|11)\s*:/, "The primitive spacing scale must stop at space-9");
assert.equal(propertyValue(tokens, "--layout-gutter-inline"), "var(--space-5)", "Base gutter must be 16px");
assert.equal(propertyValue(tokens, "--layout-section-padding-tight"), "var(--space-6)", "Tight sections must use 24px");
assert.equal(propertyValue(tokens, "--layout-section-padding-default"), "var(--space-8)", "Default sections must use 48px");
assert.equal(propertyValue(tokens, "--layout-section-padding-editorial"), "var(--space-9)", "Editorial sections must use 64px");
assert.equal(propertyValue(tokens, "--layout-section-content-gap"), "var(--space-8)", "Section content gaps must use 48px");
const mediumTokens = blockAfter(tokens, "@media (min-width: 48rem)");
assert.equal(propertyValue(mediumTokens, "--layout-gutter-inline"), "var(--space-7)", "Medium and Large gutters must be 32px");
assert.equal(propertyValue(tokens, "--content-width"), "60rem", "Base and Medium content must max at 960px");
const largeTokens = blockAfter(tokens, "@media (min-width: 64rem)");
assert.equal(propertyValue(largeTokens, "--content-width"), "80rem", "Large content must max at 1280px");
assert.doesNotMatch(layout, /\.split(?:\s|\{|,)/, "The unused split layout must be removed");
assert.doesNotMatch(`${layout}\n${components}`, /gap:\s*1px/, "Unused 1px grid gaps must be removed");
assert.doesNotMatch(
  `${layout}\n${components}\n${pages}`,
  /(?:gap|margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?)\s*:\s*2px/,
  "Shared 2px spacing must consume --space-1"
);
assert.match(
  components,
  /\.product-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "Base catalog must use two columns"
);

const mediumComponents = blockAfter(components, "@media (min-width: 48rem)");
assert.match(
  mediumComponents,
  /\.product-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  "Medium and larger catalogs must use three columns"
);

assert.match(
  pages,
  /\.product-page \.auto-grid\s*\{[\s\S]*?gap:\s*var\(--space-1\)/,
  "Catalog seam must consume the 2px spacing token"
);

assert.doesNotMatch(
  pages.slice(0, pages.indexOf("@media (min-width: 64rem)")),
  /@media[\s\S]*?\.reference-page--detail/,
  "Product detail must retain the Base single-column carousel and fixed action through Medium"
);

const largePages = blockAfter(pages, "@media (min-width: 64rem)");
assert.match(
  largePages,
  /\.product-detail__panel\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)[\s\S]*?align-items:\s*stretch[\s\S]*?gap:\s*0/,
  "Large product detail must use a gapless equal-height five-column grid"
);
assert.match(largePages, /\.product-detail__gallery\s*\{[\s\S]*?grid-column:\s*span 3/, "Large gallery must span three columns");
assert.match(largePages, /\.product-detail__summary\s*\{[\s\S]*?grid-column:\s*span 2/, "Large information must span two columns");
assert.match(largePages, /\.product-detail__actions\s*\{[\s\S]*?position:\s*static/, "Large purchase action must be static");

for (const declarations of ruleDeclarations(pages, ".reference-page--detail .product-detail__summary")) {
  assert.doesNotMatch(declarations, /min-height\s*:/, "Product information must not use a fixed or minimum height");
}

assert.match(
  teamwearStory,
  /\.teamwear-highlights,[\s\S]*?padding-block:\s*var\(--layout-section-padding-editorial\)/,
  "All Teamwear editorial sections must use the 64px semantic section role"
);
assert.match(teamwearStory, /\.teamwear-section-heading\s*\{[\s\S]*?margin-bottom:\s*var\(--layout-section-content-gap\)/, "Teamwear headings must use the 48px content gap");
assert.match(teamwearStory, /\.teamwear-highlights__header\s*\{[\s\S]*?margin-bottom:\s*var\(--layout-section-content-gap\)/, "Highlights must use the same 48px content gap");
assert.match(teamwearStory, /padding:\s*0 max\(var\(--layout-gutter-inline\)/, "Teamwear rails must consume the responsive gutter role");
assert.match(teamwearStory, /\.teamwear-story-page \.teamwear-hero\s*\{[\s\S]*?padding:\s*0/, "Teamwear hero must not inherit extra top padding");
assert.match(teamwearStory, /\.teamwear-hero__copy\s*\{[\s\S]*?var\(--layout-section-padding-editorial\)[\s\S]*?var\(--teamwear-action-height\)/, "Hero copy must use 64px insets plus action clearance");
const mediumTeamwear = blockAfter(teamwearStory, "@media (min-width: 48rem)");
assert.match(
  mediumTeamwear,
  /\.teamwear-story-page\s*\{[\s\S]*?--teamwear-card-width:\s*calc\(100vw \/ 3\)/,
  "Medium Teamwear may resize horizontal rail cards"
);
assert.equal(
  mediumTeamwear
    .replace(/\.teamwear-story-page\s*\{[\s\S]*?--teamwear-card-width:\s*calc\(100vw \/ 3\);[\s\S]*?\}/, "")
    .trim(),
  "",
  "Teamwear must retain mobile composition through Medium; only rail-card sizing may change"
);
const largeTeamwear = blockAfter(teamwearStory, "@media (min-width: 64rem)");
assert.match(largeTeamwear, /\.teamwear-highlights__header,[\s\S]*?grid-template-columns:/, "Teamwear heading split must begin at Large");
assert.match(largeTeamwear, /\.teamwear-material__bento\s*\{[\s\S]*?repeat\(3,/, "Teamwear bento must gain three columns at Large");
assert.match(largeTeamwear, /\.teamwear-story-page \.teamwear-faq__layout\s*\{[\s\S]*?grid-template-columns:/, "Teamwear FAQ split must begin at Large");
assert.doesNotMatch(teamwearStory, /(?:gap|padding|margin(?:-(?:top|right|bottom|left))?)\s*:\s*(?:2|4|8|12|16|24|32|48|64|72|80|96|128)px/, "Teamwear spacing must consume system tokens");
assert.doesNotMatch(teamwearStory, /(?:gap|padding|margin(?:-(?:top|right|bottom|left))?)\s*:[^;]*var\(--radius-/, "Radius roles must not be used as spacing");
assert.match(teamwear, /\.teamwear-action\s*\{/, "Shared Teamwear action must remain available");
assert.match(teamwear, /\.teamwear-page main \.container\s*\{[\s\S]*?var\(--layout-gutter-inline\)/, "Teamwear inner content must override reference-page full bleed with the shared gutter");
assert.match(teamwear, /\.teamwear-pattern-option\s*\{/, "Teamwear customizer pattern control must remain available");
assert.match(teamwear, /\.teamwear-color-choice\s*\{/, "Teamwear customizer color control must remain available");
assert.doesNotMatch(teamwear, /\.teamwear-(?:facts|patterns|pattern-grid|pattern-card|on-court|reversible|feedback|closing)/, "Unused legacy Teamwear landing rules must be removed");
assert.doesNotMatch(`${components}\n${pages}`, /\.reference-page--teamwear/, "Unused legacy Teamwear page rules must be removed from shared CSS");

console.log("LAYOUT_SYSTEM_OK spacing=2-64 gutters=16-32 sections=24-48-64 content=960-1280 catalog=2-3-3 detail=single-single-5col teamwear=mobile-mobile-desktop");
