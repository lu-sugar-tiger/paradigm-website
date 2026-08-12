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
  "tokens.css must define only Brand plus High/Mid/Low Background, On Background, Surface, On Surface, Container, On Container, and Outline roles"
);
assert.equal(tokenDefinitions.length, SEMANTIC_ROLES.size, "semantic color roles must be defined exactly once");

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

const colorwayRegistry = JSON.parse(
  await readFile(path.join(ROOT, "data/product-colorways.json"), "utf8")
);
assert.ok(Array.isArray(colorwayRegistry.colorways), "product colorways must be a list");
const productHexValues = new Set();
const productLabels = new Set();
for (const { label, hex } of colorwayRegistry.colorways) {
  assert.ok(label && /^#[0-9a-f]{6}$/i.test(hex), "each product colorway must have a label and six-digit hex value");
  productLabels.add(label);
  productHexValues.add(normalizeHex(hex));
}
assert.equal(productLabels.size, colorwayRegistry.colorways.length, "product colorway labels must be unique");

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
for (const match of catalogText.matchAll(/"hex"\s*:\s*"(#[0-9a-f]{6})"/gi)) {
  if (!productHexValues.has(normalizeHex(match[1]))) {
    violations.push(`assets/js/catalog.js: ${match[1]} is not in product-colorways.json`);
  }
}

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
  if (normalizedPath.includes("teamwear")) continue;
  for (const match of html.matchAll(/(?:background(?:-color)?|color)\s*:\s*(#[0-9a-f]{6})/gi)) {
    if (!productHexValues.has(normalizeHex(match[1]))) {
      violations.push(`${relativePath}: inline color ${match[1]} is not a product colorway`);
    }
  }
}

assert.equal(violations.length, 0, violations.join("\n"));
console.log(
  `COLOR_SYSTEM_OK semanticRoles=${SEMANTIC_ROLES.size} productColorways=${colorwayRegistry.colorways.length} teamwearScoped=true`
);
