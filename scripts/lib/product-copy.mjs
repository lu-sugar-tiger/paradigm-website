const FLEXIBLE_SPACE_PATTERN = "[\\p{White_Space}\\u180E\\u200B\\u2060\\uFEFF]";
const FLEXIBLE_SPACE_RUN = new RegExp(`${FLEXIBLE_SPACE_PATTERN}+`, "gu");
const FLEXIBLE_SPACE_ALL = new RegExp(FLEXIBLE_SPACE_PATTERN, "gu");

export function splitTableCells(line) {
  return String(line).split(FLEXIBLE_SPACE_RUN).filter(Boolean);
}

export function isFlexibleBlank(line) {
  return String(line).replace(FLEXIBLE_SPACE_ALL, "") === "";
}

function markerText(line) {
  return String(line).replace(FLEXIBLE_SPACE_ALL, "");
}

export function extractProductCopyLines(rawContent) {
  const lines = String(rawContent || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const firstBullet = lines.findIndex((line) => {
    const marker = markerText(line);
    return marker.startsWith("•") || marker.startsWith("●");
  });
  if (firstBullet < 0) {
    throw new Error("Product document has no bullet list");
  }

  let lastLine = lines.length - 1;
  while (lastLine > firstBullet && isFlexibleBlank(lines[lastLine])) lastLine -= 1;
  return lines.slice(firstBullet, lastLine + 1);
}

function detectTable(lines, start) {
  if (start > 0 && !isFlexibleBlank(lines[start - 1])) return null;

  const header = splitTableCells(lines[start]);
  if (header.length < 2) return null;

  const body = [];
  let cursor = start + 1;
  while (cursor < lines.length && !isFlexibleBlank(lines[cursor]) && markerText(lines[cursor]) !== "-") {
    const cells = splitTableCells(lines[cursor]);
    if (cells.length < header.length + 1 || cells.length > header.length + 2) break;
    body.push(cells);
    cursor += 1;
  }

  if (body.length < 2) return null;
  if (cursor < lines.length && !isFlexibleBlank(lines[cursor]) && markerText(lines[cursor]) !== "-") return null;

  const columnCount = Math.max(header.length + 1, ...body.map((row) => row.length));
  return {
    token: {
      type: "table",
      sourceLines: lines.slice(start, cursor),
      columnCount,
      header: ["", ...header, ...Array(columnCount - header.length - 1).fill("")],
      body: body.map((row) => [...row, ...Array(columnCount - row.length).fill("")])
    },
    next: cursor
  };
}

export function tokenizeProductCopy(rawContent) {
  const lines = extractProductCopyLines(rawContent);
  const tokens = [];

  for (let index = 0; index < lines.length;) {
    const table = detectTable(lines, index);
    if (table) {
      tokens.push(table.token);
      index = table.next;
      continue;
    }

    const line = lines[index];
    if (isFlexibleBlank(line)) {
      tokens.push({ type: "blank", text: line });
    } else if (markerText(line) === "-") {
      tokens.push({ type: "rule", text: line });
    } else {
      tokens.push({ type: "text", text: line });
    }
    index += 1;
  }

  return tokens;
}

export function transformProductCopy(rawContent) {
  return tokenizeProductCopy(rawContent).map((token) => {
    if (token.type === "blank") {
      return { type: "blank", text: `${token.text}\n` };
    }
    if (token.type === "rule") {
      return { type: "rule", text: "-" };
    }
    return token;
  });
}
