import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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
import { CLIENT, installStore } from "../test/mockStore";
import { listOrders } from "../api/orders";
import { listUsers } from "../api/users";

vi.mock("../api/products", async (importOriginal) => ({
  ...(await importOriginal()),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock("../api/carts", () => ({ getCartByUser: vi.fn(), createCart: vi.fn(), saveCartItems: vi.fn() }));
vi.mock("../api/orders", async (importOriginal) => ({
  ...(await importOriginal()),
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
}));
vi.mock("../api/users", async (importOriginal) => ({
  ...(await importOriginal()),
  listUsers: vi.fn(),
  getUser: vi.fn(),
}));

// Tuesday, 3 November 2026, 15:00 local time. Only Date is faked, so
// user-event and waitFor keep their real timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 3, 15, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

const at = (month, day, hour = 12) => new Date(2026, month, day, hour).toISOString();
const order = (id, date, total, userId = "1") => ({
  id,
  userId,
  date,
  total,
  items: [{ productId: "13", name: GPU.name, price: total, quantity: 1 }],
  status: "Pago",
});

const ORDERS = [
  order("o1", at(10, 3, 14), 1000), // today, 1 hour ago
  order("o2", at(10, 1), 500, null), // client deleted
  order("o3", at(9, 20), 1000), // last month
];

function renderDashboard({ orders = ORDERS, products = [GPU, LAST_UNITS_CPU, OUT_OF_STOCK, SERVICE] } = {}) {
  installStore({ products, users: [CLIENT] });
  listOrders.mockReset().mockImplementation(async () => orders.map((o) => ({ ...o })));
  listUsers.mockReset().mockResolvedValue([CLIENT]);
  return renderWithRouter(routes, { path: "/admin", session: ADMIN_SESSION });
}

const card = (title) => screen.getByRole("heading", { name: title }).closest(".dashboard-card");
// The big number of a card
const value = (title) => card(title).querySelector(".dashboard-card-value").textContent;

describe("AdminDashboard", () => {
  it("shows this month's numbers compared with last month", async () => {
    renderDashboard();

    await screen.findByText("Pedidos recentes");
    expect(card("Receita no mês")).toHaveTextContent(/1\.500,00/);
    expect(card("Receita no mês")).toHaveTextContent("+50% vs. mês anterior");
    expect(value("Pedidos no mês")).toBe("2");
    expect(card("Pedidos no mês")).toHaveTextContent("+100% vs. mês anterior");
    expect(card("Ticket médio")).toHaveTextContent(/750,00/);
    expect(card("Ticket médio")).toHaveTextContent("−25% vs. mês anterior");
    // Stock alerts: 1 without stock, 1 with the last units (services excluded)
    expect(value("Produtos sem estoque")).toBe("1");
    expect(card("Produtos sem estoque")).toHaveTextContent("1 com últimas unidades");
    expect(screen.getByText(/^Dados atualizados em 3 de novembro de 2026/)).toBeInTheDocument();
  });

  it("colours the comparison by direction (with the text saying it)", async () => {
    renderDashboard();
    await screen.findByText("Pedidos recentes");

    expect(within(card("Receita no mês")).getByText("+50% vs. mês anterior")).toHaveClass("up");
    expect(within(card("Ticket médio")).getByText("−25% vs. mês anterior")).toHaveClass("down");
  });

  it("gives the 7-day chart as a table for screen readers", async () => {
    renderDashboard();

    const table = await screen.findByRole("table", { name: "Vendas nos últimos 7 dias" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(7);
    expect(rows[6]).toHaveTextContent(/terça-feira, 3 de novembro.*1\.000,00/);
    expect(rows[4]).toHaveTextContent(/domingo, 1 de novembro.*500,00/);
    expect(rows[0]).toHaveTextContent(/quarta-feira, 28 de outubro.*0,00/);
  });

  it("lists the latest orders with customer and time", async () => {
    renderDashboard();

    const section = (await screen.findByRole("heading", { name: "Pedidos recentes" })).closest("section");
    const items = within(section).getAllByRole("listitem");
    expect(items.map((li) => within(li).getByRole("heading").textContent)).toEqual([
      expect.stringMatching(/^Pedido #o1 · R\$\s1\.000,00$/),
      expect.stringMatching(/^Pedido #o2/),
      expect.stringMatching(/^Pedido #o3/),
    ]);
    expect(items[0]).toHaveTextContent("Ana Souza · 1 item · há 1 hora");
    expect(items[1]).toHaveTextContent("Cliente removido");
  });

  it("handles a store without orders", async () => {
    renderDashboard({ orders: [] });

    expect(await screen.findByText("Nenhum pedido ainda.")).toBeInTheDocument();
    expect(card("Receita no mês")).toHaveTextContent("Sem vendas neste mês nem no anterior");
    expect(card("Ticket médio")).toHaveTextContent("–");
  });

  it("shows the server error and retries", async () => {
    const user = userEvent.setup();
    renderDashboard();
    listOrders.mockRejectedValueOnce(new Error("Servidor fora do ar"));
    // The first load already started with the working mock; reload to fail
    await screen.findByText("Pedidos recentes");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(await screen.findByText("Servidor fora do ar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByText("Servidor fora do ar")).not.toBeInTheDocument());
  });

  it("picks up new orders with the refresh button", async () => {
    const user = userEvent.setup();
    const orders = [...ORDERS];
    renderDashboard({ orders });
    await screen.findByText("Pedidos recentes");

    orders.push(order("o4", at(10, 3, 14), 250));
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(value("Pedidos no mês")).toBe("3"));
    expect(card("Receita no mês")).toHaveTextContent(/1\.750,00/);
  });
});

describe("AdminDashboard: demo", () => {
  it("a client's purchase changes the dashboard numbers", async () => {
    const user = userEvent.setup();

    // 1. The client buys 2 GPUs (2 × R$ 4.299,90)
    const db = installStore({
      products: [GPU, LAST_UNITS_CPU, OUT_OF_STOCK, SERVICE],
      users: [CLIENT],
      cartItems: [{ productId: GPU.id, quantity: 2 }],
    });
    const checkout = renderWithRouter(routes, { path: "/checkout", session: CLIENT_SESSION });
    await user.type(await screen.findByLabelText("Número do cartão"), "4111 1111 1111 1234");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));
    await screen.findByRole("heading", { name: "Pedido confirmado!" });
    checkout.unmount();
    localStorage.clear();

    // 2. The admin opens the dashboard: the order is there
    listOrders.mockReset().mockImplementation(async () => Object.values(db.orders));
    listUsers.mockReset().mockResolvedValue([CLIENT]);
    renderWithRouter(routes, { path: "/admin", session: ADMIN_SESSION });

    await screen.findByText("Pedidos recentes");
    expect(value("Pedidos no mês")).toBe("1");
    expect(card("Receita no mês")).toHaveTextContent(/8\.599,80/);
    const recent = screen.getByRole("heading", { name: /^Pedido #o1 · R\$\s8\.599,80$/ }).closest("li");
    expect(recent).toHaveTextContent("Ana Souza · 2 itens · agora");
    // Stock went from 6 to 4: still in stock, so no new alert
    expect(card("Produtos sem estoque")).toHaveTextContent("1 com últimas unidades");
  });
});
