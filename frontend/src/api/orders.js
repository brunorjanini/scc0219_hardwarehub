// Orders (/orders): { id, userId, items, total, date, cardLast4, address, status }
import { http, whereEquals } from "./http";

export function listOrders() {
  return http.get("/orders", { _sort: "-date" });
}

// whereEquals keeps "1" a string (see http.js)
export function listOrdersByUser(userId) {
  return http.get("/orders", {
    ...whereEquals({ userId: String(userId) }),
    _sort: "-date",
  });
}

export function getOrder(id) {
  return http.get(`/orders/${encodeURIComponent(id)}`);
}

export function createOrder(order) {
  return http.post("/orders", order);
}
