import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "../seed.json";
import { routes } from "../routes";
import { renderWithRouter } from "../test/renderWithRouter";
import { installProductStore } from "../test/productStore";
import { listProducts } from "../api/products";
import { BUILDER_STORAGE_KEY } from "../utils/builder";
import { BUILDER_CATEGORIES } from "../utils/categories";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));

function renderBuilder(products = seed.products) {
  installProductStore(products);
  return renderWithRouter(routes, { path: "/monte-seu-pc" });
}

// Slot <li> by its category heading
const slot = (label) => screen.getByRole("heading", { level: 2, name: label }).closest("li");
// The compatibility banner (role="status"; the page has other status regions)
const status = () => document.querySelector(".builder-status");

async function open(user, label) {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^(Escolher|Trocar) ${label}$`) }));
  return screen.getByRole("region", { name: `Opções de ${label}` });
}

async function choose(user, label, productName) {
  const picker = await open(user, label);
  await user.click(within(picker).getByRole("button", { name: `Escolher ${productName}` }));
}

// Picks the first option that can be chosen (options come best first)
async function chooseFirst(user, label) {
  const picker = await open(user, label);
  const button = within(picker)
    .getAllByRole("button")
    .find((b) => !b.disabled);
  await user.click(button);
}

describe("Builder", () => {
  it("starts with 7 empty slots", async () => {
    renderBuilder();

    expect(await screen.findByText("Comece escolhendo as peças")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Monte seu PC" })).toBeInTheDocument();
    const slots = screen.getByRole("list", { name: "Componentes do PC" });
    expect(within(slots).getAllByRole("heading", { level: 2 })).toHaveLength(7);
    expect(within(slot("Placa-mãe")).getByText("Escolha uma placa-mãe")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "0 de 7 componentes selecionados" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    // Builder parts and services (assembly) are loaded in one request
    expect(listProducts).toHaveBeenCalledWith({ categories: [...BUILDER_CATEGORIES, "service"], sort: "price" });
  });

  it("shows an error between CPU and motherboard sockets, and clears it when fixed (demo)", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await choose(user, "Processador", "Intel Core i5-14600K"); // LGA1700
    await choose(user, "Placa-mãe", "ASUS TUF Gaming B650M-Plus"); // AM5

    expect(status()).toHaveTextContent("Há peças incompatíveis");
    expect(status()).toHaveTextContent("1 problema para resolver");
    const message = "Soquete incompatível: o processador é LGA1700 e a placa-mãe é AM5.";
    expect(within(slot("Processador")).getByText(message)).toBeInTheDocument();
    expect(within(slot("Placa-mãe")).getByText(message)).toBeInTheDocument();

    // Swap the CPU for an AM5 one
    await choose(user, "Processador", "AMD Ryzen 7 7800X3D");

    expect(status()).toHaveTextContent("Peças compatíveis até agora");
    expect(status()).toHaveTextContent("Faltam 5 componentes.");
    expect(screen.queryByText(/Soquete incompatível/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "2 de 7 componentes selecionados" })).toBeInTheDocument();
  });

  it("tells, in the picker, how each option fits the chosen parts", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await choose(user, "Processador", "AMD Ryzen 7 7800X3D");

    const picker = await open(user, "Placa-mãe");
    const option = (name) => within(picker).getByText(name).closest("li");

    expect(within(option("ASUS TUF Gaming B650M-Plus")).getByText("Compatível com as peças escolhidas")).toBeInTheDocument();
    expect(within(option("MSI B550M Pro-VDH")).getByText(/o processador é AM5 e a placa-mãe é AM4/)).toBeInTheDocument();
    // Compatible options come first
    expect(within(picker).getAllByRole("listitem")[0]).toHaveTextContent("ASUS TUF Gaming B650M-Plus");
    // Out-of-stock parts cannot be chosen
    const outOfStock = within(option("ASRock B760M Pro RS")).getByRole("button");
    expect(outOfStock).toBeDisabled();
    expect(outOfStock).toHaveTextContent("Indisponível");
    expect(screen.getByRole("button", { name: "Escolher Placa-mãe" })).toHaveAttribute("aria-expanded", "true");
  });

  it("confirms a complete compatible build with the power estimate", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await screen.findByText("Comece escolhendo as peças");

    for (const label of ["Processador", "Placa-mãe", "Memória RAM", "Placa de vídeo", "Armazenamento", "Fonte", "Gabinete"]) {
      await chooseFirst(user, label);
    }

    expect(status()).toHaveTextContent("Configuração compatível");
    expect(status()).not.toHaveTextContent("avisos");
    expect(status()).toHaveTextContent(/Consumo estimado: \d+ W · Fonte recomendada: \d+ W\./);
    expect(screen.getByRole("progressbar", { name: "7 de 7 componentes selecionados" })).toBeInTheDocument();
  });

  it("warns about a PSU with little headroom", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await choose(user, "Processador", "Intel Core i5-14600K"); // 125 W
    await choose(user, "Placa de vídeo", "ASUS TUF GeForce RTX 4080 SUPER 16GB"); // 320 W
    await choose(user, "Fonte", "Corsair CX650 650W 80 Plus Bronze");

    expect(within(slot("Fonte")).getByText("Fonte no limite: 650 W. Recomendamos 700 W ou mais para ter folga.")).toBeInTheDocument();
    expect(status()).toHaveTextContent("Peças compatíveis até agora, com avisos");
    expect(status()).toHaveTextContent("Consumo estimado: 545 W · Fonte recomendada: 700 W.");
  });

  it("returns focus to the slot button after choosing, closing and removing", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await choose(user, "Gabinete", "NZXT H5 Flow");
    expect(screen.getByRole("button", { name: "Trocar Gabinete" })).toHaveFocus();
    expect(screen.queryByRole("region", { name: "Opções de Gabinete" })).not.toBeInTheDocument();

    await open(user, "Gabinete");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Opções de Gabinete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar Gabinete" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Remover Gabinete" }));
    expect(within(slot("Gabinete")).getByText("Escolha um gabinete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher Gabinete" })).toHaveFocus();
  });

  it("keeps the build after leaving the page, and drops parts that no longer exist", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBuilder();
    await choose(user, "Processador", "AMD Ryzen 7 7800X3D");
    await choose(user, "Memória RAM", "Kingston Fury Beast 32GB (2x16) DDR5 6000MHz");
    expect(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))).toEqual({ cpu: "1", ram: "9" });
    unmount();

    // The RAM kit was deleted by an admin in the meantime
    renderBuilder(seed.products.filter((p) => p.id !== "9"));

    expect(await screen.findByText("Uma peça da sua montagem não está mais no catálogo e foi retirada.")).toBeInTheDocument();
    expect(within(slot("Processador")).getByText("AMD Ryzen 7 7800X3D")).toBeInTheDocument();
    expect(within(slot("Memória RAM")).getByText("Escolha a memória RAM")).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(BUILDER_STORAGE_KEY))).toEqual({ cpu: "1" }));
  });

  it("clears the build", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await choose(user, "Processador", "AMD Ryzen 7 7800X3D");

    await user.click(screen.getByRole("button", { name: "Limpar montagem" }));

    expect(screen.getByText("Comece escolhendo as peças")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar montagem" })).not.toBeInTheDocument();
  });

  it("shows the server error and retries", async () => {
    const user = userEvent.setup();
    installProductStore(seed.products);
    const working = listProducts.getMockImplementation();
    listProducts.mockImplementation(async () => {
      throw new Error("Servidor fora do ar");
    });
    renderWithRouter(routes, { path: "/monte-seu-pc" });

    expect(await screen.findByText("Servidor fora do ar")).toBeInTheDocument();
    listProducts.mockImplementation(working);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Comece escolhendo as peças")).toBeInTheDocument();
  });

  it("is linked from the header", async () => {
    const user = userEvent.setup();
    installProductStore(seed.products);
    const { router } = renderWithRouter(routes, { path: "/catalog" });

    await user.click(screen.getByRole("link", { name: "Monte seu PC" }));
    expect(router.state.location.pathname).toBe("/monte-seu-pc");
    expect(await screen.findByRole("heading", { level: 1, name: "Monte seu PC" })).toBeInTheDocument();
  });
});
