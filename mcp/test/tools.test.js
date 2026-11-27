import { describe, expect, it } from "vitest";
import { ToolError } from "../src/errors.js";
import { checkBuild, suggestParts } from "../src/tools/builder.js";
import { getProduct, listBrands, listCategories, searchProducts } from "../src/tools/catalog.js";
import { createFakeApi } from "./fakeApi.js";

// A compatible build from the seed: Ryzen 5 7600 (AM5), B650M (AM5, mATX,
// DDR5), DDR5 RAM, RX 7600, 990 Pro, CX650 and Lancool 216.
const VALID_BUILD = { cpu: "2", motherboard: "5", ram: "10", gpu: "14", storage: "17", psu: "20", case: "22" };

describe("search_products", () => {
  it("combines category, brand, price and stock filters", async () => {
    const api = createFakeApi();
    const result = await searchProducts.handler({ api }, { category: "gpu", brand: "NVIDIA", maxPrice: 5000, inStock: true });
    expect(result.products.map((p) => p.name)).toEqual(["GeForce RTX 4070 SUPER 12GB"]);
    expect(result).toMatchObject({ page: 1, perPage: 10, total: 1, pages: 1 });
    expect(api.calls[0].params).toMatchObject({
      category: "gpu",
      brand: "NVIDIA",
      "price:lte": 5000,
      "stock:ne": 0,
      _sort: "-sold",
      _page: 1,
      _per_page: 10,
    });
  });

  it("searches by name, sorts and paginates", async () => {
    const result = await searchProducts.handler({ api: createFakeApi() }, { query: "ryzen", sort: "price", perPage: 2, page: 2 });
    expect(result.products.map((p) => p.name)).toEqual(["AMD Ryzen 7 7800X3D"]);
    expect(result).toMatchObject({ total: 3, pages: 2, page: 2 });
  });

  it("summarizes each product without internal fields", async () => {
    const [product] = (await searchProducts.handler({ api: createFakeApi() }, { query: "7800X3D" })).products;
    expect(product).toEqual({
      id: "1",
      name: "AMD Ryzen 7 7800X3D",
      type: "product",
      category: "cpu",
      categoryLabel: "Processador",
      brand: "AMD",
      price: 2499.9,
      oldPrice: null,
      stock: 3,
      available: true,
      stockLabel: "Últimas unidades",
      keySpecs: "Soquete: AM5 · Núcleos: 8 · Consumo (TDP): 120 W",
    });
  });

  it("rejects a minimum price above the maximum", async () => {
    await expect(searchProducts.handler({ api: createFakeApi() }, { minPrice: 10, maxPrice: 5 })).rejects.toThrow(ToolError);
  });

  it("only sends the filters that were given", async () => {
    const api = createFakeApi();
    await searchProducts.handler({ api }, {});
    expect(api.calls[0].params).toMatchObject({ "stock:ne": undefined, category: undefined, "name:contains": undefined });
  });
});

describe("get_product", () => {
  it("returns details with labeled specs", async () => {
    const product = await getProduct.handler({ api: createFakeApi() }, { id: "13" });
    expect(product).toMatchObject({ id: "13", sold: expect.any(Number), description: expect.any(String) });
    expect(product.specsLabeled).toContainEqual({ key: "lengthMm", label: "Comprimento", value: "261 mm" });
  });

  it("reports an unknown id as a tool error", async () => {
    await expect(getProduct.handler({ api: createFakeApi() }, { id: "999" })).rejects.toThrow('Produto "999" não encontrado.');
  });

  it("marks services as always available", async () => {
    const service = await getProduct.handler({ api: createFakeApi() }, { id: "27" });
    expect(service).toMatchObject({ type: "service", stock: null, available: true, stockLabel: "Sob agendamento" });
  });
});

describe("list_categories and list_brands", () => {
  it("lists the seven builder slots and their required specs", async () => {
    const { categories } = await listCategories.handler();
    expect(categories.filter((c) => c.builderSlot).map((c) => c.slug)).toEqual([
      "cpu", "motherboard", "ram", "gpu", "storage", "psu", "case",
    ]);
    const cpu = categories.find((c) => c.slug === "cpu");
    expect(cpu.specFields.filter((f) => f.required).map((f) => f.key)).toEqual(["socket", "cores", "tdp"]);
  });

  it("counts brands of one category in alphabetical order", async () => {
    const { brands } = await listBrands.handler({ api: createFakeApi() }, { category: "cpu" });
    expect(brands).toEqual([
      { brand: "AMD", count: 3 },
      { brand: "Intel", count: 1 },
    ]);
  });
});

describe("check_build", () => {
  it("accepts a complete compatible build", async () => {
    const result = await checkBuild.handler({ api: createFakeApi() }, { parts: VALID_BUILD });
    expect(result).toMatchObject({
      status: "ok",
      title: "Configuração compatível",
      issues: [],
      estimatedWatts: 330,
      recommendedWatts: 400,
      selectedCount: 7,
      missingSlots: [],
      unavailableSlots: [],
      total: 7249.3,
    });
    expect(result.parts.map((p) => p.slot)).toEqual(["cpu", "motherboard", "ram", "gpu", "storage", "psu", "case"]);
  });

  it("flags an AM5 board with an LGA1700 processor", async () => {
    const result = await checkBuild.handler({ api: createFakeApi() }, { parts: { cpu: "4", motherboard: "5" } });
    expect(result.status).toBe("error");
    expect(result.issues).toEqual([
      {
        id: "socket",
        level: "error",
        slots: ["cpu", "motherboard"],
        message: "Soquete incompatível: o processador é LGA1700 e a placa-mãe é AM5.",
      },
    ]);
    expect(result.missingSlots).toEqual(["ram", "gpu", "storage", "psu", "case"]);
  });

  it("applies the memory, form factor and GPU length rules", async () => {
    const result = await checkBuild.handler({ api: createFakeApi() }, {
      parts: { motherboard: "6", ram: "11", gpu: "15", case: "24" },
    });
    expect(result.issues.map((i) => i.id).sort()).toEqual(["formFactor", "gpuLength", "memory"]);
  });

  it("warns when the PSU has no headroom", async () => {
    // RTX 4080 (320 W) + Ryzen 7 7800X3D (120 W) + 100 W = 540 W; 550 W is enough but below the 650 W recommendation
    const result = await checkBuild.handler({ api: createFakeApi() }, { parts: { cpu: "1", gpu: "15", psu: "19" } });
    expect(result).toMatchObject({ estimatedWatts: 540, recommendedWatts: 650 });
    expect(result.issues).toEqual([expect.objectContaining({ id: "psuMargin", level: "warning" })]);
  });

  it("lists parts that are out of stock", async () => {
    const result = await checkBuild.handler({ api: createFakeApi() }, { parts: { motherboard: "8" } });
    expect(result.unavailableSlots).toEqual(["motherboard"]);
  });

  it("refuses a product in the wrong slot", async () => {
    await expect(checkBuild.handler({ api: createFakeApi() }, { parts: { cpu: "13" } })).rejects.toThrow(
      "não pode ocupar a posição Processador",
    );
  });

  it("refuses an unknown product", async () => {
    await expect(checkBuild.handler({ api: createFakeApi() }, { parts: { cpu: "999" } })).rejects.toThrow(ToolError);
  });
});

describe("suggest_parts", () => {
  it("ranks compatible parts first, then the cheapest", async () => {
    const result = await suggestParts.handler({ api: createFakeApi() }, { slot: "motherboard", parts: { cpu: "2" } });
    expect(result.options.map((o) => [o.product.id, o.compatibility])).toEqual([
      ["5", "ok"],
      ["6", "ok"],
      ["7", "error"],
    ]);
    expect(result.options[2].messages).toEqual(["Soquete incompatível: o processador é AM5 e a placa-mãe é AM4."]);
  });

  it("hides out-of-stock parts but counts the compatible ones", async () => {
    const result = await suggestParts.handler({ api: createFakeApi() }, { slot: "motherboard", parts: { cpu: "4" } });
    expect(result.options.every((o) => o.compatibility === "error")).toBe(true);
    expect(result.compatibleOutOfStock).toBe(1);

    const all = await suggestParts.handler({ api: createFakeApi() }, { slot: "motherboard", parts: { cpu: "4" }, includeUnavailable: true });
    expect(all.options[0]).toMatchObject({ compatibility: "ok", product: { id: "8", available: false } });
    expect(all.compatibleOutOfStock).toBe(0);
  });

  it("respects the price limit and the number of options", async () => {
    const api = createFakeApi();
    const result = await suggestParts.handler({ api }, { slot: "psu", maxPrice: 500, limit: 1 });
    expect(result.options.map((o) => o.product.id)).toEqual(["19"]);
    expect(result.candidates).toBe(2);
    expect(api.calls.at(-1).params).toMatchObject({ category: "psu", "price:lte": 500 });
  });

  it("ignores the part already in the slot being filled", async () => {
    const api = createFakeApi();
    await suggestParts.handler({ api }, { slot: "cpu", parts: { cpu: "4", motherboard: "5" } });
    expect(api.calls.map((c) => c.path)).not.toContain("/products/4");
  });
});
