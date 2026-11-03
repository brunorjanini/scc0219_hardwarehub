import { describe, expect, it } from "vitest";
import { changeComment, dashboardStats, timeAgo } from "./dashboardStats";

// Tuesday, 3 November 2026, 15:00 local time
const NOW = new Date(2026, 10, 3, 15, 0);
// ISO date of a local time (so tests pass in any time zone)
const at = (year, month, day, hour = 12, minute = 0) => new Date(year, month, day, hour, minute).toISOString();

const order = (id, date, total, extra = {}) => ({
  id,
  userId: "1",
  date,
  total,
  items: [{ productId: "13", name: "RTX", price: total, quantity: 1 }],
  status: "Pago",
  ...extra,
});

const ORDERS = [
  // November (this month)
  order("o1", at(2026, 10, 3, 14, 30), 1000),
  order("o2", at(2026, 10, 1), 500, { userId: null }),
  order("o3", at(2026, 10, 2, 9), 300, { items: [{ productId: "1", quantity: 2 }, { productId: "27", quantity: 1 }] }),
  // October (previous month)
  order("o4", at(2026, 9, 31, 23, 50), 1000),
  order("o5", at(2026, 9, 10), 600),
  // Older: ignored by the month cards
  order("o6", at(2026, 8, 1), 9999),
];

const PRODUCTS = [
  { id: "1", type: "product", stock: 0 },
  { id: "2", type: "product", stock: 2 },
  { id: "3", type: "product", stock: 3 },
  { id: "4", type: "product", stock: 10 },
  { id: "27", type: "service", stock: null },
];

const USERS = [{ id: "1", name: "Ana Souza" }];

describe("dashboardStats", () => {
  const stats = dashboardStats({ orders: ORDERS, products: PRODUCTS, users: USERS }, NOW);

  it("sums this month and the previous one", () => {
    expect(stats.month).toEqual({ revenue: 1800, orders: 3, ticket: 600 });
    expect(stats.previous).toEqual({ revenue: 1600, orders: 2, ticket: 800 });
  });

  it("compares with the previous month", () => {
    expect(stats.comments.revenue).toEqual({ text: "+12,5% vs. mês anterior", tone: "up" });
    expect(stats.comments.orders).toEqual({ text: "+50% vs. mês anterior", tone: "up" });
    expect(stats.comments.ticket).toEqual({ text: "−25% vs. mês anterior", tone: "down" });
  });

  it("counts products without stock and with few units (services excluded)", () => {
    expect(stats.stock).toEqual({ out: 1, low: 2 });
  });

  it("builds the revenue of the last 7 days, ending today", () => {
    expect(stats.days).toHaveLength(7);
    // 28, 29, 30, 31 Oct, 1, 2, 3 Nov (the 23:50 order counts on 31 Oct)
    expect(stats.days.map((d) => d.total)).toEqual([0, 0, 0, 1000, 500, 300, 1000]);
    expect(stats.days.at(-1)).toMatchObject({ isToday: true, label: "ter", longLabel: "terça-feira, 3 de novembro" });
    expect(stats.days[0]).toMatchObject({ isToday: false, label: "qua", longLabel: "quarta-feira, 28 de outubro" });
  });

  it("lists the newest orders with customer, units and time", () => {
    expect(stats.recent.map((r) => r.id)).toEqual(["o1", "o3", "o2", "o4", "o5", "o6"]);
    expect(stats.recent[0]).toMatchObject({ customer: "Ana Souza", total: 1000, units: 1, ago: "há 30 minutos" });
    expect(stats.recent[1]).toMatchObject({ units: 3, ago: "ontem" });
    // The client was deleted: json-server set userId to null
    expect(stats.recent[2].customer).toBe("Cliente removido");
  });

  it("keeps only the 6 newest orders", () => {
    const many = Array.from({ length: 9 }, (_, i) => order(`n${i}`, at(2026, 10, 3, 1, i), 10));
    expect(dashboardStats({ orders: many }, NOW).recent).toHaveLength(6);
  });

  it("works with no data", () => {
    const empty = dashboardStats({}, NOW);
    expect(empty.month).toEqual({ revenue: 0, orders: 0, ticket: 0 });
    expect(empty.comments.revenue).toEqual({ text: "Sem vendas neste mês nem no anterior", tone: "neutral" });
    expect(empty.days.every((d) => d.total === 0)).toBe(true);
    expect(empty.recent).toEqual([]);
    expect(empty.stock).toEqual({ out: 0, low: 0 });
  });

  it("ignores orders with an invalid date", () => {
    const broken = dashboardStats({ orders: [order("x", "ontem", 50)] }, NOW);
    expect(broken.month.orders).toBe(0);
    expect(broken.recent).toEqual([]);
  });
});

describe("changeComment", () => {
  it.each([
    [100, 0, "Sem vendas no mês anterior", "neutral"],
    [100, 100, "Igual ao mês anterior", "neutral"],
    [110, 100, "+10% vs. mês anterior", "up"],
    [98.7, 100, "−1,3% vs. mês anterior", "down"],
  ])("%s vs %s", (current, previous, text, tone) => {
    expect(changeComment(current, previous)).toEqual({ text, tone });
  });
});

describe("timeAgo", () => {
  it.each([
    [new Date(2026, 10, 3, 14, 59, 30), "agora"],
    [new Date(2026, 10, 3, 14, 55), "há 5 minutos"],
    [new Date(2026, 10, 3, 12, 0), "há 3 horas"],
    [new Date(2026, 10, 2, 20, 0), "há 19 horas"],
    [new Date(2026, 10, 2, 9, 0), "ontem"],
    [new Date(2026, 9, 30, 9, 0), "há 4 dias"],
  ])("%s -> %s", (date, text) => {
    expect(timeAgo(date, NOW)).toBe(text);
  });
});
