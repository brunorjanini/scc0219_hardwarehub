// Orders (/orders): { id, userId, items, total, date, cardLast4, address, status }
import { http } from "./http";

export function listOrders() {
  return http.get("/orders", { _sort: "-date" });
}

export function listOrdersByUser(userId) {
  return http.get("/orders", { userId: String(userId), _sort: "-date" });
}

export function getOrder(id) {
  return http.get(`/orders/${encodeURIComponent(id)}`);
}

export function createOrder(order) {
  return http.post("/orders", order);
}
