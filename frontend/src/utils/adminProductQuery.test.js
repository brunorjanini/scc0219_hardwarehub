import { describe, expect, it } from "vitest";
import {
  parseAdminProductParams,
  rangeText,
  toAdminProductFilters,
  toAdminProductSearch,
} from "./adminProductQuery";

const parse = (query) => parseAdminProductParams(new URLSearchParams(query));

describe("admin product query", () => {
  it("uses defaults for an empty URL", () => {
    expect(parse("")).toEqual({ q: "", category: "", status: "", sort: "name", page: 1 });
  });

  it("reads valid params and drops invalid ones", () => {
    expect(parse("q=%20rtx%20&category=gpu&status=out&sort=-sold&page=3")).toEqual({
      q: "rtx",
      category: "gpu",
      status: "out",
      sort: "-sold",
      page: 3,
    });
    expect(parse("category=tablet&status=x&sort=id&page=-2")).toEqual(parse(""));
  });

  it("round-trips through the URL, leaving defaults out", () => {
    const filters = { q: "ryzen", category: "cpu", status: "low", sort: "stock", page: 2 };
    expect(parse(toAdminProductSearch(filters).slice(1))).toEqual(filters);
    expect(toAdminProductSearch({ sort: "name", page: 1 })).toBe("");
  });

  it("maps to listProducts filters with pagination", () => {
    expect(toAdminProductFilters(parse("q=rtx&status=out&page=2"))).toEqual({
      search: "rtx",
      category: "",
      stockLevel: "out",
      sort: "name",
      page: 2,
      perPage: 10,
    });
  });

  it.each([
    [1, 31, "Exibindo 1–10 de 31"],
    [4, 31, "Exibindo 31–31 de 31"],
    [1, 0, "Nenhum item"],
  ])("range text for page %i of %i items", (page, total, text) => {
    expect(rangeText(page, total)).toBe(text);
  });
});
