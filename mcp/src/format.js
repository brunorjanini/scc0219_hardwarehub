/**
 * @file Shapes store records into what agents receive. Every product and
 * user that leaves the MCP server goes through these functions, so private
 * fields can never leak by accident.
 */
import { categoryLabel, formatSpecs, keySpecsText, stockStatus } from "./shared.js";

/**
 * Short product view used in lists.
 * @param {object} product Product from the API.
 */
export function summarizeProduct(product) {
  const status = stockStatus(product);
  return {
    id: String(product.id),
    name: product.name,
    type: product.type === "service" ? "service" : "product",
    category: product.category,
    categoryLabel: categoryLabel(product.category),
    brand: product.brand ?? null,
    price: Number(product.price) || 0,
    oldPrice: Number(product.oldPrice) > 0 ? Number(product.oldPrice) : null,
    stock: product.stock ?? null,
    available: status.available,
    stockLabel: status.label,
    keySpecs: keySpecsText(product),
  };
}

/**
 * Full product view: the summary plus description, sales and labeled specs.
 * @param {object} product Product from the API.
 */
export function describeProduct(product) {
  return {
    ...summarizeProduct(product),
    description: product.description ?? "",
    sold: Number(product.sold) || 0,
    specs: product.specs ?? {},
    specsLabeled: formatSpecs(product.specs).map(({ key, label, value }) => ({ key, label, value })),
  };
}

/**
 * Removes secrets from a user record. The store keeps passwords in plain
 * text (agreed with the instructor), so they must never reach an agent.
 * @param {object} user User from the API.
 */
export function sanitizeUser(user) {
  if (!user || typeof user !== "object") return user;
  // eslint-disable-next-line no-unused-vars -- the password is dropped on purpose
  const { password, ...safe } = user;
  return safe;
}
