/**
 * @file MongoDB connection.
 */
const mongoose = require("mongoose");

/**
 * Connects Mongoose to the database given by MONGODB_URI
 * (defaults to a local instance).
 * @returns {Promise<void>} Resolves once the connection is open.
 */
async function connect() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/hardwarehub";
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = { connect };
