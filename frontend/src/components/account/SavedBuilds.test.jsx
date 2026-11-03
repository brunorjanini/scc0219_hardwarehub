// Saved builds (Task 11): saving from the builder, the "Minhas montagens"
// section of My Account, and the demo (save, log out/in, reopen).
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../../seed.json";
import { routes } from "../../routes";
import { ADMIN_SESSION, CLIENT_SESSION, renderWithRouter } from "../../test/renderWithRouter";
import { CLIENT, installStore } from "../../test/mockStore";
import { createBuild, deleteBuild, listBuildsByUser } from "../../api/builds";
import { BUILDER_STORAGE_KEY } from "../../utils/builder";

vi.mock("../../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock("../../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));
vi.mock("../../api/orders", async (importOriginal) => ({
  ...(await importOriginal()),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  listOrdersByUser: vi.fn(),
}));
vi.mock("../../api/users", async (importOriginal) => ({
  ...(await importOriginal()),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  findUsersByEmail: vi.fn(),
}));
vi.mock("../../api/builds", () => ({ listBuildsByUser: vi.fn(), createBuild: vi.fn(), deleteBuild: vi.fn() }));

const STORED_CLIENT = { ...CLIENT, password: "Password123" };
const byName = (name) => seed.products.find((p) => p.name === name);
const RYZEN_7 = byName("AMD Ryzen 7 7800X3D");
const B650M = byName("ASUS TUF Gaming B650M-Plus");

// Store + an in-memory /builds
function install({ builds = [], products = seed.products } = {}) {
  const db = installStore({ products, users: [STORED_CLIENT], orders: [] });
  db.builds = builds.map((b) => ({ ...b }));
  let next = 1;
  listBuildsByUser.mockReset().mockImplementation(async (userId) =>
    db.builds
      .filter((b) => b.userId === String(userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((b) => ({ ...b })),
  );
  createBuild.mockReset().mockImplementation(async (build) => {
    const saved = { ...build, id: `b${next++}` };
    db.builds.push(saved);
    return { ...saved };
  });
  deleteBuild.mockReset().mockImplementation(async (id) => {
    db.builds = db.builds.filter((b) => b.id !== id);
    return null;
  });
  return db;
}

async function choose(user, label, productName) {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^(Escolher|Trocar) ${label}$`) }));
  const picker = screen.getByRole("region", { name: `Opções de ${label}` });
  await user.click(within(picker).getByRole("button", { name: `Escolher ${productName}` }));
}

const summary = () => screen.getByRole("complementary", { name: "Resumo do setup" });

describe("Builder: save build", () => {
  it("saves the chosen parts with a name", async () => {
    const user = userEvent.setup();
    const db = install();
    renderWithRouter(routes, { path: "/monte-seu-pc", session: CLIENT_SESSION });

    await choose(user, "Processador", RYZEN_7.name);
    await choose(user, "Placa-mãe", B650M.name);
    await user.click(within(summary()).getByRole("button", { name: "Salvar montagem" }));

    const name = within(summary()).getByLabelText("Nome da montagem");
    expect(name).toHaveFocus();
    expect(name.value).toMatch(/^Montagem de \d+ de /);
    await user.clear(name);
    await user.type(name, "PC gamer AM5");
    await user.click(within(summary()).getByRole("button", { name: "Salvar" }));

    expect(await within(summary()).findByText(/Montagem “PC gamer AM5” salva\./)).toBeInTheDocument();
    expect(within(summary()).getByRole("link", { name: "Ver em Minha conta" })).toHaveAttribute("href", "/account#montagens");
    expect(db.builds).toEqual([
      expect.objectContaining({
        userId: "1",
        name: "PC gamer AM5",
        parts: { cpu: RYZEN_7.id, motherboard: B650M.id },
        total: 3799.8,
        createdAt: expect.any(String),
      }),
    ]);
    // Focus returns to the button
    expect(within(summary()).getByRole("button", { name: "Salvar montagem" })).toHaveFocus();
  });

  it("requires a name and at least one part", async () => {
    const user = userEvent.setup();
    install();
    renderWithRouter(routes, { path: "/monte-seu-pc", session: CLIENT_SESSION });

    const save = await screen.findByRole("button", { name: "Salvar montagem" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Escolha pelo menos uma peça para salvar.");

    await choose(user, "Processador", RYZEN_7.name);
    await user.click(within(summary()).getByRole("button", { name: "Salvar montagem" }));
    await user.clear(within(summary()).getByLabelText("Nome da montagem"));
    await user.click(within(summary()).getByRole("button", { name: "Salvar" }));

    expect(within(summary()).getByRole("alert")).toHaveTextContent("Dê um nome à montagem");
    expect(createBuild).not.toHaveBeenCalled();

    // Esc closes the form
    await user.keyboard("{Escape}");
    expect(within(summary()).queryByLabelText("Nome da montagem")).not.toBeInTheDocument();
  });

  it("sends guests to login and hides the option from admins", async () => {
    const user = userEvent.setup();
    install();
    const guest = renderWithRouter(routes, { path: "/monte-seu-pc" });
    await choose(user, "Processador", RYZEN_7.name);
    await user.click(within(summary()).getByRole("button", { name: "Salvar montagem" }));
    expect(guest.router.state.location.pathname).toBe("/login");
    guest.unmount();

    renderWithRouter(routes, { path: "/monte-seu-pc", session: ADMIN_SESSION });
    await screen.findByRole("complementary", { name: "Resumo do setup" });
    expect(screen.queryByRole("button", { name: "Salvar montagem" })).not.toBeInTheDocument();
  });
});

describe("My Account: saved builds", () => {
  const SAVED = [
    { id: "b1", userId: "1", name: "Antiga", parts: { cpu: "1", motherboard: "99" }, total: 3000, createdAt: "2026-10-01T12:00:00Z" },
    { id: "b2", userId: "1", name: "Nova", parts: { cpu: "1", motherboard: "5" }, total: 3799.8, createdAt: "2026-11-02T12:00:00Z" },
    { id: "b3", userId: "7", name: "De outra pessoa", parts: { cpu: "1" }, total: 1, createdAt: "2026-11-02T12:00:00Z" },
  ];

  const section = () => screen.getByRole("heading", { name: "Minhas montagens" }).closest("section");
  const item = (name) => within(section()).getByRole("heading", { level: 3, name }).closest("li");

  function renderAccount(builds = SAVED, products = seed.products) {
    install({ builds, products });
    return renderWithRouter(routes, { path: "/account", session: CLIENT_SESSION });
  }

  it("lists the client's builds, newest first, with today's price", async () => {
    renderAccount();

    await screen.findByRole("heading", { level: 3, name: "Nova" });
    const names = within(section()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Nova", "Antiga"]);
    expect(item("Nova")).toHaveTextContent("2 de 7 peças");
    expect(item("Nova")).toHaveTextContent(/3\.799,80/);
    expect(item("Nova")).not.toHaveTextContent("quando você salvou");
  });

  it("flags deleted parts, parts out of stock and price changes", async () => {
    const products = seed.products.map((p) => (p.id === "1" ? { ...p, stock: 0, price: 2299.9 } : p));
    renderAccount(SAVED, products);
    await screen.findByRole("heading", { level: 3, name: "Nova" });

    expect(item("Antiga")).toHaveTextContent("Não está mais no catálogo: Placa-mãe.");
    expect(item("Antiga")).toHaveTextContent("1 de 7 peças");
    expect(item("Nova")).toHaveTextContent("Sem estoque agora: Processador.");
    expect(item("Nova")).toHaveTextContent(/era R\$\s3\.799,80 quando você salvou/);
  });

  it("deletes a build after confirmation", async () => {
    const user = userEvent.setup();
    renderAccount();
    await screen.findByRole("button", { name: "Excluir “Nova”" });

    await user.click(screen.getByRole("button", { name: "Excluir “Nova”" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Excluir “Nova”?" })).getByRole("button", { name: "Excluir" }));

    expect(deleteBuild).toHaveBeenCalledWith("b2");
    expect(await screen.findByText("Montagem “Nova” excluída.")).toBeInTheDocument();
    expect(within(section()).queryByRole("heading", { level: 3, name: "Nova" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Minhas montagens" })).toHaveFocus();
  });

  it("shows an empty state", async () => {
    renderAccount([]);
    expect(await screen.findByText("Você ainda não salvou nenhuma montagem.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Montar um PC" })).toHaveAttribute("href", "/monte-seu-pc");
  });

  it("opens a build in the builder, replacing the build in progress", async () => {
    const user = userEvent.setup();
    localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify({ gpu: "13" }));
    const { router } = renderAccount();

    await user.click(await screen.findByRole("button", { name: "Abrir “Nova” no montador" }));

    expect(router.state.location.pathname).toBe("/monte-seu-pc");
    expect(await screen.findByText("Montagem “Nova” aberta no montador.")).toBeInTheDocument();
    const slot = (label) => screen.getByRole("heading", { level: 2, name: label }).closest("li");
    expect(within(slot("Processador")).getByText(RYZEN_7.name)).toBeInTheDocument();
    expect(within(slot("Placa-mãe")).getByText(B650M.name)).toBeInTheDocument();
    expect(within(slot("Placa de vídeo")).getByText("Escolha uma placa de vídeo")).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))).toEqual({ cpu: "1", motherboard: "5" }),
    );
  });
});

describe("Saved builds: demo", () => {
  it("saves a build, logs out and in, and opens it again", async () => {
    const user = userEvent.setup();
    install();
    const { router } = renderWithRouter(routes, { path: "/monte-seu-pc", session: CLIENT_SESSION });

    // 1. Build and save
    await choose(user, "Processador", RYZEN_7.name);
    await choose(user, "Placa-mãe", B650M.name);
    await user.click(within(summary()).getByRole("button", { name: "Salvar montagem" }));
    await user.clear(within(summary()).getByLabelText("Nome da montagem"));
    await user.type(within(summary()).getByLabelText("Nome da montagem"), "Meu PC");
    await user.click(within(summary()).getByRole("button", { name: "Salvar" }));
    await within(summary()).findByText(/Montagem “Meu PC” salva\./);

    // Empty the builder, so the build can only come back from the server
    await user.click(screen.getByRole("button", { name: "Limpar montagem" }));

    // 2. Log out and log in again
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await router.navigate("/login");
    await user.type(await screen.findByLabelText("E-mail ou usuário"), CLIENT.email);
    await user.type(screen.getByLabelText("Senha"), "Password123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"), { timeout: 2500 });

    // 3. My Account -> open the saved build
    await router.navigate("/account#montagens");
    await user.click(await screen.findByRole("button", { name: "Abrir “Meu PC” no montador" }));

    expect(await screen.findByText("Montagem “Meu PC” aberta no montador.")).toBeInTheDocument();
    const slot = (label) => screen.getByRole("heading", { level: 2, name: label }).closest("li");
    expect(within(slot("Processador")).getByText(RYZEN_7.name)).toBeInTheDocument();
    expect(within(slot("Placa-mãe")).getByText(B650M.name)).toBeInTheDocument();
  });
});
