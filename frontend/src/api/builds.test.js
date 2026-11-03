import { describe, expect, it, vi } from "vitest";
import { API_URL } from "./http";
import { createBuild, deleteBuild, listBuildsByUser } from "./builds";

function stubFetch(body = []) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("builds API", () => {
  it("lists a client's builds, newest first, keeping the id a string", async () => {
    const fetchMock = stubFetch([]);
    await listBuildsByUser(1);
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toBe(
      `${API_URL}/builds?_where={"userId":{"eq":"1"}}&_sort=-createdAt`,
    );
  });

  it("creates and deletes builds", async () => {
    const fetchMock = stubFetch({ id: "b1" });
    await createBuild({ userId: "1", name: "Gamer", parts: { cpu: "1" }, total: 10 });
    await deleteBuild("b1");

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/builds`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/builds/b1`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });
});
