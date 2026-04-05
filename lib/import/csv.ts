export type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (isQuoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (char === "," && !isQuoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvText(source: string): CsvParseResult {
  const lines = source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerLine, ...rowLines] = lines;
  const headers = parseCsvLine(headerLine);
  const rows = rowLines.map((line) => parseCsvLine(line));

  return { headers, rows };
}
