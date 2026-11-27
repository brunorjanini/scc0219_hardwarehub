/**
 * @file Customer tools: cart, saved builds, orders and checkout, always for
 * the customer set in the configuration (HARDWAREHUB_USER_ID).
 *
 * Cart rules (stock limits, all-or-nothing additions) and saved-build rules
 * come from the React client's utils, so the agent and the store behave the
 * same. Checkout and clearing the cart take two steps (preview + confirm).
 */
import * as z from "zod/v4";
import { ApiError, readPage, whereEquals } from "../api.js";
import { ToolError } from "../errors.js";
import { summarizeProduct } from "../format.js";
import { BuildParts, ProductSummary } from "../schemas.js";
import {
  ASSEMBLY_SERVICE_ID,
  addBlockReason,
  addItems,
  analyzeCompatibility,
  buildCartEntries,
  cartCount,
  describeSavedBuild,
  maxPurchasable,
  removeItem,
  sameId,
  setItemQuantity,
  toBuildRecord,
  validateBuildName,
  BUILD_NAME_MAX,
} from "../shared.js";
import { loadParts } from "./builder.js";
import { fetchProduct } from "./catalog.js";

const round2 = (n) => Math.round(n * 100) / 100;

/** Writes to the cart: change data, reversible. */
const CART_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
/** Reads of the customer's own data. */
const OWN_READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

// ---- Data access ----

/**
 * The customer and their cart (null when they never had one).
 * @param {{ api: object, identity: object }} ctx
 */
async function readCart({ api, identity }) {
  const user = await identity.customer();
  const carts = readPage(await api.get("/carts", whereEquals({ userId: String(user.id) }))).data;
  const cart = carts[0] ?? null;
  return { user, cart, items: cart?.items ?? [] };
}

/** Saves the item list, creating the cart on first use. */
async function writeItems({ api }, state, items) {
  if (state.cart) {
    await api.patch(`/carts/${encodeURIComponent(state.cart.id)}`, { items });
  } else {
    await api.post("/carts", { userId: String(state.user.id), items });
  }
}

/** Products by id; ids that no longer exist map to null. */
async function fetchProducts(api, ids) {
  const unique = [...new Set(ids.map(String))];
  const products = await Promise.all(
    unique.map((id) =>
      fetchProduct(api, id).catch((err) => {
        if (err instanceof ToolError) return null;
        throw err;
      }),
    ),
  );
  return new Map(unique.map((id, i) => [id, products[i]]));
}

// ---- Views ----

const CartLine = z.object({
  productId: z.string(),
  quantity: z.number(),
  product: ProductSummary.nullable().describe("null se o produto saiu do catálogo"),
  unitPrice: z.number().nullable(),
  subtotal: z.number(),
  problem: z.string().nullable().describe("Impede a compra: produto removido, sem estoque ou quantidade acima do estoque"),
});

const CartView = z.object({
  items: z.array(CartLine),
  count: z.number().describe("Total de unidades"),
  total: z.number().describe("Total em reais, com os preços de hoje"),
  canCheckout: z.boolean(),
  problems: z.array(z.string()),
});

/**
 * Cart with today's prices and stock, plus what would block a purchase.
 * @param {object} api
 * @param {{ productId: string, quantity: number }[]} items
 */
export async function cartView(api, items) {
  const products = await fetchProducts(api, items.map((item) => item.productId));
  const lines = items.map(({ productId, quantity }) => {
    const product = products.get(String(productId));
    if (!product) {
      return { productId: String(productId), quantity, product: null, unitPrice: null, subtotal: 0, problem: "Produto removido do catálogo" };
    }
    const max = maxPurchasable(product);
    let problem = null;
    if (max === 0) problem = "Produto indisponível no momento";
    else if (quantity > max) problem = `Só há ${max} unidade(s) disponível(is)`;
    const price = Number(product.price) || 0;
    return {
      productId: String(productId),
      quantity,
      product: summarizeProduct(product),
      unitPrice: price,
      subtotal: round2(price * quantity),
      problem,
    };
  });
  const problems = lines.filter((line) => line.problem).map((line) => `${line.product?.name ?? `Produto ${line.productId}`}: ${line.problem}`);
  return {
    items: lines,
    count: cartCount(items),
    total: round2(lines.reduce((sum, line) => sum + line.subtotal, 0)),
    canCheckout: lines.length > 0 && problems.length === 0,
    problems,
  };
}

const OrderView = z.object({
  id: z.string(),
  date: z.string().nullable(),
  status: z.string().nullable(),
  total: z.number(),
  cardLast4: z.string().nullable(),
  address: z.record(z.string(), z.unknown()).nullable(),
  items: z.array(
    z.object({ productId: z.string(), name: z.string(), price: z.number(), quantity: z.number(), subtotal: z.number() }),
  ),
});

/** Order as shown to the agent. */
function orderView(order) {
  return {
    id: String(order.id),
    date: order.date ?? null,
    status: order.status ?? null,
    total: Number(order.total) || 0,
    cardLast4: order.cardLast4 ?? null,
    address: order.address ?? null,
    items: (order.items ?? []).map((item) => ({
      productId: String(item.productId),
      name: item.name,
      price: Number(item.price) || 0,
      quantity: item.quantity,
      subtotal: round2((Number(item.price) || 0) * item.quantity),
    })),
  };
}

/** Stable text of a cart, to notice changes between preview and confirm. */
const cartKey = (items) =>
  items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join(",");

// ---- Cart ----

export const getCart = {
  name: "get_cart",
  title: "Ver carrinho",
  description: "Show the customer's cart with today's prices, the total, and anything that would block checkout.",
  outputSchema: CartView,
  annotations: OWN_READ,
  async handler(ctx) {
    return cartView(ctx.api, (await readCart(ctx)).items);
  },
};

const CartEntry = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const addToCart = {
  name: "add_to_cart",
  title: "Adicionar ao carrinho",
  description:
    "Add products to the customer's cart. All or nothing: if any product would exceed its stock " +
    "(counting what is already in the cart), nothing changes and the error names that product.",
  inputSchema: z.object({ items: z.array(CartEntry).min(1).max(20) }),
  outputSchema: CartView,
  annotations: CART_WRITE,
  async handler(ctx, { items }) {
    const state = await readCart(ctx);
    const entries = await Promise.all(
      items.map(async ({ productId, quantity }) => ({ product: await fetchProduct(ctx.api, productId), quantity })),
    );
    const result = addItems(state.items, entries);
    if (result.error) throw new ToolError(result.error);
    await writeItems(ctx, state, result.items);
    return cartView(ctx.api, result.items);
  },
};

export const updateCartItem = {
  name: "update_cart_item",
  title: "Alterar quantidade",
  description: "Set the quantity of one product in the cart (limited to its stock). Quantity 0 removes it.",
  inputSchema: z.object({
    productId: z.string().trim().min(1),
    quantity: z.number().int().min(0).max(99),
  }),
  outputSchema: CartView,
  annotations: { ...CART_WRITE, idempotentHint: true },
  async handler(ctx, { productId, quantity }) {
    const state = await readCart(ctx);
    let items;
    if (quantity === 0) {
      items = removeItem(state.items, productId);
    } else {
      const result = setItemQuantity(state.items, await fetchProduct(ctx.api, productId), quantity);
      if (result.error) throw new ToolError(result.error);
      items = result.items;
    }
    await writeItems(ctx, state, items);
    return cartView(ctx.api, items);
  },
};

export const removeCartItem = {
  name: "remove_cart_item",
  title: "Remover do carrinho",
  description: "Remove one product from the cart.",
  inputSchema: z.object({ productId: z.string().trim().min(1) }),
  outputSchema: CartView,
  annotations: { ...CART_WRITE, destructiveHint: true, idempotentHint: true },
  async handler(ctx, { productId }) {
    const state = await readCart(ctx);
    if (!state.items.some((item) => sameId(item.productId, productId))) {
      throw new ToolError(`O produto "${productId}" não está no carrinho.`);
    }
    const items = removeItem(state.items, productId);
    await writeItems(ctx, state, items);
    return cartView(ctx.api, items);
  },
};

const PreviewResult = (extra) =>
  z.object({
    token: z.string().describe("Use no *_confirm correspondente, só depois de o usuário concordar"),
    expiresAt: z.string(),
    ...extra,
  });

export const clearCartPreview = {
  name: "clear_cart_preview",
  title: "Esvaziar carrinho (prévia)",
  description:
    "Step 1 of 2 to empty the cart: shows what would be removed and returns a one-time token. " +
    "Ask the user, then call clear_cart_confirm with the token.",
  outputSchema: PreviewResult({ cart: CartView }),
  annotations: OWN_READ,
  async handler(ctx) {
    const { items } = await readCart(ctx);
    if (items.length === 0) throw new ToolError("O carrinho já está vazio.");
    return { ...ctx.confirmations.issue("clear_cart", null), cart: await cartView(ctx.api, items) };
  },
};

export const clearCartConfirm = {
  name: "clear_cart_confirm",
  title: "Esvaziar carrinho (confirmar)",
  description: "Step 2 of 2: empties the cart. Needs the token from clear_cart_preview (valid once, for 5 minutes).",
  inputSchema: z.object({ token: z.string().trim().min(1) }),
  outputSchema: CartView,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  async handler(ctx, { token }) {
    ctx.confirmations.consume(token, "clear_cart");
    const state = await readCart(ctx);
    if (state.cart) await writeItems(ctx, state, []);
    return cartView(ctx.api, []);
  },
};

export const addBuildToCart = {
  name: "add_build_to_cart",
  title: "Adicionar montagem ao carrinho",
  description:
    "Add a whole PC build (one of each of the 7 Builder slots) to the cart, optionally with the PC assembly " +
    "service. Same rule as the store's Builder: the build must be complete, without compatibility errors, " +
    "and every part must be in stock (warnings do not block).",
  inputSchema: z.object({
    parts: BuildParts,
    includeAssembly: z.boolean().optional().describe("Incluir o serviço Montagem de PC (padrão: não)"),
  }),
  outputSchema: CartView,
  annotations: CART_WRITE,
  async handler(ctx, { parts, includeAssembly = false }) {
    const products = await loadParts(ctx.api, parts);
    const reason = addBlockReason(analyzeCompatibility(products), products);
    if (reason) throw new ToolError(reason);
    let assembly = null;
    if (includeAssembly) {
      assembly = await fetchProduct(ctx.api, ASSEMBLY_SERVICE_ID).catch(() => {
        throw new ToolError("O serviço de montagem não está disponível no momento.");
      });
    }
    const state = await readCart(ctx);
    const result = addItems(state.items, buildCartEntries(products, assembly));
    if (result.error) throw new ToolError(result.error);
    await writeItems(ctx, state, result.items);
    return cartView(ctx.api, result.items);
  },
};

// ---- Saved builds ----

const SavedBuildView = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().nullable(),
  parts: z.record(z.string(), z.string()).describe("Id do produto por posição"),
  complete: z.boolean(),
  missingSlots: z.array(z.string()).describe("Posições cujo produto saiu do catálogo"),
  unavailableSlots: z.array(z.string()),
  savedTotal: z.number(),
  currentTotal: z.number(),
  priceChange: z.number(),
});

export const saveBuild = {
  name: "save_build",
  title: "Salvar montagem",
  description:
    "Save a PC build (it may be incomplete) in the customer's account, as the Builder's \"Salvar montagem\" does. " +
    "Only product ids are stored; the build always shows today's prices.",
  inputSchema: z.object({
    name: z.string().describe(`Nome da montagem (até ${BUILD_NAME_MAX} caracteres)`),
    parts: BuildParts,
  }),
  outputSchema: SavedBuildView,
  annotations: CART_WRITE,
  async handler(ctx, { name, parts }) {
    const nameError = validateBuildName(name);
    if (nameError) throw new ToolError(nameError);
    const products = await loadParts(ctx.api, parts);
    if (Object.keys(products).length === 0) throw new ToolError("Escolha pelo menos uma peça para salvar a montagem.");
    const user = await ctx.identity.customer();
    const saved = await ctx.api.post("/builds", toBuildRecord({ userId: user.id, name, parts: products }));
    return savedBuildView(saved, Object.fromEntries(Object.values(products).map((p) => [String(p.id), p])));
  },
};

/**
 * Saved build compared with today's catalog.
 * @param {object} build Record from /builds.
 * @param {Record<string, object>} productsById Plain object, as `describeSavedBuild` expects.
 */
function savedBuildView(build, productsById) {
  const info = describeSavedBuild(build, productsById);
  return {
    id: String(build.id),
    name: build.name,
    createdAt: build.createdAt ?? null,
    parts: Object.fromEntries(Object.entries(build.parts ?? {}).map(([slot, id]) => [slot, String(id)])),
    complete: info.complete,
    missingSlots: info.missing,
    unavailableSlots: info.unavailable,
    savedTotal: info.savedTotal,
    currentTotal: info.currentTotal,
    priceChange: info.priceChange,
  };
}

export const listSavedBuilds = {
  name: "list_saved_builds",
  title: "Montagens salvas",
  description:
    "List the customer's saved PC builds, newest first, with today's total, price changes and parts that " +
    "left the catalog or are out of stock. Use check_build or add_build_to_cart with a build's parts.",
  outputSchema: z.object({ builds: z.array(SavedBuildView) }),
  annotations: OWN_READ,
  async handler(ctx) {
    const user = await ctx.identity.customer();
    const builds = readPage(
      await ctx.api.get("/builds", { ...whereEquals({ userId: String(user.id) }), _sort: "-createdAt" }),
    ).data;
    const ids = builds.flatMap((build) => Object.values(build.parts ?? {}));
    const products = await fetchProducts(ctx.api, ids);
    // describeSavedBuild expects a plain object { id: product }
    const productsById = Object.fromEntries([...products].filter(([, product]) => product));
    return { builds: builds.map((build) => savedBuildView(build, productsById)) };
  },
};

// ---- Orders ----

export const listMyOrders = {
  name: "list_my_orders",
  title: "Meus pedidos",
  description: "List the customer's orders, newest first.",
  outputSchema: z.object({ orders: z.array(OrderView) }),
  annotations: OWN_READ,
  async handler(ctx) {
    const user = await ctx.identity.customer();
    const orders = readPage(
      await ctx.api.get("/orders", { ...whereEquals({ userId: String(user.id) }), _sort: "-date" }),
    ).data;
    return { orders: orders.map(orderView) };
  },
};

export const getOrder = {
  name: "get_order",
  title: "Detalhes do pedido",
  description: "Show one of the customer's orders.",
  inputSchema: z.object({ id: z.string().trim().min(1) }),
  outputSchema: OrderView,
  annotations: OWN_READ,
  async handler(ctx, { id }) {
    const user = await ctx.identity.customer();
    let order = null;
    try {
      order = await ctx.api.get(`/orders/${encodeURIComponent(id)}`);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
    // Someone else's order is reported exactly like a missing one
    if (!order || !sameId(order.userId, user.id)) throw new ToolError(`Pedido "${id}" não encontrado.`);
    return orderView(order);
  },
};

// ---- Checkout ----

export const checkoutPreview = {
  name: "checkout_preview",
  title: "Finalizar compra (prévia)",
  description:
    "Step 1 of 2 to buy the cart: shows items, total, delivery address and the card that will be charged, and " +
    "returns a one-time token. Show this to the user and call checkout_confirm only after they agree.",
  outputSchema: PreviewResult({
    cart: CartView,
    address: z.record(z.string(), z.unknown()).nullable(),
    cardLast4: z.string(),
  }),
  annotations: OWN_READ,
  async handler(ctx) {
    const { user, items } = await readCart(ctx);
    if (items.length === 0) throw new ToolError("O carrinho está vazio.");
    const cart = await cartView(ctx.api, items);
    if (!cart.canCheckout) throw new ToolError(`Não é possível finalizar a compra: ${cart.problems.join("; ")}`);
    const preview = ctx.confirmations.issue("checkout", { key: cartKey(items), total: cart.total });
    return {
      ...preview,
      cart,
      address: user.address ?? null,
      cardLast4: ctx.config.testCard.replace(/\D/g, "").slice(-4),
    };
  },
};

export const checkoutConfirm = {
  name: "checkout_confirm",
  title: "Finalizar compra (confirmar)",
  description:
    "Step 2 of 2: buys the cart. Needs the token from checkout_preview (valid once, for 5 minutes) and fails if " +
    "the cart or its total changed since the preview. The payment card comes from the server configuration.",
  inputSchema: z.object({ token: z.string().trim().min(1) }),
  outputSchema: OrderView,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(ctx, { token }) {
    const snapshot = ctx.confirmations.consume(token, "checkout");
    const { user, items } = await readCart(ctx);
    const cart = await cartView(ctx.api, items);
    if (cartKey(items) !== snapshot.key || cart.total !== snapshot.total) {
      throw new ToolError("O carrinho ou os preços mudaram depois da prévia. Gere uma nova prévia com checkout_preview.");
    }
    if (!cart.canCheckout) throw new ToolError(`Não é possível finalizar a compra: ${cart.problems.join("; ")}`);
    try {
      const order = await ctx.api.post("/checkout", {
        userId: String(user.id),
        items: items.map(({ productId, quantity }) => ({ productId: String(productId), quantity })),
        cardNumber: ctx.config.testCard,
      });
      return orderView(order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && !/Customer|Product/.test(err.message)) {
        throw new ToolError(
          "Esta API não tem a rota POST /checkout. A compra pelo agente exige o backend (Express + MongoDB); " +
            "o json-server do Milestone 2 não a oferece.",
        );
      }
      throw err;
    }
  },
};

export const customerTools = [
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCartPreview,
  clearCartConfirm,
  addBuildToCart,
  saveBuild,
  listSavedBuilds,
  listMyOrders,
  getOrder,
  checkoutPreview,
  checkoutConfirm,
];
