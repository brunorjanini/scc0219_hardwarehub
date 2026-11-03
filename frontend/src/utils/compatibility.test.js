import { describe, expect, it } from "vitest";
import seed from "../seed.json";
import { analyzeCompatibility, estimateWatts, recommendWatts } from "./compatibility";

// Minimal parts: only the fields the rules read
const part = (category, specs, extra = {}) => ({ id: `${category}-${JSON.stringify(specs)}`, category, specs, ...extra });

const CPU_AM5 = part("cpu", { socket: "AM5", tdp: 120 });
const CPU_LGA = part("cpu", { socket: "LGA1700", tdp: 125 });
const BOARD_AM5_DDR5_MATX = part("motherboard", { socket: "AM5", memoryType: "DDR5", formFactor: "mATX" });
const BOARD_LGA_DDR5_ATX = part("motherboard", { socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX" });
const RAM_DDR5 = part("ram", { memoryType: "DDR5", capacityGb: 32 });
const RAM_DDR4 = part("ram", { memoryType: "DDR4", capacityGb: 16 });
const GPU_261 = part("gpu", { lengthMm: 261, tdp: 220 });
const GPU_348 = part("gpu", { lengthMm: 348, tdp: 320 });
const SSD = part("storage", { storageType: "NVMe", capacityGb: 1000 });
const PSU_550 = part("psu", { watts: 550 });
const PSU_650 = part("psu", { watts: 650 });
const PSU_850 = part("psu", { watts: 850 });
const CASE_FULL = part("case", { supportedFormFactors: ["ATX", "mATX", "ITX"], maxGpuLengthMm: 392 });
const CASE_SMALL = part("case", { supportedFormFactors: ["mATX", "ITX"], maxGpuLengthMm: 330 });

// A complete, compatible build: 120 + 220 + 100 = 440 W, recommended 550 W
const VALID = {
  cpu: CPU_AM5,
  motherboard: BOARD_AM5_DDR5_MATX,
  ram: RAM_DDR5,
  gpu: GPU_261,
  storage: SSD,
  psu: PSU_650,
  case: CASE_FULL,
};

const ids = (result) => result.issues.map((issue) => `${issue.level}:${issue.id}`);

describe("estimateWatts / recommendWatts", () => {
  it("adds CPU and GPU TDP plus 100 W for the rest", () => {
    expect(estimateWatts(VALID)).toBe(440);
    expect(estimateWatts({ cpu: CPU_AM5 })).toBe(220);
    expect(estimateWatts({})).toBe(0);
  });

  it("recommends 20% headroom rounded up to 50 W", () => {
    expect(recommendWatts(440)).toBe(550); // 528 -> 550
    expect(recommendWatts(545)).toBe(700); // 654 -> 700
    expect(recommendWatts(500)).toBe(600); // exactly 600
    expect(recommendWatts(0)).toBe(0);
  });
});

describe("analyzeCompatibility", () => {
  it("reports an empty build as incomplete", () => {
    expect(analyzeCompatibility({})).toEqual({
      status: "incomplete",
      issues: [],
      estimatedWatts: 0,
      recommendedWatts: 0,
      selectedCount: 0,
      totalSlots: 7,
    });
  });

  it("accepts a complete compatible build", () => {
    const result = analyzeCompatibility(VALID);
    expect(result).toMatchObject({ status: "ok", issues: [], estimatedWatts: 440, recommendedWatts: 550, selectedCount: 7 });
  });

  it("stays incomplete, without issues, while compatible parts are missing", () => {
    const result = analyzeCompatibility({ cpu: CPU_AM5, motherboard: BOARD_AM5_DDR5_MATX });
    expect(result.status).toBe("incomplete");
    expect(result.issues).toEqual([]);
    expect(result.selectedCount).toBe(2);
  });

  it("flags a CPU socket that differs from the motherboard (even when incomplete)", () => {
    const result = analyzeCompatibility({ cpu: CPU_AM5, motherboard: BOARD_LGA_DDR5_ATX });
    expect(result.status).toBe("error");
    expect(result.issues).toEqual([
      {
        id: "socket",
        level: "error",
        parts: ["cpu", "motherboard"],
        message: "Soquete incompatível: o processador é AM5 e a placa-mãe é LGA1700.",
      },
    ]);
  });

  it("flags RAM of a type the motherboard does not support", () => {
    const result = analyzeCompatibility({ ...VALID, ram: RAM_DDR4 });
    expect(result.status).toBe("error");
    expect(ids(result)).toEqual(["error:memory"]);
    expect(result.issues[0].parts).toEqual(["ram", "motherboard"]);
    expect(result.issues[0].message).toBe("Memória incompatível: a placa-mãe aceita DDR5 e a memória é DDR4.");
  });

  it("flags a motherboard format the case does not fit", () => {
    const result = analyzeCompatibility({ ...VALID, cpu: CPU_LGA, motherboard: BOARD_LGA_DDR5_ATX, case: CASE_SMALL });
    expect(ids(result)).toEqual(["error:formFactor"]);
    expect(result.issues[0].parts).toEqual(["motherboard", "case"]);
    expect(result.issues[0].message).toBe("O gabinete não comporta placa-mãe ATX (aceita mATX, ITX).");
  });

  it("flags a GPU longer than the case allows", () => {
    const result = analyzeCompatibility({ ...VALID, gpu: GPU_348, psu: PSU_850, case: CASE_SMALL });
    expect(ids(result)).toEqual(["error:gpuLength"]);
    expect(result.issues[0].parts).toEqual(["gpu", "case"]);
    expect(result.issues[0].message).toBe("A placa de vídeo tem 348 mm e o gabinete aceita até 330 mm.");
  });

  it("accepts a GPU exactly as long as the case limit", () => {
    const exact = part("case", { supportedFormFactors: ["mATX"], maxGpuLengthMm: 261 });
    expect(analyzeCompatibility({ ...VALID, case: exact }).status).toBe("ok");
  });

  it("flags a PSU below the estimated draw", () => {
    // 125 + 320 + 100 = 545 W > 500 W
    const psu500 = part("psu", { watts: 500 });
    const result = analyzeCompatibility({ ...VALID, cpu: CPU_LGA, motherboard: BOARD_LGA_DDR5_ATX, gpu: GPU_348, psu: psu500 });
    expect(ids(result)).toEqual(["error:psuPower"]);
    expect(result.issues[0].parts).toEqual(["psu"]);
    expect(result.issues[0].message).toBe("Fonte insuficiente: 500 W para um consumo estimado de 545 W.");
    expect(result.status).toBe("error");
  });

  it("warns when the PSU has less than the recommended headroom", () => {
    // 545 W estimated -> 700 W recommended; 650 W is enough but tight
    const result = analyzeCompatibility({ ...VALID, cpu: CPU_LGA, motherboard: BOARD_LGA_DDR5_ATX, gpu: GPU_348, psu: PSU_650 });
    expect(result.status).toBe("warning");
    expect(ids(result)).toEqual(["warning:psuMargin"]);
    expect(result.issues[0].message).toBe("Fonte no limite: 650 W. Recomendamos 700 W ou mais para ter folga.");
  });

  it("accepts a PSU exactly at the recommended power", () => {
    expect(analyzeCompatibility({ ...VALID, psu: PSU_550 }).status).toBe("ok");
  });

  it("checks the PSU as soon as there is something to power", () => {
    const tiny = part("psu", { watts: 200 });
    const result = analyzeCompatibility({ cpu: CPU_AM5, psu: tiny });
    // 120 + 100 = 220 W: already too much, and adding parts only makes it worse
    expect(result.status).toBe("error");
    expect(ids(result)).toEqual(["error:psuPower"]);
  });

  it("lists every problem at once, errors first", () => {
    const result = analyzeCompatibility({
      cpu: CPU_LGA,
      motherboard: BOARD_AM5_DDR5_MATX,
      ram: RAM_DDR4,
      gpu: GPU_348,
      storage: SSD,
      psu: PSU_650,
      case: CASE_SMALL,
    });
    expect(ids(result)).toEqual(["error:socket", "error:memory", "error:gpuLength", "warning:psuMargin"]);
    expect(result.status).toBe("error");
  });

  it("an incomplete build with only a warning stays incomplete", () => {
    const result = analyzeCompatibility({ cpu: CPU_LGA, gpu: GPU_348, psu: PSU_650 });
    expect(result.status).toBe("incomplete");
    expect(ids(result)).toEqual(["warning:psuMargin"]);
  });

  it("warns instead of guessing when technical data is missing", () => {
    const noSocket = part("motherboard", { memoryType: "DDR5", formFactor: "mATX" });
    const result = analyzeCompatibility({ ...VALID, motherboard: noSocket });
    expect(result.status).toBe("warning");
    expect(ids(result)).toEqual(["warning:socket"]);
    expect(result.issues[0].message).toBe("Não foi possível verificar o soquete: faltam dados técnicos. Confira antes de comprar.");
  });

  it("ignores a part placed in the wrong slot", () => {
    const result = analyzeCompatibility({ cpu: GPU_261 });
    expect(result.selectedCount).toBe(0);
  });

  it("finds the incompatible pairs present in the seed catalog", () => {
    const byName = (name) => seed.products.find((p) => p.name === name);
    const result = analyzeCompatibility({
      cpu: byName("AMD Ryzen 7 7800X3D"),
      motherboard: byName("ASRock B760M Pro RS"),
    });
    expect(ids(result)).toEqual(["error:socket"]);
  });
});
