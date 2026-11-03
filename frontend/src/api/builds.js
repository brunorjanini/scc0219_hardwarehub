// Saved PC builds (/builds):
// { id, userId, name, parts: { slot: productId }, total, createdAt }
import { http, whereEquals } from "./http";

// Builds of a client, newest first. whereEquals keeps "1" a string.
export function listBuildsByUser(userId) {
  return http.get("/builds", { ...whereEquals({ userId: String(userId) }), _sort: "-createdAt" });
}

export function createBuild(build) {
  return http.post("/builds", build);
}

export function deleteBuild(id) {
  return http.delete(`/builds/${encodeURIComponent(id)}`);
}
