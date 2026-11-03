import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../seed.json";
import { routes } from "../routes";
import { ADMIN_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { installUserStore } from "../test/userStore";
import { deleteUser, listUsers } from "../api/users";
import { getCartByUser } from "../api/carts";
import { SESSION_KEY } from "../contexts/auth";

vi.mock("../api/users", async (importOriginal) => ({
  ...(await importOriginal()),
  listUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  findUsersByEmail: vi.fn(),
  findUsersByUsername: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));

// Seed accounts: Ana (client "1"), Marina (admin "2"), Administrador (default admin "3")
const [ANA, MARINA, DEFAULT_ADMIN] = ["1", "2", "3"].map((id) => seed.users.find((u) => u.id === id));
const BRUNO = {
  id: "7",
  type: "user",
  name: "Bruno Lima",
  email: "bruno@usp.br",
  password: "Senha@123",
  phone: "(16) 98888-7777",
  address: { street: "Rua XV", number: "10", city: "Araraquara", zip: "14800-000" },
};
const MARINA_SESSION = { id: "2", type: "admin", name: "Marina Costa" };

function renderPage(path, { users = [ANA, BRUNO, MARINA, DEFAULT_ADMIN], session = ADMIN_SESSION } = {}) {
  getCartByUser.mockResolvedValue(null);
  const db = installUserStore(users);
  const view = renderWithRouter(routes, { path, session });
  return { db, ...view };
}

const rowOf = async (name) => (await screen.findByRole("rowheader", { name: new RegExp(name) })).closest("tr");
const rowNames = () =>
  screen.getAllByRole("rowheader").map((cell) => cell.querySelector(".admin-product-name").textContent);

describe("AdminUsers: clients", () => {
  it("lists only clients, with email, phone and address", async () => {
    renderPage("/admin/clients");

    const ana = await rowOf(ANA.name);
    expect(within(ana).getByText(ANA.email)).toBeInTheDocument();
    expect(within(ana).getByText(ANA.phone)).toBeInTheDocument();
    expect(within(ana).getByText(/São Carlos · CEP 13566-590/)).toBeInTheDocument();

    expect(rowNames()).toEqual([ANA.name, BRUNO.name]);
    expect(screen.getByText("2 clientes")).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ type: "user", sort: "name", page: 1, perPage: 10 }));
  });

  it("searches and keeps the search in the URL", async () => {
    const user = userEvent.setup();
    const { router } = renderPage("/admin/clients");
    await rowOf(ANA.name);

    await user.type(screen.getByLabelText("Buscar"), "usp.br{Enter}");

    await waitFor(() => expect(rowNames()).toEqual([BRUNO.name]));
    expect(router.state.location.search).toBe("?q=usp.br");
    expect(screen.getByText("1 cliente")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Limpar busca" }));
    await waitFor(() => expect(rowNames()).toHaveLength(2));
  });

  it("shows a message when the search finds nothing", async () => {
    renderPage("/admin/clients?q=zzz");
    expect(await screen.findByText("Nenhum resultado para “zzz”.")).toBeInTheDocument();
  });

  it("deletes a client after confirmation", async () => {
    const user = userEvent.setup();
    const { db } = renderPage("/admin/clients");

    await user.click(within(await rowOf(BRUNO.name)).getByRole("button", { name: `Excluir ${BRUNO.name}` }));
    const dialog = screen.getByRole("alertdialog", { name: `Excluir “${BRUNO.name}”?` });
    expect(dialog).toHaveTextContent(/carrinho do cliente são apagados/);
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(deleteUser).toHaveBeenCalledWith(BRUNO.id);
    expect(db[BRUNO.id]).toBeUndefined();
    expect(await screen.findByText(`“${BRUNO.name}” foi excluído.`)).toBeInTheDocument();
    await waitFor(() => expect(rowNames()).toEqual([ANA.name]));
  });

  it("shows the server error", async () => {
    renderPage("/admin/clients");
    listUsers.mockRejectedValue(new Error("Servidor fora do ar"));
    // Searching triggers a new request, which fails
    const user = userEvent.setup();
    await rowOf(ANA.name);
    await user.type(screen.getByLabelText("Buscar"), "x{Enter}");
    expect(await screen.findByText("Servidor fora do ar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("AdminUsers: administrators", () => {
  it("lists administrators with their usernames", async () => {
    renderPage("/admin/admins");

    const marina = await rowOf(MARINA.name);
    expect(within(marina).getByText("marina")).toBeInTheDocument();
    expect(rowNames()).toEqual([DEFAULT_ADMIN.name, MARINA.name]);
    expect(screen.getByText("2 administradores")).toBeInTheDocument();
  });

  it("protects the default admin and the logged-in account", async () => {
    // Logged in as Marina: she cannot delete herself nor the default admin
    renderPage("/admin/admins", { session: MARINA_SESSION });

    const marina = await rowOf(MARINA.name);
    expect(within(marina).getByText("Você")).toBeInTheDocument();
    expect(within(marina).queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(within(marina).getByText("Você não pode excluir a própria conta.")).toBeInTheDocument();

    const admin = await rowOf(DEFAULT_ADMIN.name);
    expect(within(admin).getByText("Conta padrão")).toBeInTheDocument();
    expect(within(admin).queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(within(admin).getByText(/conta padrão “admin” não pode ser excluída/)).toBeInTheDocument();

    // Editing is still allowed
    expect(within(admin).getByRole("link", { name: `Editar ${DEFAULT_ADMIN.name}` })).toBeInTheDocument();
  });

  it("lets the default admin delete other administrators", async () => {
    const user = userEvent.setup();
    renderPage("/admin/admins");

    await user.click(within(await rowOf(MARINA.name)).getByRole("button", { name: `Excluir ${MARINA.name}` }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(rowNames()).toEqual([DEFAULT_ADMIN.name]));
    expect(deleteUser).toHaveBeenCalledWith(MARINA.id);
  });

  it("is reachable from the admin menu", async () => {
    const user = userEvent.setup();
    const { router } = renderPage("/admin/clients");
    await rowOf(ANA.name);

    await user.click(screen.getByRole("link", { name: "Administradores" }));
    expect(router.state.location.pathname).toBe("/admin/admins");
    expect(await screen.findByRole("heading", { level: 1, name: "Administradores" })).toBeInTheDocument();
    expect(await rowOf(MARINA.name)).toBeInTheDocument();
  });
});

describe("AdminUsers: demo flow", () => {
  it("creates an admin, logs in as them and deletes a client", async () => {
    const user = userEvent.setup();
    const { db, router } = renderPage("/admin/admins");

    // 1. The default admin creates Carla
    await user.click(await screen.findByRole("link", { name: "Novo administrador" }));
    await user.type(screen.getByLabelText("Nome completo"), "Carla Dias");
    await user.type(screen.getByLabelText("E-mail"), "carla@hardwarehub.com");
    await user.type(screen.getByLabelText("Telefone"), "(16) 97777-6666");
    await user.type(screen.getByLabelText("Usuário"), "Carla");
    await user.type(screen.getByLabelText("Senha"), "Carla@2026");
    await user.type(screen.getByLabelText("Confirmar senha"), "Carla@2026");
    await user.click(screen.getByRole("button", { name: "Cadastrar administrador" }));
    expect(await screen.findByText("“Carla Dias” foi cadastrado.")).toBeInTheDocument();

    // 2. Log out and log in as Carla (username, any case)
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    await user.type(screen.getByLabelText("E-mail ou usuário"), "CARLA");
    await user.type(screen.getByLabelText("Senha"), "Carla@2026");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    // Back in the admin area (RequireAuth remembered the page left at logout)
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/admin/), { timeout: 2500 });
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    expect(session).toMatchObject({ type: "admin", name: "Carla Dias" });

    // 3. Carla deletes the client Bruno
    await router.navigate("/admin/clients");
    await user.click(within(await rowOf(BRUNO.name)).getByRole("button", { name: `Excluir ${BRUNO.name}` }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(rowNames()).toEqual([ANA.name]));
    expect(db[BRUNO.id]).toBeUndefined();
    expect(db[session.id]).toMatchObject({ username: "carla", type: "admin" });
  });
});
