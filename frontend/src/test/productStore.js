// In-memory fake of /products for the admin pages. Unlike mockStore.js,
// listProducts applies the filters used by the admin list and the catalog
// (search, category, type, stock level, sorting, pagination), so tests can
// check what a page shows for a given URL.
// The test file must vi.mock("../api/products") with these functions mocked:
// listProducts, getProduct, createProduct, updateProduct, deleteProduct.
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "../api/products";
import { ApiError } from "../api/http";
import { LOW_STOCK_THRESHOLD } from "../utils/stock";

const notFound = () => new ApiError("Erro na requisição (404)", 404);

function matches(product, filters) {
  const { search, category, categories, type, stockLevel, inStock } = filters;
  if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return false;
  if (category && product.category !== category) return false;
  if (categories?.length && !categories.includes(product.category)) return false;
  if (type && product.type !== type) return false;
  if ((inStock || stockLevel === "available") && product.stock === 0) return false;
  if (stockLevel === "low" && !(product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD)) return false;
  if (stockLevel === "out" && product.stock !== 0) return false;
  return true;
}

function compare(sort) {
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return (a, b) => {
    const x = a[field] ?? -Infinity;
    const y = b[field] ?? -Infinity;
    const result = typeof x === "string" ? x.localeCompare(y) : x - y;
    return desc ? -result : result;
  };
}

// Returns the live database ({ [id]: product }) to inspect the final state
export function installProductStore(products = []) {
  const db = Object.fromEntries(products.map((p) => [String(p.id), { ...p }]));
  let nextId = 1;

  listProducts.mockReset().mockImplementation(async (filters = {}) => {
    let items = Object.values(db).filter((p) => matches(p, filters));
    if (filters.sort) items = [...items].sort(compare(filters.sort));
    items = items.map((p) => ({ ...p }));
    if (!filters.page) return items;

    const perPage = filters.perPage ?? 12;
    const start = (filters.page - 1) * perPage;
    return {
      data: items.slice(start, start + perPage),
      items: items.length,
      pages: Math.max(1, Math.ceil(items.length / perPage)),
    };
  });

  getProduct.mockReset().mockImplementation(async (id) => {
    if (!db[String(id)]) throw notFound();
    return { ...db[String(id)] };
  });

  createProduct.mockReset().mockImplementation(async (product) => {
    const id = `new${nextId++}`;
    db[id] = { ...product, id };
    return { ...db[id] };
  });

  updateProduct.mockReset().mockImplementation(async (id, changes) => {
    if (!db[String(id)]) throw notFound();
    db[String(id)] = { ...db[String(id)], ...changes };
    return { ...db[String(id)] };
  });

  deleteProduct.mockReset().mockImplementation(async (id) => {
    if (!db[String(id)]) throw notFound();
    delete db[String(id)];
    return null;
  });

  return db;
}
