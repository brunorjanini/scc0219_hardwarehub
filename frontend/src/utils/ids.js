// Id comparison shared by the client and the MCP server (mcp/), which
// imports pure utils from here. Kept free of `import.meta.env` so it also
// loads in Node.

// json-server v1 creates string ids while seed data may use numbers,
// so ids are always compared as strings.
export function sameId(a, b) {
  return a !== undefined && a !== null && String(a) === String(b);
}
