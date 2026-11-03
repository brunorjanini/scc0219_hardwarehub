// PC Builder summary and "add the whole build to the cart" (Task 9),
// including the full demo: build, add, check out, stock goes down.
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../seed.json";
import { routes } from "../routes";
import { ADMIN_SESSION, CLIENT_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { CLIENT, installStore } from "../test/mockStore";
import { createCart, saveCartItems } from "../api/carts";
import { BUILDER_STORAGE_KEY } from "../utils/builder";

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

const byName = (name) => seed.products.find((p) => p.name === name);
const ASSEMBLY = byName("Montagem de PC");

// A valid build from the seed: 120 + 220 + 100 = 440 W, 650 W PSU
const BUILD = {
  Processador: "AMD Ryzen 7 7800X3D",
  "Placa-mãe": "ASUS TUF Gaming B650M-Plus",
  "Memória RAM": "Kingston Fury Beast 32GB (2x16) DDR5 6000MHz",
  "Placa de vídeo": "GeForce RTX 4070 SUPER 12GB",
  Armazenamento: "Samsung 990 Pro 2TB NVMe",
  Fonte: "Corsair CX650 650W 80 Plus Bronze",
  Gabinete: "NZXT H5 Flow",
};
const BUILD_IDS = Object.values(BUILD).map((name) => byName(name).id);
const BUILD_PRICE = Object.values(BUILD).reduce((sum, name) => sum + byName(name).price, 0);

function renderBuilder({ session = CLIENT_SESSION, cartItems = null } = {}) {
  const db = installStore({ products: seed.products, users: [CLIENT], cartItems });
  const view = renderWithRouter(routes, { path: "/monte-seu-pc", session });
  return { db, ...view };
}

async function choose(user, label, productName) {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^(Escolher|Trocar) ${label}$`) }));
  const picker = screen.getByRole("region", { name: `Opções de ${label}` });
  await user.click(within(picker).getByRole("button", { name: `Escolher ${productName}` }));
}

async function chooseBuild(user, build = BUILD) {
  for (const [label, name] of Object.entries(build)) await choose(user, label, name);
}

const summary = () => screen.getByRole("complementary", { name: "Resumo do setup" });
const addButton = () => within(summary()).getByRole("button", { name: /Adicionar configuração ao carrinho/ });
// "R$ 9.495,30" -> regex tolerant to the non-breaking space of Intl
const price = (value) =>
  new RegExp(value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(".", "\\."));

describe("Builder summary", () => {
  it("shows prices, power and the total as parts are chosen", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await choose(user, "Processador", BUILD.Processador);
    await choose(user, "Placa de vídeo", BUILD["Placa de vídeo"]);

    const card = summary();
    const line = (label) => within(card).getByText(label).closest("li");
    expect(line("Processador")).toHaveTextContent(price(2499.9));
    expect(line("Placa-mãe")).toHaveTextContent("–");
    expect(within(card).getByText("Consumo estimado").parentElement).toHaveTextContent("440 W");
    expect(within(card).getByText("Fonte recomendada").parentElement).toHaveTextContent("550 W");
    expect(within(card).getByText("Total").parentElement).toHaveTextContent(price(2499.9 + 4299.9));
  });

  it("keeps the button disabled and says what is missing", async () => {
    const user = userEvent.setup();
    renderBuilder();
    const partial = { ...BUILD };
    delete partial.Armazenamento;
    delete partial.Fonte;

    await chooseBuild(user, partial);

    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveAccessibleDescription("Escolha também: Armazenamento e Fonte.");
  });

  it("does not allow incompatible builds", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await chooseBuild(user, { ...BUILD, Processador: "Intel Core i5-14600K" });

    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveAccessibleDescription("Resolva as incompatibilidades para continuar.");
  });

  it("adds the optional assembly service to the total", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await chooseBuild(user);

    const total = () => within(summary()).getByText("Total").parentElement;
    expect(total()).toHaveTextContent(price(BUILD_PRICE));

    await user.click(within(summary()).getByRole("checkbox", { name: /Incluir Montagem de PC/ }));
    expect(total()).toHaveTextContent(price(BUILD_PRICE + ASSEMBLY.price));
    expect(within(summary()).getByText("Montagem de PC").closest("li")).toHaveTextContent(price(ASSEMBLY.price));
  });
});

describe("Builder: add to cart", () => {
  it("adds every part and the assembly in one cart change", async () => {
    const user = userEvent.setup();
    const { db } = renderBuilder();
    await chooseBuild(user);
    await user.click(within(summary()).getByRole("checkbox", { name: /Incluir Montagem de PC/ }));

    expect(addButton()).toBeEnabled();
    await user.click(addButton());

    expect(await within(summary()).findByText("Configuração adicionada ao carrinho.")).toBeInTheDocument();
    // The client had no cart yet: it is created once with all 8 items
    expect(createCart).toHaveBeenCalledTimes(1);
    expect(saveCartItems).not.toHaveBeenCalled();
    expect(db.cart.items).toEqual([...BUILD_IDS, ASSEMBLY.id].map((productId) => ({ productId, quantity: 1 })));
    expect(screen.getByRole("link", { name: "Carrinho, 8 itens" })).toBeInTheDocument();
    expect(within(summary()).getByRole("link", { name: "Ir para o carrinho" })).toHaveAttribute("href", "/cart");
  });

  it("adds nothing when one part would exceed its stock", async () => {
    const user = userEvent.setup();
    // The client already has all 3 units of the Ryzen 7 in the cart
    const { db } = renderBuilder({ cartItems: [{ productId: "1", quantity: 3 }] });
    await chooseBuild(user);

    await user.click(addButton());

    expect(await within(summary()).findByText(/AMD Ryzen 7 7800X3D: Você já tem 3 no carrinho/)).toBeInTheDocument();
    expect(db.cart.items).toEqual([{ productId: "1", quantity: 3 }]);
    expect(saveCartItems).not.toHaveBeenCalled();
  });

  it("sends guests to login and keeps the build for when they come back", async () => {
    const user = userEvent.setup();
    installStore({ products: seed.products });
    const { router } = renderWithRouter(routes, { path: "/monte-seu-pc" });
    await chooseBuild(user);

    // Enabled for guests: clicking asks them to log in
    await user.click(addButton());

    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.state.from.pathname).toBe("/monte-seu-pc");
    expect(Object.values(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY)))).toEqual(BUILD_IDS);
  });

  it("does not let administrators buy", async () => {
    const user = userEvent.setup();
    renderBuilder({ session: ADMIN_SESSION });
    await chooseBuild(user);

    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveAccessibleDescription(/Administradores não fazem compras/);
  });
});

describe("Builder: demo", () => {
  it("builds a valid PC, adds it, checks out, and the stock goes down", async () => {
    const user = userEvent.setup();
    const { db } = renderBuilder({ cartItems: [] });

    await chooseBuild(user);
    await user.click(within(summary()).getByRole("checkbox", { name: /Incluir Montagem de PC/ }));
    await user.click(addButton());
    await user.click(await within(summary()).findByRole("link", { name: "Ir para o carrinho" }));

    // Cart -> checkout -> pay
    await user.click(await screen.findByRole("link", { name: "Finalizar compra" }));
    await user.type(await screen.findByLabelText("Número do cartão"), "4111 1111 1111 1234");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));
    expect(await screen.findByRole("heading", { name: "Pedido confirmado!" })).toBeInTheDocument();

    // Each part: stock - 1, sold + 1; the service only counts as sold
    for (const id of BUILD_IDS) {
      const before = seed.products.find((p) => p.id === id);
      expect(db.products[id], before.name).toMatchObject({ stock: before.stock - 1, sold: before.sold + 1 });
    }
    expect(db.products[ASSEMBLY.id]).toMatchObject({ stock: null, sold: ASSEMBLY.sold + 1 });

    const order = Object.values(db.orders)[0];
    expect(order.items).toHaveLength(8);
    expect(order.total).toBeCloseTo(BUILD_PRICE + ASSEMBLY.price);
    expect(db.cart.items).toEqual([]);
    await waitFor(() => expect(screen.getByRole("link", { name: "Carrinho, 0 itens" })).toBeInTheDocument());
  });
});
