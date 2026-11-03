// Clients and administrators (/users). The `type` field tells them apart:
// "user" for clients and "admin" for administrators.
import { http, whereEquals } from "./http";

// Returns the users with this email (empty array when none)
export function findUsersByEmail(email) {
  return http.get("/users", whereEquals({ email }));
}

// Returns the users with this username (used by the admin/admin login).
// whereEquals matters here: a numeric username like "123" would otherwise
// be compared as a number and never match.
export function findUsersByUsername(username) {
  return http.get("/users", whereEquals({ username }));
}

// Lists users, optionally filtered by type ("user" or "admin")
export function listUsers(type) {
  return http.get("/users", type ? { type } : undefined);
}

export function getUser(id) {
  return http.get(`/users/${encodeURIComponent(id)}`);
}

export function createUser(user) {
  return http.post("/users", user);
}

export function updateUser(id, changes) {
  return http.patch(`/users/${encodeURIComponent(id)}`, changes);
}

export function deleteUser(id) {
  return http.delete(`/users/${encodeURIComponent(id)}`);
}
