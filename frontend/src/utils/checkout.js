// Cart lines, totals and the purchase itself (placeOrder).
//
// json-server has no transactions, so placeOrder applies the changes one
// by one and undoes them if a step fails:
//   1. read every product again (prices and stock may have changed)
//   2. refuse the order if a product is gone or has too little stock
//   3. PATCH each product: stock - quantity, sold + quantity
//   4. POST the order
// If step 3 or 4 fails, the products already changed get their previous
// stock/sold back and the cart is left untouched. The real server of the
// final version should do this in a single database transaction.
import { getProduct, updateProduct } from "../api/products";
import { createOrder } from "../api/orders";
import { isService } from "./stock";

// Error with a message that can be shown to the client as is
export class CheckoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "CheckoutError";
  }
}

// Avoids floating point noise like 899.9 * 3 = 2699.7000000000003
function roundCents(value) {
  return Math.round(value * 100) / 100;
}

// Loads the given products. Returns { [id]: product | null }, where null
// means the product no longer exists (404). Other errors are thrown.
export async function fetchProducts(ids) {
  const unique = [...new Set(ids.map(String))];
  const entries = await Promise.all(
    unique.map(async (id) => {
      try {
        return [id, await getProduct(id)];
      } catch (error) {
        if (error.status === 404) return [id, null];
        throw error;
      }
    }),
  );
  return Object.fromEntries(entries);
}

// Joins cart items with product data. Each line says what is wrong with it
// (`problem`), so the cart can show it and block the checkout.
export function buildCartLines(items, productsById) {
  return items.map((item) => {
    const id = String(item.productId);
    const product = productsById[id] ?? null;

    let problem = "";
    if (!product) {
      problem = "Este produto não está mais disponível";
    } else if (!isService(product) && product.stock < item.quantity) {
      problem =
        product.stock > 0
          ? `Apenas ${product.stock} em estoque. Diminua a quantidade.`
          : "Produto esgotado. Remova-o para continuar.";
    }

    return {
      productId: id,
      quantity: item.quantity,
      product,
      problem,
      subtotal: product ? roundCents(product.price * item.quantity) : 0,
    };
  });
}

export function cartTotal(lines) {
  return roundCents(lines.reduce((sum, line) => sum + line.subtotal, 0));
}

// Units in the cart
export function lineCount(lines) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

// Gives the changed products their previous stock and sold values back.
// Returns the products that could not be restored.
async function rollback(changedProducts) {
  const failed = [];
  for (const product of [...changedProducts].reverse()) {
    try {
      await updateProduct(product.id, { stock: product.stock, sold: product.sold });
    } catch {
      failed.push(product);
    }
  }
  return failed;
}

// Buys the cart. `address` is { street, number, city, zip }; any card
// number is accepted and only its last 4 digits are saved.
// Returns the created order or throws CheckoutError.
export async function placeOrder({ userId, items, address, cardNumber }) {
  if (!items?.length) throw new CheckoutError("Seu carrinho está vazio.");

  // 1-2. Fresh product data and validation
  const products = await fetchProducts(items.map((item) => item.productId));
  const lines = buildCartLines(items, products);
  const problems = lines.filter((line) => line.problem);
  if (problems.length > 0) {
    throw new CheckoutError(
      problems
        .map((line) => `${line.product?.name ?? "Item removido"}: ${line.problem}`)
        .join(" "),
    );
  }

  const changed = [];
  try {
    // 3. Stock and sold counters (services have no stock)
    for (const line of lines) {
      const { product } = line;
      const changes = { sold: (product.sold ?? 0) + line.quantity };
      if (!isService(product)) changes.stock = product.stock - line.quantity;
      await updateProduct(product.id, changes);
      changed.push(product);
    }

    // 4. The order keeps name and price as they were at purchase time
    const digits = String(cardNumber).replace(/\D/g, "");
    return await createOrder({
      userId: String(userId),
      items: lines.map(({ product, quantity }) => ({
        productId: String(product.id),
        name: product.name,
        price: product.price,
        quantity,
      })),
      total: cartTotal(lines),
      date: new Date().toISOString(),
      cardLast4: digits.slice(-4),
      address,
      status: "Pago",
    });
  } catch {
    const notRestored = await rollback(changed);
    if (notRestored.length > 0) {
      throw new CheckoutError(
        "Não foi possível concluir o pedido e o estoque de alguns produtos pode ter ficado incorreto. Avise o suporte. Seu carrinho foi mantido.",
      );
    }
    throw new CheckoutError(
      "Não foi possível concluir o pedido. Nada foi cobrado e seu carrinho foi mantido. Tente novamente.",
    );
  }
}
