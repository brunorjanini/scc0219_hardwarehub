import { describe, expect, it } from "vitest";
import { formatSpecs } from "./specs";
import { formatPrice } from "./format";

// Intl uses a non-breaking space after "R$"
const normalize = (text) => text.replace(/\s/g, " ");

describe("formatPrice", () => {
  it("formats Brazilian reais", () => {
    expect(normalize(formatPrice(4299.9))).toBe("R$ 4.299,90");
    expect(normalize(formatPrice(0))).toBe("R$ 0,00");
  });
});

describe("formatSpecs", () => {
  it("labels and formats known specs in Portuguese", () => {
    expect(
      formatSpecs({ socket: "AM5", baseClockGhz: 4.2, tdp: 120, capacityGb: 2000, modular: true, supportedFormFactors: ["ATX", "mATX"] }),
    ).toEqual([
      { key: "socket", label: "Soquete", value: "AM5" },
      { key: "baseClockGhz", label: "Clock base", value: "4,2 GHz" },
      { key: "tdp", label: "Consumo (TDP)", value: "120 W" },
      { key: "capacityGb", label: "Capacidade", value: "2 TB" },
      { key: "modular", label: "Modular", value: "Sim" },
      { key: "supportedFormFactors", label: "Placas suportadas", value: "ATX, mATX" },
    ]);
  });

  it("keeps unknown specs and drops empty ones", () => {
    expect(formatSpecs({ rgb: "Sim", color: "", weight: null })).toEqual([
      { key: "rgb", label: "rgb", value: "Sim" },
    ]);
  });

  it("handles missing specs", () => {
    expect(formatSpecs(undefined)).toEqual([]);
    expect(formatSpecs(null)).toEqual([]);
  });
});
