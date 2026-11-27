/**
 * @file In-memory stand-in for the store API, loaded from the frontend seed.
 * It understands the subset of the json-server query syntax the tools use
 * (field filters, operators, `_where`, `_sort`, pagination), writes, and
 * the backend's `POST /checkout`, so tests run without any server.
 */
import { readFileSync } from "node:fs";
import { ApiError } from "../src/api.js";

const seedUrl = new URL("../../frontend/src/seed.json", import.meta.url);

/** Fresh copy of the seed data. */
export function loadSeed() {
  return JSON.parse(readFileSync(seedUrl, "utf8"));
}

function matchesWhere(item, where) {
  return Object.entries(where).every(([field, condition]) =>
    Object.entries(condition).every(([op, value]) => op === "eq" && item[field] === value),
  );
}

function matches(item, params) {
  if (params._where) return matchesWhere(item, JSON.parse(params._where));
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || key.startsWith("_")) continue;
    const [field, op = "eq"] = key.split(":");
    const actual = item[field];
    if (op === "eq" && String(actual) !== String(value)) return false;
    if (op === "contains" && !String(actual ?? "").toLowerCase().includes(String(value).toLowerCase())) return false;
    if (op === "gte" && !(Number(actual) >= Number(value))) return false;
    if (op === "lte" && !(Number(actual) <= Number(value))) return false;
    if (op === "ne" && actual === Number(value)) return false;
  }
  return true;
}

function sortBy(list, sort) {
  if (!sort) return list;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return [...list].sort((a, b) => {
    const cmp = typeof a[field] === "string" ? a[field].localeCompare(b[field]) : a[field] - b[field];
    return desc ? -cmp : cmp;
  });
}

const notFound = () => new ApiError("A API respondeu 404", 404);

/**
 * Creates a fake API client with the same methods as `createApi`.
 * @param {object} [data] Collections to serve (defaults to the seed).
 * @param {{ checkout?: boolean }} [options] `checkout: false` mimics json-server, which has no POST /checkout.
 */
export function createFakeApi(data = loadSeed(), { checkout = true } = {}) {
  const calls = [];
  let nextId = 1000;

  function collection(path) {
    const [, resource, id] = path.split("/");
    const list = data[resource];
    if (!list) throw new ApiError("A API respondeu 404: Route not found", 404);
    return { list, id: id === undefined ? undefined : decodeURIComponent(id) };
  }

  function find(list, id) {
    const found = list.find((item) => String(item.id) === id);
    if (!found) throw notFound();
    return found;
  }

  function placeOrder({ userId, items, cardNumber }) {
    const user = data.users.find((u) => u.id === userId);
    if (!user) throw new ApiError("A API respondeu 404: Customer not found", 404);
    const lines = items.map(({ productId, quantity }) => {
      const product = data.products.find((p) => p.id === productId);
      if (!product) throw new ApiError(`A API respondeu 404: Product ${productId} not found`, 404);
      if (product.type !== "service" && product.stock < quantity) {
        throw new ApiError(`A API respondeu 409: Not enough stock for "${product.name}"`, 409);
      }
      return { product, quantity };
    });
    for (const { product, quantity } of lines) {
      if (product.type !== "service") product.stock -= quantity;
      product.sold += quantity;
    }
    const order = {
      id: String(nextId++),
      userId,
      items: lines.map(({ product, quantity }) => ({ productId: product.id, name: product.name, price: product.price, quantity })),
      total: Math.round(lines.reduce((s, l) => s + l.product.price * l.quantity, 0) * 100) / 100,
      date: new Date().toISOString(),
      cardLast4: String(cardNumber).replace(/\D/g, "").slice(-4),
      address: user.address,
      status: "Pago",
    };
    data.orders.push(order);
    for (const cart of data.carts) if (cart.userId === userId) cart.items = [];
    return order;
  }

  return {
    apiUrl: "http://fake",
    calls,
    data,
    async get(path, params = {}) {
      calls.push({ method: "GET", path, params });
      const { list, id } = collection(path);
      if (id !== undefined) return structuredClone(find(list, id));
      const filtered = sortBy(list.filter((item) => matches(item, params)), params._sort);
      if (!params._page) return structuredClone(filtered);
      const perPage = Number(params._per_page ?? 10);
      const start = (Number(params._page) - 1) * perPage;
      return {
        data: structuredClone(filtered.slice(start, start + perPage)),
        items: filtered.length,
        pages: Math.max(1, Math.ceil(filtered.length / perPage)),
      };
    },
    async post(path, body) {
      calls.push({ method: "POST", path, body });
      if (path === "/checkout") {
        if (!checkout) throw new ApiError("A API respondeu 404", 404);
        return structuredClone(placeOrder(body));
      }
      const { list } = collection(path);
      const record = { id: String(nextId++), ...structuredClone(body) };
      list.push(record);
      return structuredClone(record);
    },
    async patch(path, body) {
      calls.push({ method: "PATCH", path, body });
      const { list, id } = collection(path);
      const record = find(list, id);
      Object.assign(record, structuredClone(body));
      return structuredClone(record);
    },
    async delete(path) {
      calls.push({ method: "DELETE", path });
      const { list, id } = collection(path);
      const record = find(list, id);
      list.splice(list.indexOf(record), 1);
      return structuredClone(record);
    },
  };
}
