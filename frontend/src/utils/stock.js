// Stock rules shared by product cards, the product page and the cart.
// Services have stock null: they are scheduled, never run out, and only
// the per-item limit applies.

// Highest quantity of one item in the cart (also caps services)
export const MAX_QUANTITY_PER_ITEM = 99;

// Units left to call it "últimas unidades"
export const LOW_STOCK_THRESHOLD = 3;

export function isService(product) {
  return product?.type === "service";
}

// Largest quantity that can be bought right now (0 = unavailable)
export function maxPurchasable(product) {
  if (!product) return 0;
  if (isService(product)) return MAX_QUANTITY_PER_ITEM;
  const stock = Number(product.stock) || 0;
  return Math.max(0, Math.min(stock, MAX_QUANTITY_PER_ITEM));
}

// Label and tone shown next to the product. `tone` only picks the colour;
// the label always carries the meaning (accessibility: never colour alone).
export function stockStatus(product) {
  if (isService(product)) {
    return { label: "Sob agendamento", tone: "info", available: true };
  }
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) {
    return { label: "Indisponível", tone: "danger", available: false };
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return { label: "Últimas unidades", tone: "warning", available: true };
  }
  return { label: "Em estoque", tone: "success", available: true };
}
