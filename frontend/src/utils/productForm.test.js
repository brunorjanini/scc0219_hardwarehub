import { describe, expect, it } from "vitest";
import seed from "../seed.json";
import {
  SPEC_FIELDS,
  parseNumber,
  readProductForm,
  specFieldLabel,
  specInitialValue,
  toFormValues,
  toProductRecord,
  validateProduct,
} from "./productForm";
import { CATEGORIES } from "./categories";

// Valid GPU values, as read from the form
const GPU_VALUES = {
  name: "RTX 5070",
  brand: "NVIDIA",
  category: "gpu",
  description: "Placa de vídeo.",
  photo: "",
  price: "3.999,90",
  oldPrice: "",
  stock: "5",
  specs: { vramGb: "12", lengthMm: "250", tdp: "250", recommendedPsuW: "" },
};

const withValues = (changes) => ({ ...GPU_VALUES, ...changes });
const withSpecs = (specs, changes = {}) => withValues({ ...changes, specs: { ...GPU_VALUES.specs, ...specs } });

function formData(entries) {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe("parseNumber", () => {
  it.each([
    ["4299.90", 4299.9],
    ["4299,90", 4299.9],
    ["4.299,90", 4299.9],
    [" 12 ", 12],
    ["", null],
    ["   ", null],
    ["12a", NaN],
    ["1,2,3", NaN],
  ])("%j -> %s", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });
});

describe("SPEC_FIELDS", () => {
  it("has fields for every category", () => {
    for (const { slug } of CATEGORIES) {
      expect(SPEC_FIELDS[slug]?.length, slug).toBeGreaterThan(0);
    }
  });

  it("covers every spec key used by the seed products", () => {
    for (const product of seed.products) {
      const keys = SPEC_FIELDS[product.category].map((f) => f.key);
      for (const key of Object.keys(product.specs)) {
        expect(keys, `${product.name}: ${key}`).toContain(key);
      }
    }
  });

  it("builds labels with units", () => {
    expect(specFieldLabel({ key: "baseClockGhz", unit: "GHz" })).toBe("Clock base (GHz)");
    expect(specFieldLabel({ key: "socket" })).toBe("Soquete");
    expect(specFieldLabel({ key: "tdp", unit: "W", label: "Consumo TDP" })).toBe("Consumo TDP (W)");
  });
});

describe("readProductForm", () => {
  it("reads trimmed fields and only the specs of the chosen category", () => {
    const values = readProductForm(
      formData([
        ["name", "  Gabinete X "],
        ["brand", "Lian Li"],
        ["category", "case"],
        ["description", "Gabinete."],
        ["photo", ""],
        ["price", "500"],
        ["oldPrice", ""],
        ["stock", "3"],
        ["spec-supportedFormFactors", "ATX"],
        ["spec-supportedFormFactors", "ITX"],
        ["spec-maxGpuLengthMm", " 400 "],
        // Left over from another category: ignored
        ["spec-socket", "AM5"],
      ]),
    );

    expect(values).toEqual({
      name: "Gabinete X",
      brand: "Lian Li",
      category: "case",
      description: "Gabinete.",
      photo: "",
      price: "500",
      oldPrice: "",
      stock: "3",
      specs: { supportedFormFactors: ["ATX", "ITX"], maxGpuLengthMm: "400" },
    });
  });

  it("reads checkboxes as booleans", () => {
    const on = readProductForm(formData([["category", "psu"], ["spec-modular", "1"]]));
    const off = readProductForm(formData([["category", "psu"]]));
    expect(on.specs.modular).toBe(true);
    expect(off.specs.modular).toBe(false);
  });
});

describe("validateProduct", () => {
  it("accepts valid values", () => {
    expect(validateProduct(GPU_VALUES)).toBeNull();
  });

  it.each([
    [{ name: "" }, "name", "Informe o nome do produto"],
    [{ category: "" }, "category", "Escolha a categoria"],
    [{ category: "tablet" }, "category", "Escolha a categoria"],
    [{ brand: "" }, "brand", "Informe a marca"],
    [{ description: "" }, "description", "Informe a descrição"],
    [{ photo: "foto.jpg" }, "photo", /caminho/],
    [{ price: "" }, "price", "Informe o preço"],
    [{ price: "0" }, "price", /maior que zero/],
    [{ price: "abc" }, "price", /maior que zero/],
    [{ oldPrice: "3000" }, "oldPrice", /maior que o preço atual/],
    [{ oldPrice: "3999.90" }, "oldPrice", /maior que o preço atual/],
    [{ stock: "" }, "stock", "Informe o estoque"],
    [{ stock: "-1" }, "stock", /inteiro maior ou igual a zero/],
    [{ stock: "1.5" }, "stock", /inteiro maior ou igual a zero/],
  ])("refuses %j", (changes, field, message) => {
    const error = validateProduct(withValues(changes));
    expect(error.field).toBe(field);
    expect(error.message).toMatch(message);
  });

  it("accepts photo paths and URLs", () => {
    expect(validateProduct(withValues({ photo: "/products/x.jpg" }))).toBeNull();
    expect(validateProduct(withValues({ photo: "https://example.com/x.png" }))).toBeNull();
  });

  it("accepts stock 0 and an old price above the price", () => {
    expect(validateProduct(withValues({ stock: "0", oldPrice: "4500" }))).toBeNull();
  });

  it("validates required and numeric specs", () => {
    expect(validateProduct(withSpecs({ lengthMm: "" }))).toEqual({
      field: "spec-lengthMm",
      message: "Preencha o campo Comprimento (mm)",
    });
    expect(validateProduct(withSpecs({ vramGb: "8,5" })).message).toBe(
      "Memória de vídeo (GB) deve ser um número inteiro maior que zero",
    );
    expect(validateProduct(withSpecs({ recommendedPsuW: "0" })).field).toBe("spec-recommendedPsuW");
  });

  it("validates selects and checkbox groups", () => {
    const board = {
      ...withValues({ category: "motherboard" }),
      specs: { socket: "AM5", formFactor: "EATX", memoryType: "DDR5" },
    };
    expect(validateProduct(board).field).toBe("spec-formFactor");

    const pcCase = { ...withValues({ category: "case" }), specs: { supportedFormFactors: [], maxGpuLengthMm: "300" } };
    expect(validateProduct(pcCase)).toEqual({
      field: "spec-supportedFormFactors-ATX",
      message: "Marque pelo menos uma opção em Placas suportadas",
    });
  });

  it("does not ask services for stock", () => {
    const service = { ...withValues({ category: "service", stock: "" }), specs: { durationHours: "1,5" } };
    expect(validateProduct(service)).toBeNull();
  });
});

describe("toProductRecord", () => {
  it("builds a new product with numbers, placeholder photo and sold 0", () => {
    expect(toProductRecord(GPU_VALUES, { isNew: true })).toEqual({
      name: "RTX 5070",
      type: "product",
      category: "gpu",
      brand: "NVIDIA",
      photo: "/products/placeholder-gpu.svg",
      description: "Placa de vídeo.",
      price: 3999.9,
      stock: 5,
      sold: 0,
      specs: { vramGb: 12, lengthMm: 250, tdp: 250 },
    });
  });

  it("keeps an offer price", () => {
    expect(toProductRecord(withValues({ oldPrice: "4599,9" }), { isNew: true }).oldPrice).toBe(4599.9);
  });

  it("ends an offer on edit by sending null, and never sends sold", () => {
    const record = toProductRecord(GPU_VALUES);
    expect(record.oldPrice).toBeNull();
    expect(record).not.toHaveProperty("sold");
  });

  it("turns services into type service without stock", () => {
    const record = toProductRecord({
      ...withValues({ category: "service", stock: "7" }),
      specs: { durationHours: "1,5" },
    });
    expect(record).toMatchObject({ type: "service", stock: null, specs: { durationHours: 1.5 } });
  });

  it("swaps a placeholder of another category but keeps real photos", () => {
    expect(toProductRecord(withValues({ photo: "/products/placeholder-cpu.svg" })).photo).toBe(
      "/products/placeholder-gpu.svg",
    );
    expect(toProductRecord(withValues({ photo: "/products/geoforce_rtx.jpg" })).photo).toBe("/products/geoforce_rtx.jpg");
  });

  it("keeps checkbox specs in a fixed order and booleans as booleans", () => {
    const pcCase = toProductRecord({
      ...withValues({ category: "case" }),
      specs: { supportedFormFactors: ["ITX", "ATX"], maxGpuLengthMm: "330" },
    });
    expect(pcCase.specs).toEqual({ supportedFormFactors: ["ATX", "ITX"], maxGpuLengthMm: 330 });

    const psu = toProductRecord({ ...withValues({ category: "psu" }), specs: { watts: "650", efficiency: "", modular: false } });
    expect(psu.specs).toEqual({ watts: 650, modular: false });
  });
});

describe("toFormValues", () => {
  it("turns a stored product into form strings", () => {
    const product = seed.products.find((p) => p.type === "product" && p.oldPrice);
    const values = toFormValues(product);
    expect(values.price).toBe(product.price.toFixed(2));
    expect(values.oldPrice).toBe(product.oldPrice.toFixed(2));
    expect(values.stock).toBe(String(product.stock));
  });

  it("round-trips every seed product through validation", () => {
    for (const product of seed.products) {
      const values = toFormValues(product);
      const specs = Object.fromEntries(
        SPEC_FIELDS[product.category].map((field) => [field.key, specInitialValue(field, product.specs)]),
      );
      const formValues = { ...values, specs };
      expect(validateProduct(formValues), product.name).toBeNull();
      expect(toProductRecord(formValues).specs, product.name).toEqual(
        // Unset booleans become false
        SPEC_FIELDS[product.category].some((f) => f.kind === "boolean")
          ? { modular: false, ...product.specs }
          : product.specs,
      );
    }
  });

  it("gives empty strings for a new product", () => {
    expect(toFormValues(null)).toMatchObject({ name: "", price: "", stock: "", specs: {} });
  });
});
