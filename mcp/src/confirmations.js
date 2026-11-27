/**
 * @file One-time tokens for actions that cannot be undone (checkout,
 * clearing the cart). A `*_preview` tool shows what will happen and issues
 * a token; the matching `*_confirm` tool runs only with it. This works with
 * every MCP client, without relying on elicitation support.
 */
import { randomBytes } from "node:crypto";
import { ToolError } from "./errors.js";

/** How long a token stays valid. */
export const TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Creates a token store. Tokens live in memory, so they are tied to the
 * running server (one per client connection).
 * @param {{ ttlMs?: number, now?: () => number }} [options] `now` lets tests move the clock.
 */
export function createConfirmations({ ttlMs = TOKEN_TTL_MS, now = Date.now } = {}) {
  const pending = new Map();

  return {
    /**
     * Issues a token for one action.
     * @param {string} action Action name, e.g. "checkout".
     * @param {unknown} payload Snapshot checked again on confirmation.
     * @returns {{ token: string, expiresAt: string }}
     */
    issue(action, payload) {
      const token = randomBytes(12).toString("base64url");
      const expires = now() + ttlMs;
      pending.set(token, { action, payload, expires });
      return { token, expiresAt: new Date(expires).toISOString() };
    },

    /**
     * Uses up a token. Every attempt removes it, valid or not, so a token
     * can never run twice.
     * @param {string} token
     * @param {string} action The action being confirmed.
     * @returns {unknown} The payload given to `issue`.
     * @throws {ToolError} Unknown, used, expired or issued for another action.
     */
    consume(token, action) {
      const entry = pending.get(token);
      pending.delete(token);
      for (const [key, value] of pending) {
        if (value.expires <= now()) pending.delete(key);
      }
      if (!entry) {
        throw new ToolError("Token de confirmação inválido ou já usado. Gere uma nova prévia.");
      }
      if (entry.action !== action) {
        throw new ToolError(`Este token confirma outra ação (${entry.action}). Gere uma nova prévia.`);
      }
      if (entry.expires <= now()) {
        throw new ToolError("O token de confirmação expirou. Gere uma nova prévia.");
      }
      return entry.payload;
    },
  };
}
