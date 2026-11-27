import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfirmations } from "../src/confirmations.js";
import { createIdentity } from "../src/identity.js";
import {
  createProduct,
  deleteProductConfirm,
  deleteProductPreview,
  getDashboardStats,
  listLowStock,
  listUsers,
  updateProduct,
  updateStock,
} from "../src/tools/admin.js";
import { createFakeApi } from "./fakeApi.js";

// Seed: "3" is the default admin (admin/admin), "2" is admin Marina, "1" is client Ana.
function setup({ userId = "3" } = {}) {
  const api = createFakeApi();
  const config = { mode: "admin", userId, testCard: "0000" };
  const ctx = { api, config, identity: createIdentity(api, config), confirmations: createConfirmations() };
  const product = (id) => api.data.products.find((p) => p.id === id);
  return { api, ctx, product };
}

const NEW_GPU = {
  name: "Radeon RX 7700 XT 12GB",
  category: "gpu",
  brand: "AMD",
  description: "Placa de vídeo para 1440p.",
  price: 2999.9,
  stock: 4,
  specs: { vramGb: 12, lengthMm: 267, tdp: 245 },
};

afterEach(() => {
  vi.useRealTimers();
});

describe("admin identity", () => {
  it("refuses every admin tool for a client account", async () => {
    const { ctx, api } = setup({ userId: "1" });
    await expect(listLowStock.handler(ctx)).rejects.toThrow(/é um cliente/);
    await expect(updateStock.handler(ctx, { id: "13", stock: 1 })).rejects.toThrow(/é um cliente/);
    expect(api.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });
});

describe("dashboard and stock", () => {
  it("computes the dashboard from orders, products and users", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 26, 12, 0));
    const { ctx, api } = setup();
    api.data.orders.push(
      { id: "o1", userId: "1", items: [{ quantity: 2 }], total: 1000, date: new Date(2026, 10, 26, 9, 0).toISOString() },
      { id: "o2", userId: "1", items: [{ quantity: 1 }], total: 500, date: new Date(2026, 10, 20, 9, 0).toISOString() },
      { id: "o3", userId: "gone", items: [{ quantity: 1 }], total: 750, date: new Date(2026, 9, 10, 9, 0).toISOString() },
    );

    const stats = await getDashboardStats.handler(ctx);
    expect(stats.month).toEqual({ revenue: 1500, orders: 2, ticket: 750 });
    expect(stats.previousMonth).toEqual({ revenue: 750, orders: 1, ticket: 750 });
    expect(stats.comments.revenue).toEqual({ text: "+100% vs. mês anterior", tone: "up" });
    expect(stats.stock).toEqual({ out: 3, low: 2 });
    expect(stats.last7Days.at(-1)).toMatchObject({ day: "2026-11-26", total: 1000 });
    expect(stats.recentOrders.map((o) => [o.id, o.customer])).toEqual([
      ["o1", "Ana Souza"],
      ["o2", "Ana Souza"],
      ["o3", "Cliente removido"],
    ]);
  });

  it("lists products out of stock and with few units, never services", async () => {
    const { ctx } = setup();
    const result = await listLowStock.handler(ctx);
    expect(result.threshold).toBe(3);
    expect(result.out.map((p) => p.id).sort()).toEqual(["16", "26", "8"]);
    expect(result.low.map((p) => [p.id, p.stock])).toEqual([
      ["1", 3],
      ["15", 3],
    ]);
    expect(result.out[0]).toHaveProperty("sold");
  });

  it("updates the stock of a product but not of a service", async () => {
    const { ctx, product } = setup();
    expect(await updateStock.handler(ctx, { id: "8", stock: 12 })).toMatchObject({ id: "8", stock: 12, available: true });
    expect(product("8").stock).toBe(12);
    await expect(updateStock.handler(ctx, { id: "27", stock: 5 })).rejects.toThrow("é um serviço e não tem estoque");
  });
});

describe("create_product and update_product", () => {
  it("creates a product with the admin form rules", async () => {
    const { ctx, api } = setup();
    const created = await createProduct.handler(ctx, NEW_GPU);
    expect(created).toMatchObject({
      name: "Radeon RX 7700 XT 12GB",
      type: "product",
      category: "gpu",
      price: 2999.9,
      stock: 4,
      sold: 0,
      oldPrice: null,
      specs: { vramGb: 12, lengthMm: 267, tdp: 245 },
    });
    const body = api.calls.find((c) => c.method === "POST").body;
    expect(body).toMatchObject({ sold: 0, photo: "/products/placeholder-gpu.svg" });
    expect(body).not.toHaveProperty("oldPrice");
  });

  it("creates a service without stock", async () => {
    const { ctx } = setup();
    const service = await createProduct.handler(ctx, {
      name: "Backup de dados",
      category: "service",
      brand: "HardwareHub",
      description: "Cópia dos seus arquivos.",
      price: 59.9,
      specs: { durationHours: 2 },
    });
    expect(service).toMatchObject({ type: "service", stock: null, available: true });
  });

  it.each([
    [{ specs: { vramGb: 12, tdp: 245 } }, "Preencha o campo Comprimento (mm)"],
    [{ stock: undefined }, "Informe o estoque"],
    [{ oldPrice: 100 }, "O preço antigo (oferta) deve ser maior que o preço atual"],
    [{ photo: "foto.jpg" }, "A foto deve ser um caminho"],
  ])("rejects what the admin form rejects (%o)", async (override, message) => {
    const { ctx, api } = setup();
    await expect(createProduct.handler(ctx, { ...NEW_GPU, ...override })).rejects.toThrow(message);
    expect(api.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("changes only the given fields and merges specs", async () => {
    const { ctx, api, product } = setup();
    const before = structuredClone(product("13"));
    const updated = await updateProduct.handler(ctx, { id: "13", changes: { price: 3999.9, specs: { lengthMm: 270 } } });
    expect(updated).toMatchObject({ price: 3999.9, oldPrice: 4899.9, stock: before.stock, sold: before.sold });
    expect(updated.specs).toEqual({ ...before.specs, lengthMm: 270 });
    expect(api.calls.find((c) => c.method === "PATCH").body).not.toHaveProperty("sold");
  });

  it("ends an offer with oldPrice null and refuses invalid edits", async () => {
    const { ctx, product } = setup();
    await updateProduct.handler(ctx, { id: "13", changes: { oldPrice: null } });
    expect(product("13").oldPrice).toBeNull();
    await expect(updateProduct.handler(ctx, { id: "13", changes: { specs: { tdp: null } } })).rejects.toThrow(
      "Preencha o campo Consumo TDP (W)",
    );
  });

  it("starts specs from scratch when the category changes", async () => {
    const { ctx } = setup();
    await expect(updateProduct.handler(ctx, { id: "13", changes: { category: "psu" } })).rejects.toThrow(
      "Preencha o campo Potência",
    );
    const moved = await updateProduct.handler(ctx, {
      id: "13",
      changes: { category: "psu", specs: { watts: 750, efficiency: "80 Plus Gold" } },
    });
    expect(moved.specs).toEqual({ watts: 750, efficiency: "80 Plus Gold", modular: false });
  });
});

describe("deleting a product (two steps)", () => {
  it("shows the impact, then deletes only with the token", async () => {
    const { ctx, api, product } = setup();
    api.data.carts.push({ id: "c1", userId: "1", items: [{ productId: "13", quantity: 1 }] });
    api.data.builds.push({ id: "b1", userId: "1", name: "x", parts: { gpu: "13" } });

    const preview = await deleteProductPreview.handler(ctx, { id: "13" });
    expect(preview).toMatchObject({ product: { id: "13" }, cartsWithProduct: 1, savedBuildsWithProduct: 1 });
    expect(product("13")).toBeDefined();

    expect(await deleteProductConfirm.handler(ctx, { token: preview.token })).toMatchObject({ deleted: { id: "13" } });
    expect(product("13")).toBeUndefined();
    await expect(deleteProductConfirm.handler(ctx, { token: preview.token })).rejects.toThrow(/inválido ou já usado/);
  });
});

describe("list_users", () => {
  it("lists users without passwords and filters by type and search", async () => {
    const { ctx, api } = setup();
    const all = await listUsers.handler(ctx, {});
    expect(all.users).toHaveLength(3);
    for (const user of all.users) expect(user).not.toHaveProperty("password");

    await listUsers.handler(ctx, { type: "admin", search: "mar" });
    const where = JSON.parse(api.calls.at(-1).params._where);
    expect(where).toEqual({
      type: { eq: "admin" },
      or: [{ name: { contains: "mar" } }, { email: { contains: "mar" } }, { username: { contains: "mar" } }],
    });
  });
});
