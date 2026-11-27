/**
 * @file AI analysis of a PC Builder build (phase 5 of docs/plano-mcp.md).
 *
 * The store's rules still decide compatibility: `analyzeCompatibility` from
 * the React client gives the status and the issues. Claude only explains
 * them in plain language and suggests swaps, chosen from a list of
 * compatible, in-stock candidates that the server picks with `rankOptions`.
 * Any suggestion outside that list is dropped.
 *
 * Everything here is plain functions that receive the Anthropic client, so
 * tests can pass a fake one and never reach the network.
 */
const path = require("path");
const { pathToFileURL } = require("url");
const { z } = require("zod");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");

/** Model used for the analysis (see the claude-api guidance). */
const MODEL = "claude-opus-5-5";

/** Alternatives offered to the model per slot. */
const CANDIDATES_PER_SLOT = 3;

const SLOTS = ["cpu", "motherboard", "ram", "gpu", "storage", "psu", "case"];

const utilsDir = path.join(__dirname, "../../../frontend/src/utils");

let rulesPromise = null;

/**
 * Loads the Builder rules from the React client. They are ES modules, so
 * this CommonJS server imports them dynamically (once).
 * @returns {Promise<{ analyzeCompatibility: Function, rankOptions: Function, stockStatus: Function, categoryLabel: Function }>}
 */
function loadRules() {
  if (!rulesPromise) {
    const load = (file) => import(pathToFileURL(path.join(utilsDir, file)).href);
    rulesPromise = Promise.all([
      load("compatibility.js"),
      load("builder.js"),
      load("stock.js"),
      load("categories.js"),
    ]).then(([compatibility, builder, stock, categories]) => ({
      analyzeCompatibility: compatibility.analyzeCompatibility,
      rankOptions: builder.rankOptions,
      stockStatus: stock.stockStatus,
      categoryLabel: categories.categoryLabel,
    }));
  }
  return rulesPromise;
}

/** What Claude must answer (validated by the API and again by the SDK). */
const AnalysisSchema = z.object({
  summary: z.string().describe("Resumo de 2 a 4 frases sobre a montagem, em português do Brasil"),
  issues: z
    .array(
      z.object({
        slot: z.enum(SLOTS),
        explanation: z.string().describe("Explicação simples de um problema apontado pelas regras"),
      }),
    )
    .describe("Uma explicação por problema das regras; vazio se não houver problemas"),
  suggestions: z
    .array(
      z.object({
        slot: z.enum(SLOTS),
        productId: z.string().describe("Id de uma peça da lista de candidatas desta posição"),
        reason: z.string().describe("Por que essa troca ajuda, em uma ou duas frases"),
      }),
    )
    .describe("Trocas ou peças para posições vazias, só da lista de candidatas; no máximo uma por posição"),
});

const SYSTEM_PROMPT = `Você é o assistente do Montador de PC da HardwareHub, uma loja brasileira de hardware.
Você recebe uma montagem, o resultado das regras de compatibilidade da loja e uma lista de peças candidatas.

- As regras da loja são a fonte da verdade: não contradiga o status nem os problemas que elas apontam,
  e não invente problemas novos.
- Explique cada problema em linguagem simples para quem não entende de hardware.
- Sugira trocas apenas com peças da lista de candidatas, usando o id exato, no máximo uma por posição.
  Para posições vazias, você pode sugerir uma candidata para completar a montagem.
- Considere preço e equilíbrio da montagem. Se não houver nada útil a sugerir, deixe a lista vazia.
- Escreva em português do Brasil, de forma curta e direta. Preços em reais.`;

/** Product fields the model needs. */
const brief = (p) => ({
  id: String(p.id),
  name: p.name,
  brand: p.brand ?? null,
  price: p.price,
  stock: p.stock ?? null,
  specs: p.specs ?? {},
});

/**
 * Compatible, in-stock alternatives for the slots that have issues or are
 * empty, best first (the Builder's own ranking).
 * @param {object} rules From `loadRules`.
 * @param {Record<string, object>} parts Chosen product per slot.
 * @param {object[]} catalog Products of the builder categories.
 * @param {object} result `analyzeCompatibility(parts)`.
 * @returns {Record<string, object[]>} Candidates per slot.
 */
function pickCandidates(rules, parts, catalog, result) {
  const troubled = new Set(result.issues.flatMap((issue) => issue.parts));
  const slots = SLOTS.filter((slot) => !parts[slot] || troubled.has(slot));
  const candidates = {};
  for (const slot of slots) {
    const options = rules
      .rankOptions(catalog, parts, slot)
      .filter((o) => o.available && o.check.level !== "error" && String(o.product.id) !== String(parts[slot]?.id))
      .slice(0, CANDIDATES_PER_SLOT)
      .map((o) => o.product);
    if (options.length) candidates[slot] = options;
  }
  return candidates;
}

/**
 * The user message: build, rule result and candidates as JSON.
 * @returns {string}
 */
function buildPrompt(rules, parts, result, candidates) {
  const data = {
    build: Object.fromEntries(
      SLOTS.map((slot) => [slot, parts[slot] ? { label: rules.categoryLabel(slot), ...brief(parts[slot]) } : null]),
    ),
    rules: {
      status: result.status,
      issues: result.issues.map(({ id, level, parts: slots, message }) => ({ id, level, slots, message })),
      estimatedWatts: result.estimatedWatts,
      recommendedWatts: result.recommendedWatts,
    },
    candidates: Object.fromEntries(Object.entries(candidates).map(([slot, list]) => [slot, list.map(brief)])),
  };
  return `Analise esta montagem.\n\n${JSON.stringify(data, null, 2)}`;
}

/**
 * Keeps only what the model may say: one explanation per slot that has a
 * rule issue, and suggestions from the candidate list (one per slot).
 * Product names and prices come from the catalog, never from the model.
 */
function sanitize(parsed, result, candidates) {
  const troubled = new Set(result.issues.flatMap((issue) => issue.parts));
  const seen = new Set();
  const suggestions = [];
  for (const s of parsed.suggestions ?? []) {
    const product = candidates[s.slot]?.find((p) => String(p.id) === String(s.productId));
    if (!product || seen.has(s.slot)) continue;
    seen.add(s.slot);
    suggestions.push({ slot: s.slot, productId: String(product.id), name: product.name, price: product.price, reason: s.reason });
  }
  return {
    summary: parsed.summary,
    issues: (parsed.issues ?? []).filter((i) => troubled.has(i.slot)),
    suggestions,
  };
}

/** Error with an HTTP status, for the route. */
const failure = (status, message) => Object.assign(new Error(message), { status });

/**
 * Runs the analysis.
 * @param {{ client: object, parts: Record<string, object>, catalog: object[], rules?: object }} input
 * `client` is an Anthropic client (or a fake with `beta.messages.parse`).
 * @returns {Promise<{ status: string, issues: object[], analysis: object, model: string }>}
 */
async function analyzeBuild({ client, parts, catalog, rules }) {
  const r = rules ?? (await loadRules());
  const result = r.analyzeCompatibility(parts);
  const candidates = pickCandidates(r, parts, catalog, result);

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // Thinking is always on in this model; effort controls its depth
    output_config: { effort: "medium", format: zodOutputFormat(AnalysisSchema) },
    // On a safety decline, the API retries on Anthropic's recommended model
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildPrompt(r, parts, result, candidates) }],
  });

  if (response.stop_reason === "refusal") throw failure(502, "The AI declined to analyze this build");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw failure(502, "The AI analysis came back incomplete");
  }

  return {
    status: result.status,
    issues: result.issues.map(({ id, level, parts: slots, message }) => ({ id, level, slots, message })),
    analysis: sanitize(response.parsed_output, result, candidates),
    model: response.model,
  };
}

module.exports = {
  MODEL,
  SLOTS,
  AnalysisSchema,
  SYSTEM_PROMPT,
  loadRules,
  pickCandidates,
  buildPrompt,
  sanitize,
  analyzeBuild,
};
