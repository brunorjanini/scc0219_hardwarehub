import { describe, expect, it, vi } from "vitest";
import { API_URL } from "./http";
import { buildUserQuery, deleteUser, listUsers } from "./users";

function stubFetch(body = []) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("buildUserQuery", () => {
  it("returns no params without filters", () => {
    expect(buildUserQuery()).toEqual({});
  });

  it("filters by type and searches name, email and username", () => {
    const params = buildUserQuery({ type: "admin", search: "  Mar ", sort: "name", page: 2 });
    expect(JSON.parse(params._where)).toEqual({
      type: { eq: "admin" },
      or: [{ name: { contains: "Mar" } }, { email: { contains: "Mar" } }, { username: { contains: "Mar" } }],
    });
    expect(params).toMatchObject({ _sort: "name", _page: 2, _per_page: 10 });
  });

  it("ignores a blank search", () => {
    expect(JSON.parse(buildUserQuery({ type: "user", search: "  " })._where)).toEqual({ type: { eq: "user" } });
  });
});

describe("users API", () => {
  it("lists users with the built query", async () => {
    const fetchMock = stubFetch([]);
    await listUsers({ type: "user", sort: "name" });
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toBe(
      `${API_URL}/users?_where={"type":{"eq":"user"}}&_sort=name`,
    );
  });

  it("deletes a user together with their cart and saved builds", async () => {
    const fetchMock = stubFetch(null);
    await deleteUser("7");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/users/7?_dependent=carts&_dependent=builds`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });
});
