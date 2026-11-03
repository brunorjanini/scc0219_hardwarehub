import { describe, expect, it } from "vitest";
import seed from "../seed.json";
import {
  BUILDER_STORAGE_KEY,
  checkOption,
  cleanSelection,
  keySpecsText,
  loadSelection,
  rankOptions,
  resolveParts,
  saveSelection,
  statusMessage,
} from "./builder";

const byName = (name) => seed.products.find((p) => p.name === name);
const byId = Object.fromEntries(seed.products.map((p) => [p.id, p]));
const RYZEN_7 = byName("AMD Ryzen 7 7800X3D"); // AM5
const B650M = byName("ASUS TUF Gaming B650M-Plus"); // AM5, mATX, DDR5

describe("selection storage", () => {
  it("keeps only builder slots with an id", () => {
    expect(cleanSelection({ cpu: 1, motherboard: "5", service: "27", gpu: null, ram: {} })).toEqual({
      cpu: "1",
      motherboard: "5",
    });
    expect(cleanSelection("x")).toEqual({});
  });

  it("saves and loads the selection", () => {
    saveSelection({ cpu: "1", peripheral: "29" });
    expect(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))).toEqual({ cpu: "1" });
    expect(loadSelection()).toEqual({ cpu: "1" });
  });

  it("starts empty with missing or corrupted data", () => {
    expect(loadSelection()).toEqual({});
    localStorage.setItem(BUILDER_STORAGE_KEY, "{oops");
    expect(loadSelection()).toEqual({});
  });
});

describe("resolveParts", () => {
  it("turns ids into products and reports the ones that are gone", () => {
    const { parts, missing } = resolveParts({ cpu: RYZEN_7.id, gpu: "nao-existe", ram: RYZEN_7.id }, byId);
    expect(parts).toEqual({ cpu: RYZEN_7 });
    // A missing id and a product in the wrong slot are both dropped
    expect(missing).toEqual(["gpu", "ram"]);
  });
});

describe("keySpecsText", () => {
  it("shows the specs that matter for compatibility", () => {
    expect(keySpecsText(RYZEN_7)).toBe("Soquete: AM5 · Núcleos: 8 · Consumo (TDP): 120 W");
    expect(keySpecsText(B650M)).toBe("Soquete: AM5 · Formato: mATX · Tipo de memória: DDR5");
  });
});

describe("picker options", () => {
  it("checks a candidate against the chosen parts", () => {
    const lga = byName("ASRock B760M Pro RS");
    expect(checkOption({ cpu: RYZEN_7 }, "motherboard", B650M)).toEqual({ level: "ok", messages: [] });
    expect(checkOption({ cpu: RYZEN_7 }, "motherboard", lga)).toEqual({
      level: "error",
      messages: ["Soquete incompatível: o processador é AM5 e a placa-mãe é LGA1700."],
    });
  });

  it("only counts issues of the slot being chosen", () => {
    const ddr4 = byName("MSI B550M Pro-VDH"); // AM4 board
    const ram = seed.products.find((p) => p.category === "ram" && p.specs.memoryType === "DDR5");
    // The CPU/board conflict exists, but choosing RAM is judged on RAM only
    expect(checkOption({ cpu: RYZEN_7, motherboard: ddr4 }, "ram", ram).messages).toEqual([
      "Memória incompatível: a placa-mãe aceita DDR4 e a memória é DDR5.",
    ]);
  });

  it("ranks compatible, then available, then cheaper options first", () => {
    const ranked = rankOptions(seed.products, { cpu: RYZEN_7 }, "motherboard");
    const levels = ranked.map((o) => o.check.level);
    // Two AM5 boards first, then the AM4 and LGA1700 ones
    expect(levels).toEqual(["ok", "ok", "error", "error"]);
    expect(ranked[0].product.name).toBe(B650M.name);
    expect(ranked.every((o) => o.product.category === "motherboard")).toBe(true);
    // The out-of-stock LGA1700 board goes after the available AM4 one
    expect(ranked.at(-1).product.name).toBe("ASRock B760M Pro RS");
  });
});

describe("statusMessage", () => {
  const base = { issues: [], estimatedWatts: 0, recommendedWatts: 0, selectedCount: 0, totalSlots: 7 };
  const warning = { id: "psuMargin", level: "warning", parts: ["psu"], message: "..." };
  const error = { id: "socket", level: "error", parts: ["cpu", "motherboard"], message: "..." };

  it.each([
    [{ status: "incomplete" }, "Comece escolhendo as peças", "Validamos a compatibilidade a cada escolha."],
    [{ status: "incomplete", selectedCount: 6 }, "Peças compatíveis até agora", "Falta 1 componente."],
    [
      { status: "incomplete", selectedCount: 3, estimatedWatts: 440, recommendedWatts: 550, issues: [warning] },
      "Peças compatíveis até agora, com avisos",
      "Faltam 4 componentes. Consumo estimado: 440 W · Fonte recomendada: 550 W.",
    ],
    [{ status: "error", selectedCount: 2, issues: [error] }, "Há peças incompatíveis", /^1 problema para resolver/],
    [{ status: "error", issues: [error, error, warning] }, "Há peças incompatíveis", /^2 problemas/],
    [
      { status: "warning", selectedCount: 7, estimatedWatts: 545, recommendedWatts: 700, issues: [warning] },
      "Configuração compatível, com avisos",
      "Consumo estimado: 545 W · Fonte recomendada: 700 W.",
    ],
    [
      { status: "ok", selectedCount: 7, estimatedWatts: 440, recommendedWatts: 550 },
      "Configuração compatível",
      "Consumo estimado: 440 W · Fonte recomendada: 550 W.",
    ],
  ])("%j", (changes, title, detail) => {
    const message = statusMessage({ ...base, ...changes });
    expect(message.title).toBe(title);
    expect(message.detail).toMatch(detail);
  });
});
