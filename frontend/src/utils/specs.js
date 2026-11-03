// Human-readable technical specifications for the product page.
// Each key of product.specs maps to a label and a formatter.
import { formatNumber } from "./format";

const withUnit = (unit) => (value) => `${formatNumber(value)} ${unit}`;

// 2000 -> "2 TB", 512 -> "512 GB"
function formatCapacity(gb) {
  return gb >= 1000 ? `${formatNumber(gb / 1000)} TB` : `${formatNumber(gb)} GB`;
}

const SPEC_FORMATS = {
  socket: { label: "Soquete" },
  cores: { label: "Núcleos" },
  threads: { label: "Threads" },
  baseClockGhz: { label: "Clock base", format: withUnit("GHz") },
  boostClockGhz: { label: "Clock boost", format: withUnit("GHz") },
  tdp: { label: "Consumo (TDP)", format: withUnit("W") },
  chipset: { label: "Chipset" },
  formFactor: { label: "Formato" },
  memoryType: { label: "Tipo de memória" },
  memorySlots: { label: "Slots de memória" },
  maxMemoryGb: { label: "Memória máxima", format: withUnit("GB") },
  capacityGb: { label: "Capacidade", format: formatCapacity },
  modules: { label: "Módulos" },
  speedMhz: { label: "Frequência", format: withUnit("MHz") },
  vramGb: { label: "Memória de vídeo", format: withUnit("GB") },
  lengthMm: { label: "Comprimento", format: withUnit("mm") },
  recommendedPsuW: { label: "Fonte recomendada", format: withUnit("W") },
  storageType: { label: "Tipo" },
  interface: { label: "Interface" },
  watts: { label: "Potência", format: withUnit("W") },
  efficiency: { label: "Eficiência" },
  modular: { label: "Modular", format: (value) => (value ? "Sim" : "Não") },
  supportedFormFactors: { label: "Placas suportadas", format: (value) => value.join(", ") },
  maxGpuLengthMm: { label: "Placa de vídeo até", format: withUnit("mm") },
  kind: { label: "Tipo" },
  connection: { label: "Conexão" },
  sizeInches: { label: "Tamanho", format: (value) => `${formatNumber(value)}"` },
  resolution: { label: "Resolução" },
  refreshHz: { label: "Taxa de atualização", format: withUnit("Hz") },
  durationHours: { label: "Duração estimada", format: withUnit("h") },
};

// Returns [{ key, label, value }] in the order of the specs object.
// Unknown keys are kept with the raw key as label, so specs added by an
// admin still show up.
export function formatSpecs(specs = {}) {
  return Object.entries(specs ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const spec = SPEC_FORMATS[key];
      const format = spec?.format ?? ((v) => (typeof v === "number" ? formatNumber(v) : String(v)));
      return { key, label: spec?.label ?? key, value: format(value) };
    });
}
