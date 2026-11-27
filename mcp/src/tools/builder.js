/**
 * @file PC Builder tools. They run the store's own rule engine
 * (`analyzeCompatibility` and `rankOptions` from the React client), so an
 * agent and the Builder page always agree on what is compatible.
 */
import * as z from "zod/v4";
import { readPage } from "../api.js";
import { ToolError } from "../errors.js";
import { summarizeProduct } from "../format.js";
import { BuildParts, BuilderSlot, ProductSummary, READ_ONLY } from "../schemas.js";
import {
  BUILDER_CATEGORIES,
  analyzeCompatibility,
  categoryLabel,
  rankOptions,
  statusMessage,
  stockStatus,
} from "../shared.js";
import { fetchProduct } from "./catalog.js";

/** Most options `suggest_parts` returns at once. */
export const MAX_SUGGESTIONS = 10;

/**
 * Fetches the products of a build and checks each one fits its slot.
 * @param {ReturnType<import("../api.js").createApi>} api
 * @param {Record<string, string | undefined>} parts Product id per slot.
 * @returns {Promise<Record<string, object>>} Product per filled slot.
 */
export async function loadParts(api, parts = {}) {
  const entries = Object.entries(parts).filter(([, id]) => id);
  const products = await Promise.all(entries.map(([, id]) => fetchProduct(api, id)));
  const result = {};
  entries.forEach(([slot, id], index) => {
    const product = products[index];
    if (product.category !== slot) {
      throw new ToolError(
        `O produto "${product.name}" (id ${id}) é da categoria ${categoryLabel(product.category)} ` +
          `e não pode ocupar a posição ${categoryLabel(slot)}.`,
      );
    }
    result[slot] = product;
  });
  return result;
}

const Issue = z.object({
  id: z.string().describe("Regra: socket, memory, formFactor, gpuLength, psuPower ou psuMargin"),
  level: z.enum(["error", "warning"]),
  slots: z.array(z.string()),
  message: z.string(),
});

export const checkBuild = {
  name: "check_build",
  title: "Verificar montagem",
  description:
    "Check a PC build with the store's compatibility rules (CPU/motherboard socket, memory type, " +
    "form factor, GPU length, PSU power and headroom). Returns the overall status, every issue, " +
    "estimated power draw, recommended PSU, total price and parts that are out of stock. " +
    "Errors block adding the build to the cart in the store; warnings do not.",
  inputSchema: z.object({ parts: BuildParts }),
  outputSchema: z.object({
    status: z.enum(["incomplete", "ok", "warning", "error"]),
    title: z.string(),
    detail: z.string(),
    issues: z.array(Issue),
    estimatedWatts: z.number(),
    recommendedWatts: z.number(),
    selectedCount: z.number(),
    totalSlots: z.number(),
    missingSlots: z.array(z.string()),
    unavailableSlots: z.array(z.string()).describe("Posições com peça sem estoque"),
    total: z.number().describe("Soma dos preços das peças escolhidas, em reais"),
    parts: z.array(z.object({ slot: z.string(), slotLabel: z.string(), product: ProductSummary })),
  }),
  annotations: READ_ONLY,
  async handler({ api }, { parts }) {
    const products = await loadParts(api, parts);
    const result = analyzeCompatibility(products);
    const message = statusMessage(result);
    const chosen = BUILDER_CATEGORIES.filter((slot) => products[slot]);
    return {
      status: result.status,
      title: message.title,
      detail: message.detail,
      issues: result.issues.map(({ id, level, parts: slots, message: text }) => ({ id, level, slots, message: text })),
      estimatedWatts: result.estimatedWatts,
      recommendedWatts: result.recommendedWatts,
      selectedCount: result.selectedCount,
      totalSlots: result.totalSlots,
      missingSlots: BUILDER_CATEGORIES.filter((slot) => !products[slot]),
      unavailableSlots: chosen.filter((slot) => !stockStatus(products[slot]).available),
      total: Math.round(chosen.reduce((sum, slot) => sum + (Number(products[slot].price) || 0), 0) * 100) / 100,
      parts: chosen.map((slot) => ({
        slot,
        slotLabel: categoryLabel(slot),
        product: summarizeProduct(products[slot]),
      })),
    };
  },
};

export const suggestParts = {
  name: "suggest_parts",
  title: "Sugerir peças",
  description:
    "Suggest products for one PC Builder slot, ranked like the store's Builder: compatible with the parts " +
    "already chosen first, then available, then cheapest. Each option says why it is incompatible, if it is.",
  inputSchema: z.object({
    slot: BuilderSlot.describe("Posição a preencher"),
    parts: BuildParts.optional().describe("Peças já escolhidas, para verificar a compatibilidade"),
    maxPrice: z.number().min(0).optional().describe("Preço máximo da peça, em reais"),
    includeUnavailable: z.boolean().optional().describe("Incluir peças sem estoque (padrão: não)"),
    limit: z.number().int().min(1).max(MAX_SUGGESTIONS).optional().describe(`Quantas opções (padrão 5, máximo ${MAX_SUGGESTIONS})`),
  }),
  outputSchema: z.object({
    slot: z.string(),
    slotLabel: z.string(),
    candidates: z.number().describe("Quantos produtos da categoria atendem ao filtro de preço"),
    compatibleOutOfStock: z
      .number()
      .describe("Opções compatíveis omitidas por estarem sem estoque (use includeUnavailable para vê-las)"),
    options: z.array(
      z.object({
        compatibility: z.enum(["ok", "warning", "error"]),
        messages: z.array(z.string()),
        product: ProductSummary,
      }),
    ),
  }),
  annotations: READ_ONLY,
  async handler({ api }, { slot, parts = {}, maxPrice, includeUnavailable = false, limit = 5 }) {
    // The slot being filled is replaced by each candidate, so it is not loaded
    const { [slot]: _replaced, ...others } = parts;
    const [current, listing] = await Promise.all([
      loadParts(api, others),
      api.get("/products", { category: slot, "price:lte": maxPrice, _sort: "price" }),
    ]);
    const products = readPage(listing).data;
    const all = rankOptions(products, current, slot);
    const ranked = all.filter((option) => includeUnavailable || option.available);
    const compatibleOutOfStock = includeUnavailable
      ? 0
      : all.filter((option) => !option.available && option.check.level !== "error").length;
    return {
      slot,
      slotLabel: categoryLabel(slot),
      candidates: products.length,
      compatibleOutOfStock,
      options: ranked.slice(0, limit).map((option) => ({
        compatibility: option.check.level,
        messages: option.check.messages,
        product: summarizeProduct(option.product),
      })),
    };
  },
};

export const builderTools = [checkBuild, suggestParts];
