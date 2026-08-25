const FLEXIBLE_SPACE_PATTERN = "[\\p{White_Space}\\u180E\\u200B\\u2060\\uFEFF]";
const FLEXIBLE_SPACE_RUN = new RegExp(`${FLEXIBLE_SPACE_PATTERN}+`, "gu");
const FLEXIBLE_SPACE_ALL = new RegExp(FLEXIBLE_SPACE_PATTERN, "gu");

export function normalizeDescriptionSource(source, label = "Description source") {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error(`${label} must be an object.`);
  }
  if (!['local', 'google-doc'].includes(source.type)) {
    throw new Error(`${label} type must be local or google-doc.`);
  }
  if (typeof source.content !== "string" || source.content.length === 0) {
    throw new Error(`${label} content must be a non-empty string.`);
  }

  if (source.type === "google-doc") {
    if (typeof source.documentId !== "string" || source.documentId.length === 0) {
      throw new Error(`${label} requires a documentId.`);
    }
    if (typeof source.modifiedTime !== "string" || source.modifiedTime.length === 0) {
      throw new Error(`${label} requires a modifiedTime.`);
    }
    return {
      type: source.type,
      content: source.content,
      documentId: source.documentId,
      modifiedTime: source.modifiedTime
    };
  }

  return { type: source.type, content: source.content };
}

export function splitDescriptionTableCells(line) {
  return String(line).split(FLEXIBLE_SPACE_RUN).filter(Boolean);
}

export function isFlexibleBlank(line) {
  return String(line).replace(FLEXIBLE_SPACE_ALL, "") === "";
}

function markerText(line) {
  return String(line).replace(FLEXIBLE_SPACE_ALL, "");
}

export function extractDescriptionLines(rawContent) {
  const lines = String(rawContent || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const firstBullet = lines.findIndex((line) => {
    const marker = markerText(line);
    return marker.startsWith("•") || marker.startsWith("●");
  });
  if (firstBullet < 0) {
    throw new Error("Description source has no bullet list");
  }

  let lastLine = lines.length - 1;
  while (lastLine > firstBullet && isFlexibleBlank(lines[lastLine])) lastLine -= 1;
  return lines.slice(firstBullet, lastLine + 1);
}

function detectTable(lines, start) {
  if (start > 0 && !isFlexibleBlank(lines[start - 1])) return null;

  const header = splitDescriptionTableCells(lines[start]);
  if (header.length < 2) return null;

  const body = [];
  let cursor = start + 1;
  while (cursor < lines.length && !isFlexibleBlank(lines[cursor]) && markerText(lines[cursor]) !== "-") {
    const cells = splitDescriptionTableCells(lines[cursor]);
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

export function tokenizeDescription(rawContent) {
  const lines = extractDescriptionLines(rawContent);
  const tokens = [];

  for (let index = 0; index < lines.length;) {
    const table = detectTable(lines, index);
    if (table) {
      tokens.push(table.token);
      index = table.next;
      continue;
    }

    const line = lines[index];
    const marker = markerText(line);
    if (isFlexibleBlank(line)) {
      tokens.push({ type: "blank", text: line });
    } else if (marker === "-") {
      tokens.push({ type: "divider", text: line });
    } else if (marker.startsWith("#")) {
      tokens.push({ type: "hashtag", text: line });
    } else {
      tokens.push({ type: "text", text: line });
    }
    index += 1;
  }

  return tokens;
}

export function transformDescription(rawContent) {
  return tokenizeDescription(rawContent).map((token) => {
    if (token.type === "blank") {
      return { type: "blank", text: `${token.text}\n` };
    }
    if (token.type === "divider") {
      return { type: "divider", text: "-" };
    }
    return token;
  });
}
