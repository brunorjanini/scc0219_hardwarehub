// Products and services (/products)
import { http } from "./http";

// Translates catalog filters into json-server v1 query params.
// Supported filters: type, category, brand, search, minPrice, maxPrice,
// sort ("price", "-price", "name", "-sold"...), page, perPage.
export function buildProductQuery({
  type,
  category,
  brand,
  search,
  minPrice,
  maxPrice,
  sort,
  page,
  perPage,
} = {}) {
  const params = {};

  if (type) params["type"] = type;
  if (category) params["category"] = category;
  if (brand) params["brand"] = brand;
  if (search && search.trim()) params["name:contains"] = search.trim();
  if (minPrice !== undefined && minPrice !== "")
    params["price:gte"] = minPrice;
  if (maxPrice !== undefined && maxPrice !== "")
    params["price:lte"] = maxPrice;
  if (sort) params["_sort"] = sort;

  // Pagination only when a page is requested; json-server then returns
  // { data, items, pages, ... } instead of a plain array.
  if (page) {
    params["_page"] = page;
    params["_per_page"] = perPage ?? 12;
  }

  return params;
}

// Lists products. Returns an array, or a pagination object if `page` is set.
export function listProducts(filters) {
  return http.get("/products", buildProductQuery(filters));
}

export function getProduct(id) {
  return http.get(`/products/${encodeURIComponent(id)}`);
}

export function createProduct(product) {
  return http.post("/products", product);
}

export function updateProduct(id, changes) {
  return http.patch(`/products/${encodeURIComponent(id)}`, changes);
}

export function deleteProduct(id) {
  return http.delete(`/products/${encodeURIComponent(id)}`);
}
