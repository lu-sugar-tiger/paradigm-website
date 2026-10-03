import { readFileSync } from "node:fs";
import searchCore from "../../assets/js/search-core.js";

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const COLOR_HANDLE = /(?<![ꟲ⁰¹²³⁴⁵⁶⁷⁸⁹])([⁰¹²³⁴⁵⁶⁷⁸⁹]{2})(\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*|\p{Letter}[\p{Letter}\p{Mark}]*)/gu;

export function createItemColors(registry) {
  const paletteByCode = new Map(registry.palette.map((color) => [color.code, color]));
  const colorByCode = new Map(registry.colors.map((color) => [color.code, color]));
  const name = (code, fallback = "") => colorByCode.get(code)?.name || fallback;
  const label = (code, fallback = "") => {
    const colorName = name(code, fallback);
    if (!paletteByCode.has(code)) return colorName;
    return [...code.slice(1)].map((digit) => SUPERSCRIPT_DIGITS[Number(digit)]).join("") + colorName;
  };
  const resolveHandles = (text, { includeCode = true } = {}) => String(text).replace(COLOR_HANDLE, (handle, digits, sourceName) => {
    const code = "C" + [...digits].map((digit) => SUPERSCRIPT_DIGITS.indexOf(digit)).join("");
    return paletteByCode.has(code) ? (includeCode ? digits : "") + name(code, sourceName) : handle;
  });
  const descriptionTerms = (tokens) => searchCore.descriptionTerms({ description: tokens.map((token) => token.type === "text"
    ? { ...token, text: resolveHandles(token.text, { includeCode: false }) } : token) });
  return { paletteByCode, colorByCode, name, label, resolveHandles, descriptionTerms };
}

export const itemColors = createItemColors(JSON.parse(
  readFileSync(new URL("../../data/colors.json", import.meta.url), "utf8")
));
