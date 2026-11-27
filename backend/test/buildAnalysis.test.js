/**
 * @file Tests of the AI build analysis with a fake Anthropic client: no
 * network, no API key, no database. Run with `npm test`.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const seed = require("../../frontend/src/seed.json");
const { MODEL, SLOTS, analyzeBuild, loadRules, pickCandidates } = require("../src/ai/buildAnalysis");

const catalog = seed.products.filter((p) => SLOTS.includes(p.category));
const byId = (id) => catalog.find((p) => p.id === id);
const partsOf = (ids) => Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, byId(id)]));

/** Fake client: records the request and answers with `parsed_output`. */
function fakeClient(parsed, extra = {}) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        async parse(params) {
          calls.push(params);
          return { stop_reason: "end_turn", parsed_output: parsed, model: MODEL, ...extra };
        },
      },
    },
  };
}

// Intel Core i5-14600K (LGA1700) on an AM5 board: a socket error
const SOCKET_ERROR = { cpu: "4", motherboard: "5" };

describe("pickCandidates", () => {
  test("offers compatible, in-stock parts for troubled and empty slots", async () => {
    const rules = await loadRules();
    const parts = partsOf(SOCKET_ERROR);
    const result = rules.analyzeCompatibility(parts);
    const candidates = pickCandidates(rules, parts, catalog, result);

    // The only LGA1700 board (ASRock B760M) is out of stock: no board candidate
    assert.equal(candidates.motherboard, undefined);
    // CPUs compatible with the AM5 board, cheapest first, never the current one
    assert.deepEqual(candidates.cpu.map((p) => p.id), ["2", "1"]);
    // Empty slots get up to 3 options each
    for (const slot of ["ram", "gpu", "storage", "psu", "case"]) {
      assert.ok(candidates[slot].length > 0 && candidates[slot].length <= 3, slot);
      assert.ok(candidates[slot].every((p) => p.stock > 0), slot);
    }
  });
});

describe("analyzeBuild", () => {
  test("sends the build, the rule result and the candidates in one structured call", async () => {
    const client = fakeClient({ summary: "Resumo.", issues: [], suggestions: [] });
    await analyzeBuild({ client, parts: partsOf(SOCKET_ERROR), catalog });

    assert.equal(client.calls.length, 1);
    const params = client.calls[0];
    assert.equal(params.model, "claude-opus-5-5");
    assert.equal(params.output_config.effort, "medium");
    assert.equal(params.output_config.format.type, "json_schema");
    assert.deepEqual(params.betas, ["server-side-fallback-2026-07-01"]);
    assert.equal(params.fallbacks, "default");
    assert.equal(params.thinking, undefined);

    const data = JSON.parse(params.messages[0].content.slice(params.messages[0].content.indexOf("{")));
    assert.equal(data.rules.status, "error");
    assert.equal(data.rules.issues[0].id, "socket");
    assert.equal(data.build.cpu.id, "4");
    assert.equal(data.build.ram, null);
    assert.deepEqual(Object.keys(data.candidates).sort(), ["case", "cpu", "gpu", "psu", "ram", "storage"]);
  });

  test("keeps the rules' status and drops anything outside the candidates", async () => {
    const client = fakeClient({
      summary: "O processador não encaixa na placa-mãe.",
      issues: [
        { slot: "cpu", explanation: "O soquete LGA1700 não entra numa placa AM5." },
        { slot: "gpu", explanation: "Problema inventado." },
      ],
      suggestions: [
        { slot: "cpu", productId: "2", reason: "Ryzen 5 7600 é AM5 e mais barato." },
        { slot: "cpu", productId: "1", reason: "Segunda sugestão para a mesma posição." },
        { slot: "case", productId: "13", reason: "Uma placa de vídeo não é candidata a gabinete." },
        { slot: "motherboard", productId: "8", reason: "Sem estoque." },
        { slot: "ram", productId: "999", reason: "Não existe." },
      ],
    });
    const out = await analyzeBuild({ client, parts: partsOf(SOCKET_ERROR), catalog });

    assert.equal(out.status, "error");
    assert.equal(out.issues[0].id, "socket");
    assert.deepEqual(out.analysis.issues.map((i) => i.slot), ["cpu"]);
    assert.deepEqual(out.analysis.suggestions, [
      { slot: "cpu", productId: "2", name: "AMD Ryzen 5 7600", price: 1199.9, reason: "Ryzen 5 7600 é AM5 e mais barato." },
    ]);
    assert.equal(out.model, MODEL);
  });

  test("reports a refusal or an incomplete answer as a 502", async () => {
    const parts = partsOf(SOCKET_ERROR);
    await assert.rejects(
      analyzeBuild({ client: fakeClient(null, { stop_reason: "refusal" }), parts, catalog }),
      (err) => err.status === 502 && /declined/.test(err.message),
    );
    await assert.rejects(
      analyzeBuild({ client: fakeClient(null, { stop_reason: "max_tokens" }), parts, catalog }),
      (err) => err.status === 502 && /incomplete/.test(err.message),
    );
  });

  test("asks for no candidates when a complete build has no issues", async () => {
    const client = fakeClient({ summary: "Tudo certo.", issues: [], suggestions: [] });
    const parts = partsOf({ cpu: "2", motherboard: "5", ram: "10", gpu: "14", storage: "17", psu: "20", case: "22" });
    const out = await analyzeBuild({ client, parts, catalog });
    const data = JSON.parse(client.calls[0].messages[0].content.slice(client.calls[0].messages[0].content.indexOf("{")));
    assert.equal(out.status, "ok");
    assert.deepEqual(data.candidates, {});
  });
});
