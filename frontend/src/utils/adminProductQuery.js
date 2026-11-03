// Filters of the admin product list live in the URL (like the catalog),
// so going to an edit form and back keeps the search, filters and page.
import { CATEGORIES } from "./categories";

export const ADMIN_PAGE_SIZE = 10;

export const ADMIN_SORT_OPTIONS = [
  { value: "name", label: "Nome (A–Z)" },
  { value: "stock", label: "Menor estoque" },
  { value: "-sold", label: "Mais vendidos" },
  { value: "price", label: "Menor preço" },
  { value: "-price", label: "Maior preço" },
];
export const ADMIN_DEFAULT_SORT = "name";

// Values match STOCK_LEVELS in api/products.js
export const STOCK_STATUS_OPTIONS = [
  { value: "available", label: "Disponível" },
  { value: "low", label: "Últimas unidades" },
  { value: "out", label: "Sem estoque" },
];

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.slug));
const VALID_SORTS = new Set(ADMIN_SORT_OPTIONS.map((o) => o.value));
const VALID_STATUS = new Set(STOCK_STATUS_OPTIONS.map((o) => o.value));

// URLSearchParams -> sanitized filters (invalid values fall back to defaults)
export function parseAdminProductParams(searchParams) {
  const get = (key) => (searchParams.get(key) ?? "").trim();
  const page = Number.parseInt(get("page"), 10);

  return {
    q: get("q"),
    category: VALID_CATEGORIES.has(get("category")) ? get("category") : "",
    status: VALID_STATUS.has(get("status")) ? get("status") : "",
    sort: VALID_SORTS.has(get("sort")) ? get("sort") : ADMIN_DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// Filters -> "?query" (defaults left out)
export function toAdminProductSearch(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort && filters.sort !== ADMIN_DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Filters -> arguments for listProducts() (api/products.js)
export function toAdminProductFilters(filters) {
  return {
    search: filters.q,
    category: filters.category,
    stockLevel: filters.status,
    sort: filters.sort,
    page: filters.page,
    perPage: ADMIN_PAGE_SIZE,
  };
}

// "Exibindo 11–20 de 31"
export function rangeText(page, total, perPage = ADMIN_PAGE_SIZE) {
  if (total === 0) return "Nenhum item";
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  return `Exibindo ${first}–${last} de ${total}`;
}
