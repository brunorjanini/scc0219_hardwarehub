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

// Builds the json-server v1 query of the admin user lists.
//   type: "user" | "admin"; search: matches name, email or username
//   (case-insensitive); sort; page / perPage.
// Everything goes into `_where` because it is the only way to express an
// "or" (and `_where` replaces plain filter params anyway, see http.js).
export function buildUserQuery({ type, search, sort, page, perPage } = {}) {
  const where = {};
  if (type) where.type = { eq: type };
  const text = search?.trim();
  if (text) {
    where.or = ["name", "email", "username"].map((field) => ({ [field]: { contains: text } }));
  }

  const params = {};
  if (Object.keys(where).length > 0) params._where = JSON.stringify(where);
  if (sort) params._sort = sort;
  if (page) {
    params._page = page;
    params._per_page = perPage ?? 10;
  }
  return params;
}

// Lists users. Returns an array, or a pagination object
// ({ data, items, pages, ... }) when `page` is set.
export function listUsers(filters) {
  return http.get("/users", buildUserQuery(filters));
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

// Deleting a user makes json-server set `userId` to null in every other
// collection (it does that for any "<name>Id" field). `_dependent=carts`
// then removes carts left with userId null, so the cart goes away with
// the client. Orders stay, with userId null, so sales history is kept.
export function deleteUser(id) {
  return http.delete(`/users/${encodeURIComponent(id)}`, { _dependent: "carts" });
}
