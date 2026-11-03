import { useEffect, useState } from "react";
import { listProducts } from "../api/products";

// Loads products for the given filters (see buildProductQuery in
// api/products.js) and reloads when they change.
// Returns { data, items, pages, loading, error }. Paginated and plain
// responses from json-server are normalised to the same shape.
export function useProductList(filters) {
  // Filters are compared by value, so callers may pass a new object each render
  const key = JSON.stringify(filters ?? {});
  const [state, setState] = useState({ key: null, data: [], items: 0, pages: 0, error: "" });

  useEffect(() => {
    let cancelled = false;

    listProducts(JSON.parse(key))
      .then((result) => {
        if (cancelled) return;
        const page = Array.isArray(result)
          ? { data: result, items: result.length, pages: 1 }
          : result;
        setState({ key, data: page.data, items: page.items, pages: page.pages, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ key, data: [], items: 0, pages: 0, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { ...state, loading: state.key !== key };
}
