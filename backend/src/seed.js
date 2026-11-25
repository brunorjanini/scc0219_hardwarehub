/**
 * @file Seeds MongoDB with the frontend's initial data (frontend/src/seed.json,
 * the clean version). Usage: npm run seed [path/to/other.json]
 * WARNING: it wipes the current contents of every collection first.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connect } = require("./db");
const models = require("./models");

/**
 * Reads the seed file and replaces each collection with its rows, mapping
 * the JSON `id` field to MongoDB's `_id`.
 * @returns {Promise<void>}
 */
async function main() {
  const file = path.resolve(
    process.argv[2] || path.join(__dirname, "..", "..", "frontend", "src", "seed.json"),
  );
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`Reading ${file}`);

  await connect();
  for (const [name, Model] of Object.entries(models)) {
    const rows = (data[name] || []).map(({ id, ...rest }) => ({ _id: id, ...rest }));
    await Model.deleteMany({});
    await Model.insertMany(rows);
    console.log(`  ${name}: ${rows.length} documents`);
  }
  await mongoose.disconnect();
  console.log("Seed finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
