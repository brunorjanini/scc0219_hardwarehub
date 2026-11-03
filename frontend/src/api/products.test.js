import { describe, expect, it, vi } from "vitest";
import { API_URL } from "./http";
import { buildProductQuery, getProduct, listProducts, updateProduct } from "./products";

function stubFetch(body = []) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("buildProductQuery", () => {
  it("returns no params without filters", () => {
    expect(buildProductQuery()).toEqual({});
  });

  it("maps filters to json-server v1 operators", () => {
    expect(
      buildProductQuery({
        type: "product",
        category: "cpu",
        brand: "AMD",
        search: "  ryzen ",
        minPrice: 100,
        maxPrice: 2000,
        sort: "-price",
      }),
    ).toEqual({
      type: "product",
      category: "cpu",
      brand: "AMD",
      "name:contains": "ryzen",
      "price:gte": 100,
      "price:lte": 2000,
      _sort: "-price",
    });
  });

  it("keeps a minimum price of 0 and ignores blank search", () => {
    expect(buildProductQuery({ minPrice: 0, search: "   " })).toEqual({ "price:gte": 0 });
  });

  it.each([
    ["available", { "stock:ne": 0 }],
    ["low", { "stock:gt": 0, "stock:lte": 3 }],
    ["out", { stock: 0 }],
    ["unknown", {}],
  ])("maps stock level %s", (stockLevel, expected) => {
    expect(buildProductQuery({ stockLevel })).toEqual(expected);
  });

  it("adds pagination only when a page is requested", () => {
    expect(buildProductQuery({ page: 2 })).toEqual({ _page: 2, _per_page: 12 });
    expect(buildProductQuery({ page: 1, perPage: 24 })).toEqual({ _page: 1, _per_page: 24 });
    expect(buildProductQuery({ perPage: 24 })).toEqual({});
  });
});

describe("products API", () => {
  it("lists products with the built query string", async () => {
    const fetchMock = stubFetch([]);
    await listProducts({ category: "gpu", maxPrice: 5000 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_URL}/products?category=gpu&price%3Alte=5000`,
    );
  });

  it("gets and updates a product by id", async () => {
    const fetchMock = stubFetch({ id: "13" });
    await getProduct(13);
    await updateProduct("13", { stock: 5 });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/products/13`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/products/13`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ stock: 5 }),
    });
  });
});
