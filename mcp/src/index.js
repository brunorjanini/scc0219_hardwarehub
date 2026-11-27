#!/usr/bin/env node
/**
 * @file Entry point: reads the configuration and serves MCP over stdio.
 *
 * stdout carries the MCP messages, so anything meant for a person goes to
 * stderr (console.error).
 */
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createApi } from "./api.js";
import { ConfigError, loadConfig } from "./config.js";
import { createServer } from "./server.js";

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`[hardwarehub-mcp] ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const api = createApi({ apiUrl: config.apiUrl });

serveStdio(() => createServer(config, api), {
  onerror: (error) => console.error("[hardwarehub-mcp]", error),
});

console.error(`[hardwarehub-mcp] modo ${config.mode}, API ${config.apiUrl}`);
