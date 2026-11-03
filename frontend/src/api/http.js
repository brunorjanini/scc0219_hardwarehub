// Thin wrapper around fetch used by every API module.
// The base URL comes from VITE_API_URL so the same code can point to
// json-server now and to the real Node server in the final version.

export const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

// Error thrown for any non-2xx response, carrying the HTTP status
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Builds a query string from an object, skipping empty values.
// Keys are kept as-is so json-server v1 operators like "price:lte" work.
// An array repeats the key (?_dependent=carts&_dependent=builds).
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

// Sends a request and returns the parsed JSON body (or null when empty).
// Throws ApiError on HTTP errors and on network failures.
export async function request(path, { method = "GET", body, params } = {}) {
  const url = `${API_URL}${path}${toQuery(params)}`;
  const options = { method, headers: {} };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique se o mock server está rodando.",
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      `Erro na requisição (${response.status})`,
      response.status,
    );
  }

  // DELETE and some PATCH responses may have an empty body
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Short helpers for each HTTP verb
export const http = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path, params) => request(path, { method: "DELETE", params }),
};

// Exact-match filter that keeps strings as strings.
// json-server v1 converts query values that look like numbers ("1") into
// numbers and compares with ===, so `?userId=1` never matches the stored
// string "1". The `_where` JSON parameter keeps the original types.
// Note: `_where` replaces the other filter params (sorting and pagination
// still apply), so put every filter of the request in `fields`.
export function whereEquals(fields) {
  const where = {};
  for (const [key, value] of Object.entries(fields)) {
    where[key] = { eq: value };
  }
  return { _where: JSON.stringify(where) };
}

// json-server v1 creates string ids while seed data may use numbers,
// so ids are always compared as strings.
export function sameId(a, b) {
  return a !== undefined && a !== null && String(a) === String(b);
}
