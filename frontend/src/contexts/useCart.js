import { useContext } from "react";
import { CartContext } from "./cart";

// Returns the cart of the logged-in client:
//   items, count, status ("guest" | "loading" | "ready" | "error"), error,
//   canShop, quantityOf(id), addItem(product, qty), setQuantity(product, qty),
//   removeItem(id), clearCart()
// Every change returns a promise of { items } or { error }.
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}
