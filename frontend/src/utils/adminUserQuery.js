// Search and page of the admin client/admin lists live in the URL
// (?q=ana&page=2), like the product list.
import { ADMIN_PAGE_SIZE } from "./adminProductQuery";

export function parseAdminUserParams(searchParams) {
  const page = Number.parseInt(searchParams.get("page") ?? "", 10);
  return {
    q: (searchParams.get("q") ?? "").trim(),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function toAdminUserSearch({ q, page } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Filters -> arguments for listUsers() (api/users.js), sorted by name
export function toAdminUserFilters(type, filters) {
  return { type, search: filters.q, sort: "name", page: filters.page, perPage: ADMIN_PAGE_SIZE };
}
