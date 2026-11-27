import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi, readPage, toQuery } from "../src/api.js";
import { ConfigError, DEFAULT_API_URL, DEFAULT_TEST_CARD, loadConfig } from "../src/config.js";
import { sanitizeUser } from "../src/format.js";

describe("loadConfig", () => {
  it("defaults to read-only mode on the local API", () => {
    expect(loadConfig({})).toEqual({ apiUrl: DEFAULT_API_URL, mode: "readonly", userId: null, testCard: DEFAULT_TEST_CARD });
  });

  it("normalizes the API URL", () => {
    expect(loadConfig({ HARDWAREHUB_API_URL: " http://api.test:8080/ " }).apiUrl).toBe("http://api.test:8080");
  });

  it.each(["ftp://x", "not a url"])("rejects the API URL %s", (url) => {
    expect(() => loadConfig({ HARDWAREHUB_API_URL: url })).toThrow(ConfigError);
  });

  it("rejects unknown modes", () => {
    expect(() => loadConfig({ HARDWAREHUB_MODE: "root" })).toThrow(/HARDWAREHUB_MODE inválido/);
  });

  it("starts the admin mode with a user id", () => {
    expect(loadConfig({ HARDWAREHUB_MODE: "admin", HARDWAREHUB_USER_ID: "3" })).toMatchObject({ mode: "admin", userId: "3" });
  });

  it("requires a user id in admin mode", () => {
    expect(() => loadConfig({ HARDWAREHUB_MODE: "admin" })).toThrow(/exige HARDWAREHUB_USER_ID/);
  });

  it("starts the customer mode with a user id and a custom card", () => {
    const config = loadConfig({ HARDWAREHUB_MODE: "Customer", HARDWAREHUB_USER_ID: " 1 ", HARDWAREHUB_TEST_CARD: "1234-5678" });
    expect(config).toMatchObject({ mode: "customer", userId: "1", testCard: "1234-5678" });
  });

  it("requires a user id in customer mode", () => {
    expect(() => loadConfig({ HARDWAREHUB_MODE: "customer" })).toThrow(/exige HARDWAREHUB_USER_ID/);
  });

  it.each(["12", "abcd 1234", "1".repeat(20)])("rejects the card %s", (card) => {
    expect(() => loadConfig({ HARDWAREHUB_TEST_CARD: card })).toThrow(/HARDWAREHUB_TEST_CARD inválido/);
  });
});

describe("api client", () => {
  const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

  it("builds query strings with operators and repeated keys", () => {
    expect(toQuery({ "price:lte": 500, category: "cpu", empty: "", none: undefined, tag: ["a", "b"] })).toBe(
      "?price%3Alte=500&category=cpu&tag=a&tag=b",
    );
    expect(toQuery({})).toBe("");
  });

  it("sends GET requests to the configured URL", async () => {
    const fetchImpl = vi.fn(async () => ok([{ id: "1" }]));
    const api = createApi({ apiUrl: "http://api.test", fetchImpl });
    await expect(api.get("/products", { category: "cpu" })).resolves.toEqual([{ id: "1" }]);
    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/products?category=cpu", expect.objectContaining({ method: "GET" }));
  });

  it("turns HTTP errors into ApiError with the server message", async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, text: async () => JSON.stringify({ error: "Not found" }) });
    const error = await createApi({ apiUrl: "http://api.test", fetchImpl }).get("/products/9").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "A API respondeu 404: Not found" });
  });

  it("explains when the API is not running", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await createApi({ apiUrl: "http://api.test", fetchImpl }).get("/products").catch((e) => e);
    expect(error).toMatchObject({ status: 0 });
    expect(error.message).toMatch(/backend ou o json-server está rodando/);
  });

  it("reads paginated and plain list responses", () => {
    expect(readPage({ data: [1, 2], items: 7, pages: 4 })).toEqual({ data: [1, 2], items: 7, pages: 4 });
    expect(readPage([1, 2])).toEqual({ data: [1, 2], items: 2, pages: 1 });
  });
});

describe("sanitizeUser", () => {
  it("never returns the password", () => {
    const user = { id: "1", name: "Ana", email: "ana@x.com", password: "secret" };
    expect(sanitizeUser(user)).toEqual({ id: "1", name: "Ana", email: "ana@x.com" });
    expect(user.password).toBe("secret");
  });
});
