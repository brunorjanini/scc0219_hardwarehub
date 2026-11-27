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

// AI analysis of a build (backend only; json-server has no such route).
// { enabled } tells whether the server has the feature turned on.
export function getBuildAnalysisStatus() {
  return http.get("/builds/analyze");
}

// parts: { slot: productId }. Returns { status, issues, analysis, model }.
export function analyzeBuild(parts) {
  return http.post("/builds/analyze", { parts });
}
