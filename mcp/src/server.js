/**
 * @file Builds the MCP server for one configuration: registers the tools,
 * resources and prompts of the active mode.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { ApiError } from "./api.js";
import { ToolError } from "./errors.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { createConfirmations } from "./confirmations.js";
import { createIdentity } from "./identity.js";
import { builderTools } from "./tools/builder.js";
import { catalogTools } from "./tools/catalog.js";
import { adminTools } from "./tools/admin.js";
import { customerTools } from "./tools/customer.js";

export const SERVER_INFO = { name: "hardwarehub", version: "1.0.0" };

const BASE_INSTRUCTIONS = `HardwareHub is a Brazilian online store of PC parts, peripherals and services (prices in BRL).
Use search_products and get_product to browse the catalog. To build a PC, use suggest_parts slot by slot and
check_build on the whole build: these run the store's own compatibility rules (see hardwarehub://rules/compatibility).
Product names, labels and messages are in Brazilian Portuguese.`;

const CUSTOMER_INSTRUCTIONS = `You act as one store customer, fixed by the server configuration: the cart, saved builds and
orders are theirs. Buying and emptying the cart take two steps: the *_preview tool shows what will happen and returns a
token; show that summary to the user and call the matching *_confirm tool only after they explicitly agree.`;

const ADMIN_INSTRUCTIONS = `You act as a store administrator, fixed by the server configuration. You can see the dashboard and
the users, and manage products and stock. Product changes go through the same validation as the admin form. Change
stock, prices or products only when the user asks. Deleting a product takes two steps: delete_product_preview shows what
will be removed and returns a token; call delete_product_confirm only after the user explicitly agrees.`;

/**
 * Tools of each mode. Tools of other modes are not registered at all, so
 * an agent cannot even see them.
 */
const READONLY_TOOLS = [...catalogTools, ...builderTools];

export const TOOLS_BY_MODE = {
  readonly: READONLY_TOOLS,
  customer: [...READONLY_TOOLS, ...customerTools],
  admin: [...READONLY_TOOLS, ...adminTools],
};

/** Server instructions of each mode. */
export const INSTRUCTIONS_BY_MODE = {
  readonly: BASE_INSTRUCTIONS,
  customer: `${BASE_INSTRUCTIONS}\n\n${CUSTOMER_INSTRUCTIONS}`,
  admin: `${BASE_INSTRUCTIONS}\n\n${ADMIN_INSTRUCTIONS}`,
};

/**
 * Turns a tool handler result or error into an MCP tool result.
 * Expected failures (ToolError, ApiError) become `isError` results the
 * agent can read; anything else is a bug and is rethrown.
 * @param {() => Promise<object>} run
 */
export async function toToolResult(run) {
  try {
    const output = await run();
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  } catch (err) {
    if (err instanceof ToolError || err instanceof ApiError) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
    throw err;
  }
}

/**
 * Creates a server for a configuration. Each server (one per client
 * connection) has its own confirmation tokens.
 * @param {{ mode: string, userId?: string | null, testCard?: string }} config Validated configuration (see config.js).
 * @param {ReturnType<import("./api.js").createApi>} api API client.
 * @param {{ confirmations?: ReturnType<typeof createConfirmations> }} [deps] Replaceable parts, for tests.
 * @returns {McpServer}
 */
export function createServer(config, api, { confirmations = createConfirmations() } = {}) {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS_BY_MODE[config.mode] });
  const ctx = { api, config, identity: createIdentity(api, config), confirmations };

  for (const tool of TOOLS_BY_MODE[config.mode] ?? []) {
    const { name, title, description, inputSchema, outputSchema, annotations, handler } = tool;
    const definition = { title, description, outputSchema, annotations };
    if (inputSchema) {
      server.registerTool(name, { ...definition, inputSchema }, (args) => toToolResult(() => handler(ctx, args)));
    } else {
      server.registerTool(name, definition, () => toToolResult(() => handler(ctx, {})));
    }
  }

  registerResources(server, api);
  registerPrompts(server, config.mode);
  return server;
}
