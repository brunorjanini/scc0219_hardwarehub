// Accessibility smoke test (Task 12): every main page is rendered with
// realistic data and checked with axe-core. Interactive states that only
// appear after a click (dialogs, pickers) are checked too.
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "./seed.json";
import { routes } from "./routes";
import { ADMIN_SESSION, CLIENT_SESSION, renderWithRouter } from "./test/renderWithRouter";
import { CLIENT, installStore } from "./test/mockStore";
import { axeViolations } from "./test/axe";
import { createProduct, deleteProduct } from "./api/products";
import { listOrders } from "./api/orders";
import { listUsers } from "./api/users";
import { listBuildsByUser } from "./api/builds";

vi.mock("./api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock("./api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));
vi.mock("./api/orders", async (importOriginal) => ({
  ...(await importOriginal()),
  listOrders: vi.fn(),
  listOrdersByUser: vi.fn(),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
}));
vi.mock("./api/users", async (importOriginal) => ({
  ...(await importOriginal()),
  listUsers: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  findUsersByEmail: vi.fn(),
  findUsersByUsername: vi.fn(),
}));
vi.mock("./api/builds", () => ({ listBuildsByUser: vi.fn(), createBuild: vi.fn(), deleteBuild: vi.fn() }));

const ORDER = {
  id: "o1",
  userId: "1",
  items: [{ productId: "13", name: "GeForce RTX 4070 SUPER 12GB", price: 4299.9, quantity: 1 }],
  total: 4299.9,
  date: new Date().toISOString(),
  cardLast4: "1234",
  address: CLIENT.address,
  status: "Pago",
};

function install() {
  const users = seed.users.map((u) => (u.id === "1" ? { ...u, ...CLIENT, password: u.password } : u));
  const db = installStore({
    products: seed.products,
    users,
    orders: [ORDER],
    cartItems: [{ productId: "13", quantity: 1 }, { productId: "27", quantity: 1 }],
  });
  createProduct.mockReset().mockResolvedValue({});
  deleteProduct.mockReset().mockResolvedValue(null);
  listOrders.mockReset().mockResolvedValue([ORDER]);
  listUsers.mockReset().mockImplementation(async (filters = {}) =>
    users.filter((u) => !filters.type || u.type === filters.type),
  );
  listBuildsByUser.mockReset().mockResolvedValue([
    { id: "b1", userId: "1", name: "PC gamer", parts: { cpu: "1", motherboard: "5" }, total: 3799.8, createdAt: ORDER.date },
  ]);
  return db;
}

// The failure message lists every violation (the default diff truncates them)
function expectNoViolations(violations) {
  expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
}

// [path, session, text that shows the page has loaded]
const PAGES = [
  ["/", null, "Mais vendidos"],
  ["/catalog", null, /itens encontrados/],
  ["/product/13", null, "Especificações técnicas"],
  ["/login", null, "Bem-vindo de volta"],
  ["/signup", null, "Crie sua conta"],
  ["/monte-seu-pc", null, "Comece escolhendo as peças"],
  ["/cart", CLIENT_SESSION, "Finalizar compra"],
  ["/checkout", CLIENT_SESSION, "Número do cartão"],
  ["/order/o1", CLIENT_SESSION, "Cartão terminado em 1234"],
  ["/account", CLIENT_SESSION, "PC gamer"],
  ["/admin", ADMIN_SESSION, "Pedidos recentes"],
  ["/admin/products", ADMIN_SESSION, "Exibindo 1–10 de 30"],
  ["/admin/products/new", ADMIN_SESSION, "Escolha a categoria para ver as especificações."],
  ["/admin/products/13", ADMIN_SESSION, "Comprimento (mm)"],
  ["/admin/clients", ADMIN_SESSION, "Ana Souza"],
  ["/admin/clients/1", ADMIN_SESSION, "Alterar senha"],
  ["/admin/admins", ADMIN_SESSION, "Marina Costa"],
  ["/admin/admins/new", ADMIN_SESSION, "Senha de acesso"],
  ["/nao-existe", null, "Página não encontrada"],
  ["/admin/nao-existe", ADMIN_SESSION, "Página não encontrada"],
];

describe("axe: pages", () => {
  it.each(PAGES)("%s has no violations", async (path, session, ready) => {
    install();
    renderWithRouter(routes, { path, session: session ?? undefined });

    expect((await screen.findAllByText(ready)).length).toBeGreaterThan(0);
    expectNoViolations(await axeViolations());
  });
});

describe("axe: interactive states", () => {
  it("builder with a part picker open and a part chosen", async () => {
    const user = userEvent.setup();
    install();
    renderWithRouter(routes, { path: "/monte-seu-pc", session: CLIENT_SESSION });

    await user.click(await screen.findByRole("button", { name: "Escolher Processador" }));
    await user.click(screen.getByRole("button", { name: "Escolher AMD Ryzen 7 7800X3D" }));
    await user.click(screen.getByRole("button", { name: "Escolher Placa-mãe" }));

    expectNoViolations(await axeViolations());
  });

  it("delete confirmation dialog", async () => {
    const user = userEvent.setup();
    install();
    renderWithRouter(routes, { path: "/admin/products", session: ADMIN_SESSION });

    const row = (await screen.findByRole("rowheader", { name: /AMD Ryzen 7 7800X3D/ })).closest("tr");
    await user.click(within(row).getByRole("button", { name: /^Excluir/ }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    expectNoViolations(await axeViolations());
  });

  it("login error message", async () => {
    const user = userEvent.setup();
    install();
    renderWithRouter(routes, { path: "/login" });

    await user.click(await screen.findByRole("button", { name: "Entrar" }));
    await screen.findByText("Preencha todos os campos");

    expectNoViolations(await axeViolations());
  });
});
