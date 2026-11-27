/**
 * @file Catalog tools: search, product details, categories and brands.
 * Each tool is a plain object; `server.js` registers them with the SDK, and
 * the tests call the handlers directly.
 */
import * as z from "zod/v4";
import { ApiError, readPage } from "../api.js";
import { ToolError } from "../errors.js";
import { describeProduct, summarizeProduct } from "../format.js";
import { ProductDetails, ProductSummary, READ_ONLY } from "../schemas.js";
import { CATEGORIES, specFieldLabel, specFields } from "../shared.js";

/** Sort orders accepted by the store ("-" = descending). */
export const SORTS = ["-sold", "price", "-price", "name"];

/** Largest page an agent may ask for. */
export const MAX_PER_PAGE = 50;

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

/**
 * Fetches one product, turning a 404 into a readable error.
 * @param {ReturnType<import("../api.js").createApi>} api
 * @param {string} id
 */
export async function fetchProduct(api, id) {
  try {
    return await api.get(`/products/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new ToolError(`Produto "${id}" não encontrado.`);
    }
    throw err;
  }
}

export const searchProducts = {
  name: "search_products",
  title: "Buscar produtos",
  description:
    "Search the HardwareHub catalog (PC parts, peripherals and services) with the same filters as the store. " +
    "Prices are in BRL. Results are paginated; use get_product for full details.",
  inputSchema: z.object({
    query: z.string().trim().min(1).optional().describe("Parte do nome do produto, por exemplo \"ryzen\""),
    category: z.enum(CATEGORY_SLUGS).optional().describe("Categoria (use list_categories para ver todas)"),
    brand: z.string().trim().min(1).optional().describe("Marca exata, por exemplo \"AMD\" (use list_brands)"),
    minPrice: z.number().min(0).optional().describe("Preço mínimo em reais"),
    maxPrice: z.number().min(0).optional().describe("Preço máximo em reais"),
    inStock: z.boolean().optional().describe("Só itens disponíveis (serviços sempre contam como disponíveis)"),
    sort: z.enum(SORTS).optional().describe("Ordem: -sold (mais vendidos, padrão), price, -price ou name"),
    page: z.number().int().min(1).optional().describe("Página, a partir de 1"),
    perPage: z.number().int().min(1).max(MAX_PER_PAGE).optional().describe(`Itens por página (padrão 10, máximo ${MAX_PER_PAGE})`),
  }),
  outputSchema: z.object({
    page: z.number(),
    perPage: z.number(),
    total: z.number(),
    pages: z.number(),
    products: z.array(ProductSummary),
  }),
  annotations: READ_ONLY,
  async handler({ api }, args) {
    const { query, category, brand, minPrice, maxPrice, inStock, sort = "-sold", page = 1, perPage = 10 } = args;
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new ToolError("minPrice não pode ser maior que maxPrice.");
    }
    // Same query syntax as frontend/src/api/products.js (buildProductQuery)
    const params = {
      category,
      brand,
      "name:contains": query,
      "price:gte": minPrice,
      "price:lte": maxPrice,
      "stock:ne": inStock ? 0 : undefined,
      _sort: sort,
      _page: page,
      _per_page: perPage,
    };
    const result = readPage(await api.get("/products", params));
    return {
      page,
      perPage,
      total: result.items,
      pages: result.pages,
      products: result.data.map(summarizeProduct),
    };
  },
};

export const getProduct = {
  name: "get_product",
  title: "Detalhes do produto",
  description: "Get every detail of one product or service: description, price, stock and labeled technical specs.",
  inputSchema: z.object({ id: z.string().trim().min(1).describe("Id do produto") }),
  outputSchema: ProductDetails,
  annotations: READ_ONLY,
  async handler({ api }, { id }) {
    return describeProduct(await fetchProduct(api, id));
  },
};

export const listCategories = {
  name: "list_categories",
  title: "Categorias",
  description:
    "List the store categories, which ones are PC Builder slots, and the technical spec fields each category uses.",
  outputSchema: z.object({
    categories: z.array(
      z.object({
        slug: z.string(),
        label: z.string(),
        builderSlot: z.boolean(),
        specFields: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            required: z.boolean(),
            choices: z.array(z.string()).nullable(),
          }),
        ),
      }),
    ),
  }),
  annotations: READ_ONLY,
  async handler() {
    return { categories: categoryList() };
  },
};

/** Categories with their spec fields (also served as a resource). */
export function categoryList() {
  return CATEGORIES.map((category) => ({
    slug: category.slug,
    label: category.label,
    builderSlot: Boolean(category.builder),
    specFields: specFields(category.slug).map((field) => ({
      key: field.key,
      label: specFieldLabel(field),
      required: Boolean(field.required),
      choices: field.choices ?? null,
    })),
  }));
}

export const listBrands = {
  name: "list_brands",
  title: "Marcas",
  description: "List the brands sold in the store, optionally only those of one category, with how many items each has.",
  inputSchema: z.object({
    category: z.enum(CATEGORY_SLUGS).optional().describe("Só marcas desta categoria"),
  }),
  outputSchema: z.object({
    brands: z.array(z.object({ brand: z.string(), count: z.number() })),
  }),
  annotations: READ_ONLY,
  async handler({ api }, { category }) {
    const products = readPage(await api.get("/products", { category })).data;
    const counts = new Map();
    for (const product of products) {
      if (!product.brand) continue;
      counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
    }
    const brands = [...counts]
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand, "pt-BR"));
    return { brands };
  },
};

export const catalogTools = [searchProducts, getProduct, listCategories, listBrands];
