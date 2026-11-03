// Catalog filters live in the URL (?category=gpu&sort=price&page=2), so a
// filtered page can be bookmarked, shared and reached with the back button.
// This module converts URL params <-> filter object <-> product API query.
import { CATALOG_SECTIONS, CATEGORIES, categoryLabel } from "./categories";

export const SORT_OPTIONS = [
  { value: "-sold", label: "Mais vendidos" },
  { value: "price", label: "Menor preço" },
  { value: "-price", label: "Maior preço" },
  { value: "name", label: "Nome (A–Z)" },
];
export const DEFAULT_SORT = "-sold";
export const CATALOG_PAGE_SIZE = 12;

const VALID_CATEGORIES = new Set([
  ...CATALOG_SECTIONS.map((s) => s.slug),
  ...CATEGORIES.map((c) => c.slug),
]);
const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value));

// "" for empty or invalid input, otherwise a non-negative number
function parsePrice(value) {
  if (value === null || value.trim() === "") return "";
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : "";
}

// URLSearchParams -> sanitized filters. Invalid values fall back to
// defaults, so a hand-edited URL never breaks the page.
export function parseCatalogParams(searchParams) {
  const get = (key) => searchParams.get(key) ?? "";

  const category = VALID_CATEGORIES.has(get("category")) ? get("category") : "";
  const sort = VALID_SORTS.has(get("sort")) ? get("sort") : DEFAULT_SORT;
  const page = Number.parseInt(get("page"), 10);

  let minPrice = parsePrice(searchParams.get("minPrice"));
  let maxPrice = parsePrice(searchParams.get("maxPrice"));
  if (minPrice !== "" && maxPrice !== "" && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    q: get("q").trim(),
    category,
    brand: get("brand").trim(),
    minPrice,
    maxPrice,
    inStock: get("inStock") === "1",
    sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// Filters -> "?query" string. Default values are left out to keep URLs short.
export function toCatalogSearch(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.minPrice !== undefined && filters.minPrice !== "")
    params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined && filters.maxPrice !== "")
    params.set("maxPrice", String(filters.maxPrice));
  if (filters.inStock) params.set("inStock", "1");
  if (filters.sort && filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

// Link to the catalog with the given filters
export function catalogPath(filters) {
  return `/catalog${toCatalogSearch(filters)}`;
}

// Filters -> arguments for listProducts() (api/products.js)
export function toProductFilters(filters, perPage = CATALOG_PAGE_SIZE) {
  const section = CATALOG_SECTIONS.find((s) => s.slug === filters.category);
  const categoryFilters = section
    ? section.filters
    : filters.category
      ? { category: filters.category }
      : {};

  return {
    ...categoryFilters,
    brand: filters.brand,
    search: filters.q,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock,
    sort: filters.sort,
    page: filters.page,
    perPage,
  };
}

// Page title for the current filters
export function catalogTitle(filters) {
  if (filters.q) return `Resultados para “${filters.q}”`;
  const section = CATALOG_SECTIONS.find((s) => s.slug === filters.category);
  if (section) return section.label;
  if (filters.category) return categoryLabel(filters.category);
  return "Catálogo";
}

// True when any filter besides sorting/pagination is active
export function hasActiveFilters(filters) {
  return Boolean(
    filters.q ||
      filters.category ||
      filters.brand ||
      filters.minPrice !== "" ||
      filters.maxPrice !== "" ||
      filters.inStock,
  );
}
