import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  catalogPath,
  catalogTitle,
  hasActiveFilters,
  parseCatalogParams,
  toCatalogSearch,
  toProductFilters,
} from "./catalogQuery";
import { buildProductQuery } from "../api/products";
import { BUILDER_CATEGORIES } from "./categories";

const parse = (query) => parseCatalogParams(new URLSearchParams(query));

describe("parseCatalogParams", () => {
  it("returns defaults for an empty URL", () => {
    expect(parse("")).toEqual({
      q: "",
      category: "",
      brand: "",
      minPrice: "",
      maxPrice: "",
      inStock: false,
      sort: DEFAULT_SORT,
      page: 1,
    });
  });

  it("reads every filter", () => {
    expect(parse("q=ryzen&category=cpu&brand=AMD&minPrice=100&maxPrice=2000&inStock=1&sort=price&page=2")).toEqual({
      q: "ryzen",
      category: "cpu",
      brand: "AMD",
      minPrice: 100,
      maxPrice: 2000,
      inStock: true,
      sort: "price",
      page: 2,
    });
  });

  it("ignores invalid values from a hand-edited URL", () => {
    const filters = parse("category=tv&sort=random&page=-3&minPrice=abc&maxPrice=-5");
    expect(filters.category).toBe("");
    expect(filters.sort).toBe(DEFAULT_SORT);
    expect(filters.page).toBe(1);
    expect(filters.minPrice).toBe("");
    expect(filters.maxPrice).toBe("");
  });

  it("accepts a decimal comma and swaps a reversed price range", () => {
    expect(parse("minPrice=2000&maxPrice=99,90")).toMatchObject({ minPrice: 99.9, maxPrice: 2000 });
  });

  it("accepts section slugs as category", () => {
    expect(parse("category=hardware").category).toBe("hardware");
    expect(parse("category=offers").category).toBe("offers");
  });
});

describe("toCatalogSearch / catalogPath", () => {
  it("leaves default values out of the URL", () => {
    expect(toCatalogSearch({ sort: DEFAULT_SORT, page: 1, minPrice: "", inStock: false })).toBe("");
    expect(catalogPath({})).toBe("/catalog");
  });

  it("round-trips through parseCatalogParams", () => {
    const filters = parse("q=rtx&category=gpu&maxPrice=5000&inStock=1&sort=-price&page=3");
    expect(parse(toCatalogSearch(filters).slice(1))).toEqual(filters);
  });

  it("keeps a minimum price of 0", () => {
    expect(toCatalogSearch({ minPrice: 0 })).toBe("?minPrice=0");
  });
});

describe("toProductFilters", () => {
  it("expands the hardware section into the PC part categories", () => {
    const query = buildProductQuery(toProductFilters(parse("category=hardware")));
    expect(query["category:in"]).toBe(BUILDER_CATEGORIES.join(","));
    expect(query).not.toHaveProperty("category");
  });

  it("maps services, offers and availability to API operators", () => {
    expect(buildProductQuery(toProductFilters(parse("category=service")))).toMatchObject({ type: "service" });
    expect(buildProductQuery(toProductFilters(parse("category=offers")))).toMatchObject({ "oldPrice:gt": 0 });
    expect(buildProductQuery(toProductFilters(parse("inStock=1")))).toMatchObject({ "stock:ne": 0 });
  });

  it("asks for one page of 12 items sorted by best sellers by default", () => {
    expect(buildProductQuery(toProductFilters(parse("")))).toEqual({
      _sort: "-sold",
      _page: 1,
      _per_page: 12,
    });
  });

  it("passes a single category, brand, search and price range", () => {
    expect(buildProductQuery(toProductFilters(parse("category=ram&brand=Kingston&q=fury&minPrice=300")))).toMatchObject({
      category: "ram",
      brand: "Kingston",
      "name:contains": "fury",
      "price:gte": 300,
    });
  });
});

describe("catalogTitle / hasActiveFilters", () => {
  it("names the page after the search, section or category", () => {
    expect(catalogTitle(parse(""))).toBe("Catálogo");
    expect(catalogTitle(parse("category=hardware"))).toBe("Hardware");
    expect(catalogTitle(parse("category=gpu"))).toBe("Placa de vídeo");
    expect(catalogTitle(parse("q=ryzen&category=cpu"))).toBe("Resultados para “ryzen”");
  });

  it("does not count sorting and pagination as filters", () => {
    expect(hasActiveFilters(parse("sort=price&page=2"))).toBe(false);
    expect(hasActiveFilters(parse("inStock=1"))).toBe(true);
    expect(hasActiveFilters(parse("minPrice=0"))).toBe(true);
  });
});
