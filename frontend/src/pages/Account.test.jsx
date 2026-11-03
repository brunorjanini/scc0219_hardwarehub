import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import { ADMIN_SESSION, CLIENT_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { CLIENT, installStore } from "../test/mockStore";
import { findUsersByEmail, updateUser } from "../api/users";
import * as orders from "../api/orders";
import { SESSION_KEY } from "../contexts/auth";

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
  listOrdersByUser: vi.fn(),
}));
vi.mock("../api/users", async (importOriginal) => ({
  ...(await importOriginal()),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  findUsersByEmail: vi.fn(),
}));
// Saved builds have their own tests (SavedBuilds.test.jsx)
vi.mock("../api/builds", () => ({
  listBuildsByUser: vi.fn(async () => []),
  createBuild: vi.fn(),
  deleteBuild: vi.fn(),
}));

// Stored password of the seed client
const STORED = { ...CLIENT, password: "Password123" };
const OTHER = { id: "7", type: "user", name: "Bruno", email: "bruno@usp.br", password: "x" };

const ORDERS = [
  { id: "o1", userId: "1", items: [{ productId: "13", name: "RTX", price: 100, quantity: 2 }], total: 200, date: "2026-11-01T10:00:00Z", status: "Pago", cardLast4: "1234", address: CLIENT.address },
  { id: "o2", userId: "1", items: [{ productId: "27", name: "Montagem", price: 199.9, quantity: 1 }], total: 199.9, date: "2026-11-03T10:00:00Z", status: "Pago", cardLast4: "9999", address: CLIENT.address },
  { id: "o3", userId: "7", items: [], total: 50, date: "2026-11-02T10:00:00Z", status: "Pago" },
];

function renderAccount(store = {}, session = CLIENT_SESSION) {
  const db = installStore({ users: [STORED, OTHER], orders: ORDERS, ...store });
  const view = renderWithRouter(routes, { path: "/account", session });
  return { db, ...view };
}

// Section of the page by its heading
const section = (name) => screen.getByRole("heading", { name }).closest("section");

async function replaceField(user, label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value) await user.type(input, value);
}

describe("Account: profile", () => {
  it("shows the saved data", async () => {
    renderAccount();

    expect(await screen.findByLabelText("Nome completo")).toHaveValue("Ana Souza");
    expect(screen.getByLabelText("E-mail")).toHaveValue("user@gmail.com");
    expect(screen.getByLabelText("Telefone")).toHaveValue("(16) 99123-4567");
    expect(screen.getByLabelText("Rua")).toHaveValue(CLIENT.address.street);
    expect(screen.getByLabelText("CEP")).toHaveValue("13566-590");
  });

  it("saves the changes and updates the name in the header", async () => {
    const user = userEvent.setup();
    const { db } = renderAccount();
    await screen.findByLabelText("Nome completo");

    await replaceField(user, "Nome completo", "Ana Maria Souza");
    await replaceField(user, "Cidade", "Araraquara");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(await screen.findByText("Dados atualizados com sucesso")).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith("1", {
      name: "Ana Maria Souza",
      email: "user@gmail.com",
      phone: "(16) 99123-4567",
      address: { ...CLIENT.address, city: "Araraquara" },
    });
    // The password is never part of the profile update
    expect(db.users[1].password).toBe("Password123");
    // Unchanged email: no uniqueness check needed
    expect(findUsersByEmail).not.toHaveBeenCalled();

    expect(screen.getByRole("link", { name: "Olá, Ana (Minha conta)" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)).name).toBe("Ana Maria Souza");
  });

  it("refuses an email used by another account", async () => {
    const user = userEvent.setup();
    renderAccount();
    await screen.findByLabelText("E-mail");

    await replaceField(user, "E-mail", "Bruno@USP.br");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(await screen.findByText("Esse e-mail já está cadastrado em outra conta")).toBeInTheDocument();
    expect(findUsersByEmail).toHaveBeenCalledWith("bruno@usp.br");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["Telefone", "123", /Telefone inválido/],
    ["CEP", "abc", "CEP inválido"],
    ["E-mail", "ana", "E-mail inválido"],
    ["Rua", "", "Preencha todos os campos"],
  ])("validates %s", async (label, value, message) => {
    const user = userEvent.setup();
    renderAccount();
    await screen.findByLabelText(label);

    await replaceField(user, label, value);
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(await within(section("Meus dados")).findByRole("alert")).toHaveTextContent(message);
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("Account: password", () => {
  async function changePassword(current, next, confirm = next) {
    const user = userEvent.setup();
    await screen.findByLabelText("Senha atual");
    if (current) await user.type(screen.getByLabelText("Senha atual"), current);
    if (next) await user.type(screen.getByLabelText("Nova senha"), next);
    if (confirm) await user.type(screen.getByLabelText("Confirmar nova senha"), confirm);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
  }

  it("changes the password when the current one is right", async () => {
    const { db } = renderAccount();

    await changePassword("Password123", "NovaSenha@1");

    expect(await screen.findByText("Senha alterada com sucesso")).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith("1", { password: "NovaSenha@1" });
    expect(db.users[1].password).toBe("NovaSenha@1");
    // Fields are cleared after the change
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
  });

  it("refuses a wrong current password", async () => {
    renderAccount();
    await changePassword("errada", "NovaSenha@1");

    expect(await screen.findByText("Senha atual incorreta")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["Password123", "NovaSenha@1", "Outra@123", "A confirmação não confere com a nova senha"],
    ["Password123", "fraca", "fraca", /no mínimo 8 caracteres/],
    ["Password123", "Password123", "Password123", "A nova senha deve ser diferente da atual"],
    ["", "NovaSenha@1", "NovaSenha@1", "Preencha todos os campos de senha"],
  ])("validates (%s → %s)", async (current, next, confirm, message) => {
    renderAccount();
    await changePassword(current, next, confirm);

    expect(await within(section("Alterar senha")).findByRole("alert")).toHaveTextContent(message);
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("Account: orders", () => {
  it("lists only the client's orders, newest first, with links to the details", async () => {
    renderAccount();

    const table = await screen.findByRole("table", { name: /Seus pedidos/ });
    expect(orders.listOrdersByUser).toHaveBeenCalledWith("1");

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("rowheader")).toHaveTextContent("#o2");
    expect(within(rows[1]).getByText("2 itens")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/200,00/)).toBeInTheDocument();
    expect(within(rows[0]).getByRole("link", { name: "Ver detalhes do pedido #o2" })).toHaveAttribute("href", "/order/o2");
    expect(screen.queryByText("#o3")).not.toBeInTheDocument();
  });

  it("opens an order from the history as a detail page", async () => {
    const user = userEvent.setup();
    renderAccount();

    await user.click(await screen.findByRole("link", { name: "Ver detalhes do pedido #o1" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pedido #o1" })).toBeInTheDocument();
    expect(screen.queryByText("Pedido confirmado!")).not.toBeInTheDocument();
    expect(screen.getByText("Cartão terminado em 1234")).toBeInTheDocument();
  });

  it("shows an empty state without orders", async () => {
    renderAccount({ orders: [] });

    expect(await screen.findByText("Você ainda não fez nenhum pedido.")).toBeInTheDocument();
  });
});

describe("Account: access", () => {
  it("sends guests to login", async () => {
    installStore({});
    const { router } = renderWithRouter(routes, { path: "/account" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("is not for administrators", async () => {
    installStore({});
    const { router } = renderWithRouter(routes, { path: "/account", session: ADMIN_SESSION });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("is reachable from the header", async () => {
    const user = userEvent.setup();
    installStore({ users: [STORED], orders: [] });
    const { router } = renderWithRouter(routes, { path: "/", session: CLIENT_SESSION });

    await user.click(screen.getByRole("link", { name: "Olá, Ana (Minha conta)" }));
    expect(router.state.location.pathname).toBe("/account");
  });
});
