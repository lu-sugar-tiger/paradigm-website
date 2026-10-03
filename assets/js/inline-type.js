(function (global) {
  // Only explicit script characters are normalized, never whole source strings.
  // ꟲ is deliberately excluded: it is not an accepted color-handle prefix.
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁱⁿᵃᵇᶜᵈᵉᶠᵍʰᶦʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ";
  const subscripts = "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ";
  const scripts = new Map([
    ...[...superscripts].map((character) => [character, "sup"]),
    ...[...subscripts].map((character) => [character, "sub"])
  ]);
  function runs(value) {
    const result = [];
    for (const character of String(value ?? "")) {
      const type = scripts.get(character) || "text";
      const text = type === "text" ? character : character.normalize("NFKC");
      const previous = result[result.length - 1];
      if (previous?.type === type) previous.text += text;
      else result.push({ type, text });
    }
    return result;
  }
  function escape(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function render(value) {
    return runs(value).map(({ type, text }) => type === "text" ? escape(text) : `<${type}>${escape(text)}</${type}>`).join("");
  }
  function plain(value) {
    return runs(value).map(({ text }) => text).join("");
  }
  function set(element, value) {
    const document = element.ownerDocument;
    const fragment = document.createDocumentFragment();
    for (const { type, text } of runs(value)) {
      const node = type === "text" ? document.createTextNode(text) : document.createElement(type);
      if (type !== "text") node.textContent = text;
      fragment.append(node);
    }
    element.replaceChildren(fragment);
  }
  const api = Object.freeze({ runs, render, plain, set });
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.PARADIGM_INLINE_TYPE = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
