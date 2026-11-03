// Checks that the seed database respects the assignment's data requirements
import { describe, expect, it } from "vitest";
import seed from "./seed.json";
import { BUILDER_CATEGORIES, CATEGORIES } from "./utils/categories";

const categorySlugs = CATEGORIES.map((c) => c.slug);

describe("seed.json", () => {
  it("ships the default admin/admin account", () => {
    const admin = seed.users.find((u) => u.username === "admin");
    expect(admin).toMatchObject({ type: "admin", password: "admin" });
  });

  it("uses unique string ids in every collection", () => {
    for (const collection of ["users", "products"]) {
      const ids = seed[collection].map((item) => item.id);
      expect(ids.every((id) => typeof id === "string")).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives admins name, id, phone and email", () => {
    for (const admin of seed.users.filter((u) => u.type === "admin")) {
      expect(admin).toEqual(
        expect.objectContaining({ id: expect.any(String), name: expect.any(String), phone: expect.any(String), email: expect.any(String) }),
      );
    }
  });

  it("gives clients name, id, address, phone and email", () => {
    for (const client of seed.users.filter((u) => u.type === "user")) {
      expect(client).toEqual(
        expect.objectContaining({ id: expect.any(String), name: expect.any(String), phone: expect.any(String), email: expect.any(String) }),
      );
      expect(client.address).toEqual(
        expect.objectContaining({ street: expect.any(String), number: expect.any(String), city: expect.any(String), zip: expect.any(String) }),
      );
    }
  });

  it("gives every product the required fields", () => {
    for (const product of seed.products) {
      expect(product).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          photo: expect.stringMatching(/^\/products\//),
          description: expect.any(String),
          price: expect.any(Number),
          sold: expect.any(Number),
        }),
      );
      expect(categorySlugs).toContain(product.category);
      if (product.type === "service") {
        expect(product.stock).toBeNull();
      } else {
        expect(product.type).toBe("product");
        expect(Number.isInteger(product.stock)).toBe(true);
      }
    }
  });

  it("has at least two parts in every builder category", () => {
    for (const slug of BUILDER_CATEGORIES) {
      const count = seed.products.filter((p) => p.category === slug).length;
      expect(count, slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes incompatible combinations for the builder tests", () => {
    const sockets = new Set(seed.products.filter((p) => p.category === "cpu").map((p) => p.specs.socket));
    const memoryTypes = new Set(seed.products.filter((p) => p.category === "ram").map((p) => p.specs.memoryType));
    expect(sockets.size).toBeGreaterThanOrEqual(2);
    expect(memoryTypes).toEqual(new Set(["DDR4", "DDR5"]));
  });

  it("has offers whose old price is higher than the price", () => {
    const offers = seed.products.filter((p) => p.oldPrice !== undefined);
    expect(offers.length).toBeGreaterThanOrEqual(3);
    for (const product of offers) {
      expect(product.oldPrice, product.name).toBeGreaterThan(product.price);
    }
  });

  it("starts with empty carts, orders and builds", () => {
    expect(seed.carts).toEqual([]);
    expect(seed.orders).toEqual([]);
    expect(seed.builds).toEqual([]);
  });
});
