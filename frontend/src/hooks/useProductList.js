import { useEffect, useState } from "react";
import { listProducts } from "../api/products";

// Loads products for the given filters (see buildProductQuery in
// api/products.js) and reloads when they change, or when `reloadKey`
// changes (the admin list bumps it after editing or deleting).
// Returns { data, items, pages, loading, error }. Paginated and plain
// responses from json-server are normalised to the same shape.
// While reloading, the previous `data` is kept, so a table can stay on
// screen (and keep keyboard focus) until the new rows arrive.
export function useProductList(filters, reloadKey = 0) {
  // Filters are compared by value, so callers may pass a new object each render
  const filtersKey = JSON.stringify(filters ?? {});
  const key = `${filtersKey}#${reloadKey}`;
  const [state, setState] = useState({ key: null, data: [], items: 0, pages: 0, error: "" });

  useEffect(() => {
    let cancelled = false;

    listProducts(JSON.parse(filtersKey))
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
  }, [key, filtersKey]);

  return { ...state, loading: state.key !== key };
}
