/**
 * @file Who the agent acts as. The user id comes only from the
 * configuration; tools never take it as an argument, so an agent cannot act
 * on behalf of someone else.
 *
 * The account is checked on first use instead of at start-up: MCP clients
 * usually start the server when a session opens, possibly before the store
 * API is running, and a server that exits there would simply disappear.
 */
import { ApiError } from "./api.js";
import { ToolError } from "./errors.js";
import { sanitizeUser } from "./format.js";

/** Account type each mode needs, and how to describe a mismatch. */
const EXPECTED = {
  user: { mode: "customer", wrong: "é um administrador. O modo customer precisa de uma conta de cliente." },
  admin: { mode: "admin", wrong: "é um cliente. O modo admin precisa de uma conta de administrador." },
};

/**
 * Creates the identity of a configured user.
 * @param {ReturnType<import("./api.js").createApi>} api
 * @param {{ userId: string | null }} config
 */
export function createIdentity(api, { userId }) {
  const cache = new Map();

  /** Loads the configured account and checks its type. */
  async function load(type) {
    let user;
    try {
      user = await api.get(`/users/${encodeURIComponent(userId)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new ToolError(`A conta configurada (HARDWAREHUB_USER_ID=${userId}) não existe na loja.`);
      }
      throw err;
    }
    if (user?.type !== type) throw new ToolError(`HARDWAREHUB_USER_ID=${userId} ${EXPECTED[type].wrong}`);
    return sanitizeUser(user);
  }

  /** Cached account of one type. Failures are not cached, so a fix is picked up. */
  function account(type) {
    if (!cache.has(type)) {
      cache.set(
        type,
        load(type).catch((err) => {
          cache.delete(type);
          throw err;
        }),
      );
    }
    return cache.get(type);
  }

  return {
    userId,
    /** The configured customer, without the password. */
    customer: () => account("user"),
    /** The configured administrator, without the password. */
    admin: () => account("admin"),
  };
}
