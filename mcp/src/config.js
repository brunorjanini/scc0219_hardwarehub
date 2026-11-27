/**
 * @file Server configuration, read from environment variables.
 *
 * The store API has no authentication, so the MCP server itself decides who
 * the agent is (see docs/plano-mcp.md, "Segurança"). The identity comes from
 * the configuration, never from tool arguments.
 */

/** Access modes, from least to most powerful. */
export const MODES = ["readonly", "customer", "admin"];

/** Modes that act on behalf of a configured user. */
export const MODES_WITH_USER = ["customer", "admin"];

/** Default API address, the same one the React client uses. */
export const DEFAULT_API_URL = "http://localhost:3000";

/**
 * Card used by checkout. The store accepts any number and keeps only the
 * last 4 digits; the number comes from the configuration so card data never
 * passes through the agent.
 */
export const DEFAULT_TEST_CARD = "0000 0000 0000 0000";

/**
 * Error raised for an invalid configuration. `index.js` prints its message
 * and exits before any MCP traffic starts.
 */
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Reads and validates the configuration.
 * @param {Record<string, string | undefined>} [env] Environment variables.
 * @returns {{ apiUrl: string, mode: string, userId: string | null, testCard: string }}
 * @throws {ConfigError} When a value is invalid.
 */
export function loadConfig(env = process.env) {
  const rawUrl = (env.HARDWAREHUB_API_URL || DEFAULT_API_URL).trim();
  let apiUrl;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    apiUrl = url.href.replace(/\/$/, "");
  } catch {
    throw new ConfigError(`HARDWAREHUB_API_URL inválida: "${rawUrl}". Use um endereço http(s), por exemplo ${DEFAULT_API_URL}.`);
  }

  const mode = (env.HARDWAREHUB_MODE || "readonly").trim().toLowerCase();
  if (!MODES.includes(mode)) {
    throw new ConfigError(`HARDWAREHUB_MODE inválido: "${mode}". Valores aceitos: ${MODES.join(", ")}.`);
  }
  const userId = env.HARDWAREHUB_USER_ID?.trim() || null;
  if (MODES_WITH_USER.includes(mode) && !userId) {
    throw new ConfigError(`O modo "${mode}" exige HARDWAREHUB_USER_ID com o id da conta que o agente vai usar.`);
  }

  // Same rule as the store's card field: digits, spaces and dashes, 4 to 19 digits
  const testCard = (env.HARDWAREHUB_TEST_CARD || DEFAULT_TEST_CARD).trim();
  const digits = testCard.replace(/\D/g, "").length;
  if (!/^[\d\s-]+$/.test(testCard) || digits < 4 || digits > 19) {
    throw new ConfigError("HARDWAREHUB_TEST_CARD inválido: use de 4 a 19 dígitos (espaços e hífens são aceitos).");
  }

  return { apiUrl, mode, userId, testCard };
}
