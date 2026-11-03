import { describe, expect, it } from "vitest";
import seed from "../seed.json";
import { defaultBuildName, describeSavedBuild, slotList, toBuildRecord, validateBuildName } from "./savedBuilds";

const byId = Object.fromEntries(seed.products.map((p) => [p.id, p]));
const RYZEN_7 = byId["1"]; // 2499.9, stock 3
const B650M = byId["5"]; // 1299.9
const NOW = new Date(2026, 10, 3, 15, 0);

describe("build name", () => {
  it("suggests a name with the date", () => {
    expect(defaultBuildName(NOW)).toBe("Montagem de 3 de novembro");
  });

  it("requires a short name", () => {
    expect(validateBuildName("  ")).toBe("Dê um nome à montagem");
    expect(validateBuildName("x".repeat(61))).toBe("Use no máximo 60 caracteres");
    expect(validateBuildName(" PC gamer ")).toBe("");
  });
});

describe("toBuildRecord", () => {
  it("saves only product ids, the total of the day and the date", () => {
    expect(toBuildRecord({ userId: 1, name: " PC gamer ", parts: { motherboard: B650M, cpu: RYZEN_7 } }, NOW)).toEqual({
      userId: "1",
      name: "PC gamer",
      parts: { cpu: "1", motherboard: "5" },
      total: 3799.8,
      createdAt: NOW.toISOString(),
    });
  });
});

describe("describeSavedBuild", () => {
  const saved = { id: "b1", name: "PC", parts: { cpu: "1", motherboard: "5" }, total: 3799.8 };

  it("resolves the parts and compares the totals", () => {
    const info = describeSavedBuild(saved, byId);
    expect(info).toMatchObject({
      missing: [],
      unavailable: [],
      partCount: 2,
      complete: false,
      currentTotal: 3799.8,
      priceChange: 0,
    });
    expect(info.parts.cpu).toBe(RYZEN_7);
  });

  it("flags deleted and out-of-stock parts", () => {
    const catalog = { ...byId, 1: { ...RYZEN_7, stock: 0 } };
    delete catalog["5"];
    const info = describeSavedBuild(saved, catalog);
    expect(info.missing).toEqual(["motherboard"]);
    expect(info.unavailable).toEqual(["cpu"]);
    expect(info.partCount).toBe(1);
    // A part disappeared: the totals are not comparable
    expect(info.priceChange).toBe(0);
  });

  it("reports price changes", () => {
    const catalog = { ...byId, 1: { ...RYZEN_7, price: 2299.9 } };
    expect(describeSavedBuild(saved, catalog).priceChange).toBe(-200);
  });

  it("ignores invalid slots in old records", () => {
    const info = describeSavedBuild({ ...saved, parts: { cpu: "1", service: "27", gpu: null } }, byId);
    expect(Object.keys(info.parts)).toEqual(["cpu"]);
  });

  it("names slots in Portuguese", () => {
    expect(slotList(["motherboard", "psu"])).toBe("Placa-mãe e Fonte");
  });
});
