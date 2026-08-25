import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SEMANTIC_LEVELS = ["high", "mid", "low"];
const SEMANTIC_FAMILIES = [
  "background",
  "on-background",
  "surface",
  "on-surface",
  "container",
  "on-container",
  "outline"
];
const SEMANTIC_ROLES = new Set([
  "--color-brand",
  "--color-brand-low",
  ...SEMANTIC_FAMILIES.flatMap((family) =>
    SEMANTIC_LEVELS.map((level) => `--color-${family}-${level}`)
  )
]);
const SHARED_CSS = [
  "assets/css/reset.css",
  "assets/css/base.css",
  "assets/css/layout.css",
  "assets/css/components.css",
  "assets/css/pages.css"
];
const ALL_CSS = [
  "assets/css/tokens.css",
  ...SHARED_CSS,
  "assets/css/teamwear.css",
  "assets/css/teamwear-story.css"
];
const RAW_COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|:\s*(?:black|white)\b/i;

function collectRules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];

  function visit(block) {
    let cursor = 0;
    while (cursor < block.length) {
      const open = block.indexOf("{", cursor);
      if (open < 0) break;
      const header = block.slice(cursor, open).trim().replace(/^;\s*/, "");
      let depth = 1;
      let close = open + 1;
      while (close < block.length && depth > 0) {
        if (block[close] === "{") depth += 1;
        if (block[close] === "}") depth -= 1;
        close += 1;
      }
      assert.equal(depth, 0, `unbalanced CSS block after "${header}"`);
      const body = block.slice(open + 1, close - 1);
      if (header.startsWith("@")) visit(body);
      else rules.push({ selector: header, declarations: body });
      cursor = close;
    }
  }

  visit(css);
  return rules;
}

function isTeamwearSelector(selector) {
  const selectors = selector.split(",").map((part) => part.trim()).filter(Boolean);
  return selectors.length > 0 && selectors.every((part) => part.toLowerCase().includes("teamwear"));
}

function normalizeHex(value) {
  const hex = value.toLowerCase();
  if (hex.length === 4) return `#${[...hex.slice(1)].map((digit) => digit.repeat(2)).join("")}`;
  return hex;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "references", "node_modules"].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

const tokensText = await readFile(path.join(ROOT, "assets/css/tokens.css"), "utf8");
const tokenDefinitions = [...tokensText.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((match) => match[1]);
assert.deepEqual(
  [...new Set(tokenDefinitions)].sort(),
  [...SEMANTIC_ROLES].sort(),
  "tokens.css must define only Brand, Brand Low, plus High/Mid/Low Background, On Background, Surface, On Surface, Container, On Container, and Outline roles"
);
assert.equal(tokenDefinitions.length, SEMANTIC_ROLES.size, "semantic color roles must be defined exactly once");
assert.match(tokensText, /--color-brand-low\s*:\s*#ff808b\s*;/i, "Brand Low must equal #FF808B");
assert.match(tokensText, /--color-outline-mid\s*:\s*#808080\s*;/i, "Outline Mid must equal #808080");
assert.match(tokensText, /--color-outline-low\s*:\s*#bfbfbf\s*;/i, "Outline Low must equal #BFBFBF");
const brandTitleGradient = tokensText.match(/--gradient-brand-title\s*:\s*linear-gradient\(([\s\S]*?)\);/)?.[1] ?? "";
assert.match(brandTitleGradient, /var\(--color-brand\)/, "brand title gradient must use Brand");
assert.match(brandTitleGradient, /var\(--color-brand-low\)/, "brand title gradient must use Brand Low");
const teamwearCssText = await readFile(path.join(ROOT, "assets/css/teamwear.css"), "utf8");
assert.match(
  teamwearCssText,
  /\.teamwear-title--brand-gradient\s*\{[\s\S]*?background\s*:\s*var\(--gradient-brand-title\)/,
  "Teamwear Brand Title utility must consume the prepared gradient token"
);

const semanticHexValues = new Set(
  [...tokensText.matchAll(/--color-[a-z0-9-]+\s*:\s*(#[0-9a-f]{6})\s*;/gi)]
    .map((match) => normalizeHex(match[1]))
);
assert.equal(semanticHexValues.size > 0, true, "semantic roles must have concrete color values");

const violations = [];
for (const relativePath of ALL_CSS) {
  const css = await readFile(path.join(ROOT, relativePath), "utf8");
  for (const reference of css.matchAll(/var\((--color-[a-z0-9-]+)\)/g)) {
    if (!SEMANTIC_ROLES.has(reference[1])) {
      violations.push(`${relativePath}: unknown semantic role ${reference[1]}`);
    }
  }
}

for (const relativePath of SHARED_CSS) {
  const css = await readFile(path.join(ROOT, relativePath), "utf8");
  for (const { selector, declarations } of collectRules(css)) {
    if (RAW_COLOR.test(declarations) && !isTeamwearSelector(selector)) {
      violations.push(`${relativePath}: literal color outside Teamwear in ${selector}`);
    }
  }
}

const colorRegistry = JSON.parse(
  await readFile(path.join(ROOT, "data/colors.json"), "utf8")
);
assert.ok(Array.isArray(colorRegistry.colors), "canonical colors must be a list");
const productHexValues = new Set();
const productLabels = new Set();
for (const { id, name, value } of colorRegistry.colors) {
  assert.ok(id && name && /^#[0-9a-f]{6}$/i.test(value), "each canonical color must have an id, name, and six-digit value");
  productLabels.add(name);
  productHexValues.add(normalizeHex(value));
}
assert.equal(productLabels.size, colorRegistry.colors.length, "canonical color names must be unique");

const runtimeFiles = await walk(ROOT);
for (const filePath of runtimeFiles.filter((file) => file.toLowerCase().endsWith(".svg"))) {
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  if (relativePath.toLowerCase().includes("teamwear")) continue;
  const svg = await readFile(filePath, "utf8");
  for (const match of svg.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    const value = normalizeHex(match[0]);
    if (!semanticHexValues.has(value)) {
      violations.push(`${relativePath}: SVG color ${match[0]} is not a semantic value`);
    }
  }
}

const catalogText = await readFile(path.join(ROOT, "assets/js/catalog.js"), "utf8");
if (/#[0-9a-f]{6}\b/i.test(catalogText)) violations.push("assets/js/catalog.js: local color values are prohibited");

for (const filePath of runtimeFiles.filter((file) => file.toLowerCase().endsWith(".html"))) {
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const normalizedPath = relativePath.toLowerCase();
  const html = await readFile(filePath, "utf8");
  if (
    /teamwear(?:-story)?\.css/i.test(html) &&
    !normalizedPath.includes("teamwear")
  ) {
    violations.push(`${relativePath}: Teamwear color styles may only load on Teamwear pages`);
  }
  for (const match of html.matchAll(/(?:background(?:-color)?|color)\s*:\s*(#[0-9a-f]{6})/gi)) {
    violations.push(`${relativePath}: inline color ${match[1]} is prohibited; reference a canonical color id`);
  }
}

assert.equal(violations.length, 0, violations.join("\n"));
console.log(
  `COLOR_SYSTEM_OK semanticRoles=${SEMANTIC_ROLES.size} canonicalColors=${colorRegistry.colors.length} teamwearScoped=true`
);
