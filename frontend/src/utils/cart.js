// Pure functions on cart items ([{ productId, quantity }]).
// They never mutate the input and return either { items } or { error },
// so CartContext only saves to the server when the change is valid.
import { sameId } from "../api/http";
import { MAX_QUANTITY_PER_ITEM, isService, maxPurchasable } from "./stock";

// Total number of units in the cart (shown in the header badge)
export function cartCount(items = []) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function quantityOf(items = [], productId) {
  return items.find((item) => sameId(item.productId, productId))?.quantity ?? 0;
}

function isValidQuantity(quantity) {
  return Number.isInteger(quantity) && quantity > 0;
}

// Message when `wanted` units exceed what can be bought
function limitError(product, max, current) {
  if (max === 0) return "Produto indisponível no momento";
  if (isService(product)) {
    return `Limite de ${MAX_QUANTITY_PER_ITEM} unidades por item`;
  }
  const units = max === 1 ? "1 unidade disponível" : `${max} unidades disponíveis`;
  return current > 0
    ? `Você já tem ${current} no carrinho. Estoque: ${units}`
    : `Apenas ${units}`;
}

// Adds `quantity` units, merging with the line already in the cart
export function addItem(items = [], product, quantity = 1) {
  if (!isValidQuantity(quantity)) return { error: "Quantidade inválida" };

  const max = maxPurchasable(product);
  const current = quantityOf(items, product.id);
  if (current + quantity > max) {
    return { error: limitError(product, max, current) };
  }

  if (current > 0) {
    return { items: setLine(items, product.id, current + quantity) };
  }
  return { items: [...items, { productId: String(product.id), quantity }] };
}

// Adds several products at once (the PC Builder adds a whole build).
// entries: [{ product, quantity }]. All or nothing: if one product cannot
// be added, nothing changes and the error names that product.
export function addItems(items = [], entries = []) {
  let next = items;
  for (const { product, quantity = 1 } of entries) {
    const result = addItem(next, product, quantity);
    if (result.error) return { error: `${product.name}: ${result.error}` };
    next = result.items;
  }
  return { items: next };
}

// Sets the quantity of a line; 0 removes it
export function setItemQuantity(items = [], product, quantity) {
  if (quantity === 0) return { items: removeItem(items, product.id) };
  if (!isValidQuantity(quantity)) return { error: "Quantidade inválida" };

  const max = maxPurchasable(product);
  if (quantity > max) return { error: limitError(product, max, 0) };

  if (quantityOf(items, product.id) === 0) {
    return { items: [...items, { productId: String(product.id), quantity }] };
  }
  return { items: setLine(items, product.id, quantity) };
}

export function removeItem(items = [], productId) {
  return items.filter((item) => !sameId(item.productId, productId));
}

function setLine(items, productId, quantity) {
  return items.map((item) =>
    sameId(item.productId, productId) ? { ...item, quantity } : item,
  );
}
