/**
 * @file HTTP server entry point: wires middleware, routes and the database.
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connect } = require("./db");
const models = require("./models");
const { crud } = require("./crud");
const checkout = require("./routes/checkout");
const { errorHandler } = require("./errors");

const app = express();
app.use(cors({ exposedHeaders: ["X-Total-Count"] }));
app.use(express.json());

// GET / - health check that also lists the available resources.
app.get("/", (req, res) => {
  res.json({ name: "HardwareHub API", resources: [...Object.keys(models), "checkout"] });
});

app.use("/checkout", checkout);

/**
 * Guard for user deletion: the default "admin" account must always exist
 * (assignment requirement).
 * @param {{ username?: string }} user User about to be deleted.
 * @returns {string | null} Reason to block the deletion, or null to allow it.
 */
const protectDefaultAdmin = (user) =>
  user.username === "admin" ? "The default admin account cannot be deleted" : null;

// One CRUD router per model, mounted at /<resource>.
for (const [name, Model] of Object.entries(models)) {
  const options = {
    name,
    models,
    ...(name === "users" ? { beforeDelete: protectDefaultAdmin } : {}),
  };
  app.use(`/${name}`, crud(Model, options));
}

// Fallback for unknown routes (must come after every router).
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

const port = process.env.PORT || 3000;

/**
 * Connects to MongoDB and then starts accepting HTTP requests.
 * Exits the process with code 1 if the database is unreachable.
 * @returns {Promise<void>}
 */
async function start() {
  try {
    await connect();
    // Listen only after the database is ready.
    app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}

start();
