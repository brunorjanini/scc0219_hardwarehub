// In-memory fake of /users for the admin client/admin pages and login.
// listUsers applies type, search (name, email, username), sorting by name
// and pagination, like buildUserQuery asks json-server to.
// The test file must vi.mock("../api/users") with these functions mocked:
// listUsers, getUser, createUser, updateUser, deleteUser,
// findUsersByEmail, findUsersByUsername.
import {
  createUser,
  deleteUser,
  findUsersByEmail,
  findUsersByUsername,
  getUser,
  listUsers,
  updateUser,
} from "../api/users";
import { ApiError } from "../api/http";

const notFound = () => new ApiError("Erro na requisição (404)", 404);

function matches(user, { type, search }) {
  if (type && user.type !== type) return false;
  const text = search?.trim().toLowerCase();
  if (!text) return true;
  return [user.name, user.email, user.username].some((value) => value?.toLowerCase().includes(text));
}

// Returns the live database ({ [id]: user }) to inspect the final state
export function installUserStore(users = []) {
  const db = Object.fromEntries(users.map((u) => [String(u.id), structuredClone(u)]));
  let nextId = 1;
  const copy = (user) => structuredClone(user);

  listUsers.mockReset().mockImplementation(async (filters = {}) => {
    let items = Object.values(db).filter((u) => matches(u, filters));
    if (filters.sort === "name") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    items = items.map(copy);
    if (!filters.page) return items;

    const perPage = filters.perPage ?? 10;
    const start = (filters.page - 1) * perPage;
    return {
      data: items.slice(start, start + perPage),
      items: items.length,
      pages: Math.max(1, Math.ceil(items.length / perPage)),
    };
  });

  getUser.mockReset().mockImplementation(async (id) => {
    if (!db[String(id)]) throw notFound();
    return copy(db[String(id)]);
  });

  createUser.mockReset().mockImplementation(async (user) => {
    const id = `u${nextId++}`;
    db[id] = { ...copy(user), id };
    return copy(db[id]);
  });

  updateUser.mockReset().mockImplementation(async (id, changes) => {
    if (!db[String(id)]) throw notFound();
    db[String(id)] = { ...db[String(id)], ...copy(changes) };
    return copy(db[String(id)]);
  });

  deleteUser.mockReset().mockImplementation(async (id) => {
    if (!db[String(id)]) throw notFound();
    delete db[String(id)];
    return null;
  });

  findUsersByEmail
    .mockReset()
    .mockImplementation(async (email) => Object.values(db).filter((u) => u.email === email).map(copy));
  findUsersByUsername
    .mockReset()
    .mockImplementation(async (username) => Object.values(db).filter((u) => u.username === username).map(copy));

  return db;
}
