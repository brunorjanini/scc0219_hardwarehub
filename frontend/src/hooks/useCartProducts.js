import { useEffect, useState } from "react";
import { fetchProducts } from "../utils/checkout";

// Loads the products that are in the cart: { products, loading, error },
// where products is { [id]: product | null } (null = deleted product).
// Products already loaded stay in memory, so changing a quantity or
// removing an item does not flash a loading state.
export function useCartProducts(items) {
  const ids = [...new Set(items.map((item) => String(item.productId)))].sort();
  const key = ids.join(",");
  const [state, setState] = useState({ key: null, products: {}, error: "" });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;

    fetchProducts(key.split(","))
      .then((products) => {
        if (cancelled) return;
        setState((previous) => ({ key, products: { ...previous.products, ...products }, error: "" }));
      })
      .catch((error) => {
        if (cancelled) return;
        setState((previous) => ({ ...previous, key, error: error.message }));
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const missing = ids.some((id) => !(id in state.products));
  const error = state.key === key ? state.error : "";

  return { products: state.products, loading: missing && !error, error };
}
