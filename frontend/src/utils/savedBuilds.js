// Saved PC builds (/builds): the record saved from the builder and how a
// saved build compares with today's catalog (parts deleted, out of stock,
// price changes).
import { BUILDER_CATEGORIES, categoryLabel } from "./categories";
import { buildTotal, cleanSelection, resolveParts } from "./builder";
import { stockStatus } from "./stock";

export const BUILD_NAME_MAX = 60;

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

// "Montagem de 3 de novembro"
export function defaultBuildName(now = new Date()) {
  return `Montagem de ${dayMonth.format(now)}`;
}

export function validateBuildName(name = "") {
  const value = name.trim();
  if (!value) return "Dê um nome à montagem";
  if (value.length > BUILD_NAME_MAX) return `Use no máximo ${BUILD_NAME_MAX} caracteres`;
  return "";
}

// Record for POST /builds. `parts` are products; only their ids are
// saved, so the build always shows today's prices and stock. `total` is
// the price on the day it was saved, to show price changes later.
export function toBuildRecord({ userId, name, parts }, now = new Date()) {
  const ids = {};
  for (const slot of BUILDER_CATEGORIES) {
    if (parts[slot]) ids[slot] = String(parts[slot].id);
  }
  return {
    userId: String(userId),
    name: name.trim(),
    parts: ids,
    total: Math.round(buildTotal(parts) * 100) / 100,
    createdAt: now.toISOString(),
  };
}

// A saved build against the current catalog (products by id):
// { parts, missing, unavailable, partCount, complete, currentTotal, savedTotal, priceChange }
// `missing` and `unavailable` are slot lists; `priceChange` is today's
// total minus the saved one (0 when equal).
export function describeSavedBuild(build, productsById) {
  const selection = cleanSelection(build.parts);
  const { parts, missing } = resolveParts(selection, productsById);
  const unavailable = BUILDER_CATEGORIES.filter((slot) => parts[slot] && !stockStatus(parts[slot]).available);
  const currentTotal = Math.round(buildTotal(parts) * 100) / 100;
  const savedTotal = Number(build.total) || 0;
  const partCount = Object.keys(parts).length;

  return {
    parts,
    missing,
    unavailable,
    partCount,
    complete: partCount === BUILDER_CATEGORIES.length,
    currentTotal,
    savedTotal,
    // Only meaningful when no part disappeared
    priceChange: missing.length ? 0 : Math.round((currentTotal - savedTotal) * 100) / 100,
  };
}

// "Placa-mãe e Fonte"
const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });
export const slotList = (slots) => listFormat.format(slots.map(categoryLabel));
