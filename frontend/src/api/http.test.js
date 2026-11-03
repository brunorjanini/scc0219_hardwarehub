import { describe, expect, it, vi } from "vitest";
import { API_URL, ApiError, http, request, sameId, toQuery, whereEquals } from "./http";
import { getCartByUser } from "./carts";
import { listOrdersByUser } from "./orders";
import { findUsersByUsername } from "./users";

// Builds a fake fetch Response
function fakeResponse({ status = 200, body = "" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  };
}

describe("toQuery", () => {
  it("returns an empty string when there are no params", () => {
    expect(toQuery()).toBe("");
    expect(toQuery({})).toBe("");
  });

  it("skips empty values and keeps json-server operators in keys", () => {
    const query = toQuery({ "price:lte": 500, brand: "", category: undefined, type: null });
    expect(query).toBe("?price%3Alte=500");
  });

  it("encodes values", () => {
    expect(toQuery({ email: "a+b@x.com" })).toBe("?email=a%2Bb%40x.com");
  });
});

describe("request", () => {
  it("GETs the full URL and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ body: [{ id: "1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await http.get("/products", { category: "cpu" });

    expect(data).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/products?category=cpu`, {
      method: "GET",
      headers: {},
    });
  });

  it("sends a JSON body on POST and PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ status: 201, body: { id: "9" } }));
    vi.stubGlobal("fetch", fetchMock);

    await http.post("/users", { name: "Ana" });
    await http.patch("/users/9", { phone: "123" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana" }),
    });
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ phone: "123" }));
  });

  it("returns null for an empty body (e.g. DELETE)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ body: "" })));
    await expect(http.delete("/products/1")).resolves.toBeNull();
  });

  it("throws ApiError with the status on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ status: 404 })));

    const error = await request("/products/999").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
  });

  it("throws ApiError with status 0 when the server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await request("/products").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/servidor/);
  });
});

describe("whereEquals", () => {
  it("builds a _where filter that keeps numeric-looking strings as strings", () => {
    // json-server would turn ?userId=1 into the number 1 and miss "1"
    expect(whereEquals({ userId: "1" })).toEqual({ _where: '{"userId":{"eq":"1"}}' });
  });

  it("is used by cart, order and user lookups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ body: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getCartByUser(1);
    await listOrdersByUser("1");
    await findUsersByUsername("admin");

    const urls = fetchMock.mock.calls.map(([url]) => decodeURIComponent(url));
    expect(urls[0]).toBe(`${API_URL}/carts?_where={"userId":{"eq":"1"}}`);
    expect(urls[1]).toBe(`${API_URL}/orders?_where={"userId":{"eq":"1"}}&_sort=-date`);
    expect(urls[2]).toBe(`${API_URL}/users?_where={"username":{"eq":"admin"}}`);
  });
});

describe("sameId", () => {
  it("compares numeric and string ids as equal", () => {
    expect(sameId(1, "1")).toBe(true);
    expect(sameId("a1", "a1")).toBe(true);
  });

  it("rejects different or missing ids", () => {
    expect(sameId("1", "2")).toBe(false);
    expect(sameId(undefined, "undefined")).toBe(false);
    expect(sameId(null, "null")).toBe(false);
  });
});
