import { describe, expect, it } from "vitest";
import { addItem, addItems, cartCount, quantityOf, removeItem, setItemQuantity } from "./cart";
import { MAX_QUANTITY_PER_ITEM, maxPurchasable, stockStatus } from "./stock";
import { GPU, LAST_UNITS_CPU, OUT_OF_STOCK, SERVICE } from "../test/renderWithRouter";

describe("addItem", () => {
  it("adds a new line with the product id as a string", () => {
    expect(addItem([], { ...GPU, id: 13 }, 2)).toEqual({ items: [{ productId: "13", quantity: 2 }] });
  });

  it("merges quantities of the same product", () => {
    const { items } = addItem([{ productId: "13", quantity: 1 }], GPU, 2);
    expect(items).toEqual([{ productId: "13", quantity: 3 }]);
  });

  it("does not mutate the input", () => {
    const items = [{ productId: "13", quantity: 1 }];
    addItem(items, GPU, 1);
    expect(items).toEqual([{ productId: "13", quantity: 1 }]);
  });

  it("cannot exceed the stock, counting what is already in the cart", () => {
    expect(addItem([], LAST_UNITS_CPU, 4)).toEqual({ error: "Apenas 3 unidades disponíveis" });
    expect(addItem([{ productId: "1", quantity: 2 }], LAST_UNITS_CPU, 2)).toEqual({
      error: "Você já tem 2 no carrinho. Estoque: 3 unidades disponíveis",
    });
    expect(addItem([{ productId: "1", quantity: 2 }], LAST_UNITS_CPU, 1).items).toEqual([
      { productId: "1", quantity: 3 },
    ]);
  });

  it("rejects products without stock", () => {
    expect(addItem([], OUT_OF_STOCK, 1)).toEqual({ error: "Produto indisponível no momento" });
  });

  it("treats services as unlimited, up to the per-item limit", () => {
    expect(addItem([], SERVICE, 50).items).toEqual([{ productId: "27", quantity: 50 }]);
    expect(addItem([], SERVICE, MAX_QUANTITY_PER_ITEM + 1)).toEqual({
      error: `Limite de ${MAX_QUANTITY_PER_ITEM} unidades por item`,
    });
  });

  it.each([0, -1, 1.5, NaN])("rejects quantity %s", (quantity) => {
    expect(addItem([], GPU, quantity)).toEqual({ error: "Quantidade inválida" });
  });
});

describe("addItems", () => {
  it("adds every product, merging with the cart", () => {
    const { items } = addItems([{ productId: "13", quantity: 1 }], [
      { product: GPU, quantity: 1 },
      { product: LAST_UNITS_CPU },
      { product: SERVICE, quantity: 1 },
    ]);
    expect(items).toEqual([
      { productId: "13", quantity: 2 },
      { productId: "1", quantity: 1 },
      { productId: "27", quantity: 1 },
    ]);
  });

  it("changes nothing when one product cannot be added", () => {
    const cart = [{ productId: "1", quantity: 3 }];
    expect(addItems(cart, [{ product: GPU }, { product: LAST_UNITS_CPU }])).toEqual({
      error: `${LAST_UNITS_CPU.name}: Você já tem 3 no carrinho. Estoque: 3 unidades disponíveis`,
    });
    expect(addItems([], [{ product: OUT_OF_STOCK }]).error).toBe(`${OUT_OF_STOCK.name}: Produto indisponível no momento`);
    expect(cart).toEqual([{ productId: "1", quantity: 3 }]);
  });

  it("accepts an empty list", () => {
    expect(addItems([], [])).toEqual({ items: [] });
  });
});

describe("setItemQuantity / removeItem", () => {
  const items = [
    { productId: "13", quantity: 1 },
    { productId: "1", quantity: 1 },
  ];

  it("replaces the quantity within the stock", () => {
    expect(setItemQuantity(items, LAST_UNITS_CPU, 3).items).toEqual([
      { productId: "13", quantity: 1 },
      { productId: "1", quantity: 3 },
    ]);
    expect(setItemQuantity(items, LAST_UNITS_CPU, 4)).toEqual({ error: "Apenas 3 unidades disponíveis" });
  });

  it("removes the line when set to 0", () => {
    expect(setItemQuantity(items, GPU, 0).items).toEqual([{ productId: "1", quantity: 1 }]);
  });

  it("removes by id, comparing numbers and strings", () => {
    expect(removeItem(items, 13)).toEqual([{ productId: "1", quantity: 1 }]);
  });
});

describe("cartCount / quantityOf", () => {
  it("sums units and finds a line", () => {
    const items = [
      { productId: "13", quantity: 2 },
      { productId: "27", quantity: 3 },
    ];
    expect(cartCount(items)).toBe(5);
    expect(cartCount([])).toBe(0);
    expect(quantityOf(items, 27)).toBe(3);
    expect(quantityOf(items, "99")).toBe(0);
  });
});

describe("stock rules", () => {
  it("labels availability with text, not only colour", () => {
    expect(stockStatus(GPU)).toMatchObject({ label: "Em estoque", available: true });
    expect(stockStatus(LAST_UNITS_CPU)).toMatchObject({ label: "Últimas unidades", available: true });
    expect(stockStatus(OUT_OF_STOCK)).toMatchObject({ label: "Indisponível", available: false });
    expect(stockStatus(SERVICE)).toMatchObject({ label: "Sob agendamento", available: true });
  });

  it("limits purchases to the stock, and services to the per-item limit", () => {
    expect(maxPurchasable(GPU)).toBe(6);
    expect(maxPurchasable(OUT_OF_STOCK)).toBe(0);
    expect(maxPurchasable(SERVICE)).toBe(MAX_QUANTITY_PER_ITEM);
    expect(maxPurchasable({ ...GPU, stock: 500 })).toBe(MAX_QUANTITY_PER_ITEM);
  });
});
