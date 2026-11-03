// PC Builder helpers: which product is in each slot (kept in
// localStorage, so the build survives a refresh or a visit to another
// page), the specs shown in the picker, and how each option fits the
// parts already chosen.
import { BUILDER_CATEGORIES } from "./categories";
import { analyzeCompatibility } from "./compatibility";
import { formatNumber } from "./format";
import { formatSpecs } from "./specs";
import { stockStatus } from "./stock";

export const BUILDER_STORAGE_KEY = "hardwarehub:builder";

// id of the "Escolher/Trocar" button of a slot (focus returns to it)
export const toggleId = (slot) => `builder-toggle-${slot}`;

// Text of an empty slot
export const SLOT_PLACEHOLDERS = {
  cpu: "Escolha um processador",
  motherboard: "Escolha uma placa-mãe",
  ram: "Escolha a memória RAM",
  gpu: "Escolha uma placa de vídeo",
  storage: "Escolha um SSD ou HD",
  psu: "Escolha uma fonte",
  case: "Escolha um gabinete",
};

// Specs that matter for compatibility, shown under each option
const KEY_SPECS = {
  cpu: ["socket", "cores", "tdp"],
  motherboard: ["socket", "formFactor", "memoryType"],
  ram: ["memoryType", "capacityGb", "speedMhz"],
  gpu: ["vramGb", "lengthMm", "tdp"],
  storage: ["storageType", "capacityGb"],
  psu: ["watts", "efficiency"],
  case: ["supportedFormFactors", "maxGpuLengthMm"],
};

// "Soquete: AM5 · Núcleos: 8 · Consumo (TDP): 120 W"
export function keySpecsText(product) {
  const keys = KEY_SPECS[product.category] ?? [];
  const specs = Object.fromEntries(keys.filter((k) => product.specs?.[k] !== undefined).map((k) => [k, product.specs[k]]));
  return formatSpecs(specs)
    .map((spec) => `${spec.label}: ${spec.value}`)
    .join(" · ");
}

// ---- Selection: { cpu: "1", motherboard: "5", ... } ----

// Keeps only builder slots with a string/number id
export function cleanSelection(value) {
  const selection = {};
  if (!value || typeof value !== "object") return selection;
  for (const slot of BUILDER_CATEGORIES) {
    const id = value[slot];
    if (typeof id === "string" || typeof id === "number") selection[slot] = String(id);
  }
  return selection;
}

export function loadSelection() {
  try {
    return cleanSelection(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY)));
  } catch {
    // Corrupted data: start an empty build
    return {};
  }
}

export function saveSelection(selection) {
  localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(cleanSelection(selection)));
}

// Selection + products by id -> { parts, missing }. `missing` lists the
// slots whose product no longer exists (deleted, or moved to another
// category by an admin); those slots are left empty.
export function resolveParts(selection, productsById) {
  const parts = {};
  const missing = [];
  for (const [slot, id] of Object.entries(selection)) {
    const product = productsById[id];
    if (product && product.category === slot) parts[slot] = product;
    else missing.push(slot);
  }
  return { parts, missing };
}

// ---- Picker options ----

const LEVEL_ORDER = { ok: 0, warning: 1, error: 2 };

// How `candidate` would fit in `slot` with the other chosen parts:
// { level: "ok" | "warning" | "error", messages: [...] }. Only issues
// that involve this slot count.
export function checkOption(parts, slot, candidate) {
  const { issues } = analyzeCompatibility({ ...parts, [slot]: candidate });
  const mine = issues.filter((issue) => issue.parts.includes(slot));
  const level = mine.some((i) => i.level === "error") ? "error" : mine.length > 0 ? "warning" : "ok";
  return { level, messages: mine.map((i) => i.message) };
}

// Options of a slot with their check, best first: compatible, then
// available, then cheapest.
export function rankOptions(products, parts, slot) {
  return products
    .filter((product) => product.category === slot)
    .map((product) => ({
      product,
      check: checkOption(parts, slot, product),
      available: stockStatus(product).available,
    }))
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.check.level] - LEVEL_ORDER[b.check.level] ||
        Number(b.available) - Number(a.available) ||
        a.product.price - b.product.price,
    );
}

// ---- Status banner ----

// Title and detail of the banner for an analyzeCompatibility() result
export function statusMessage(result) {
  const { status, issues, estimatedWatts, recommendedWatts, selectedCount, totalSlots } = result;
  const power = estimatedWatts
    ? `Consumo estimado: ${formatNumber(estimatedWatts)} W · Fonte recomendada: ${formatNumber(recommendedWatts)} W.`
    : "";
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;
  const left = totalSlots - selectedCount;

  if (status === "error") {
    return {
      title: "Há peças incompatíveis",
      detail: `${errors === 1 ? "1 problema" : `${errors} problemas`} para resolver. Veja os avisos nas peças marcadas.`,
    };
  }
  if (status === "incomplete") {
    if (selectedCount === 0) {
      return { title: "Comece escolhendo as peças", detail: "Validamos a compatibilidade a cada escolha." };
    }
    const missing = left === 1 ? "Falta 1 componente." : `Faltam ${left} componentes.`;
    return {
      title: warnings ? "Peças compatíveis até agora, com avisos" : "Peças compatíveis até agora",
      detail: [missing, power].filter(Boolean).join(" "),
    };
  }
  if (status === "warning") {
    return { title: "Configuração compatível, com avisos", detail: power };
  }
  return { title: "Configuração compatível", detail: power };
}
