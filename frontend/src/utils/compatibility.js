// PC Builder compatibility check (rule based).
// The final version may ask an AI model instead; the rest of the app only
// calls analyzeCompatibility(), so the rules can be swapped behind it.
//
// parts: { cpu, motherboard, ram, gpu, storage, psu, case }, each a product
// from /products (or null/undefined while the slot is empty).
//
// Returns {
//   status: "incomplete" | "ok" | "warning" | "error",
//   issues: [{ id, level: "error" | "warning", parts: [slot...], message }],
//   estimatedWatts, recommendedWatts, selectedCount, totalSlots
// }
// Errors are reported as soon as both parts of a rule are chosen, because
// adding more parts never fixes them. "error" wins over "incomplete";
// "incomplete" wins over "warning".
import { BUILDER_CATEGORIES } from "./categories";
import { formatNumber } from "./format";

// Power of everything besides CPU and GPU (board, RAM, drives, fans)
export const BASE_WATTS = 100;
// Extra capacity the PSU should have over the estimated draw
export const PSU_HEADROOM = 1.2;

// Only parts of the right category count (a GPU in the CPU slot is ignored)
function pick(parts, slot) {
  const product = parts?.[slot];
  return product && product.category === slot ? product : null;
}

const has = (value) => value !== undefined && value !== null && value !== "";

// CPU TDP + GPU TDP + 100 W, or 0 when neither is chosen
export function estimateWatts(parts) {
  const cpu = pick(parts, "cpu");
  const gpu = pick(parts, "gpu");
  if (!cpu && !gpu) return 0;
  return (Number(cpu?.specs?.tdp) || 0) + (Number(gpu?.specs?.tdp) || 0) + BASE_WATTS;
}

// 20% over the estimate, rounded up to the next 50 W (common PSU sizes)
export function recommendWatts(estimatedWatts) {
  if (!estimatedWatts) return 0;
  const withHeadroom = Math.round(estimatedWatts * PSU_HEADROOM * 100) / 100;
  return Math.ceil(withHeadroom / 50) * 50;
}

const watts = (value) => `${formatNumber(value)} W`;

function missingData(id, slots, what) {
  return {
    id,
    level: "warning",
    parts: slots,
    message: `Não foi possível verificar ${what}: faltam dados técnicos. Confira antes de comprar.`,
  };
}

export function analyzeCompatibility(parts = {}) {
  const cpu = pick(parts, "cpu");
  const board = pick(parts, "motherboard");
  const ram = pick(parts, "ram");
  const gpu = pick(parts, "gpu");
  const psu = pick(parts, "psu");
  const pcCase = pick(parts, "case");
  const issues = [];

  // CPU socket = motherboard socket
  if (cpu && board) {
    const a = cpu.specs?.socket;
    const b = board.specs?.socket;
    if (!has(a) || !has(b)) issues.push(missingData("socket", ["cpu", "motherboard"], "o soquete"));
    else if (a !== b) {
      issues.push({
        id: "socket",
        level: "error",
        parts: ["cpu", "motherboard"],
        message: `Soquete incompatível: o processador é ${a} e a placa-mãe é ${b}.`,
      });
    }
  }

  // RAM type supported by the motherboard
  if (ram && board) {
    const a = ram.specs?.memoryType;
    const b = board.specs?.memoryType;
    if (!has(a) || !has(b)) issues.push(missingData("memory", ["ram", "motherboard"], "o tipo de memória"));
    else if (a !== b) {
      issues.push({
        id: "memory",
        level: "error",
        parts: ["ram", "motherboard"],
        message: `Memória incompatível: a placa-mãe aceita ${b} e a memória é ${a}.`,
      });
    }
  }

  // Motherboard format fits the case
  if (board && pcCase) {
    const format = board.specs?.formFactor;
    const supported = pcCase.specs?.supportedFormFactors;
    if (!has(format) || !Array.isArray(supported)) {
      issues.push(missingData("formFactor", ["motherboard", "case"], "o formato da placa-mãe"));
    } else if (!supported.includes(format)) {
      issues.push({
        id: "formFactor",
        level: "error",
        parts: ["motherboard", "case"],
        message: `O gabinete não comporta placa-mãe ${format} (aceita ${supported.join(", ")}).`,
      });
    }
  }

  // GPU length within the case limit
  if (gpu && pcCase) {
    const length = gpu.specs?.lengthMm;
    const max = pcCase.specs?.maxGpuLengthMm;
    if (!has(length) || !has(max)) issues.push(missingData("gpuLength", ["gpu", "case"], "o tamanho da placa de vídeo"));
    else if (Number(length) > Number(max)) {
      issues.push({
        id: "gpuLength",
        level: "error",
        parts: ["gpu", "case"],
        message: `A placa de vídeo tem ${formatNumber(length)} mm e o gabinete aceita até ${formatNumber(max)} mm.`,
      });
    }
  }

  // PSU power: error below the estimate, warning below the recommendation.
  // Checked as soon as there is something to power: more parts only add.
  const estimatedWatts = estimateWatts(parts);
  const recommendedWatts = recommendWatts(estimatedWatts);
  if (psu && estimatedWatts > 0) {
    const power = psu.specs?.watts;
    if (!has(power)) issues.push(missingData("psuPower", ["psu"], "a potência da fonte"));
    else if (Number(power) < estimatedWatts) {
      issues.push({
        id: "psuPower",
        level: "error",
        parts: ["psu"],
        message: `Fonte insuficiente: ${watts(power)} para um consumo estimado de ${watts(estimatedWatts)}.`,
      });
    } else if (Number(power) < recommendedWatts) {
      issues.push({
        id: "psuMargin",
        level: "warning",
        parts: ["psu"],
        message: `Fonte no limite: ${watts(power)}. Recomendamos ${watts(recommendedWatts)} ou mais para ter folga.`,
      });
    }
  }

  // Errors first (sort is stable, so rule order is kept inside each level)
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));

  const selectedCount = BUILDER_CATEGORIES.filter((slot) => pick(parts, slot)).length;
  const totalSlots = BUILDER_CATEGORIES.length;

  let status;
  if (issues.some((issue) => issue.level === "error")) status = "error";
  else if (selectedCount < totalSlots) status = "incomplete";
  else if (issues.length > 0) status = "warning";
  else status = "ok";

  return { status, issues, estimatedWatts, recommendedWatts, selectedCount, totalSlots };
}
