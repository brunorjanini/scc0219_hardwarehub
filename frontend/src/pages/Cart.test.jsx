import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import { ADMIN_SESSION, CLIENT_SESSION, GPU, LAST_UNITS_CPU, SERVICE, renderWithRouter } from "../test/renderWithRouter";
import { CLIENT, installStore } from "../test/mockStore";

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

function renderCart(store) {
  const db = installStore({ products: [GPU, LAST_UNITS_CPU, SERVICE], users: [CLIENT], ...store });
  const view = renderWithRouter(routes, { path: "/cart", session: CLIENT_SESSION });
  return { db, ...view };
}

// The list item of a product in the cart
const lineOf = async (name) => (await screen.findByRole("link", { name })).closest("li");

describe("Cart", () => {
  it("lists the items with subtotals and the total", async () => {
    renderCart({
      cartItems: [
        { productId: "13", quantity: 2 },
        { productId: "27", quantity: 1 },
      ],
    });

    const gpuLine = await lineOf(GPU.name);
    expect(within(gpuLine).getByLabelText(`Quantidade de ${GPU.name}`)).toHaveValue(2);
    expect(within(gpuLine).getByText(/8\.599,80/)).toBeInTheDocument();

    const summary = screen.getByRole("complementary", { name: "Resumo" });
    expect(within(summary).getByText("3 itens")).toBeInTheDocument();
    expect(within(summary).getAllByText(/8\.799,70/)).toHaveLength(2);
    expect(within(summary).getByRole("link", { name: "Finalizar compra" })).toHaveAttribute("href", "/checkout");
  });

  it("changes the quantity and saves it", async () => {
    const user = userEvent.setup();
    const { db } = renderCart({ cartItems: [{ productId: "13", quantity: 1 }] });

    const line = await lineOf(GPU.name);
    await user.click(within(line).getByRole("button", { name: `Aumentar quantidade de ${GPU.name}` }));

    await waitFor(() => expect(db.cart.items).toEqual([{ productId: "13", quantity: 2 }]));
    expect(within(line).getByLabelText(`Quantidade de ${GPU.name}`)).toHaveValue(2);
    expect(screen.getByRole("link", { name: "Carrinho, 2 itens" })).toBeInTheDocument();
  });

  it("removes an item", async () => {
    const user = userEvent.setup();
    const { db } = renderCart({
      cartItems: [
        { productId: "13", quantity: 1 },
        { productId: "27", quantity: 1 },
      ],
    });

    await user.click(await screen.findByRole("button", { name: `Remover ${SERVICE.name} do carrinho` }));

    await waitFor(() => expect(db.cart.items).toEqual([{ productId: "13", quantity: 1 }]));
    expect(screen.queryByRole("link", { name: SERVICE.name })).not.toBeInTheDocument();
  });

  it("empties the cart only after confirmation", async () => {
    const user = userEvent.setup();
    const { db } = renderCart({ cartItems: [{ productId: "13", quantity: 1 }] });

    await user.click(await screen.findByRole("button", { name: "Esvaziar carrinho" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(db.cart.items).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Esvaziar carrinho" }));
    await user.click(screen.getByRole("button", { name: "Sim, esvaziar" }));

    expect(await screen.findByText("Seu carrinho está vazio.")).toBeInTheDocument();
    expect(db.cart.items).toEqual([]);
  });

  it("blocks checkout when the stock dropped below the cart quantity", async () => {
    renderCart({
      products: [GPU, { ...LAST_UNITS_CPU, stock: 1 }],
      cartItems: [{ productId: "1", quantity: 3 }],
    });

    const line = await lineOf(LAST_UNITS_CPU.name);
    expect(within(line).getByText(/Apenas 1 em estoque/)).toBeInTheDocument();
    expect(screen.getByText("Resolva os itens destacados para continuar.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finalizar compra" })).not.toBeInTheDocument();
  });

  it("shows deleted products so the client can remove them", async () => {
    const user = userEvent.setup();
    const { db } = renderCart({ cartItems: [{ productId: "99", quantity: 1 }] });

    expect(await screen.findByText("Produto indisponível")).toBeInTheDocument();
    expect(screen.getByText("Este produto não está mais disponível")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover Produto indisponível do carrinho" }));
    await waitFor(() => expect(db.cart.items).toEqual([]));
  });

  it("shows an empty state with a link to the catalog", async () => {
    renderCart({ cartItems: null });

    expect(await screen.findByText("Seu carrinho está vazio.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/catalog");
  });

  it("is only for clients", async () => {
    installStore({});
    const { router } = renderWithRouter(routes, { path: "/cart", session: ADMIN_SESSION });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
