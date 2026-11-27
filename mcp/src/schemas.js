/**
 * @file Zod schemas shared by several tools. They describe what agents send
 * and receive, and the SDK validates both sides against them.
 */
import * as z from "zod/v4";
import { BUILDER_CATEGORIES } from "./shared.js";

/** Product view returned in lists (see `summarizeProduct`). */
export const ProductSummary = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["product", "service"]),
  category: z.string(),
  categoryLabel: z.string(),
  brand: z.string().nullable(),
  price: z.number(),
  oldPrice: z.number().nullable(),
  stock: z.number().nullable().describe("Unidades em estoque; null para serviços"),
  available: z.boolean(),
  stockLabel: z.string(),
  keySpecs: z.string().describe("Especificações principais em texto"),
});

/** Full product view (see `describeProduct`). */
export const ProductDetails = ProductSummary.extend({
  description: z.string(),
  sold: z.number(),
  specs: z.record(z.string(), z.unknown()),
  specsLabeled: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
});

/** One of the seven PC Builder slots. */
export const BuilderSlot = z.enum(BUILDER_CATEGORIES);

/** A build: product id per slot, every slot optional. */
export const BuildParts = z
  .object(Object.fromEntries(BUILDER_CATEGORIES.map((slot) => [slot, z.string().min(1).optional()])))
  .strict()
  .describe(`Id do produto escolhido em cada posição (${BUILDER_CATEGORIES.join(", ")}); todas opcionais`);

/** Annotations of every tool that only reads store data. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
