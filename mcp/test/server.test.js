// Protocol tests: a real MCP client talks to the server in the same process.
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { createFakeApi } from "./fakeApi.js";

let client;

const READONLY = { mode: "readonly", userId: null, testCard: "0000" };
const CUSTOMER = { mode: "customer", userId: "1", testCard: "4111 1111 1111 1234" };

async function connect(api = createFakeApi(), config = READONLY) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(config, api).connect(serverTransport);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("MCP server (readonly mode)", () => {
  it("exposes only read-only tools", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "check_build",
      "get_product",
      "list_brands",
      "list_categories",
      "search_products",
      "suggest_parts",
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it("returns structured content that matches the output schema", async () => {
    const result = await (await connect()).callTool({ name: "check_build", arguments: { parts: { cpu: "4", motherboard: "5" } } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ status: "error", issues: [expect.objectContaining({ id: "socket" })] });
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });

  it("answers expected failures as readable tool errors", async () => {
    const result = await (await connect()).callTool({ name: "get_product", arguments: { id: "999" } });
    expect(result).toMatchObject({ isError: true, content: [{ type: "text", text: 'Produto "999" não encontrado.' }] });
  });

  it("validates arguments before running the tool", async () => {
    const api = createFakeApi();
    const result = await (await connect(api)).callTool({ name: "suggest_parts", arguments: { slot: "monitor" } });
    expect(result.isError).toBe(true);
    expect(api.calls).toHaveLength(0);
  });

  it("serves the rules, categories and product resources", async () => {
    const c = await connect();
    const { resources } = await c.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(["hardwarehub://categories", "hardwarehub://rules/compatibility"]);

    const rules = await c.readResource({ uri: "hardwarehub://rules/compatibility" });
    expect(rules.contents[0].text).toContain("TDP do processador + TDP da placa de vídeo + 100 W");

    const product = await c.readResource({ uri: "hardwarehub://products/13" });
    expect(JSON.parse(product.contents[0].text)).toMatchObject({ id: "13", category: "gpu" });
  });

  it("offers the montar-pc prompt with the budget filled in", async () => {
    const c = await connect();
    const prompt = await c.getPrompt({ name: "montar-pc", arguments: { orcamento: "6000", uso: "jogos" } });
    const text = prompt.messages[0].content.text;
    expect(text).toContain("R$ 6000");
    expect(text).toContain("jogos");
    expect(text).toContain("check_build");
  });
});

describe("MCP server (customer mode)", () => {
  const CUSTOMER_TOOLS = [
    "add_build_to_cart",
    "add_to_cart",
    "checkout_confirm",
    "checkout_preview",
    "clear_cart_confirm",
    "clear_cart_preview",
    "get_cart",
    "get_order",
    "list_my_orders",
    "list_saved_builds",
    "remove_cart_item",
    "save_build",
    "update_cart_item",
  ];

  it("adds the customer tools to the read-only ones, without a user id argument", async () => {
    const { tools } = await (await connect(createFakeApi(), CUSTOMER)).listTools();
    expect(tools).toHaveLength(6 + CUSTOMER_TOOLS.length);
    for (const name of CUSTOMER_TOOLS) {
      const tool = tools.find((t) => t.name === name);
      expect(tool, name).toBeDefined();
      expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain("userId");
    }
    const annotations = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    expect(annotations.clear_cart_confirm).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(annotations.checkout_preview).toMatchObject({ readOnlyHint: true });
  });

  it("does not register customer tools in read-only mode", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.map((t) => t.name)).not.toContain("add_to_cart");
  });

  it("buys through the protocol: add, preview, confirm", async () => {
    const api = createFakeApi();
    const c = await connect(api, CUSTOMER);
    const added = await c.callTool({ name: "add_to_cart", arguments: { items: [{ productId: "11", quantity: 2 }] } });
    expect(added.isError).toBeFalsy();
    expect(added.structuredContent).toMatchObject({ count: 2, total: 599.8 });

    const preview = await c.callTool({ name: "checkout_preview", arguments: {} });
    expect(preview.isError).toBeFalsy();
    expect(preview.structuredContent).toMatchObject({ cardLast4: "1234", address: { city: "São Carlos" } });

    const order = await c.callTool({ name: "checkout_confirm", arguments: { token: preview.structuredContent.token } });
    expect(order.isError).toBeFalsy();
    expect(order.structuredContent).toMatchObject({ status: "Pago", total: 599.8, cardLast4: "1234" });

    const again = await c.callTool({ name: "checkout_confirm", arguments: { token: preview.structuredContent.token } });
    expect(again.isError).toBe(true);
    expect(api.data.orders).toHaveLength(1);
  });
});

describe("MCP server (admin mode)", () => {
  const ADMIN = { mode: "admin", userId: "3", testCard: "0000" };
  const ADMIN_TOOLS = [
    "create_product",
    "dashboard_stats",
    "delete_product_confirm",
    "delete_product_preview",
    "list_low_stock",
    "list_users",
    "update_product",
    "update_stock",
  ];

  it("adds the admin tools and none of the customer ones", async () => {
    const { tools } = await (await connect(createFakeApi(), ADMIN)).listTools();
    const names = tools.map((t) => t.name);
    expect(names).toHaveLength(6 + ADMIN_TOOLS.length);
    for (const name of ADMIN_TOOLS) expect(names).toContain(name);
    expect(names).not.toContain("add_to_cart");
    const annotations = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    expect(annotations.delete_product_confirm).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(annotations.dashboard_stats).toMatchObject({ readOnlyHint: true });
  });

  it("offers the stock report prompt only in admin mode", async () => {
    const admin = await connect(createFakeApi(), ADMIN);
    expect((await admin.listPrompts()).prompts.map((p) => p.name).sort()).toEqual(["montar-pc", "relatorio-estoque"]);
    const prompt = await admin.getPrompt({ name: "relatorio-estoque", arguments: {} });
    expect(prompt.messages[0].content.text).toContain("list_low_stock");
    await client.close();

    const readonly = await connect();
    expect((await readonly.listPrompts()).prompts.map((p) => p.name)).toEqual(["montar-pc"]);
  });

  it("creates a product through the protocol and reports validation errors", async () => {
    const c = await connect(createFakeApi(), ADMIN);
    const product = {
      name: "Mouse sem fio",
      category: "peripheral",
      brand: "Redragon",
      description: "Mouse.",
      price: 99.9,
      stock: 10,
      specs: { kind: "Mouse", connection: "USB" },
    };
    const created = await c.callTool({ name: "create_product", arguments: product });
    expect(created.isError).toBeFalsy();
    expect(created.structuredContent).toMatchObject({ name: "Mouse sem fio", sold: 0, specs: { kind: "Mouse" } });

    const invalid = await c.callTool({ name: "create_product", arguments: { ...product, specs: {} } });
    expect(invalid).toMatchObject({ isError: true, content: [{ text: "Preencha o campo Tipo" }] });
  });

  it("refuses an update with no changes", async () => {
    const c = await connect(createFakeApi(), ADMIN);
    const result = await c.callTool({ name: "update_product", arguments: { id: "13", changes: {} } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Informe pelo menos um campo");
  });
});
