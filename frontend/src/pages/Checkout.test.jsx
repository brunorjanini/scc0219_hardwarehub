import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import { CLIENT_SESSION, GPU, LAST_UNITS_CPU, SERVICE, renderWithRouter } from "../test/renderWithRouter";
import { CLIENT, installStore } from "../test/mockStore";
import { createOrder } from "../api/orders";
import { saveCartItems } from "../api/carts";
import { ApiError } from "../api/http";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));
vi.mock("../api/orders", async (importOriginal) => ({
  ...(await importOriginal()),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
}));
vi.mock("../api/users", async (importOriginal) => ({ ...(await importOriginal()), getUser: vi.fn() }));

const CART = [
  { productId: "13", quantity: 2 },
  { productId: "27", quantity: 1 },
];

function renderCheckout(store = {}) {
  const db = installStore({ products: [GPU, LAST_UNITS_CPU, SERVICE], users: [CLIENT], cartItems: CART, ...store });
  const view = renderWithRouter(routes, { path: "/checkout", session: CLIENT_SESSION });
  return { db, ...view };
}

async function pay(cardNumber) {
  const user = userEvent.setup();
  const card = await screen.findByLabelText("Número do cartão");
  if (cardNumber) await user.type(card, cardNumber);
  await user.click(screen.getByRole("button", { name: /^Pagar/ }));
  return user;
}

describe("Checkout", () => {
  it("prefills the saved address and shows the order summary", async () => {
    renderCheckout();

    expect(await screen.findByLabelText("Rua")).toHaveValue(CLIENT.address.street);
    expect(screen.getByLabelText("Número")).toHaveValue("400");
    expect(screen.getByLabelText("Cidade")).toHaveValue("São Carlos");
    expect(screen.getByLabelText("CEP")).toHaveValue("13566-590");

    const summary = screen.getByRole("complementary", { name: "Resumo do pedido" });
    expect(within(summary).getByRole("rowheader", { name: GPU.name })).toBeInTheDocument();
    expect(within(summary).getByText(/8\.799,70/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar R\$\s8\.799,70/ })).toBeInTheDocument();
  });

  it("pays, updates stock and sold, empties the cart and shows the confirmation", async () => {
    const { db, router } = renderCheckout();

    await pay("4111 1111 1111 1234");

    expect(await screen.findByRole("heading", { name: "Pedido confirmado!" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/order/o1");

    // Assignment rule: stock - quantity, sold + quantity
    expect(db.products[13]).toMatchObject({ stock: GPU.stock - 2, sold: GPU.sold + 2 });
    expect(db.products[27]).toMatchObject({ stock: null, sold: SERVICE.sold + 1 });

    // Cart emptied by the payment
    expect(db.cart.items).toEqual([]);
    expect(screen.getByRole("link", { name: "Carrinho, 0 itens" })).toBeInTheDocument();

    // Only the last 4 digits are saved and shown
    expect(db.orders.o1.cardLast4).toBe("1234");
    expect(JSON.stringify(db.orders.o1)).not.toContain("4111");
    expect(screen.getByText("Cartão terminado em 1234")).toBeInTheDocument();
    expect(screen.getByText(/Av\. Trabalhador São-carlense, 400/)).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
  });

  it("validates the card number before calling the server", async () => {
    renderCheckout();

    await pay("");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Informe o número do cartão"));

    await pay("abc");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("apenas dígitos"));
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("validates the address", async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.clear(await screen.findByLabelText("CEP"));
    await user.type(screen.getByLabelText("CEP"), "123");
    await pay("1234");

    expect(await screen.findByRole("alert")).toHaveTextContent("CEP inválido");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("keeps the cart and explains when the payment fails", async () => {
    const { db } = renderCheckout();
    createOrder.mockRejectedValue(new ApiError("Erro na requisição (500)", 500));

    await pay("1234");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Nada foi cobrado e seu carrinho foi mantido/);
    expect(db.cart.items).toEqual(CART);
    // Stock rolled back
    expect(db.products[13]).toMatchObject({ stock: GPU.stock, sold: GPU.sold });
    expect(saveCartItems).not.toHaveBeenCalled();
    // The form stays usable for a new try
    expect(screen.getByRole("button", { name: /^Pagar/ })).toBeEnabled();
  });

  it("sends the client back to the cart when it is empty", async () => {
    const { router } = renderCheckout({ cartItems: null });
    await waitFor(() => expect(router.state.location.pathname).toBe("/cart"));
  });

  it("sends the client back to the cart when an item has a problem", async () => {
    const { router } = renderCheckout({ products: [{ ...GPU, stock: 1 }, SERVICE] });
    await waitFor(() => expect(router.state.location.pathname).toBe("/cart"));
    expect(await screen.findByText(/Apenas 1 em estoque/)).toBeInTheDocument();
  });
});

describe("OrderConfirmation", () => {
  it("hides orders of other clients", async () => {
    installStore({ orders: [{ id: "o9", userId: "2", items: [], total: 0, date: "2026-11-03T12:00:00Z", status: "Pago" }] });
    renderWithRouter(routes, { path: "/order/o9", session: CLIENT_SESSION });

    expect(await screen.findByRole("heading", { name: "Pedido não encontrado" })).toBeInTheDocument();
  });

  it("explains when the order does not exist", async () => {
    installStore({});
    renderWithRouter(routes, { path: "/order/nope", session: CLIENT_SESSION });

    expect(await screen.findByText("Não encontramos este pedido na sua conta.")).toBeInTheDocument();
  });
});
