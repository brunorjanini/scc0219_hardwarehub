import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutError, buildCartLines, cartTotal, fetchProducts, lineCount, placeOrder } from "./checkout";
import { getProduct, updateProduct } from "../api/products";
import { createOrder } from "../api/orders";
import { ApiError } from "../api/http";
import { GPU, LAST_UNITS_CPU, SERVICE } from "../test/renderWithRouter";

vi.mock("../api/products", () => ({ getProduct: vi.fn(), updateProduct: vi.fn() }));
vi.mock("../api/orders", () => ({ createOrder: vi.fn() }));

const ADDRESS = { street: "Av. Trabalhador São-carlense", number: "400", city: "São Carlos", zip: "13566-590" };

// Fake product table that PATCH really changes, to check the final state
let db;

beforeEach(() => {
  db = {
    13: { ...GPU },
    1: { ...LAST_UNITS_CPU },
    27: { ...SERVICE },
  };
  getProduct.mockReset().mockImplementation(async (id) => {
    if (!db[id]) throw new ApiError("Erro na requisição (404)", 404);
    return { ...db[id] };
  });
  updateProduct.mockReset().mockImplementation(async (id, changes) => {
    db[id] = { ...db[id], ...changes };
    return db[id];
  });
  createOrder.mockReset().mockImplementation(async (order) => ({ id: "o1", ...order }));
});

const purchase = (items, cardNumber = "4111 1111 1111 1234") =>
  placeOrder({ userId: "1", items, address: ADDRESS, cardNumber });

describe("placeOrder", () => {
  it("decrements stock, increments sold and creates the order", async () => {
    const order = await purchase([
      { productId: "13", quantity: 2 },
      { productId: "27", quantity: 1 },
    ]);

    expect(db[13]).toMatchObject({ stock: GPU.stock - 2, sold: GPU.sold + 2 });
    // Services have no stock: only the sold counter changes
    expect(db[27]).toMatchObject({ stock: null, sold: SERVICE.sold + 1 });
    expect(updateProduct).toHaveBeenCalledWith("27", { sold: SERVICE.sold + 1 });

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(order).toMatchObject({
      id: "o1",
      userId: "1",
      items: [
        { productId: "13", name: GPU.name, price: GPU.price, quantity: 2 },
        { productId: "27", name: SERVICE.name, price: SERVICE.price, quantity: 1 },
      ],
      total: 8799.7,
      cardLast4: "1234",
      address: ADDRESS,
      status: "Pago",
    });
    expect(Number.isNaN(Date.parse(order.date))).toBe(false);
  });

  it("uses the price from the server, not an old one", async () => {
    db[13].price = 3999.9;
    const order = await purchase([{ productId: "13", quantity: 1 }]);
    expect(order.total).toBe(3999.9);
  });

  it("refuses the order when the stock dropped below the cart quantity", async () => {
    db[1].stock = 1;

    const error = await purchase([
      { productId: "13", quantity: 1 },
      { productId: "1", quantity: 2 },
    ]).catch((e) => e);

    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.message).toMatch(`${LAST_UNITS_CPU.name}: Apenas 1 em estoque`);
    expect(updateProduct).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("refuses the order when a product was deleted", async () => {
    const error = await purchase([{ productId: "99", quantity: 1 }]).catch((e) => e);
    expect(error.message).toMatch("Item removido: Este produto não está mais disponível");
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("rolls back earlier PATCHes when a later one fails", async () => {
    updateProduct.mockImplementation(async (id, changes) => {
      // The second product fails, but rollback PATCHes (with stock) succeed
      if (id === "1" && changes.stock !== LAST_UNITS_CPU.stock) throw new ApiError("Erro na requisição (500)", 500);
      db[id] = { ...db[id], ...changes };
      return db[id];
    });

    const error = await purchase([
      { productId: "13", quantity: 2 },
      { productId: "1", quantity: 1 },
    ]).catch((e) => e);

    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.message).toMatch(/Nada foi cobrado e seu carrinho foi mantido/);
    expect(db[13]).toMatchObject({ stock: GPU.stock, sold: GPU.sold });
    expect(db[1]).toMatchObject({ stock: LAST_UNITS_CPU.stock, sold: LAST_UNITS_CPU.sold });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rolls back every product when the order cannot be saved", async () => {
    createOrder.mockRejectedValue(new ApiError("Erro na requisição (500)", 500));

    await expect(
      purchase([
        { productId: "13", quantity: 1 },
        { productId: "27", quantity: 1 },
      ]),
    ).rejects.toThrow(CheckoutError);

    expect(db[13]).toMatchObject({ stock: GPU.stock, sold: GPU.sold });
    expect(db[27]).toMatchObject({ stock: null, sold: SERVICE.sold });
  });

  it("warns when the rollback itself fails", async () => {
    createOrder.mockRejectedValue(new Error("offline"));
    updateProduct.mockImplementation(async (id, changes) => {
      if (changes.stock === GPU.stock) throw new Error("offline");
      db[id] = { ...db[id], ...changes };
      return db[id];
    });

    await expect(purchase([{ productId: "13", quantity: 1 }])).rejects.toThrow(/pode ter ficado incorreto/);
  });

  it("refuses an empty cart", async () => {
    await expect(purchase([])).rejects.toThrow("Seu carrinho está vazio.");
  });
});

describe("cart lines", () => {
  it("joins items with products, with subtotals without float noise", () => {
    const lines = buildCartLines(
      [
        { productId: 13, quantity: 3 },
        { productId: "27", quantity: 1 },
      ],
      { 13: { ...GPU, price: 899.9 }, 27: SERVICE },
    );

    expect(lines[0]).toMatchObject({ productId: "13", quantity: 3, subtotal: 2699.7, problem: "" });
    expect(cartTotal(lines)).toBe(2899.6);
    expect(lineCount(lines)).toBe(4);
  });

  it("flags deleted, sold-out and short-stock products", () => {
    const [deleted, soldOut, short] = buildCartLines(
      [
        { productId: "99", quantity: 1 },
        { productId: "16", quantity: 1 },
        { productId: "1", quantity: 5 },
      ],
      { 99: null, 16: { ...GPU, id: "16", stock: 0 }, 1: LAST_UNITS_CPU },
    );

    expect(deleted).toMatchObject({ product: null, subtotal: 0, problem: "Este produto não está mais disponível" });
    expect(soldOut.problem).toMatch(/esgotado/);
    expect(short.problem).toMatch(/Apenas 3 em estoque/);
  });

  it("fetchProducts maps 404 to null and rethrows other errors", async () => {
    await expect(fetchProducts(["13", 13, "99"])).resolves.toEqual({ 13: db[13], 99: null });
    expect(getProduct).toHaveBeenCalledTimes(2);

    getProduct.mockRejectedValueOnce(new ApiError("Não foi possível conectar ao servidor.", 0));
    await expect(fetchProducts(["13"])).rejects.toThrow("Não foi possível conectar");
  });
});
