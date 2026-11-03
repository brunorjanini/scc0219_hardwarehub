import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import { GPU, LAST_UNITS_CPU, OUT_OF_STOCK, SERVICE, renderWithRouter } from "../test/renderWithRouter";
import { listProducts } from "../api/products";
import { BUILDER_CATEGORIES } from "../utils/categories";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
}));

const ALL = [GPU, LAST_UNITS_CPU, OUT_OF_STOCK, SERVICE];

// Paginated calls (the grid) get `page`; the brand list asks for everything
function mockCatalog({ data = ALL, pages = 1 } = {}) {
  listProducts.mockImplementation(async (filters) =>
    filters?.page ? { data, items: data.length, pages } : ALL,
  );
}

// Last call made by the product grid (the one with a page)
function lastGridCall() {
  const calls = listProducts.mock.calls.filter(([filters]) => filters?.page);
  return calls.at(-1)[0];
}

beforeEach(() => {
  listProducts.mockReset();
  mockCatalog();
});

describe("Catalog", () => {
  it("lists products with name, category, price and availability", async () => {
    renderWithRouter(routes, { path: "/catalog" });

    const gpuCard = (await screen.findByRole("link", { name: GPU.name })).closest("article");
    expect(within(gpuCard).getByText("Placa de vídeo")).toBeInTheDocument();
    expect(within(gpuCard).getByText("Em estoque")).toBeInTheDocument();
    expect(within(gpuCard).getByText(/4\.299,90/)).toBeInTheDocument();
    expect(within(gpuCard).getByText(/4\.899,90/)).toBeInTheDocument();

    expect(screen.getByText("Últimas unidades")).toBeInTheDocument();
    expect(screen.getByText("Sob agendamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indisponível" })).toBeDisabled();
    expect(screen.getByText("4 itens encontrados")).toBeInTheDocument();
  });

  it("reads the section from the URL (header menu links)", async () => {
    renderWithRouter(routes, { path: "/catalog?category=hardware" });

    expect(await screen.findByRole("heading", { level: 1, name: "Hardware" })).toBeInTheDocument();
    await waitFor(() => expect(lastGridCall()).toMatchObject({ categories: BUILDER_CATEGORIES, page: 1 }));
  });

  it("applies the filter form and puts the filters in the URL", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(routes, { path: "/catalog" });
    await screen.findByRole("link", { name: GPU.name });

    await user.selectOptions(screen.getByLabelText("Categoria"), "gpu");
    // Brand options arrive from a second request
    await screen.findByRole("option", { name: "NVIDIA" });
    await user.selectOptions(screen.getByLabelText("Marca"), "NVIDIA");
    await user.type(screen.getByLabelText("Máximo"), "5000");
    await user.click(screen.getByLabelText("Somente disponíveis"));
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() =>
      expect(lastGridCall()).toMatchObject({ category: "gpu", brand: "NVIDIA", maxPrice: 5000, inStock: true, page: 1 }),
    );
    expect(router.state.location.search).toBe("?category=gpu&brand=NVIDIA&maxPrice=5000&inStock=1");
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toBeInTheDocument();
  });

  it("sorts immediately when the order changes", async () => {
    const user = userEvent.setup();
    renderWithRouter(routes, { path: "/catalog?category=cpu" });
    await screen.findByRole("link", { name: GPU.name });

    await user.selectOptions(screen.getByLabelText("Ordenar por"), "price");

    await waitFor(() => expect(lastGridCall()).toMatchObject({ category: "cpu", sort: "price" }));
  });

  it("paginates with links that keep the filters", async () => {
    mockCatalog({ pages: 3 });
    const user = userEvent.setup();
    const { router } = renderWithRouter(routes, { path: "/catalog?category=cpu" });

    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Próxima" }));

    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?category=cpu&page=2");
    expect(lastGridCall()).toMatchObject({ category: "cpu", page: 2 });
  });

  it("explains when nothing matches", async () => {
    mockCatalog({ data: [] });
    renderWithRouter(routes, { path: "/catalog?q=xyz" });

    expect(await screen.findByText(/Nenhum produto corresponde aos filtros/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Resultados para “xyz”" })).toBeInTheDocument();
  });

  it("shows the server error", async () => {
    listProducts.mockRejectedValue(new Error("Não foi possível conectar ao servidor."));
    renderWithRouter(routes, { path: "/catalog" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao servidor.");
  });
});

describe("header search", () => {
  it("opens the catalog filtered by the typed text", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(routes, { path: "/" });

    await user.type(screen.getByRole("searchbox", { name: "Buscar produtos e serviços" }), "ryzen{Enter}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/catalog"));
    expect(router.state.location.search).toBe("?q=ryzen");
    await waitFor(() => expect(lastGridCall()).toMatchObject({ search: "ryzen" }));
  });
});
