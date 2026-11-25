/**
 * @file Shared error helpers: an HTTP error factory, an async route wrapper
 * and the Express error-handling middleware.
 */

/**
 * Creates an Error that carries an HTTP status code.
 * @param {number} status HTTP status sent to the client.
 * @param {string} message Message returned in the JSON body.
 * @returns {Error & { status: number }}
 */
const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Wraps an async route handler so rejected promises reach the error
 * middleware (Express 4 does not catch them on its own).
 * @param {import("express").RequestHandler} fn Async route handler.
 * @returns {import("express").RequestHandler}
 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Express error-handling middleware. Known errors keep their status;
 * validation and cast errors become 400, duplicate keys 409, and anything
 * unexpected is logged and answered with a generic 500.
 * @type {import("express").ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars -- Express needs all four arguments to treat this as an error handler.
function errorHandler(err, req, res, next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate record", fields: err.keyValue });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = { httpError, wrap, errorHandler };
