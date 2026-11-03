// Product categories: the slug stored in the database, the label shown
// to the user and the placeholder image used when a product has no photo.
export const CATEGORIES = [
  { slug: "cpu", label: "Processador", builder: true },
  { slug: "motherboard", label: "Placa-mãe", builder: true },
  { slug: "ram", label: "Memória RAM", builder: true },
  { slug: "gpu", label: "Placa de vídeo", builder: true },
  { slug: "storage", label: "Armazenamento", builder: true },
  { slug: "psu", label: "Fonte", builder: true },
  { slug: "case", label: "Gabinete", builder: true },
  { slug: "peripheral", label: "Periférico", builder: false },
  { slug: "service", label: "Serviço", builder: false },
];

// Categories that make up a PC in the builder (one part each)
export const BUILDER_CATEGORIES = CATEGORIES.filter((c) => c.builder).map(
  (c) => c.slug,
);

export function categoryLabel(slug) {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function placeholderPhoto(slug) {
  const known = CATEGORIES.some((c) => c.slug === slug);
  return `/products/placeholder-${known ? slug : "peripheral"}.svg`;
}
