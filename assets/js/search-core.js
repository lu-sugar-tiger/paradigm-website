(function (global) {
  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function tokens(value) {
    return [...new Set(normalize(value).split(" ").filter(Boolean))];
  }

  function titleCase(value) {
    const acronyms = new Set(["aw", "pe", "prdm", "ss"]);
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((word) => {
        const lower = word.toLowerCase();
        if (acronyms.has(lower)) return lower.toUpperCase();
        return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
      })
      .join(" ");
  }

  function scoreRecord(record, query) {
    const normalizedQuery = normalize(query);
    const queryTokens = tokens(query);
    if (!normalizedQuery || queryTokens.length === 0) return null;

    const fields = (record.searchTerms || []).map(normalize).filter(Boolean);
    const combined = fields.join(" ");
    if (!queryTokens.every((token) => combined.includes(token))) return null;

    let score = 100;
    if (fields.includes(normalizedQuery)) score = 400;
    else if (fields.some((field) => field.startsWith(normalizedQuery))) score = 300;
    else if (fields.some((field) => field.split(" ").includes(normalizedQuery))) score = 200;

    queryTokens.forEach((token) => {
      if (fields.includes(token)) score += 40;
      else if (fields.some((field) => field.split(" ").some((word) => word.startsWith(token)))) score += 30;
      else score += 10;
    });
    return score;
  }

  function rankRecords(records, query) {
    return records
      .map((record, index) => ({ record, index, score: scoreRecord(record, query) }))
      .filter((entry) => entry.score !== null)
      .sort((left, right) => (
        right.score - left.score
        || left.index - right.index
        || String(left.record.title).localeCompare(String(right.record.title))
      ))
      .map((entry) => entry.record);
  }

  function suggestions(index, query, limit = 5) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return index.popularKeywords.map(titleCase);

    const lastToken = tokens(query).at(-1) || normalizedQuery;
    const popularRank = new Map(index.popularKeywords.map((label, position) => [normalize(label), position]));
    return index.vocabulary
      .map((label) => {
        const candidate = normalize(label);
        let matchRank = null;
        if (!candidate || candidate === normalizedQuery || candidate === lastToken) return null;
        if (candidate.startsWith(normalizedQuery)) matchRank = 0;
        else if (candidate.split(" ").some((word) => word.startsWith(lastToken))) matchRank = 1;
        else if (candidate.includes(normalizedQuery) || candidate.includes(lastToken)) matchRank = 2;
        if (matchRank === null) return null;
        return {
          label,
          matchRank,
          popularRank: popularRank.get(candidate) ?? Number.MAX_SAFE_INTEGER
        };
      })
      .filter(Boolean)
      .sort((left, right) => (
        left.matchRank - right.matchRank
        || left.popularRank - right.popularRank
        || left.label.localeCompare(right.label)
      ))
      .slice(0, limit)
      .map((entry) => titleCase(entry.label));
  }

  global.PARADIGM_SEARCH_CORE = Object.freeze({ normalize, tokens, titleCase, scoreRecord, rankRecords, suggestions });
})(globalThis);
