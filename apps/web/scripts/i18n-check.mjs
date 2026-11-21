import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "i18n");
const en = JSON.parse(readFileSync(join(root, "en.json"), "utf8"));
const am = JSON.parse(readFileSync(join(root, "am.json"), "utf8"));
const missing = Object.keys(en).filter((key) => !(key in am));
const extra = Object.keys(am).filter((key) => !(key in en));
if (missing.length || extra.length) {
  if (missing.length) console.log("Missing in am.json:\n" + missing.join("\n"));
  if (extra.length) console.log("Extra in am.json:\n" + extra.join("\n"));
  process.exit(1);
}
console.log("i18n keys match");
