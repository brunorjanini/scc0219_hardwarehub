/**
 * @file Minimal client for the store REST API (Express backend or
 * json-server: both expose the same routes and query syntax).
 *
 * The React client has its own `api/http.js`, but it reads
 * `import.meta.env`, which only exists under Vite, so it cannot be reused.
 */

/** Error for any failed request. `status` is 0 when the API is unreachable. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Builds a query string, skipping empty values. Keys are kept as-is so
 * operators such as `price:lte` reach the API unchanged.
 * @param {Record<string, unknown>} [params]
 * @returns {string} "" or "?a=1&b=2".
 */
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === "") continue;
      search.append(key, String(item));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Creates an API client bound to one base URL.
 * @param {{ apiUrl: string, fetchImpl?: typeof fetch }} options
 * `fetchImpl` lets tests replace the network.
 */
export function createApi({ apiUrl, fetchImpl = globalThis.fetch }) {
  /**
   * Sends a request and returns the parsed JSON body (null when empty).
   * @param {string} path Route, e.g. "/products".
   * @param {{ method?: string, params?: Record<string, unknown>, body?: unknown }} [options]
   */
  async function request(path, { method = "GET", params, body } = {}) {
    const url = `${apiUrl}${path}${toQuery(params)}`;
    const init = { method, headers: { Accept: "application/json" } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetchImpl(url, init);
    } catch {
      throw new ApiError(
        `Não foi possível conectar à API da loja em ${apiUrl}. Verifique se o backend ou o json-server está rodando.`,
        0,
      );
    }

    const text = await response.text();
    if (!response.ok) {
      let detail = "";
      try {
        detail = JSON.parse(text)?.error ?? "";
      } catch {
        // Non-JSON error body: keep only the status
      }
      throw new ApiError(
        `A API respondeu ${response.status}${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }
    return text ? JSON.parse(text) : null;
  }

  return {
    apiUrl,
    get: (path, params) => request(path, { params }),
    post: (path, body) => request(path, { method: "POST", body }),
    patch: (path, body) => request(path, { method: "PATCH", body }),
    delete: (path, params) => request(path, { method: "DELETE", params }),
  };
}

/**
 * Exact-match filter that keeps ids as strings. json-server v1 turns
 * `?userId=1` into the number 1 and never matches the stored "1"; the
 * `_where` JSON keeps the types (the backend accepts it too). Same helper
 * as `whereEquals` in frontend/src/api/http.js.
 * @param {Record<string, unknown>} fields
 * @returns {{ _where: string }}
 */
export function whereEquals(fields) {
  const where = {};
  for (const [key, value] of Object.entries(fields)) where[key] = { eq: value };
  return { _where: JSON.stringify(where) };
}

/**
 * Normalizes a paginated response. json-server v1 and the backend answer
 * `{ data, items, pages, ... }` when `_page` is sent; a plain array is
 * accepted too.
 * @param {unknown} result Response body.
 * @returns {{ data: object[], items: number, pages: number }}
 */
export function readPage(result) {
  if (Array.isArray(result)) return { data: result, items: result.length, pages: 1 };
  const data = Array.isArray(result?.data) ? result.data : [];
  return {
    data,
    items: Number(result?.items ?? data.length),
    pages: Number(result?.pages ?? 1),
  };
}
