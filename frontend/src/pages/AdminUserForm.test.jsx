import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../seed.json";
import { routes } from "../routes";
import { ADMIN_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { installUserStore } from "../test/userStore";
import { createUser, updateUser } from "../api/users";
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

const [ANA, MARINA, DEFAULT_ADMIN] = ["1", "2", "3"].map((id) => seed.users.find((u) => u.id === id));

function renderForm(path) {
  getCartByUser.mockResolvedValue(null);
  const db = installUserStore([ANA, MARINA, DEFAULT_ADMIN]);
  const view = renderWithRouter(routes, { path, session: ADMIN_SESSION });
  return { db, ...view };
}

async function fill(user, label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value) await user.type(input, value);
}

async function fillClient(user, { email = "bruno@usp.br" } = {}) {
  await fill(user, "Nome completo", "Bruno Lima");
  await fill(user, "E-mail", email);
  await fill(user, "Telefone", "(16) 98888-7777");
  await fill(user, "Rua", "Rua XV");
  await fill(user, "Número", "10");
  await fill(user, "Cidade", "Araraquara");
  await fill(user, "CEP", "14800-000");
  await fill(user, "Senha", "Senha@123");
  await fill(user, "Confirmar senha", "Senha@123");
}

async function fillAdmin(user, { username = "carla", email = "carla@hardwarehub.com" } = {}) {
  await fill(user, "Nome completo", "Carla Dias");
  await fill(user, "E-mail", email);
  await fill(user, "Telefone", "(16) 97777-6666");
  await fill(user, "Usuário", username);
  await fill(user, "Senha", "Carla@2026");
  await fill(user, "Confirmar senha", "Carla@2026");
}

const click = (user, name) => user.click(screen.getByRole("button", { name }));

describe("AdminUserForm: clients", () => {
  it("creates a client and goes back to the list", async () => {
    const user = userEvent.setup();
    const { router } = renderForm("/admin/clients/new");

    expect(screen.queryByLabelText("Usuário")).not.toBeInTheDocument();
    await fillClient(user);
    await click(user, "Cadastrar cliente");

    expect(createUser).toHaveBeenCalledWith({
      type: "user",
      name: "Bruno Lima",
      email: "bruno@usp.br",
      phone: "(16) 98888-7777",
      address: { street: "Rua XV", number: "10", city: "Araraquara", zip: "14800-000" },
      password: "Senha@123",
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/clients"));
    expect(await screen.findByText("“Bruno Lima” foi cadastrado.")).toBeInTheDocument();
    expect(await screen.findByRole("rowheader", { name: /Bruno Lima/ })).toBeInTheDocument();
  });

  it("refuses an email already used by any account", async () => {
    const user = userEvent.setup();
    renderForm("/admin/clients/new");

    // Marina is an admin: emails are unique across clients and admins
    await fillClient(user, { email: "Admin@Gmail.com" });
    await click(user, "Cadastrar cliente");

    expect(await screen.findByRole("alert")).toHaveTextContent("Esse e-mail já está cadastrado em outra conta");
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("validates before calling the server", async () => {
    const user = userEvent.setup();
    renderForm("/admin/clients/new");

    await click(user, "Cadastrar cliente");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome");
    expect(screen.getByLabelText("Nome completo")).toHaveFocus();

    await fillClient(user);
    await fill(user, "CEP", "123");
    await click(user, "Cadastrar cliente");
    expect(screen.getByRole("alert")).toHaveTextContent("CEP inválido");

    await fill(user, "CEP", "14800-000");
    await fill(user, "Confirmar senha", "Outra@123");
    await click(user, "Cadastrar cliente");
    expect(screen.getByRole("alert")).toHaveTextContent("A confirmação não confere com a senha");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("edits a client and keeps the password when left blank", async () => {
    const user = userEvent.setup();
    const { db } = renderForm(`/admin/clients/${ANA.id}`);

    expect(await screen.findByLabelText("Nome completo")).toHaveValue(ANA.name);
    expect(screen.getByLabelText("Rua")).toHaveValue(ANA.address.street);
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");

    await fill(user, "Cidade", "Araraquara");
    await click(user, "Salvar alterações");

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(ANA.id, {
        name: ANA.name,
        email: ANA.email,
        phone: ANA.phone,
        address: { ...ANA.address, city: "Araraquara" },
      }),
    );
    expect(db[ANA.id].password).toBe(ANA.password);
    expect(await screen.findByText(`“${ANA.name}” foi atualizado.`)).toBeInTheDocument();
  });

  it("changes the password when a new one is typed", async () => {
    const user = userEvent.setup();
    const { db } = renderForm(`/admin/clients/${ANA.id}`);
    await screen.findByLabelText("Nome completo");

    await fill(user, "Nova senha", "Nova@2026");
    await fill(user, "Confirmar nova senha", "Nova@2026");
    await click(user, "Salvar alterações");

    await waitFor(() => expect(db[ANA.id].password).toBe("Nova@2026"));
  });

  it("does not open an administrator as a client", async () => {
    renderForm(`/admin/clients/${MARINA.id}`);
    expect(await screen.findByText("Cadastro de cliente não encontrado.")).toBeInTheDocument();
  });
});

describe("AdminUserForm: administrators", () => {
  it("creates an administrator with a lower-case username", async () => {
    const user = userEvent.setup();
    renderForm("/admin/admins/new");

    expect(screen.queryByLabelText("Rua")).not.toBeInTheDocument();
    await fillAdmin(user, { username: "Carla.Dias" });
    await click(user, "Cadastrar administrador");

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        type: "admin",
        name: "Carla Dias",
        email: "carla@hardwarehub.com",
        phone: "(16) 97777-6666",
        username: "carla.dias",
        password: "Carla@2026",
      }),
    );
  });

  it("refuses a username already in use", async () => {
    const user = userEvent.setup();
    renderForm("/admin/admins/new");

    await fillAdmin(user, { username: "Marina" });
    await click(user, "Cadastrar administrador");

    expect(await screen.findByRole("alert")).toHaveTextContent("Esse usuário já está em uso");
    expect(screen.getByLabelText("Usuário")).toHaveFocus();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("refuses an invalid username", async () => {
    const user = userEvent.setup();
    renderForm("/admin/admins/new");

    await fillAdmin(user, { username: "carla@hh" });
    await click(user, "Cadastrar administrador");

    expect(screen.getByRole("alert")).toHaveTextContent(/só pode ter letras/);
  });

  it("keeps the default admin's username", async () => {
    const user = userEvent.setup();
    const { db } = renderForm(`/admin/admins/${DEFAULT_ADMIN.id}`);

    const username = await screen.findByLabelText("Usuário");
    expect(username).toHaveValue("admin");
    expect(username).toHaveAttribute("readonly");
    expect(screen.getByText("Conta padrão do sistema: não pode ser excluída.")).toBeInTheDocument();

    // Typing into a read-only field does nothing
    await user.type(username, "x");
    await click(user, "Salvar alterações");

    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(db[DEFAULT_ADMIN.id].username).toBe("admin");
    expect(db[DEFAULT_ADMIN.id].password).toBe("admin");
  });

  it("updates the sidebar name when the admin edits their own account", async () => {
    const user = userEvent.setup();
    renderForm(`/admin/admins/${DEFAULT_ADMIN.id}`);
    await screen.findByLabelText("Nome completo");

    await fill(user, "Nome completo", "Admin Geral");
    await click(user, "Salvar alterações");

    await waitFor(() => expect(JSON.parse(localStorage.getItem(SESSION_KEY)).name).toBe("Admin Geral"));
    expect(document.querySelector(".navbar-user-name")).toHaveTextContent("Admin Geral");
  });

  it("keeps the list search when cancelling", async () => {
    const user = userEvent.setup();
    const { router } = renderForm("/admin/admins?q=mar");

    await user.click(await screen.findByRole("link", { name: `Editar ${MARINA.name}` }));
    await screen.findByLabelText("Nome completo");
    await user.click(screen.getByRole("link", { name: "Cancelar" }));

    expect(router.state.location.pathname).toBe("/admin/admins");
    expect(router.state.location.search).toBe("?q=mar");
    expect(updateUser).not.toHaveBeenCalled();
  });
});
