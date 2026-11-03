import { listProducts } from "../api/products";
import { usePagedList } from "./usePagedList";

// Loads products for the given filters (see buildProductQuery in
// api/products.js). Same return value and reload rules as usePagedList.
export function useProductList(filters, reloadKey = 0) {
  return usePagedList(listProducts, filters, reloadKey);
}
