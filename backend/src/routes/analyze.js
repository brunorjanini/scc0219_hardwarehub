/**
 * @file AI analysis of a PC Builder build.
 *
 *   GET  /builds/analyze   { enabled }  -> lets the client show or hide the panel
 *   POST /builds/analyze   { parts: { cpu: "1", ... } } -> explanation and suggestions
 *
 * Optional: without ANTHROPIC_API_KEY the feature is off (GET says
 * enabled: false, POST answers 503) and the rest of the store is unaffected.
 * Mounted before the generic /builds CRUD router, so "analyze" is never
 * taken for a build id.
 */
const { Router } = require("express");
const { products } = require("../models");
const { httpError, wrap } = require("../errors");
const { SLOTS, analyzeBuild } = require("../ai/buildAnalysis");

/**
 * Creates the router.
 * @param {{ getClient?: () => object | null }} [options] `getClient` returns
 * the Anthropic client, or null when the feature is off (tests replace it).
 */
function createAnalyzeRouter({ getClient = defaultClient } = {}) {
  const router = Router();

  router.get("/", (req, res) => {
    res.json({ enabled: Boolean(getClient()) });
  });

  router.post(
    "/",
    wrap(async (req, res) => {
      const client = getClient();
      if (!client) throw httpError(503, "AI analysis is not configured on this server");

      const input = req.body?.parts;
      if (!input || typeof input !== "object" || Array.isArray(input)) throw httpError(400, "parts is required");
      const entries = Object.entries(input).filter(([, id]) => id);
      if (entries.some(([slot]) => !SLOTS.includes(slot))) throw httpError(400, `Unknown slot; use ${SLOTS.join(", ")}`);
      if (entries.length === 0) throw httpError(400, "Choose at least one part");

      // The chosen parts and every part the build could use
      const catalog = (await products.find({ category: { $in: SLOTS } })).map((doc) => doc.toJSON());
      const byId = new Map(catalog.map((p) => [String(p.id), p]));
      const parts = {};
      for (const [slot, id] of entries) {
        const product = byId.get(String(id));
        if (!product) throw httpError(404, `Product ${id} not found`);
        if (product.category !== slot) throw httpError(400, `Product ${id} is not a ${slot}`);
        parts[slot] = product;
      }

      try {
        res.json(await analyzeBuild({ client, parts, catalog }));
      } catch (err) {
        if (err.status) throw err;
        // Anthropic API errors (rate limit, overload, auth) become a 502
        console.error("AI analysis failed:", err.message);
        throw httpError(502, "The AI analysis is unavailable right now");
      }
    }),
  );

  return router;
}

let client;

/** Anthropic client when ANTHROPIC_API_KEY is set, otherwise null. */
function defaultClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    const Anthropic = require("@anthropic-ai/sdk");
    client = new (Anthropic.default ?? Anthropic)();
  }
  return client;
}

module.exports = { createAnalyzeRouter };
