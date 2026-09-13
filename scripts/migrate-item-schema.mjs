import { readFile, writeFile } from "node:fs/promises";
import { migrateItemCatalog } from "./lib/item-schema.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => !["--write", "--check"].includes(arg)) || args.length > 1) {
  throw new Error("Usage: node scripts/migrate-item-schema.mjs [--check | --write]");
}
const file = new URL("../data/products-source.json", import.meta.url);
const source = JSON.parse(await readFile(file, "utf8"));
const migrated = migrateItemCatalog(source);
if (args.includes("--write") && source.schemaVersion !== migrated.schemaVersion) {
  await writeFile(file, `${JSON.stringify(migrated, null, 2)}\n`);
  console.log(`Migrated ${migrated.items.length} items to schema ${migrated.schemaVersion}.`);
} else {
  console.log(`${migrated.items.length} items valid; schema ${source.schemaVersion} -> ${migrated.schemaVersion}${source.schemaVersion === migrated.schemaVersion ? " (current)" : " (dry run; use --write)"}.`);
  if (args.includes("--check") && source.schemaVersion !== migrated.schemaVersion) process.exitCode = 1;
}
