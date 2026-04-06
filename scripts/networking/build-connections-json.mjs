import { promises as fs } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const defaultInput = path.join(cwd, "data/networking/connections.csv");
const defaultOutput = path.join(cwd, "data/networking/connections.json");

const inputPath = path.resolve(process.argv[2] ?? defaultInput);
const outputPath = path.resolve(process.argv[3] ?? defaultOutput);

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        const next = source[index + 1];
        if (next === '"') {
          field += '"';
          index += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }

      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const normalizeCell = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const main = async () => {
  const csvText = await fs.readFile(inputPath, "utf8");
  const parsedRows = parseCsv(csvText);
  if (parsedRows.length === 0) {
    throw new Error("connections_csv_empty");
  }

  const headers = parsedRows[0].map((value) => normalizeCell(value).toLowerCase());
  const nameIndex = headers.indexOf("name");
  const headlineIndex = headers.indexOf("headline");
  const urlIndex = headers.indexOf("url");

  if (nameIndex === -1 || headlineIndex === -1 || urlIndex === -1) {
    throw new Error("connections_csv_missing_required_columns:name,headline,url");
  }

  const connections = parsedRows
    .slice(1)
    .map((cells) => {
      const name = normalizeCell(cells[nameIndex] ?? "");
      const headline = normalizeCell(cells[headlineIndex] ?? "");
      const url = normalizeCell(cells[urlIndex] ?? "");

      return { name, headline, url };
    })
    .filter((row) => row.name.length > 0 && row.url.length > 0)
    .filter((row) => /^https?:\/\//i.test(row.url));

  const payload = {
    generated_at: new Date().toISOString(),
    source_csv: path.relative(cwd, inputPath),
    total_connections: connections.length,
    connections,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Generated ${connections.length} connections -> ${path.relative(cwd, outputPath)}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
