// Numbers of the admin dashboard, computed from /orders, /products and
// /users. Pure functions: `now` is a parameter so tests can fix the date.
// Months and days follow the browser's local time zone.
import { formatNumber } from "./format";
import { LOW_STOCK_THRESHOLD } from "./stock";

export const RECENT_ORDERS = 6;
export const CHART_DAYS = 7;

const roundCents = (value) => Math.round(value * 100) / 100;
const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const dayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// Orders with a valid date, as { order, date, total }
function datedOrders(orders = []) {
  return orders
    .map((order) => ({ order, date: new Date(order.date), total: Number(order.total) || 0 }))
    .filter(({ date }) => !Number.isNaN(date.getTime()));
}

function summarize(entries) {
  const revenue = roundCents(entries.reduce((sum, e) => sum + e.total, 0));
  const count = entries.length;
  return { revenue, orders: count, ticket: count ? roundCents(revenue / count) : 0 };
}

// "+12,4% vs. mês anterior" (tone "up"), "−3% vs. mês anterior" ("down"),
// or a neutral text when there is nothing to compare with.
export function changeComment(current, previous) {
  if (!previous) {
    return { text: current ? "Sem vendas no mês anterior" : "Sem vendas neste mês nem no anterior", tone: "neutral" };
  }
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  if (change === 0) return { text: "Igual ao mês anterior", tone: "neutral" };
  const sign = change > 0 ? "+" : "−";
  return {
    text: `${sign}${formatNumber(Math.abs(change))}% vs. mês anterior`,
    tone: change > 0 ? "up" : "down",
  };
}

// "agora", "há 5 minutos", "há 3 horas", "ontem", "há 4 dias"
export function timeAgo(date, now) {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return relative.format(0, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  return relative.format(-days, "day");
}

export function dashboardStats({ orders = [], products = [], users = [] } = {}, now = new Date()) {
  const entries = datedOrders(orders);
  const thisMonth = monthIndex(now);

  const month = summarize(entries.filter((e) => monthIndex(e.date) === thisMonth));
  const previous = summarize(entries.filter((e) => monthIndex(e.date) === thisMonth - 1));

  // Services have stock null and never run out
  const goods = products.filter((p) => p.type !== "service");
  const stock = {
    out: goods.filter((p) => Number(p.stock) === 0).length,
    low: goods.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
  };

  // Revenue of each of the last 7 days, oldest first; today is highlighted
  const today = startOfDay(now);
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (CHART_DAYS - 1 - i));
    const total = roundCents(entries.filter((e) => sameDay(e.date, date)).reduce((sum, e) => sum + e.total, 0));
    return {
      date,
      label: weekdayShort.format(date).replace(".", ""),
      longLabel: dayLong.format(date),
      total,
      isToday: i === CHART_DAYS - 1,
    };
  });

  const names = Object.fromEntries(users.map((u) => [String(u.id), u.name]));
  const recent = [...entries]
    .sort((a, b) => b.date - a.date)
    .slice(0, RECENT_ORDERS)
    .map(({ order, date, total }) => ({
      id: order.id,
      total,
      date,
      ago: timeAgo(date, now),
      units: (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      // json-server sets userId to null when the client is deleted
      customer: names[String(order.userId)] ?? "Cliente removido",
    }));

  return {
    month,
    previous,
    comments: {
      revenue: changeComment(month.revenue, previous.revenue),
      orders: changeComment(month.orders, previous.orders),
      ticket: changeComment(month.ticket, previous.ticket),
    },
    stock,
    days,
    recent,
  };
}
