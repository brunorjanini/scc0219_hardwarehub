import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import {
  CLIENT_SESSION,
  GPU,
  LAST_UNITS_CPU,
  OUT_OF_STOCK,
  SERVICE,
  renderWithRouter,
} from "../test/renderWithRouter";
import { getProduct, listProducts } from "../api/products";
import { createCart, getCartByUser, saveCartItems } from "../api/carts";
import { ApiError } from "../api/http";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
}));

vi.mock("../api/carts", () => ({
  getCartByUser: vi.fn(),
  createCart: vi.fn(),
  saveCartItems: vi.fn(),
}));

const PRODUCTS = { 1: LAST_UNITS_CPU, 13: GPU, 16: OUT_OF_STOCK, 27: SERVICE };

beforeEach(() => {
  getProduct.mockReset().mockImplementation(async (id) => {
    if (PRODUCTS[id]) return PRODUCTS[id];
    throw new ApiError("Erro na requisição (404)", 404);
  });
  listProducts.mockReset().mockResolvedValue([]);
  getCartByUser.mockReset().mockResolvedValue(null);
  createCart.mockReset().mockImplementation(async (userId, items) => ({ id: "c1", userId, items }));
  saveCartItems.mockReset().mockImplementation(async (id, items) => ({ id, items }));
});

describe("ProductDetail", () => {
  it("shows price, availability, description and specs", async () => {
    renderWithRouter(routes, { path: "/product/1" });

    expect(await screen.findByRole("heading", { level: 1, name: LAST_UNITS_CPU.name })).toBeInTheDocument();
    expect(getProduct).toHaveBeenCalledWith("1");
    expect(screen.getByText("Últimas unidades")).toBeInTheDocument();
    expect(screen.getByText("3 unidades disponíveis")).toBeInTheDocument();
    expect(screen.getByText(LAST_UNITS_CPU.description)).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Soquete" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "4,2 GHz" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: LAST_UNITS_CPU.name })).toHaveAttribute("src", LAST_UNITS_CPU.photo);
  });

  it("adds the chosen quantity to the client's cart", async () => {
    const user = userEvent.setup();
    renderWithRouter(routes, { path: "/product/13", session: CLIENT_SESSION });
    await screen.findByRole("heading", { level: 1, name: GPU.name });

    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(screen.getByLabelText("Quantidade")).toHaveValue(3);
    await user.click(screen.getByRole("button", { name: `Adicionar ${GPU.name} ao carrinho` }));

    expect(await screen.findByText("Adicionado ao carrinho")).toBeInTheDocument();
    expect(createCart).toHaveBeenCalledWith("1", [{ productId: "13", quantity: 3 }]);
    expect(screen.getByRole("link", { name: "Carrinho, 3 itens" })).toBeInTheDocument();
  });

  it("limits the quantity selector to the stock", async () => {
    const user = userEvent.setup();
    renderWithRouter(routes, { path: "/product/1", session: CLIENT_SESSION });
    await screen.findByRole("heading", { level: 1, name: LAST_UNITS_CPU.name });

    const plus = screen.getByRole("button", { name: "Aumentar quantidade" });
    await user.click(plus);
    await user.click(plus);
    expect(screen.getByLabelText("Quantidade")).toHaveValue(3);
    expect(plus).toBeDisabled();
  });

  it("sends guests to login and remembers the product page", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(routes, { path: "/product/13" });
    await screen.findByRole("heading", { level: 1, name: GPU.name });

    await user.click(screen.getByRole("button", { name: `Adicionar ${GPU.name} ao carrinho` }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.state.from.pathname).toBe("/product/13");
    expect(createCart).not.toHaveBeenCalled();
  });

  it("shows services as scheduled, without a stock count", async () => {
    renderWithRouter(routes, { path: "/product/27" });

    expect(await screen.findByText("Sob agendamento")).toBeInTheDocument();
    expect(screen.queryByText(/unidades disponíveis/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Detalhes do serviço" })).toBeInTheDocument();
  });

  it("disables the purchase of out-of-stock products", async () => {
    renderWithRouter(routes, { path: "/product/16" });

    expect(await screen.findByRole("button", { name: "Indisponível" })).toBeDisabled();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    // Missing photo: the category placeholder is used
    expect(screen.getByRole("img", { name: OUT_OF_STOCK.name })).toHaveAttribute(
      "src",
      "/products/placeholder-storage.svg",
    );
  });

  it("explains when the product does not exist", async () => {
    renderWithRouter(routes, { path: "/product/999" });

    expect(await screen.findByRole("heading", { name: "Produto não encontrado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao catálogo" })).toHaveAttribute("href", "/catalog");
  });
});
