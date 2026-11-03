import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import {
  ADMIN_SESSION,
  CLIENT_SESSION,
  GPU,
  LAST_UNITS_CPU,
  OUT_OF_STOCK,
  SERVICE,
  renderWithRouter,
} from "../test/renderWithRouter";
import { installProductStore } from "../test/productStore";
import { deleteProduct, listProducts, updateProduct } from "../api/products";
import { getCartByUser } from "../api/carts";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));

const ALL = [GPU, LAST_UNITS_CPU, OUT_OF_STOCK, SERVICE];

function renderList({ products = ALL, path = "/admin/products" } = {}) {
  const db = installProductStore(products);
  const view = renderWithRouter(routes, { path, session: ADMIN_SESSION });
  return { db, ...view };
}

// Table row of a product, found by its row header
async function findRow(name) {
  const header = await screen.findByRole("rowheader", { name: new RegExp(name) });
  return header.closest("tr");
}

const rowNames = () =>
  screen.getAllByRole("rowheader").map((cell) => cell.querySelector(".admin-product-name").textContent);

describe("AdminProducts: list", () => {
  it("shows every product with category, price, stock and status", async () => {
    renderList();

    const gpu = await findRow(GPU.name);
    expect(within(gpu).getByText("Placa de vídeo")).toBeInTheDocument();
    expect(within(gpu).getByText(/4\.299,90/)).toBeInTheDocument();
    expect(within(gpu).getByText(/4\.899,90/)).toBeInTheDocument();
    expect(within(gpu).getByLabelText(`Estoque de ${GPU.name}`)).toHaveValue(6);
    expect(within(gpu).getByText("Em estoque")).toBeInTheDocument();
    expect(within(gpu).getByText("27")).toBeInTheDocument();

    expect(within(await findRow(OUT_OF_STOCK.name)).getByText("Indisponível")).toBeInTheDocument();
    expect(within(await findRow(LAST_UNITS_CPU.name)).getByText("Últimas unidades")).toBeInTheDocument();

    // Services have no stock input
    const service = await findRow(SERVICE.name);
    expect(within(service).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(within(service).getByText("Sob agendamento")).toBeInTheDocument();

    expect(screen.getByText("4 itens")).toBeInTheDocument();
    expect(screen.getByText("Exibindo 1–4 de 4")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /1 sem estoque/ })).toBeInTheDocument();
  });

  it("sorts by name by default", async () => {
    renderList();
    await findRow(GPU.name);
    expect(rowNames()).toEqual([LAST_UNITS_CPU.name, GPU.name, OUT_OF_STOCK.name, SERVICE.name]);
  });

  it("searches by name and keeps the search in the URL", async () => {
    const user = userEvent.setup();
    const { router } = renderList();
    await findRow(GPU.name);

    await user.type(screen.getByLabelText("Buscar"), "rtx{Enter}");

    await waitFor(() => expect(rowNames()).toEqual([GPU.name]));
    expect(router.state.location.search).toBe("?q=rtx");
  });

  it("filters by category and stock as soon as a select changes", async () => {
    const user = userEvent.setup();
    const { router } = renderList();
    await findRow(GPU.name);

    await user.selectOptions(screen.getByLabelText("Estoque"), "out");
    await waitFor(() => expect(rowNames()).toEqual([OUT_OF_STOCK.name]));
    expect(router.state.location.search).toBe("?status=out");

    await user.selectOptions(screen.getByLabelText("Estoque"), "");
    await user.selectOptions(screen.getByLabelText("Categoria"), "service");
    await waitFor(() => expect(rowNames()).toEqual([SERVICE.name]));
    expect(router.state.location.search).toBe("?category=service");
  });

  it("filters out-of-stock products from the alert chip, and clears filters", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole("button", { name: /1 sem estoque/ }));
    await waitFor(() => expect(rowNames()).toEqual([OUT_OF_STOCK.name]));

    await user.click(screen.getByRole("link", { name: "Limpar filtros" }));
    await waitFor(() => expect(rowNames()).toHaveLength(4));
  });

  it("paginates 10 items per page", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...GPU,
      id: `g${i}`,
      name: `Placa ${String(i + 1).padStart(2, "0")}`,
    }));
    renderList({ products: many });

    await findRow("Placa 01");
    expect(screen.getAllByRole("rowheader")).toHaveLength(10);
    expect(screen.getByText("Exibindo 1–10 de 12")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Próxima" }));
    await waitFor(() => expect(rowNames()).toEqual(["Placa 11", "Placa 12"]));
    expect(screen.getByText("Exibindo 11–12 de 12")).toBeInTheDocument();
  });

  it("shows an empty state for filters without results", async () => {
    renderList({ path: "/admin/products?q=nada" });
    expect(await screen.findByText("Nenhum produto corresponde aos filtros.")).toBeInTheDocument();
  });

  it("shows the server error and retries", async () => {
    const user = userEvent.setup();
    installProductStore(ALL);
    const working = listProducts.getMockImplementation();
    listProducts.mockImplementation(async () => {
      throw new Error("Servidor fora do ar");
    });
    renderWithRouter(routes, { path: "/admin/products", session: ADMIN_SESSION });

    expect(await screen.findByText("Servidor fora do ar")).toBeInTheDocument();

    listProducts.mockImplementation(working);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await findRow(GPU.name)).toBeInTheDocument();
  });
});

describe("AdminProducts: quick stock edit", () => {
  it("saves the new stock, updates the status and keeps focus on the input", async () => {
    const user = userEvent.setup();
    const { db } = renderList();
    const row = await findRow(OUT_OF_STOCK.name);
    const input = within(row).getByLabelText(`Estoque de ${OUT_OF_STOCK.name}`);
    const save = within(row).getByRole("button", { name: `Salvar estoque de ${OUT_OF_STOCK.name}` });

    // Nothing to save until the value changes
    expect(save).toBeDisabled();
    await user.clear(input);
    await user.type(input, "8");
    await user.click(save);

    expect(updateProduct).toHaveBeenCalledWith(OUT_OF_STOCK.id, { stock: 8 });
    expect(db[OUT_OF_STOCK.id].stock).toBe(8);
    expect(await screen.findByText(`Estoque de “${OUT_OF_STOCK.name}” atualizado para 8.`)).toBeInTheDocument();
    expect(await within(row).findByText("Em estoque")).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(save).toBeDisabled();
    // The alert chip disappears: no product is out of stock anymore
    await waitFor(() => expect(screen.queryByRole("button", { name: /sem estoque/ })).not.toBeInTheDocument());
  });

  it("saves with Enter", async () => {
    const user = userEvent.setup();
    renderList();
    const input = within(await findRow(GPU.name)).getByLabelText(`Estoque de ${GPU.name}`);

    await user.clear(input);
    await user.type(input, "0{Enter}");

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith(GPU.id, { stock: 0 }));
  });

  it("refuses a negative stock", async () => {
    const user = userEvent.setup();
    renderList();
    const row = await findRow(GPU.name);
    const input = within(row).getByLabelText(`Estoque de ${GPU.name}`);

    // user.type cannot type "-" into a number input in jsdom
    fireEvent.change(input, { target: { value: "-2" } });
    await user.click(within(row).getByRole("button", { name: `Salvar estoque de ${GPU.name}` }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Estoque inválido/);
    expect(updateProduct).not.toHaveBeenCalled();
  });
});

describe("AdminProducts: delete", () => {
  async function openDialog(user, product) {
    const row = await findRow(product.name);
    await user.click(within(row).getByRole("button", { name: `Excluir ${product.name}` }));
    return screen.getByRole("alertdialog", { name: `Excluir “${product.name}”?` });
  }

  it("asks for confirmation and deletes", async () => {
    const user = userEvent.setup();
    const { db } = renderList();

    const dialog = await openDialog(user, GPU);
    // The safe choice has the focus
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(deleteProduct).toHaveBeenCalledWith(GPU.id);
    expect(db[GPU.id]).toBeUndefined();
    expect(await screen.findByText(`“${GPU.name}” foi excluído.`)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(rowNames()).not.toContain(GPU.name));
    expect(screen.getByRole("heading", { level: 1, name: "Produtos e serviços" })).toHaveFocus();
  });

  it("cancels with the button or Escape and returns focus", async () => {
    const user = userEvent.setup();
    renderList();

    const dialog = await openDialog(user, GPU);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Excluir ${GPU.name}` })).toHaveFocus();

    await openDialog(user, GPU);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    expect(deleteProduct).not.toHaveBeenCalled();
    expect(rowNames()).toContain(GPU.name);
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    renderList();
    const dialog = await openDialog(user, GPU);
    const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
    const confirm = within(dialog).getByRole("button", { name: "Excluir" });

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("shows the error inside the dialog when the deletion fails", async () => {
    const user = userEvent.setup();
    renderList();
    const dialog = await openDialog(user, GPU);
    deleteProduct.mockRejectedValueOnce(new Error("Erro na requisição (500)"));

    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Erro na requisição (500)");
    expect(rowNames()).toContain(GPU.name);
  });

  it("goes back a page when the last row of a page is deleted", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 11 }, (_, i) => ({ ...GPU, id: `g${i}`, name: `Placa ${String(i + 1).padStart(2, "0")}` }));
    const { router } = renderList({ products: many, path: "/admin/products?page=2" });

    const dialog = await openDialog(user, many[10]);
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
    await waitFor(() => expect(rowNames()).toHaveLength(10));
  });
});

describe("AdminProducts: access", () => {
  it("is linked from the admin menu", async () => {
    const user = userEvent.setup();
    installProductStore(ALL);
    const { router } = renderWithRouter(routes, { path: "/admin", session: ADMIN_SESSION });

    await user.click(screen.getByRole("link", { name: "Produtos e serviços" }));
    expect(router.state.location.pathname).toBe("/admin/products");
    expect(await findRow(GPU.name)).toBeInTheDocument();
  });

  it("is only for administrators", async () => {
    installProductStore(ALL);
    // Clients have a cart, loaded by CartProvider
    getCartByUser.mockResolvedValue(null);
    const { router } = renderWithRouter(routes, { path: "/admin/products", session: CLIENT_SESSION });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
