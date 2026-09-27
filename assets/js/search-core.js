(function (global) {
  const STOP = new Set("a an and are as at be by for from in is it of on or our the this to with you your 的 與 及 是 以 於 和".split(" "));
  const ALIAS = { tees: "tee", tshirts: "tee", tshirt: "tee", 短袖: "tee", 短t: "tee", hoodies: "hoodie", 帽t: "hoodie", 連帽: "hoodie", crewnecks: "crewneck", 大學t: "crewneck", jerseys: "jersey", 球衣: "jersey", 短褲: "shorts", 棉質: "cotton", 棉: "cotton", 黑色: "black", 白色: "white", 灰色: "grey", 藍色: "blue", colours: "color", colors: "color" };
  const WEIGHTS = {
    search: { name: 4, type: 3, family: 3, category: 2, colors: 2, description: 1, keywords: 3, summary: 1 },
    related: { name: 3, type: 4, family: 3, category: 2, colors: 1, description: 1 }
  };
  const cache = new WeakMap();

  function normalize(value) {
    return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  }
  const compact = (value) => normalize(value).replace(/\s/g, "");
  function tokens(value) {
    const found = new Set();
    for (const part of normalize(value).replace(/\bt shirts?\b/g, "tee").split(" ").filter(Boolean)) {
      const chars = Array.from(part);
      const pieces = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(part) && chars.length > 2
        ? chars.slice(0, -1).map((char, i) => char + chars[i + 1]) : [part];
      for (const piece of pieces) {
        const term = ALIAS[piece] || piece;
        if (!STOP.has(term)) found.add(term);
      }
    }
    return [...found];
  }
  function titleCase(value) {
    const acronyms = new Set(["aw", "pe", "prdm", "ss"]);
    return String(value ?? "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean).map((word) => {
      const lower = word.toLowerCase();
      return acronyms.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(" ");
  }
  function descriptionTerms(record) {
    if (Array.isArray(record.descriptionTerms)) return record.descriptionTerms;
    const source = record.description || record.descriptionSource?.content || "";
    const lines = Array.isArray(source) ? source.filter((part) => part.type === "text").map((part) => part.text) : String(source).split(/\r?\n/);
    const useful = lines.filter((line) => !/^\s*(?:#|[\d|/\-\s]+$)/.test(line))
      .map((line) => line.replace(/\b\d+(?:[.,]\d+)?\s*(?:cm|mm|g\/m²?|gsm)\b/gi, " "));
    const terms = [...new Set(useful.flatMap(tokens))].filter((term) => !/^\d+$/.test(term));
    return [...terms.filter((term) => /^[a-z]/.test(term)), ...terms.filter((term) => !/^[a-z]/.test(term))].slice(0, 120);
  }
  function vector(record, mode) {
    const name = record.name || record.title || "";
    const type = record.type || name.match(/(Football Jersey|Crewneck|Hoodie|Shorts|Tee)$/i)?.[1] || "";
    const family = record.family || name.replace(/^PRDM\s+/i, "").replace(new RegExp(`\\s+${type}$`, "i"), "").trim();
    const colors = record.colors?.map((color) => typeof color === "string" ? color : color.label)
      || [...new Set(record.variants?.filter((variant) => variant.visible).map((variant) => variant.colorName) || [])];
    const entries = [
      ["name", name], ["type", type], ["family", family], ["category", record.category],
      ["colors", colors.join(" ")],
      ["description", descriptionTerms(record)], ["keywords", record.keywords], ["summary", record.summary]
    ];
    const result = new Map();
    for (const [field, value] of entries) {
      const weight = WEIGHTS[mode][field];
      if (!weight || !value) continue;
      const terms = [...new Set(Array.isArray(value) ? value.flatMap(tokens) : tokens(value))];
      const share = weight / Math.sqrt(terms.length || 1);
      for (const term of terms) result.set(term, (result.get(term) || 0) + share);
    }
    return result;
  }
  function model(records, mode = "search") {
    const existing = cache.get(records)?.[mode];
    if (existing) return existing;
    const vectors = records.map((record) => vector(record, mode));
    const groups = new Map(), df = new Map();
    vectors.forEach((entry, index) => {
      const key = records[index].code || records[index].url || index;
      if (!groups.has(key)) groups.set(key, new Set());
      for (const term of entry.keys()) groups.get(key).add(term);
    });
    for (const terms of groups.values()) for (const term of terms) df.set(term, (df.get(term) || 0) + 1);
    const idf = new Map([...df].map(([term, count]) => [term, 1 + Math.log((groups.size + 1) / (count + 1))]));
    const built = { vectors, idf };
    cache.set(records, { ...cache.get(records), [mode]: built });
    return built;
  }
  function cosine(left, right, idf) {
    let dot = 0, leftSize = 0, rightSize = 0;
    for (const [term, weight] of left) {
      const scaled = weight * (idf.get(term) || 1);
      leftSize += scaled * scaled;
      dot += scaled * (right.get(term) || 0) * (idf.get(term) || 1);
    }
    for (const [term, weight] of right) rightSize += (weight * (idf.get(term) || 1)) ** 2;
    return leftSize && rightSize ? dot / Math.sqrt(leftSize * rightSize) : 0;
  }
  function oneEdit(left, right) {
    if (!/^[a-z]+$/.test(left + right) || Math.abs(left.length - right.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (left.length >= right.length) i++;
      if (right.length >= left.length) j++;
    }
    return edits + left.length - i + right.length - j <= 1;
  }
  function covered(entry, terms, fallback) {
    const keys = [...entry.keys()];
    return terms.every((term) => keys.some((key) => key === term || key.startsWith(term) || (fallback && term.length >= 4 && oneEdit(term, key))));
  }
  function rankRecords(records, query) {
    const terms = tokens(query);
    if (!terms.length) return [];
    const identifier = compact(query);
    const identifiers = records.filter((record) => [record.code, record.sku].some((code) => code && compact(code) === identifier));
    if (identifiers.length) return identifiers;
    const codeTerm = terms.find((term) => /^[a-z]{2}\d{5}$/.test(term));
    if (codeTerm) {
      const matching = records.filter((record) => compact(record.code) === codeTerm);
      const remaining = terms.filter((term) => term !== codeTerm);
      return remaining.length ? rankRecords(matching, remaining.join(" ")) : matching;
    }
    if (/^[a-z]{2}\d{5}/.test(identifier)) return [];
    const { vectors, idf } = model(records);
    const queryVector = new Map(terms.map((term) => [term, 1]));
    const rank = (fallback) => records.map((record, index) => {
      const entry = vectors[index];
      if (!covered(entry, terms, fallback)) return null;
      const name = normalize(record.name || record.title), q = normalize(query);
      const expanded = new Map(entry);
      for (const term of terms) if (!expanded.has(term)) {
        const candidate = [...entry.keys()].find((key) => key.startsWith(term) || (fallback && oneEdit(term, key)));
        if (candidate) expanded.set(term, entry.get(candidate) * 0.55);
      }
      return { record, index, score: (name === q ? 500 : name.startsWith(q) ? 150 : 0) + cosine(queryVector, expanded, idf) * 100 };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index);
    const strict = rank(false);
    return (strict.length ? strict : rank(true)).map((entry) => entry.record);
  }
  function rankRelatedProducts(records, current) {
    const { vectors, idf } = model(records, "related"), query = vector(current, "related");
    return records.map((record, index) => ({ record, index, score: cosine(query, vectors[index], idf) }))
      .filter(({ record }) => record.code !== current.code)
      .sort((a, b) => b.score - a.score || Number(b.record.sequence || 0) - Number(a.record.sequence || 0) || a.index - b.index)
      .map(({ record }) => record);
  }
  function suggestions(index, query, limit = 5) {
    if (!normalize(query)) return index.popularKeywords.map(titleCase);
    const parts = normalize(query).split(" "), last = parts.pop(), prefix = parts.join(" ");
    const popular = new Map(index.popularKeywords.map((label, i) => [normalize(label), i]));
    return index.vocabulary.map((label) => {
      const candidate = normalize(label);
      if (!candidate || candidate === normalize(query) || !candidate.split(" ").some((word) => word.startsWith(last))) return null;
      const phrase = titleCase(prefix ? `${prefix} ${label}` : label);
      const results = rankRecords(index.items, phrase).length + rankRecords(index.pages, phrase).length;
      return results ? { phrase, results, popularity: popular.get(candidate) ?? Infinity, starts: candidate.startsWith(last) ? 0 : 1 } : null;
    }).filter(Boolean).sort((a, b) => a.starts - b.starts || b.results - a.results || a.popularity - b.popularity || a.phrase.localeCompare(b.phrase))
      .slice(0, limit).map((entry) => entry.phrase);
  }
  const api = Object.freeze({ normalize, tokens, titleCase, descriptionTerms, rankRecords, rankRelatedProducts, suggestions });
  global.PARADIGM_SEARCH_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
