// Admin product form: the specs each category has, and how the form is
// read, validated and turned into the record saved in /products.
// The PC Builder (Task 8) depends on the specs marked `required`.
import { CATEGORIES, placeholderPhoto } from "./categories";
import { specLabel } from "./specs";

export const FORM_FACTORS = ["ATX", "mATX", "ITX"];
export const MEMORY_TYPES = ["DDR4", "DDR5"];
export const STORAGE_TYPES = ["NVMe", "HDD"];

// Photos shipped in public/products, offered as suggestions in the form.
// json-server has no upload, so the form stores a path or an http(s) URL.
export const PHOTO_SUGGESTIONS = [
  "/products/geoforce_rtx.jpg",
  "/products/monitor.jpeg",
  "/products/ryzen7.jpeg",
  "/products/teclado.jpeg",
  ...CATEGORIES.map((c) => placeholderPhoto(c.slug)),
];

// Spec fields per category. `kind` picks the input:
//   text, integer, decimal, select (one of `choices`),
//   boolean (checkbox), multi (checkbox group of `choices`).
// `unit` is shown in the label; `label` overrides the one from specs.js.
export const SPEC_FIELDS = {
  cpu: [
    { key: "socket", kind: "text", required: true, placeholder: "AM5, LGA1700..." },
    { key: "cores", kind: "integer", required: true },
    { key: "threads", kind: "integer" },
    { key: "baseClockGhz", kind: "decimal", unit: "GHz" },
    { key: "boostClockGhz", kind: "decimal", unit: "GHz" },
    { key: "tdp", kind: "integer", unit: "W", label: "Consumo TDP", required: true },
  ],
  motherboard: [
    { key: "socket", kind: "text", required: true, placeholder: "AM5, LGA1700..." },
    { key: "chipset", kind: "text" },
    { key: "formFactor", kind: "select", choices: FORM_FACTORS, required: true },
    { key: "memoryType", kind: "select", choices: MEMORY_TYPES, required: true },
    { key: "memorySlots", kind: "integer" },
    { key: "maxMemoryGb", kind: "integer", unit: "GB" },
  ],
  ram: [
    { key: "memoryType", kind: "select", choices: MEMORY_TYPES, required: true },
    { key: "capacityGb", kind: "integer", unit: "GB", required: true },
    { key: "modules", kind: "integer" },
    { key: "speedMhz", kind: "integer", unit: "MHz" },
  ],
  gpu: [
    { key: "vramGb", kind: "integer", unit: "GB", required: true },
    { key: "lengthMm", kind: "integer", unit: "mm", required: true },
    { key: "tdp", kind: "integer", unit: "W", label: "Consumo TDP", required: true },
    { key: "recommendedPsuW", kind: "integer", unit: "W" },
  ],
  storage: [
    { key: "storageType", kind: "select", choices: STORAGE_TYPES, required: true },
    { key: "capacityGb", kind: "integer", unit: "GB", required: true },
    { key: "interface", kind: "text", placeholder: "PCIe 4.0 x4, SATA III..." },
  ],
  psu: [
    { key: "watts", kind: "integer", unit: "W", required: true },
    { key: "efficiency", kind: "text", placeholder: "80 Plus Bronze" },
    { key: "modular", kind: "boolean" },
  ],
  case: [
    { key: "supportedFormFactors", kind: "multi", choices: FORM_FACTORS, required: true },
    { key: "maxGpuLengthMm", kind: "integer", unit: "mm", required: true },
  ],
  peripheral: [
    { key: "kind", kind: "text", required: true, placeholder: "Teclado, mouse, monitor..." },
    { key: "connection", kind: "text", placeholder: "USB, Bluetooth..." },
    { key: "sizeInches", kind: "decimal", unit: "polegadas" },
    { key: "resolution", kind: "text", placeholder: "2560x1440" },
    { key: "refreshHz", kind: "integer", unit: "Hz" },
  ],
  service: [{ key: "durationHours", kind: "decimal", unit: "horas", required: true }],
};

export function specFields(category) {
  return SPEC_FIELDS[category] ?? [];
}

export function isServiceCategory(category) {
  return category === "service";
}

// "Clock base (GHz)"
export function specFieldLabel(field) {
  const label = field.label ?? specLabel(field.key);
  return field.unit ? `${label} (${field.unit})` : label;
}

// Input name/id of a spec; checkbox groups add the choice ("spec-x-ATX")
export function specInputId(key, choice) {
  return choice === undefined ? `spec-${key}` : `spec-${key}-${choice}`;
}

// Parses "4299.90", "4299,90" and "4.299,90". Returns null when empty
// and NaN when the text is not a number.
export function parseNumber(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

// ---- Form <-> values ----

// Reads the form (FormData) into trimmed strings; specs of the chosen
// category only, so switching category drops the old category's specs.
export function readProductForm(formData) {
  const get = (name) => (formData.get(name) ?? "").toString().trim();
  const category = get("category");

  const specs = {};
  for (const field of specFields(category)) {
    const name = specInputId(field.key);
    if (field.kind === "multi") specs[field.key] = formData.getAll(name).map(String);
    else if (field.kind === "boolean") specs[field.key] = formData.get(name) !== null;
    else specs[field.key] = get(name);
  }

  return {
    name: get("name"),
    brand: get("brand"),
    category,
    description: get("description"),
    photo: get("photo"),
    price: get("price"),
    oldPrice: get("oldPrice"),
    stock: get("stock"),
    specs,
  };
}

// Stored product -> initial values of the form fields (strings)
export function toFormValues(product) {
  const text = (value) => (value === null || value === undefined ? "" : String(value));
  const money = (value) => (typeof value === "number" ? value.toFixed(2) : "");
  return {
    name: text(product?.name),
    brand: text(product?.brand),
    category: text(product?.category),
    description: text(product?.description),
    photo: text(product?.photo),
    price: money(product?.price),
    oldPrice: money(product?.oldPrice),
    stock: text(product?.stock),
    specs: product?.specs ?? {},
  };
}

// Initial value of one spec input: array (multi), boolean or string
export function specInitialValue(field, specs = {}) {
  const value = specs?.[field.key];
  if (field.kind === "multi") return Array.isArray(value) ? value : [];
  if (field.kind === "boolean") return Boolean(value);
  return value === null || value === undefined ? "" : String(value);
}

// ---- Validation ----

const PHOTO_PATTERN = /^(\/|https?:\/\/)\S+$/;

// Returns { field, message } for the first invalid field (`field` is the
// input id, so the page can focus it), or null when everything is valid.
export function validateProduct(values) {
  const error = (field, message) => ({ field, message });

  if (!values.name) return error("name", "Informe o nome do produto");
  if (!CATEGORIES.some((c) => c.slug === values.category)) return error("category", "Escolha a categoria");
  if (!values.brand) return error("brand", "Informe a marca");
  if (!values.description) return error("description", "Informe a descrição");
  if (values.photo && !PHOTO_PATTERN.test(values.photo)) {
    return error("photo", "A foto deve ser um caminho como /products/foto.jpg ou um endereço http(s)");
  }

  const price = parseNumber(values.price);
  if (price === null) return error("price", "Informe o preço");
  if (!(price > 0)) return error("price", "O preço deve ser um número maior que zero");

  const oldPrice = parseNumber(values.oldPrice);
  if (oldPrice !== null && !(oldPrice > price)) {
    return error("oldPrice", "O preço antigo (oferta) deve ser maior que o preço atual");
  }

  if (!isServiceCategory(values.category)) {
    const stock = parseNumber(values.stock);
    if (stock === null) return error("stock", "Informe o estoque");
    if (!Number.isInteger(stock) || stock < 0) {
      return error("stock", "O estoque deve ser um número inteiro maior ou igual a zero");
    }
  }

  for (const field of specFields(values.category)) {
    const message = validateSpec(field, values.specs?.[field.key]);
    if (message) {
      const id = field.kind === "multi" ? specInputId(field.key, field.choices[0]) : specInputId(field.key);
      return error(id, message);
    }
  }

  return null;
}

function validateSpec(field, value) {
  const label = specFieldLabel(field);

  if (field.kind === "boolean") return "";
  if (field.kind === "multi") {
    if (field.required && (!value || value.length === 0)) return `Marque pelo menos uma opção em ${label}`;
    return value?.every((v) => field.choices.includes(v)) === false ? `Opção inválida em ${label}` : "";
  }

  if (!value) return field.required ? `Preencha o campo ${label}` : "";

  if (field.kind === "select" && !field.choices.includes(value)) return `Escolha uma opção em ${label}`;
  if (field.kind === "integer") {
    const number = parseNumber(value);
    if (!Number.isInteger(number) || number <= 0) return `${label} deve ser um número inteiro maior que zero`;
  }
  if (field.kind === "decimal" && !(parseNumber(value) > 0)) return `${label} deve ser um número maior que zero`;
  return "";
}

// ---- Values -> record ----

const PLACEHOLDER_PATTERN = /^\/products\/placeholder-[a-z]+\.svg$/;

// No photo, or a placeholder of another category -> placeholder of this one
function resolvePhoto(photo, category) {
  return !photo || PLACEHOLDER_PATTERN.test(photo) ? placeholderPhoto(category) : photo;
}

function toSpecs(category, rawSpecs = {}) {
  const specs = {};
  for (const field of specFields(category)) {
    const value = rawSpecs[field.key];
    if (field.kind === "boolean") specs[field.key] = Boolean(value);
    else if (field.kind === "multi") {
      // Keep the order of the choices (ATX, mATX, ITX)
      if (value?.length) specs[field.key] = field.choices.filter((c) => value.includes(c));
    } else if (value) {
      specs[field.key] = field.kind === "integer" || field.kind === "decimal" ? parseNumber(value) : value;
    }
  }
  return specs;
}

const round2 = (value) => Math.round(value * 100) / 100;

// Validated values -> body for POST (isNew) or PATCH /products/:id.
// The whole `specs` object is sent because PATCH only merges the top level.
// `sold` is set to 0 on creation and never sent by edits, so the form
// cannot overwrite sales made while it was open.
// An empty old price is sent as null on edits, which ends the offer.
export function toProductRecord(values, { isNew = false } = {}) {
  const service = isServiceCategory(values.category);
  const oldPrice = parseNumber(values.oldPrice);

  const record = {
    name: values.name,
    type: service ? "service" : "product",
    category: values.category,
    brand: values.brand,
    photo: resolvePhoto(values.photo, values.category),
    description: values.description,
    price: round2(parseNumber(values.price)),
    oldPrice: oldPrice === null ? null : round2(oldPrice),
    stock: service ? null : parseNumber(values.stock),
    specs: toSpecs(values.category, values.specs),
  };

  if (isNew) {
    if (record.oldPrice === null) delete record.oldPrice;
    record.sold = 0;
  }
  return record;
}
