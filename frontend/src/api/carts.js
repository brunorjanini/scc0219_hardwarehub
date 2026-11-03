// Shopping carts (/carts). One cart per user: { id, userId, items: [{ productId, quantity }] }
import { http, whereEquals } from "./http";

// Returns the user's cart, or null if the user has none yet.
// whereEquals keeps "1" a string (see http.js).
export async function getCartByUser(userId) {
  const carts = await http.get("/carts", whereEquals({ userId: String(userId) }));
  return carts.length > 0 ? carts[0] : null;
}

export function createCart(userId, items = []) {
  return http.post("/carts", { userId: String(userId), items });
}

// Replaces the item list of an existing cart
export function saveCartItems(cartId, items) {
  return http.patch(`/carts/${encodeURIComponent(cartId)}`, { items });
}
