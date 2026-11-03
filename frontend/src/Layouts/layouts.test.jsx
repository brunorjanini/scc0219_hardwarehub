// Task 12: 404 pages, tab titles, skip link and the admin phone menu
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../seed.json";
import { routes } from "../routes";
import { ADMIN_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { installStore } from "../test/mockStore";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));
vi.mock("../api/orders", async (importOriginal) => ({
  ...(await importOriginal()),
  listOrders: vi.fn(async () => []),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
}));
vi.mock("../api/users", async (importOriginal) => ({
  ...(await importOriginal()),
  listUsers: vi.fn(async () => []),
  getUser: vi.fn(),
}));

describe("404", () => {
  it("shows a not-found page inside the store layout", async () => {
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/pagina/que/nao/existe" });

    expect(await screen.findByRole("heading", { level: 1, name: "Página não encontrada" })).toBeInTheDocument();
    expect(screen.getByText("/pagina/que/nao/existe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toHaveAttribute("href", "/");
    // Header and footer are still there to navigate away
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Página não encontrada | HardwareHub"));
  });

  it("shows the admin variant for unknown admin pages", async () => {
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/admin/relatorios", session: ADMIN_SESSION });

    expect(await screen.findByRole("heading", { level: 1, name: "Página não encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao dashboard" })).toHaveAttribute("href", "/admin");
  });
});

describe("tab title", () => {
  it.each([
    ["/", "HardwareHub"],
    ["/catalog", "Catálogo | HardwareHub"],
    ["/monte-seu-pc", "Monte seu PC | HardwareHub"],
    ["/login", "Entrar | HardwareHub"],
  ])("%s -> %s", async (path, title) => {
    installStore({ products: seed.products });
    renderWithRouter(routes, { path });
    await waitFor(() => expect(document.title).toBe(title));
  });

  it("follows navigation in the admin area", async () => {
    const user = userEvent.setup();
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/admin", session: ADMIN_SESSION });
    await waitFor(() => expect(document.title).toBe("Dashboard | HardwareHub"));

    await user.click(screen.getByRole("link", { name: "Clientes" }));
    await waitFor(() => expect(document.title).toBe("Clientes | HardwareHub"));
  });
});

describe("skip link", () => {
  it("is the first focusable element and moves focus to the main content", async () => {
    const user = userEvent.setup();
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/catalog" });
    await screen.findByRole("heading", { level: 1 });

    await user.tab();
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("exists in the admin layout too", async () => {
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/admin", session: ADMIN_SESSION });
    expect(await screen.findByRole("link", { name: "Pular para o conteúdo" })).toHaveAttribute("href", "#conteudo");
  });
});

describe("admin phone menu", () => {
  it("opens and closes the menu with a button that reports its state", async () => {
    const user = userEvent.setup();
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/admin", session: ADMIN_SESSION });

    const button = await screen.findByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "admin-menu");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("admin-menu")).toHaveClass("is-open");

    // Choosing a page closes it
    const nav = screen.getByRole("navigation", { name: "Menu administrativo" });
    await user.click(within(nav).getByRole("link", { name: "Produtos e serviços" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("admin-menu")).not.toHaveClass("is-open");
  });

  it("marks the current page in the menu", async () => {
    installStore({ products: seed.products });
    renderWithRouter(routes, { path: "/admin/products", session: ADMIN_SESSION });

    const nav = await screen.findByRole("navigation", { name: "Menu administrativo" });
    expect(within(nav).getByRole("link", { name: "Produtos e serviços" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});
