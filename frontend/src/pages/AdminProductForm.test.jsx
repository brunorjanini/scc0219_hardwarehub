import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "../routes";
import { ADMIN_SESSION, GPU, LAST_UNITS_CPU, SERVICE, renderWithRouter } from "../test/renderWithRouter";
import { installProductStore } from "../test/productStore";
import { createProduct, updateProduct } from "../api/products";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));

function renderForm(path = "/admin/products/new", products = [GPU, LAST_UNITS_CPU, SERVICE]) {
  const db = installProductStore(products);
  const view = renderWithRouter(routes, { path, session: ADMIN_SESSION });
  return { db, ...view };
}

async function fill(user, label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value) await user.type(input, value);
}

// Fills the common fields of a new product
async function fillBasics(user, { name = "RTX 5070 12GB", category = "gpu", price = "3999,90", stock = "5" } = {}) {
  await fill(user, "Nome", name);
  await user.selectOptions(screen.getByLabelText("Categoria"), category);
  await fill(user, "Marca", "NVIDIA");
  await fill(user, "Descrição", "Placa de vídeo nova.");
  await fill(user, "Preço (R$)", price);
  if (stock !== null) await fill(user, "Estoque (unidades)", stock);
}

const submit = (user, name = "Criar produto") => user.click(screen.getByRole("button", { name }));

describe("AdminProductForm: create", () => {
  it("creates a product with category specs and goes back to the list", async () => {
    const user = userEvent.setup();
    const { db, router } = renderForm();

    await fillBasics(user);
    await fill(user, "Memória de vídeo (GB)", "12");
    await fill(user, "Comprimento (mm)", "250");
    await fill(user, "Consumo TDP (W)", "250");
    await submit(user);

    expect(createProduct).toHaveBeenCalledWith({
      name: "RTX 5070 12GB",
      type: "product",
      category: "gpu",
      brand: "NVIDIA",
      photo: "/products/placeholder-gpu.svg",
      description: "Placa de vídeo nova.",
      price: 3999.9,
      stock: 5,
      sold: 0,
      specs: { vramGb: 12, lengthMm: 250, tdp: 250 },
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/products"));
    expect(await screen.findByText("“RTX 5070 12GB” foi criado.")).toBeInTheDocument();
    expect(await screen.findByRole("rowheader", { name: /RTX 5070 12GB/ })).toBeInTheDocument();
    expect(Object.values(db).some((p) => p.name === "RTX 5070 12GB")).toBe(true);
  });

  it("shows the new product in the store catalog", async () => {
    const user = userEvent.setup();
    const { router } = renderForm();

    await fillBasics(user, { name: "Ryzen 9 9950X", category: "cpu", price: "4500" });
    await fill(user, "Soquete", "AM5");
    await fill(user, "Núcleos", "16");
    await fill(user, "Consumo TDP (W)", "170");
    await submit(user);
    await screen.findByText("“Ryzen 9 9950X” foi criado.");

    await router.navigate("/catalog?category=cpu");
    expect(await screen.findByRole("link", { name: "Ryzen 9 9950X" })).toBeInTheDocument();
  });

  it("shows the specs of the chosen category", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByText("Escolha a categoria para ver as especificações.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Categoria"), "motherboard");
    expect(screen.getByLabelText("Soquete")).toBeInTheDocument();
    expect(screen.getByLabelText("Formato")).toBeInTheDocument();
    expect(screen.getByLabelText("Chipset (opcional)")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Categoria"), "case");
    expect(screen.queryByLabelText("Soquete")).not.toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Placas suportadas" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(3);

    await user.selectOptions(screen.getByLabelText("Categoria"), "psu");
    expect(screen.getByRole("checkbox", { name: "Modular" })).not.toBeChecked();
  });

  it("creates a service without stock", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillBasics(user, { name: "Limpeza de PC", category: "service", price: "120", stock: null });
    expect(screen.queryByLabelText("Estoque (unidades)")).not.toBeInTheDocument();
    expect(screen.getByText(/Serviços não têm estoque/)).toBeInTheDocument();
    await fill(user, "Duração estimada (horas)", "1,5");
    await submit(user);

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ type: "service", category: "service", stock: null, specs: { durationHours: 1.5 } }),
      ),
    );
  });

  it("saves checkbox specs and an offer price", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillBasics(user, { name: "Gabinete Mini", category: "case", price: "399,90" });
    await fill(user, "Preço antigo (opcional)", "499,90");
    await user.click(screen.getByRole("checkbox", { name: "mATX" }));
    await user.click(screen.getByRole("checkbox", { name: "ITX" }));
    await fill(user, "Placa de vídeo até (mm)", "320");
    await submit(user);

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 399.9,
          oldPrice: 499.9,
          specs: { supportedFormFactors: ["mATX", "ITX"], maxGpuLengthMm: 320 },
        }),
      ),
    );
  });

  it("points to the first invalid field", async () => {
    const user = userEvent.setup();
    renderForm();

    await submit(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome do produto");
    expect(screen.getByLabelText("Nome")).toHaveFocus();
    expect(screen.getByLabelText("Nome")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Nome")).toHaveAccessibleDescription("Informe o nome do produto");

    await fillBasics(user);
    await fill(user, "Memória de vídeo (GB)", "12");
    await submit(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Preencha o campo Comprimento (mm)");
    expect(screen.getByLabelText("Comprimento (mm)")).toHaveFocus();

    await fill(user, "Preço antigo (opcional)", "100");
    await submit(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/preço antigo/);

    expect(createProduct).not.toHaveBeenCalled();
  });

  it("previews the photo and falls back to the category image", async () => {
    const user = userEvent.setup();
    renderForm();
    const preview = () => screen.getByRole("img", { name: "Pré-visualização da foto" });

    await user.selectOptions(screen.getByLabelText("Categoria"), "gpu");
    expect(preview()).toHaveAttribute("src", "/products/placeholder-gpu.svg");

    await fill(user, "Caminho ou endereço da foto (opcional)", "/products/geoforce_rtx.jpg");
    expect(preview()).toHaveAttribute("src", "/products/geoforce_rtx.jpg");
  });
});

describe("AdminProductForm: edit", () => {
  it("loads the product and saves the changes", async () => {
    const user = userEvent.setup();
    const { db, router } = renderForm(`/admin/products/${GPU.id}`);

    expect(await screen.findByLabelText("Nome")).toHaveValue(GPU.name);
    expect(screen.getByLabelText("Categoria")).toHaveValue("gpu");
    expect(screen.getByLabelText("Preço (R$)")).toHaveValue("4299.90");
    expect(screen.getByLabelText("Preço antigo (opcional)")).toHaveValue("4899.90");
    expect(screen.getByLabelText("Estoque (unidades)")).toHaveValue("6");
    expect(screen.getByLabelText("Comprimento (mm)")).toHaveValue("261");
    // Sales are shown but not editable
    expect(screen.getByLabelText("Vendidos")).toBeDisabled();
    expect(screen.getByLabelText("Vendidos")).toHaveValue("27");
    expect(screen.getByText(`ID ${GPU.id}`)).toBeInTheDocument();

    await fill(user, "Preço (R$)", "3899,90");
    await fill(user, "Preço antigo (opcional)", "");
    await fill(user, "Estoque (unidades)", "10");
    await submit(user, "Salvar alterações");

    expect(updateProduct).toHaveBeenCalledWith(GPU.id, {
      name: GPU.name,
      type: "product",
      category: "gpu",
      brand: GPU.brand,
      photo: GPU.photo,
      description: GPU.description,
      price: 3899.9,
      oldPrice: null,
      stock: 10,
      specs: { vramGb: 12, lengthMm: 261, tdp: 220 },
    });
    expect(db[GPU.id]).toMatchObject({ price: 3899.9, stock: 10, sold: 27 });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/products"));
    expect(await screen.findByText(`“${GPU.name}” foi atualizado.`)).toBeInTheDocument();
  });

  it("drops the old specs when the category changes", async () => {
    const user = userEvent.setup();
    renderForm(`/admin/products/${LAST_UNITS_CPU.id}`);
    expect(await screen.findByLabelText("Soquete")).toHaveValue("AM5");

    await user.selectOptions(screen.getByLabelText("Categoria"), "motherboard");
    expect(screen.getByLabelText("Soquete")).toHaveValue("");

    // Back to the original category: the stored specs return
    await user.selectOptions(screen.getByLabelText("Categoria"), "cpu");
    expect(screen.getByLabelText("Soquete")).toHaveValue("AM5");
  });

  it("goes back to the list with the same filters", async () => {
    const user = userEvent.setup();
    const { router } = renderForm("/admin/products?category=gpu");

    await user.click(await screen.findByRole("link", { name: `Editar ${GPU.name}` }));
    expect(router.state.location.pathname).toBe(`/admin/products/${GPU.id}`);
    await screen.findByLabelText("Nome");

    await user.click(screen.getByRole("link", { name: "Cancelar" }));
    expect(router.state.location.pathname).toBe("/admin/products");
    expect(router.state.location.search).toBe("?category=gpu");
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("explains when the product does not exist", async () => {
    renderForm("/admin/products/nao-existe");
    expect(await screen.findByText(/Produto não encontrado/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Voltar para a lista" }).length).toBeGreaterThan(0);
  });

  it("keeps the form when saving fails", async () => {
    const user = userEvent.setup();
    renderForm(`/admin/products/${GPU.id}`);
    await screen.findByLabelText("Nome");
    updateProduct.mockRejectedValueOnce(new Error("Erro na requisição (500)"));

    await submit(user, "Salvar alterações");

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro na requisição (500)");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
  });
});
