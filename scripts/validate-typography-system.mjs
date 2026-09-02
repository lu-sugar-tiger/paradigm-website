import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CSS_DIRECTORY = path.join(ROOT, "assets", "css");
const WEIGHTS = new Map([
  ["thin", "100"],
  ["extra-light", "200"],
  ["light", "300"],
  ["regular", "400"],
  ["medium", "500"],
  ["semi-bold", "600"],
  ["bold", "700"],
  ["extra-bold", "800"],
  ["black", "900"]
]);
const PARAGRAPH_SPACING = new Map([
  ["default", "0"],
  ["compact", "0"],
  ["standard", "0.333333em"],
  ["relaxed", "1em"]
]);
const TEXT_ROLES = new Map([
  ["small", { size: "0.625rem", lineHeight: "0.833333rem", weight: "350" }],
  ["body", { size: "0.75rem", lineHeight: "1rem", weight: "350" }],
  ["h1", { size: "2rem", lineHeight: "2.666667rem", weight: "var(--font-weight-medium)" }],
  ["h2", { size: "1.5rem", lineHeight: "2rem", weight: "var(--font-weight-medium)" }],
  ["h3", { size: "1.25rem", lineHeight: "1.666667rem", weight: "var(--font-weight-medium)" }],
  ["h4", { size: "1rem", lineHeight: "1.333333rem", weight: "var(--font-weight-medium)" }],
  ["h5", { size: "0.875rem", lineHeight: "1.166667rem", weight: "var(--font-weight-medium)" }],
  ["h6", { size: "0.75rem", lineHeight: "1rem", weight: "var(--font-weight-medium)" }]
]);
const COMPONENT_TEXT_ROLES = new Set(["brand"]);
const FONT_FAMILIES = new Map([
  ["font-latin", '"Roboto"'],
  ["font-cjk", '"PingFang TC", "Noto Sans CJK TC", "Noto Sans TC", "Source Han Sans TC", "Microsoft JhengHei"'],
  ["font-sans", "var(--font-latin), var(--font-cjk), sans-serif"],
  ["font-brand", "var(--font-latin), sans-serif"]
]);
const ROBOTO_STYLESHEET = "https://fonts.googleapis.com/css2?family=Roboto:wdth,wght@87.5,100..900&display=swap";

function propertyValue(source, property) {
  const match = source.match(new RegExp(`${property.replaceAll("-", "\\-")}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

function collectRules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];

  function visit(block) {
    let cursor = 0;
    while (cursor < block.length) {
      const open = block.indexOf("{", cursor);
      if (open < 0) break;
      const selector = block.slice(cursor, open).trim().replace(/^;\s*/, "");
      let depth = 1;
      let close = open + 1;
      while (close < block.length && depth > 0) {
        if (block[close] === "{") depth += 1;
        if (block[close] === "}") depth -= 1;
        close += 1;
      }
      assert.equal(depth, 0, `unbalanced CSS block after "${selector}"`);
      const declarations = block.slice(open + 1, close - 1);
      if (selector.startsWith("@")) visit(declarations);
      else rules.push({ selector, declarations });
      cursor = close;
    }
  }

  visit(css);
  return rules;
}

const tokens = await readFile(path.join(CSS_DIRECTORY, "tokens.css"), "utf8");
assert.doesNotMatch(
  tokens,
  /--text-(?:xs|sm|base|lg|xl|hero)\b/,
  "Legacy text-size tokens must be removed in favor of semantic typography roles"
);
for (const [name, value] of FONT_FAMILIES) {
  assert.equal(propertyValue(tokens, `--${name}`), value, `--${name} must equal ${value}`);
}
assert.doesNotMatch(tokens, /Alibaba/i, "Alibaba webfont tokens must remain deferred");
for (const [name, value] of WEIGHTS) {
  assert.equal(
    propertyValue(tokens, `--font-weight-${name}`),
    value,
    `--font-weight-${name} must equal ${value}`
  );
}
assert.equal(propertyValue(tokens, "--font-weight-strong-offset"), "150", "Strong must add 150 to the surrounding role weight");
assert.equal(propertyValue(tokens, "--font-style-normal"), "normal", "Normal style modifier must be tokenized");
assert.equal(propertyValue(tokens, "--font-style-italic"), "italic", "Italic style modifier must be tokenized");
assert.equal(propertyValue(tokens, "--type-brand-weight"), "var(--font-weight-extra-bold)", "Brand must own its default weight");

for (const [name, value] of PARAGRAPH_SPACING) {
  assert.equal(
    propertyValue(tokens, `--type-paragraph-spacing-${name}`),
    value,
    `paragraph spacing ${name} must equal ${value}`
  );
}

for (const [name, role] of TEXT_ROLES) {
  assert.equal(propertyValue(tokens, `--type-${name}-size`), role.size, `${name} size must equal ${role.size}`);
  assert.equal(
    propertyValue(tokens, `--type-${name}-line-height`),
    role.lineHeight,
    `${name} line height must preserve the Body 12/16 ratio`
  );
  assert.equal(
    propertyValue(tokens, `--type-${name}-weight`),
    role.weight,
    `${name} default weight must be ${role.weight}`
  );
}

const cssFiles = (await readdir(CSS_DIRECTORY))
  .filter((file) => file.endsWith(".css"))
  .map((file) => path.join(CSS_DIRECTORY, file));
const violations = [];

for (const filePath of cssFiles) {
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const css = await readFile(filePath, "utf8");
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

  for (const match of withoutComments.matchAll(/var\((--text-(?:xs|sm|base|lg|xl|hero))\)/g)) {
    violations.push(`${relativePath}: legacy typography reference ${match[1]} is prohibited`);
  }

  for (const match of withoutComments.matchAll(/font-weight\s*:\s*([^;]+);/g)) {
    const value = match[1].trim();
    if (
      value !== "var(--font-weight-base)" &&
      value !== "var(--material-icon-weight)" &&
      !value.startsWith("min(")
    ) {
      violations.push(`${relativePath}: font-weight must use the semantic base or Strong modifier, found ${value}`);
    }
  }

  for (const match of withoutComments.matchAll(/--font-weight-base\s*:\s*var\(--font-weight-([a-z-]+)\)/g)) {
    violations.push(`${relativePath}: base weight must come from a complete text role; use Strong for a state or inline modifier, found ${match[1]}`);
  }


  for (const match of withoutComments.matchAll(/--font-weight-base\s*:\s*var\(--type-([a-z0-9-]+)-weight\)/g)) {
    if (!TEXT_ROLES.has(match[1]) && !COMPONENT_TEXT_ROLES.has(match[1])) {
      violations.push(`${relativePath}: unknown text-role weight ${match[1]}`);
    }
  }

  for (const { selector, declarations } of collectRules(css)) {
    const derivesIconWeight = selector.trim() === ".material-symbols-outlined";
    if (
      declarations.includes("font-weight: var(--font-weight-base)") &&
      !derivesIconWeight &&
      !/--font-weight-base\s*:\s*var\(--(?:font-weight-[a-z-]+|type-[a-z0-9-]+-weight)\)/.test(declarations)
    ) {
      violations.push(`${relativePath}: ${selector} must declare its semantic --font-weight-base`);
    }
  }
}

const base = await readFile(path.join(CSS_DIRECTORY, "base.css"), "utf8");
assert.doesNotMatch(base, /font-stretch\s*:/, "Global typography must not stretch CJK system fallbacks");
assert.match(base, /:where\(strong, \.text-strong\)/, "Strong element and modifier class must share one rule");
assert.match(base, /var\(--font-weight-strong-offset\)/, "Strong must use the +150 token");
assert.match(base, /var\(--font-weight-black\)/, "Strong must cap at Black 900");
assert.match(base, /:where\(em, \.text-italic\)/, "Italic element and modifier class must share one rule");
for (const role of TEXT_ROLES.keys()) {
  assert.match(base, new RegExp(`\\.type-${role}`), `.type-${role} must apply the complete role`);
}
for (const role of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
  assert.match(
    base,
    new RegExp(`\\.type-${role}\\s*\\{[\\s\\S]*?var\\(--type-${role}-weight\\)[\\s\\S]*?var\\(--type-${role}-size\\)[\\s\\S]*?var\\(--type-${role}-line-height\\)`),
    `.type-${role} must apply the complete ${role} role`
  );
}
for (const [semanticElement, shiftedRole] of [
  ["h1", "h3"],
  ["h2", "h4"],
  ["h3", "h5"],
  ["h4", "h5"],
  ["h5", "h6"]
]) {
  assert.match(
    base,
    new RegExp(`:where\\(${semanticElement}\\)\\s*\\{[\\s\\S]*?var\\(--type-${shiftedRole}-weight\\)[\\s\\S]*?var\\(--type-${shiftedRole}-size\\)[\\s\\S]*?var\\(--type-${shiftedRole}-line-height\\)`),
    `${semanticElement} must retain its previous rendered size through the shifted ${shiftedRole} role`
  );
}

const components = await readFile(path.join(CSS_DIRECTORY, "components.css"), "utf8");
assert.match(
  components,
  /\.material-symbols-outlined\s*\{[^}]*--material-icon-weight:\s*calc\(var\(--font-weight-base\) - var\(--material-icon-weight-offset\)\);[^}]*font-weight:\s*var\(--material-icon-weight\);[^}]*font-variation-settings:\s*"FILL" 0, "wght" var\(--material-icon-weight\), "GRAD" var\(--material-icon-grade\), "opsz" 24;/,
  "Material symbols must derive a tokenized weight 100 below their semantic text owner and consume the shared grade"
);
assert.equal(propertyValue(tokens, "--material-icon-weight-offset"), "100", "Every Material Symbol must use the shared 100 weight offset");
assert.equal(propertyValue(tokens, "--material-icon-grade"), "0", "Every Material Symbol must use grade 0");
assert.doesNotMatch(components, /"GRAD"\s+-25/, "No component may retain the previous -25 Material Symbol grade");
assert.doesNotMatch(
  components.match(/\.material-symbols-outlined\s*\{[^}]*\}/)?.[0] || "",
  /--font-weight-base\s*:/,
  "Material symbols must not override their text owner's semantic weight"
);
assert.match(
  components,
  /\.page-headline__row\s*\{[\s\S]*?--font-weight-base:\s*var\(--type-body-weight\)[\s\S]*?font-size:\s*var\(--type-body-size\)[\s\S]*?font-weight:\s*var\(--font-weight-base\)[\s\S]*?line-height:\s*var\(--type-body-line-height\)/,
  "All page headlines and breadcrumbs must use the complete Body role"
);
assert.match(
  components,
  /\.rich-description__line\s*\{[\s\S]*?var\(--type-paragraph-spacing-standard\)/,
  "rich descriptions must retain Standard paragraph spacing"
);
assert.match(
  components,
  /\.product-card__title\s*\{[\s\S]*?font-size:\s*var\(--type-h6-size\)[\s\S]*?--font-weight-base:\s*var\(--type-h6-weight\)[\s\S]*?font-weight:\s*var\(--font-weight-base\)[\s\S]*?line-height:\s*var\(--type-h6-line-height\)/,
  "Catalog product names must use the complete h6 text role"
);

const teamwearStory = await readFile(path.join(CSS_DIRECTORY, "teamwear-story.css"), "utf8");
assert.doesNotMatch(teamwearStory, /letter-spacing\s*:/, "Teamwear must use default tracking");
assert.doesNotMatch(teamwearStory, /text-shadow\s*:/, "Teamwear text must not use invented text effects");
assert.match(
  teamwearStory,
  /\.teamwear-story-page :where\(h1, h2, h3, h5, p, blockquote\)\s*\{[\s\S]*?var\(--type-paragraph-spacing-standard\)/,
  "Teamwear text fields must use Standard paragraph spacing"
);
for (const selector of [
  ".teamwear-hero__copy",
  ".teamwear-section-heading > div",
  ".teamwear-rail-card__copy",
  ".teamwear-stacked-row__copy"
]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    teamwearStory,
    new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?gap:\\s*0;`),
    `${selector} must use typography rhythm instead of a text-stack gap`
  );
}

const teamwearMarkup = await readFile(path.join(ROOT, "teamwear", "index.html"), "utf8");
const teamwearMainMarkup = teamwearMarkup.match(/<main\b[\s\S]*?<\/main>/)?.[0] || "";
assert.ok(teamwearMainMarkup, "Teamwear must render its main content landmark");
assert.match(teamwearMarkup, /<h1 class="type-h1"[^>]*>/, "Teamwear hero title must use the h1 display role");
for (const match of teamwearMainMarkup.matchAll(/<h2([^>]*)>/g)) {
  assert.match(match[1], /class="[^"]*\btype-h2\b[^"]*"/, "Every Teamwear section title must use the h2 display role");
  assert.match(match[1], /class="[^"]*\bteamwear-title--brand-gradient\b[^"]*"/, "Every Teamwear section title must use the Brand Title gradient");
}
for (const match of teamwearMainMarkup.matchAll(/<h3([^>]*)>/g)) {
  assert.match(match[1], /class="[^"]*\btype-h5\b[^"]*"/, "Every Teamwear child or card title must use the h5 text role");
}
assert.doesNotMatch(teamwearMarkup, /<p class="(?:teamwear-kicker|teamwear-section-label)"/, "Teamwear eyebrows must not remain paragraphs");
const teamwearEyebrowClasses = [...teamwearMarkup.matchAll(/class="(?:teamwear-kicker|teamwear-section-label)"/g)];
const teamwearH5Eyebrows = [...teamwearMarkup.matchAll(/<h5 class="(?:teamwear-kicker|teamwear-section-label)">/g)];
assert.ok(teamwearH5Eyebrows.length > 0, "Teamwear must include h5 eyebrows");
assert.equal(teamwearH5Eyebrows.length, teamwearEyebrowClasses.length, "Every Teamwear eyebrow must use h5");

const renderer = await readFile(path.join(ROOT, "scripts", "lib", "site-renderers.mjs"), "utf8");
assert.match(
  renderer,
  new RegExp(`const ROBOTO_SEMI_CONDENSED_STYLESHEET = ${JSON.stringify(ROBOTO_STYLESHEET).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  "The shared renderer must request Roboto at wdth 87.5 across weights 100 through 900"
);
assert.match(renderer, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/, "Google Fonts CSS must be preconnected");
assert.match(renderer, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/, "Google font files must use a cross-origin preconnect");
assert.doesNotMatch(renderer, /alibabafonts|AlibabaSansTC/i, "The shared renderer must not request the deferred Alibaba webfont");

const rootMarkup = await readFile(path.join(ROOT, "index.html"), "utf8");
const escapedRobotoStylesheet = ROBOTO_STYLESHEET.replaceAll("&", "&amp;");
assert.equal((rootMarkup.match(/rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/g) || []).length, 1, "Generated pages must preconnect to Google Fonts CSS once");
assert.equal((rootMarkup.match(/rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/g) || []).length, 1, "Generated pages must preconnect to Google font files once");
assert.ok(rootMarkup.includes(`href="${escapedRobotoStylesheet}"`), "Generated pages must load the shared Roboto Semi Condensed stylesheet");
assert.ok(rootMarkup.indexOf(escapedRobotoStylesheet) < rootMarkup.indexOf("assets/css/tokens.css"), "Roboto must load before local typography CSS");
assert.doesNotMatch(rootMarkup, /alibabafonts|AlibabaSansTC/i, "Generated pages must not request the deferred Alibaba webfont");

assert.equal(violations.length, 0, violations.join("\n"));
console.log(
  `TYPOGRAPHY_SYSTEM_OK families=${FONT_FAMILIES.size} latin=roboto-semi-condensed-100-900 cjk=system-fallback weights=${WEIGHTS.size} textRoles=${TEXT_ROLES.size} paragraphRoles=${PARAGRAPH_SPACING.size} strongOffset=150 productSpacing=one-third-em teamwear=h1-h2-gradient-child-h5-eyebrow-h5`
);
