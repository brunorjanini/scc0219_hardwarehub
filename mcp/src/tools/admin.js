/**
 * @file Administrator tools: dashboard, stock and product management, and a
 * read-only list of users. Every tool first checks that the configured
 * account (HARDWAREHUB_USER_ID) is an administrator.
 *
 * Product rules come from the admin form of the React client
 * (`validateProduct` / `toProductRecord`), so an agent cannot save a product
 * the store's own form would reject. Creating or deleting users is left out
 * on purpose: it stays in the web panel.
 */
import * as z from "zod/v4";
import { readPage } from "../api.js";
import { ToolError } from "../errors.js";
import { describeProduct, sanitizeUser, summarizeProduct } from "../format.js";
import { ProductDetails, ProductSummary } from "../schemas.js";
import {
  CATEGORIES,
  LOW_STOCK_THRESHOLD,
  dashboardStats,
  isService,
  sameId,
  toFormValues,
  toProductRecord,
  validateProduct,
} from "../shared.js";
import { fetchProduct } from "./catalog.js";

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

const ADMIN_READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ADMIN_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** Runs a handler only for the configured administrator. */
const asAdmin = (handler) => async (ctx, args) => {
  await ctx.identity.admin();
  return handler(ctx, args);
};

/** "2026-11-26" in local time (the dashboard groups by local days). */
const localDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// ---- Dashboard and stock ----

const Totals = z.object({ revenue: z.number(), orders: z.number(), ticket: z.number() });
const Comment = z.object({ text: z.string(), tone: z.enum(["up", "down", "neutral"]) });

export const getDashboardStats = {
  name: "dashboard_stats",
  title: "Indicadores da loja",
  description:
    "Store dashboard, computed like the admin panel: revenue, orders and average ticket of the current month " +
    "compared with the previous one, products out of stock or with few units, revenue of the last 7 days and " +
    "the most recent orders.",
  outputSchema: z.object({
    month: Totals,
    previousMonth: Totals,
    comments: z.object({ revenue: Comment, orders: Comment, ticket: Comment }),
    stock: z.object({ out: z.number(), low: z.number() }),
    last7Days: z.array(z.object({ day: z.string(), label: z.string(), total: z.number() })),
    recentOrders: z.array(
      z.object({ id: z.string(), total: z.number(), date: z.string(), ago: z.string(), units: z.number(), customer: z.string() }),
    ),
  }),
  annotations: ADMIN_READ,
  handler: asAdmin(async ({ api }) => {
    const [orders, products, users] = await Promise.all(
      ["/orders", "/products", "/users"].map(async (path) => readPage(await api.get(path)).data),
    );
    const stats = dashboardStats({ orders, products, users }, new Date());
    return {
      month: stats.month,
      previousMonth: stats.previous,
      comments: stats.comments,
      stock: stats.stock,
      last7Days: stats.days.map((d) => ({ day: localDay(d.date), label: d.longLabel, total: d.total })),
      recentOrders: stats.recent.map((o) => ({ ...o, id: String(o.id), date: o.date.toISOString() })),
    };
  }),
};

export const listLowStock = {
  name: "list_low_stock",
  title: "Estoque baixo",
  description:
    `List products that are out of stock or have ${LOW_STOCK_THRESHOLD} units or fewer (services have no stock), ` +
    "lowest stock first, with how many units each has sold, to help plan restocking.",
  outputSchema: z.object({
    threshold: z.number(),
    out: z.array(ProductSummary.extend({ sold: z.number() })),
    low: z.array(ProductSummary.extend({ sold: z.number() })),
  }),
  annotations: ADMIN_READ,
  handler: asAdmin(async ({ api }) => {
    const products = readPage(await api.get("/products", { _sort: "stock" })).data.filter((p) => !isService(p));
    const view = (p) => ({ ...summarizeProduct(p), sold: Number(p.sold) || 0 });
    return {
      threshold: LOW_STOCK_THRESHOLD,
      out: products.filter((p) => Number(p.stock) === 0).map(view),
      low: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).map(view),
    };
  }),
};

export const updateStock = {
  name: "update_stock",
  title: "Alterar estoque",
  description: "Set the stock of a product (services have no stock).",
  inputSchema: z.object({
    id: z.string().trim().min(1),
    stock: z.number().int().min(0).max(100000).describe("Nova quantidade em estoque"),
  }),
  outputSchema: ProductDetails,
  annotations: { ...ADMIN_WRITE, idempotentHint: true },
  handler: asAdmin(async ({ api }, { id, stock }) => {
    const product = await fetchProduct(api, id);
    if (isService(product)) throw new ToolError(`"${product.name}" é um serviço e não tem estoque.`);
    const updated = await api.patch(`/products/${encodeURIComponent(product.id)}`, { stock });
    return describeProduct(updated);
  }),
};

// ---- Product create / update / delete ----

const SpecValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const productFields = {
  name: z.string().trim().min(1),
  category: z.enum(CATEGORY_SLUGS).describe("Categoria (list_categories mostra as specs de cada uma)"),
  brand: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: z.number().positive().describe("Preço em reais"),
  oldPrice: z.number().positive().nullable().describe("Preço antigo, maior que o preço: marca o produto como oferta; null encerra a oferta"),
  stock: z.number().int().min(0).describe("Estoque (obrigatório para produtos; ignorado em serviços)"),
  photo: z.string().trim().describe("Caminho como /products/foto.jpg ou endereço http(s); vazio usa a imagem padrão da categoria"),
  specs: z
    .record(z.string(), SpecValue.nullable())
    .describe("Especificações por chave (ver list_categories); null remove uma especificação"),
};

/** Turns an agent value into the string form the admin form works with. */
function formValue(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? String(value) : value;
}

/** Applies agent input over form values (all optional, as in an edit). */
function applyChanges(base, changes) {
  const values = { ...base };
  for (const key of ["name", "category", "brand", "description", "photo"]) {
    if (changes[key] !== undefined) values[key] = changes[key];
  }
  for (const key of ["price", "oldPrice", "stock"]) {
    if (changes[key] !== undefined) values[key] = formValue(changes[key]);
  }
  if (changes.specs !== undefined || changes.category !== undefined) {
    // A new category starts from empty specs; otherwise the changes are merged
    const specs = changes.category !== undefined && changes.category !== base.category ? {} : { ...base.specs };
    for (const [key, value] of Object.entries(changes.specs ?? {})) {
      if (value === null) delete specs[key];
      else specs[key] = formValue(value);
    }
    values.specs = specs;
  }
  return values;
}

/** Runs the admin form validation; its message becomes the tool error. */
function validated(values) {
  const error = validateProduct(values);
  if (error) throw new ToolError(error.message);
  return values;
}

const EMPTY_FORM = toFormValues(null);

export const createProduct = {
  name: "create_product",
  title: "Criar produto",
  description:
    "Create a product or service with the same validation as the admin form: required fields, price > 0, an " +
    "old price only above the price, integer stock for products, and the required specs of its category " +
    "(see list_categories). Sales start at 0; without a photo the category's default image is used.",
  inputSchema: z.object({
    ...productFields,
    oldPrice: productFields.oldPrice.optional(),
    stock: productFields.stock.optional(),
    photo: productFields.photo.optional(),
    specs: productFields.specs.optional(),
  }),
  outputSchema: ProductDetails,
  annotations: ADMIN_WRITE,
  handler: asAdmin(async ({ api }, input) => {
    const values = validated(applyChanges({ ...EMPTY_FORM, specs: {} }, input));
    const created = await api.post("/products", toProductRecord(values, { isNew: true }));
    return describeProduct(created);
  }),
};

export const updateProduct = {
  name: "update_product",
  title: "Editar produto",
  description:
    "Change some fields of a product; the others keep their current values. Specs are merged by key " +
    "(null removes one); changing the category starts the specs from scratch. Same validation as the admin " +
    "form. Sales (sold) are never changed here.",
  inputSchema: z.object({
    id: z.string().trim().min(1),
    changes: z
      .object(Object.fromEntries(Object.entries(productFields).map(([key, schema]) => [key, schema.optional()])))
      .strict()
      .refine((changes) => Object.keys(changes).length > 0, "Informe pelo menos um campo para alterar"),
  }),
  outputSchema: ProductDetails,
  annotations: { ...ADMIN_WRITE, idempotentHint: true },
  handler: asAdmin(async ({ api }, { id, changes }) => {
    const product = await fetchProduct(api, id);
    const values = validated(applyChanges(toFormValues(product), changes));
    const updated = await api.patch(`/products/${encodeURIComponent(product.id)}`, toProductRecord(values));
    return describeProduct(updated);
  }),
};

export const deleteProductPreview = {
  name: "delete_product_preview",
  title: "Excluir produto (prévia)",
  description:
    "Step 1 of 2 to delete a product: shows the product, how many carts and saved builds use it, and returns a " +
    "one-time token. Ask the user, then call delete_product_confirm with the token. Past orders keep their copy.",
  inputSchema: z.object({ id: z.string().trim().min(1) }),
  outputSchema: z.object({
    token: z.string(),
    expiresAt: z.string(),
    product: ProductSummary,
    cartsWithProduct: z.number(),
    savedBuildsWithProduct: z.number(),
  }),
  annotations: ADMIN_READ,
  handler: asAdmin(async (ctx, { id }) => {
    const product = await fetchProduct(ctx.api, id);
    const [carts, builds] = await Promise.all(
      ["/carts", "/builds"].map(async (path) => readPage(await ctx.api.get(path)).data),
    );
    return {
      ...ctx.confirmations.issue("delete_product", { id: String(product.id) }),
      product: summarizeProduct(product),
      cartsWithProduct: carts.filter((c) => (c.items ?? []).some((i) => sameId(i.productId, product.id))).length,
      savedBuildsWithProduct: builds.filter((b) => Object.values(b.parts ?? {}).some((pid) => sameId(pid, product.id))).length,
    };
  }),
};

export const deleteProductConfirm = {
  name: "delete_product_confirm",
  title: "Excluir produto (confirmar)",
  description: "Step 2 of 2: deletes the product. Needs the token from delete_product_preview (valid once, for 5 minutes).",
  inputSchema: z.object({ token: z.string().trim().min(1) }),
  outputSchema: z.object({ deleted: ProductSummary }),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: asAdmin(async (ctx, { token }) => {
    const { id } = ctx.confirmations.consume(token, "delete_product");
    const product = await fetchProduct(ctx.api, id);
    await ctx.api.delete(`/products/${encodeURIComponent(id)}`);
    return { deleted: summarizeProduct(product) };
  }),
};

// ---- Users (read only) ----

const UserView = z.object({
  id: z.string(),
  type: z.enum(["user", "admin"]),
  name: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.record(z.string(), z.unknown()).nullable(),
});

export const listUsers = {
  name: "list_users",
  title: "Usuários",
  description:
    "List store clients and/or administrators, optionally searching name, e-mail or username. Passwords are " +
    "never returned. Creating, editing or deleting accounts is only possible in the web admin panel.",
  inputSchema: z.object({
    type: z.enum(["user", "admin"]).optional().describe("user = clientes, admin = administradores; vazio = todos"),
    search: z.string().trim().min(1).optional(),
    page: z.number().int().min(1).optional(),
    perPage: z.number().int().min(1).max(50).optional(),
  }),
  outputSchema: z.object({ page: z.number(), total: z.number(), pages: z.number(), users: z.array(UserView) }),
  annotations: ADMIN_READ,
  handler: asAdmin(async ({ api }, { type, search, page = 1, perPage = 20 }) => {
    // Same query as buildUserQuery in frontend/src/api/users.js
    const where = {};
    if (type) where.type = { eq: type };
    if (search) where.or = ["name", "email", "username"].map((field) => ({ [field]: { contains: search } }));
    const params = { _sort: "name", _page: page, _per_page: perPage };
    if (Object.keys(where).length) params._where = JSON.stringify(where);
    const result = readPage(await api.get("/users", params));
    return {
      page,
      total: result.items,
      pages: result.pages,
      users: result.data.map(sanitizeUser).map((u) => ({
        id: String(u.id),
        type: u.type === "admin" ? "admin" : "user",
        name: u.name,
        email: u.email,
        username: u.username ?? null,
        phone: u.phone ?? null,
        address: u.address ?? null,
      })),
    };
  }),
};

export const adminTools = [
  getDashboardStats,
  listLowStock,
  updateStock,
  createProduct,
  updateProduct,
  deleteProductPreview,
  deleteProductConfirm,
  listUsers,
];
