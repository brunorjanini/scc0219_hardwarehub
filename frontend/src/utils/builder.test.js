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
  addBlockReason,
  buildCartEntries,
  buildTotal,
} from "./builder";
import { analyzeCompatibility } from "./compatibility";

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

describe("summary and add to cart", () => {
  // Complete compatible build from the seed: 120 + 220 + 100 = 440 W, PSU 650 W
  const BUILD = {
    cpu: RYZEN_7,
    motherboard: B650M,
    ram: byName("Kingston Fury Beast 32GB (2x16) DDR5 6000MHz"),
    gpu: byName("GeForce RTX 4070 SUPER 12GB"),
    storage: byName("Samsung 990 Pro 2TB NVMe"),
    psu: byName("Corsair CX650 650W 80 Plus Bronze"),
    case: byName("NZXT H5 Flow"),
  };
  const ASSEMBLY = byName("Montagem de PC");
  const reason = (parts, options) => addBlockReason(analyzeCompatibility(parts), parts, options);

  it("lists one unit of each part in slot order, plus the assembly", () => {
    expect(buildCartEntries({ gpu: BUILD.gpu, cpu: RYZEN_7 })).toEqual([
      { product: RYZEN_7, quantity: 1 },
      { product: BUILD.gpu, quantity: 1 },
    ]);
    expect(buildCartEntries(BUILD, ASSEMBLY)).toHaveLength(8);
    expect(buildCartEntries(BUILD, ASSEMBLY).at(-1)).toEqual({ product: ASSEMBLY, quantity: 1 });
  });

  it("adds up the prices", () => {
    const parts = Object.values(BUILD).reduce((sum, p) => sum + p.price, 0);
    expect(buildTotal(BUILD)).toBeCloseTo(parts);
    expect(buildTotal(BUILD, ASSEMBLY)).toBeCloseTo(parts + ASSEMBLY.price);
    expect(buildTotal({})).toBe(0);
  });

  it("allows a complete compatible build in stock", () => {
    expect(reason(BUILD)).toBe("");
  });

  it("allows warnings but not errors", () => {
    // RTX 4080 SUPER: 125 + 320 + 100 = 545 W, 650 W PSU is tight (warning)
    const tight = {
      ...BUILD,
      cpu: byName("Intel Core i5-14600K"),
      motherboard: { ...byName("ASRock B760M Pro RS"), stock: 2 },
      gpu: byName("ASUS TUF GeForce RTX 4080 SUPER 16GB"),
    };
    expect(analyzeCompatibility(tight).status).toBe("warning");
    expect(reason(tight)).toBe("");

    expect(reason({ ...BUILD, cpu: byName("Intel Core i5-14600K") })).toBe("Resolva as incompatibilidades para continuar.");
  });

  it("names the missing slots", () => {
    const partial = { ...BUILD, storage: null, psu: null };
    expect(reason(partial)).toBe("Escolha também: Armazenamento e Fonte.");
    expect(reason({})).toMatch(/^Escolha também: Processador, Placa-mãe, .* e Gabinete\.$/);
  });

  it("names the parts without stock", () => {
    const outOfStock = { ...BUILD, storage: { ...BUILD.storage, stock: 0 } };
    expect(reason(outOfStock)).toBe("Sem estoque: Samsung 990 Pro 2TB NVMe. Troque essa peça para continuar.");
  });

  it("tells administrators they cannot buy", () => {
    expect(reason(BUILD, { isAdmin: true })).toMatch(/^Administradores não fazem compras/);
  });
});
