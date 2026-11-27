import { describe, expect, it } from "vitest";
import { createConfirmations } from "../src/confirmations.js";
import { ToolError } from "../src/errors.js";
import { createIdentity } from "../src/identity.js";
import {
  addBuildToCart,
  addToCart,
  checkoutConfirm,
  checkoutPreview,
  clearCartConfirm,
  clearCartPreview,
  getCart,
  getOrder,
  listMyOrders,
  listSavedBuilds,
  removeCartItem,
  saveBuild,
  updateCartItem,
} from "../src/tools/customer.js";
import { createFakeApi } from "./fakeApi.js";

// Seed customer: Ana Souza (id "1"). Admin: id "3".
const VALID_BUILD = { cpu: "2", motherboard: "5", ram: "10", gpu: "14", storage: "17", psu: "20", case: "22" };

function setup({ userId = "1", checkout = true, clock } = {}) {
  const api = createFakeApi(undefined, { checkout });
  const config = { mode: "customer", userId, testCard: "4111 1111 1111 1234" };
  const confirmations = createConfirmations(clock ? { now: () => clock.now } : {});
  const ctx = { api, config, identity: createIdentity(api, config), confirmations };
  const product = (id) => api.data.products.find((p) => p.id === id);
  const cartOf = (uid = userId) => api.data.carts.find((c) => c.userId === uid)?.items ?? [];
  return { api, ctx, product, cartOf };
}

describe("identity", () => {
  it("rejects an administrator account in customer mode", async () => {
    const { ctx } = setup({ userId: "3" });
    await expect(getCart.handler(ctx)).rejects.toThrow(/é um administrador/);
  });

  it("rejects an unknown account", async () => {
    const { ctx } = setup({ userId: "999" });
    await expect(getCart.handler(ctx)).rejects.toThrow(/não existe na loja/);
  });

  it("loads the customer once and never exposes the password", async () => {
    const { ctx, api } = setup();
    const user = await ctx.identity.customer();
    await ctx.identity.customer();
    expect(user).not.toHaveProperty("password");
    expect(api.calls.filter((c) => c.path === "/users/1")).toHaveLength(1);
  });
});

describe("cart", () => {
  it("starts empty and creates the cart on the first addition", async () => {
    const { ctx, cartOf } = setup();
    expect(await getCart.handler(ctx)).toMatchObject({ items: [], count: 0, total: 0, canCheckout: false });

    const cart = await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 2 }, { productId: "27", quantity: 1 }] });
    expect(cart).toMatchObject({ count: 3, total: 799.7, canCheckout: true, problems: [] });
    expect(cartOf()).toEqual([
      { productId: "11", quantity: 2 },
      { productId: "27", quantity: 1 },
    ]);
  });

  it("adds all or nothing and respects stock, counting what is in the cart", async () => {
    const { ctx, cartOf } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "1", quantity: 2 }] }); // stock 3
    await expect(
      addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }, { productId: "1", quantity: 2 }] }),
    ).rejects.toThrow("AMD Ryzen 7 7800X3D: Você já tem 2 no carrinho. Estoque: 3 unidades disponíveis");
    expect(cartOf()).toEqual([{ productId: "1", quantity: 2 }]);
  });

  it("refuses out-of-stock and unknown products", async () => {
    const { ctx } = setup();
    await expect(addToCart.handler(ctx, { items: [{ productId: "8", quantity: 1 }] })).rejects.toThrow("Produto indisponível no momento");
    await expect(addToCart.handler(ctx, { items: [{ productId: "999", quantity: 1 }] })).rejects.toThrow(ToolError);
  });

  it("sets quantities within stock, and 0 removes the line", async () => {
    const { ctx, cartOf } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "1", quantity: 1 }, { productId: "11", quantity: 1 }] });
    await expect(updateCartItem.handler(ctx, { productId: "1", quantity: 4 })).rejects.toThrow("Apenas 3 unidades disponíveis");
    await updateCartItem.handler(ctx, { productId: "1", quantity: 3 });
    const cart = await updateCartItem.handler(ctx, { productId: "11", quantity: 0 });
    expect(cartOf()).toEqual([{ productId: "1", quantity: 3 }]);
    expect(cart.total).toBe(7499.7);
  });

  it("removes one product and reports one that is not there", async () => {
    const { ctx, cartOf } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    await expect(removeCartItem.handler(ctx, { productId: "2" })).rejects.toThrow("não está no carrinho");
    await removeCartItem.handler(ctx, { productId: "11" });
    expect(cartOf()).toEqual([]);
  });

  it("flags lines the store would not sell anymore", async () => {
    const { ctx, product } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "1", quantity: 2 }] });
    product("1").stock = 1;
    const cart = await getCart.handler(ctx);
    expect(cart.canCheckout).toBe(false);
    expect(cart.problems).toEqual(["AMD Ryzen 7 7800X3D: Só há 1 unidade(s) disponível(is)"]);
  });

  it("only touches the configured customer's cart", async () => {
    const { ctx, api, cartOf } = setup();
    api.data.carts.push({ id: "c2", userId: "2", items: [{ productId: "3", quantity: 1 }] });
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    expect(cartOf("2")).toEqual([{ productId: "3", quantity: 1 }]);
  });
});

describe("clearing the cart (two steps)", () => {
  it("only empties the cart with the preview token, once", async () => {
    const { ctx, cartOf } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    const preview = await clearCartPreview.handler(ctx);
    expect(preview).toMatchObject({ token: expect.any(String), cart: { count: 1 } });
    expect(cartOf()).toHaveLength(1);

    await clearCartConfirm.handler(ctx, { token: preview.token });
    expect(cartOf()).toEqual([]);
    await expect(clearCartConfirm.handler(ctx, { token: preview.token })).rejects.toThrow(/inválido ou já usado/);
  });

  it("refuses an empty cart and a token of another action", async () => {
    const { ctx } = setup();
    await expect(clearCartPreview.handler(ctx)).rejects.toThrow("O carrinho já está vazio.");
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    const { token } = await checkoutPreview.handler(ctx);
    await expect(clearCartConfirm.handler(ctx, { token })).rejects.toThrow(/confirma outra ação \(checkout\)/);
  });
});

describe("builds", () => {
  it("adds a complete compatible build with the assembly service", async () => {
    const { ctx, cartOf } = setup();
    const cart = await addBuildToCart.handler(ctx, { parts: VALID_BUILD, includeAssembly: true });
    expect(cart).toMatchObject({ count: 8, total: 7449.2 });
    expect(cartOf().map((i) => i.productId)).toEqual(["2", "5", "10", "14", "17", "20", "22", "27"]);
  });

  it("blocks incomplete, incompatible or out-of-stock builds like the store", async () => {
    const { ctx, cartOf } = setup();
    await expect(addBuildToCart.handler(ctx, { parts: { cpu: "2" } })).rejects.toThrow(/^Escolha também: Placa-mãe/);
    await expect(addBuildToCart.handler(ctx, { parts: { ...VALID_BUILD, cpu: "4" } })).rejects.toThrow(
      "Resolva as incompatibilidades para continuar.",
    );
    await expect(
      addBuildToCart.handler(ctx, { parts: { ...VALID_BUILD, cpu: "4", motherboard: "8" } }),
    ).rejects.toThrow("Sem estoque: ASRock B760M Pro RS. Troque essa peça para continuar.");
    expect(cartOf()).toEqual([]);
  });

  it("saves builds and lists them with today's prices", async () => {
    const { ctx, product } = setup();
    await expect(saveBuild.handler(ctx, { name: "  ", parts: VALID_BUILD })).rejects.toThrow("Dê um nome à montagem");
    await expect(saveBuild.handler(ctx, { name: "Vazia", parts: {} })).rejects.toThrow(/pelo menos uma peça/);

    const saved = await saveBuild.handler(ctx, { name: "PC do agente", parts: VALID_BUILD });
    expect(saved).toMatchObject({ name: "PC do agente", complete: true, savedTotal: 7249.3, priceChange: 0 });

    product("14").price = 1699.9;
    const { builds } = await listSavedBuilds.handler(ctx);
    expect(builds).toEqual([expect.objectContaining({ id: saved.id, currentTotal: 7149.3, priceChange: -100 })]);
  });
});

describe("checkout (two steps)", () => {
  it("previews, then buys with the configured card and empties the cart", async () => {
    const { ctx, api, product, cartOf } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "1", quantity: 3 }] });
    const preview = await checkoutPreview.handler(ctx);
    expect(preview).toMatchObject({ cart: { total: 7499.7 }, cardLast4: "1234", address: { city: "São Carlos" } });
    expect(product("1").stock).toBe(3);

    const order = await checkoutConfirm.handler(ctx, { token: preview.token });
    expect(order).toMatchObject({ total: 7499.7, status: "Pago", cardLast4: "1234" });
    expect(product("1")).toMatchObject({ stock: 0, sold: 45 });
    expect(cartOf()).toEqual([]);
    expect(api.calls.find((c) => c.path === "/checkout").body).toEqual({
      userId: "1",
      items: [{ productId: "1", quantity: 3 }],
      cardNumber: "4111 1111 1111 1234",
    });
  });

  it("refuses when the cart changed after the preview", async () => {
    const { ctx, api } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    const { token } = await checkoutPreview.handler(ctx);
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    await expect(checkoutConfirm.handler(ctx, { token })).rejects.toThrow(/mudaram depois da prévia/);
    expect(api.calls.some((c) => c.path === "/checkout")).toBe(false);
  });

  it("refuses when a price changed after the preview", async () => {
    const { ctx, product } = setup();
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    const { token } = await checkoutPreview.handler(ctx);
    product("11").price = 1;
    await expect(checkoutConfirm.handler(ctx, { token })).rejects.toThrow(/mudaram depois da prévia/);
  });

  it("expires tokens after five minutes", async () => {
    const clock = { now: 0 };
    const { ctx } = setup({ clock });
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    const { token } = await checkoutPreview.handler(ctx);
    clock.now = 5 * 60 * 1000;
    await expect(checkoutConfirm.handler(ctx, { token })).rejects.toThrow(/expirou/);
  });

  it("refuses a preview of an empty or unsellable cart", async () => {
    const { ctx, product } = setup();
    await expect(checkoutPreview.handler(ctx)).rejects.toThrow("O carrinho está vazio.");
    await addToCart.handler(ctx, { items: [{ productId: "1", quantity: 1 }] });
    product("1").stock = 0;
    await expect(checkoutPreview.handler(ctx)).rejects.toThrow(/Produto indisponível no momento/);
  });

  it("explains that json-server cannot take orders", async () => {
    const { ctx } = setup({ checkout: false });
    await addToCart.handler(ctx, { items: [{ productId: "11", quantity: 1 }] });
    const { token } = await checkoutPreview.handler(ctx);
    await expect(checkoutConfirm.handler(ctx, { token })).rejects.toThrow(/exige o backend/);
  });
});

describe("orders", () => {
  it("lists only the customer's orders, newest first, and hides others", async () => {
    const { ctx, api } = setup();
    api.data.orders.push(
      { id: "o1", userId: "1", items: [{ productId: "11", name: "RAM", price: 299.9, quantity: 2 }], total: 599.8, date: "2026-11-01T10:00:00Z", status: "Pago", cardLast4: "1111", address: null },
      { id: "o2", userId: "1", items: [], total: 0, date: "2026-11-20T10:00:00Z", status: "Pago", cardLast4: "2222", address: null },
      { id: "o3", userId: "2", items: [], total: 10, date: "2026-11-25T10:00:00Z", status: "Pago", cardLast4: "3333", address: null },
    );
    const { orders } = await listMyOrders.handler(ctx);
    expect(orders.map((o) => o.id)).toEqual(["o2", "o1"]);
    expect(await getOrder.handler(ctx, { id: "o1" })).toMatchObject({ total: 599.8, items: [{ subtotal: 599.8 }] });
    await expect(getOrder.handler(ctx, { id: "o3" })).rejects.toThrow('Pedido "o3" não encontrado.');
    await expect(getOrder.handler(ctx, { id: "nada" })).rejects.toThrow('Pedido "nada" não encontrado.');
  });
});
