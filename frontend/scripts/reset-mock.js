// Restores the mock database (src/mockAPI.json) from the pristine seed
// (src/seed.json). json-server writes every POST/PATCH/DELETE into
// mockAPI.json, so run `npm run mock:reset` before demos and reviews.
//
// The file is rewritten with a plain read + write instead of copyFile:
// on Windows copyFile locks the target exclusively, and a running
// json-server would fail to reload it (EBUSY) and keep stale data.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const seed = fileURLToPath(new URL("../src/seed.json", import.meta.url));
const db = fileURLToPath(new URL("../src/mockAPI.json", import.meta.url));

writeFileSync(db, readFileSync(seed, "utf8"), "utf8");
console.log("mockAPI.json restaurado a partir de seed.json");
