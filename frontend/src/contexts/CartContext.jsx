import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartContext } from "./cart";
import { useAuth } from "./useAuth";
import { createCart, getCartByUser, saveCartItems } from "../api/carts";
import * as cartItems from "../utils/cart";

// Keeps the logged-in client's cart in sync with the server (/carts).
// The cart is saved on every change, so it survives reloads, logout and a
// change of browser; it is emptied only by the client or by payment.
//
// Changes run one at a time (a promise queue): two quick clicks never send
// PATCHes out of order, and the second change sees the result of the first.
// Only clients have a cart; administrators and guests cannot shop.
export default function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.type === "user" ? String(user.id) : null;

  // Last cart loaded or saved, tagged with its owner
  const [loaded, setLoaded] = useState({ userId: null, cart: null, error: "" });
  // Same cart, readable inside queued changes without stale closures
  const cartRef = useRef(null);
  // Promise chain: the initial load, then each change in order
  const queueRef = useRef(Promise.resolve());

  // Load the cart whenever the logged-in client changes
  useEffect(() => {
    cartRef.current = null;
    if (!userId) return undefined;

    let cancelled = false;
    const load = getCartByUser(userId)
      .then((cart) => {
        if (cancelled) return;
        // No cart on the server yet: start empty, created on the first change
        const value = cart ?? { id: null, userId, items: [] };
        cartRef.current = value;
        setLoaded({ userId, cart: value, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoaded({ userId, cart: null, error: error.message });
      });

    queueRef.current = load;
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Runs `compute(items)` after pending changes and saves the result
  const mutate = useCallback(
    (compute) => {
      if (!userId) {
        return Promise.resolve({
          error: user
            ? "Entre com uma conta de cliente para comprar"
            : "Entre na sua conta para usar o carrinho",
        });
      }

      const run = queueRef.current.then(async () => {
        const cart = cartRef.current;
        if (!cart || cart.userId !== userId) {
          return { error: "Não foi possível carregar o carrinho. Recarregue a página." };
        }

        const result = compute(cart.items);
        if (result.error) return result;

        const saved = cart.id
          ? await saveCartItems(cart.id, result.items)
          : await createCart(userId, result.items);
        const next = { id: saved.id, userId, items: saved.items ?? result.items };

        // Ignore the answer if the user logged out meanwhile
        if (cartRef.current === cart) {
          cartRef.current = next;
          setLoaded({ userId, cart: next, error: "" });
        }
        return { items: next.items };
      });

      // A failed change must not block the next ones
      queueRef.current = run.catch(() => {});
      return run.catch((error) => ({ error: error.message }));
    },
    [userId, user],
  );

  const current = loaded.userId === userId ? loaded : null;
  const items = useMemo(() => current?.cart?.items ?? [], [current]);

  let status = "guest";
  if (userId) {
    if (!current) status = "loading";
    else status = current.error ? "error" : "ready";
  }

  const value = useMemo(
    () => ({
      items,
      count: cartItems.cartCount(items),
      status,
      error: current?.error ?? "",
      canShop: Boolean(userId),
      quantityOf: (productId) => cartItems.quantityOf(items, productId),
      addItem: (product, quantity = 1) =>
        mutate((list) => cartItems.addItem(list, product, quantity)),
      // Several products in one save, all or nothing (PC Builder)
      addItems: (entries) => mutate((list) => cartItems.addItems(list, entries)),
      setQuantity: (product, quantity) =>
        mutate((list) => cartItems.setItemQuantity(list, product, quantity)),
      removeItem: (productId) =>
        mutate((list) => ({ items: cartItems.removeItem(list, productId) })),
      clearCart: () => mutate(() => ({ items: [] })),
    }),
    [items, status, current, userId, mutate],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
