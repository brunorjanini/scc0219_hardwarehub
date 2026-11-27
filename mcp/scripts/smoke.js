/**
 * @file End-to-end check: starts the MCP server over stdio, exactly as an
 * agent client would, and calls the tools against the real store API.
 * The API (backend or json-server) must be running.
 *
 *   npm run smoke                       read-only tools (changes nothing)
 *   npm run smoke -- --customer [id]    also the customer flow for client `id`
 *                                       (default "1"): cart, saved build and a
 *                                       real purchase. This CHANGES the data;
 *                                       run `npm run mock:reset` (json-server)
 *                                       or `npm run seed` (backend) afterwards.
 *   npm run smoke -- --admin [id]       also the admin flow for administrator `id`
 *                                       (default "3", the admin/admin account):
 *                                       dashboard, users, and a test product that
 *                                       is created, edited and deleted again.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";

/** Value after a flag, the default when the flag has none, or null without the flag. */
function flag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

const customerId = flag("--customer", "1");
const adminId = customerId ? null : flag("--admin", "3");
const mode = customerId ? "customer" : adminId ? "admin" : "readonly";
const TOOL_COUNT = { readonly: 6, customer: 19, admin: 14 };

const entry = fileURLToPath(new URL("../src/index.js", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  env: {
    ...process.env,
    HARDWAREHUB_MODE: mode,
    ...(customerId || adminId ? { HARDWAREHUB_USER_ID: customerId ?? adminId } : {}),
  },
  stderr: "inherit",
});
const client = new Client({ name: "hardwarehub-smoke", version: "1.0.0" });

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function call(name, args = {}) {
  return client.callTool({ name, arguments: args });
}

const text = (result) => result.content?.[0]?.text ?? "";

/** Read-only tools: they never change data. */
async function readOnlyFlow() {
  const { tools } = await client.listTools();
  const expected = TOOL_COUNT[mode];
  check(`lista as ${expected} ferramentas do modo`, tools.length === expected, `${tools.length} ferramentas`);

  const search = await call("search_products", { category: "gpu", inStock: true, sort: "price" });
  const gpus = search.structuredContent?.products ?? [];
  check("search_products traz placas de vídeo", !search.isError && gpus.length > 0, `${gpus.length} itens`);

  const first = gpus[0];
  const product = first && (await call("get_product", { id: first.id }));
  check("get_product traz as specs", product && !product.isError && product.structuredContent.specsLabeled.length > 0);

  const missing = await call("get_product", { id: "__nao_existe__" });
  check("get_product avisa produto inexistente", missing.isError === true, text(missing));

  const cpus = (await call("search_products", { category: "cpu", inStock: true })).structuredContent.products;
  const cpu = cpus[0];
  const boards = await call("suggest_parts", { slot: "motherboard", parts: { cpu: cpu.id } });
  const best = boards.structuredContent?.options?.[0];
  check("suggest_parts sugere placa compatível", best?.compatibility === "ok", `${cpu.name} + ${best?.product.name}`);

  const build = await call("check_build", { parts: { cpu: cpu.id, motherboard: best.product.id } });
  check("check_build aprova a dupla sugerida", ["incomplete", "ok", "warning"].includes(build.structuredContent?.status), build.structuredContent?.title);

  const rules = await client.readResource({ uri: "hardwarehub://rules/compatibility" });
  check("recurso de regras disponível", rules.contents[0].text.includes("Regras de compatibilidade"));
  return { cpu, board: best.product };
}

/** Customer flow: cart, saved build and a purchase. Changes data. */
async function customerFlow({ cpu, board }) {
  const cart = await call("get_cart");
  check("get_cart responde", !cart.isError, text(cart).slice(0, 80));
  if (cart.isError) return;

  if (cart.structuredContent.count > 0) {
    const preview = await call("clear_cart_preview");
    const cleared = await call("clear_cart_confirm", { token: preview.structuredContent.token });
    check("esvazia o carrinho em duas etapas", !cleared.isError && cleared.structuredContent.count === 0);
  }

  const ram = (await call("search_products", { category: "ram", inStock: true, sort: "price", perPage: 1 })).structuredContent.products[0];
  const added = await call("add_to_cart", { items: [{ productId: ram.id, quantity: 1 }] });
  check("add_to_cart adiciona", !added.isError && added.structuredContent.count === 1, ram.name);

  const updated = await call("update_cart_item", { productId: ram.id, quantity: 2 });
  check("update_cart_item altera a quantidade", !updated.isError && updated.structuredContent.count === 2, `total R$ ${updated.structuredContent?.total}`);

  const tooMany = await call("update_cart_item", { productId: ram.id, quantity: 99 });
  check("update_cart_item respeita o estoque", tooMany.isError === true, text(tooMany));

  const saved = await call("save_build", { name: "Montagem do smoke", parts: { cpu: cpu.id, motherboard: board.id } });
  check("save_build salva a montagem", !saved.isError, text(saved).slice(0, 80));
  const builds = await call("list_saved_builds");
  check(
    "list_saved_builds mostra a montagem",
    builds.structuredContent?.builds?.some((b) => b.id === saved.structuredContent?.id),
  );

  const { structuredContent: before } = await call("get_product", { id: ram.id });
  const preview = await call("checkout_preview");
  check("checkout_preview mostra total e cartão", !preview.isError, `R$ ${preview.structuredContent?.cart.total}, cartão final ${preview.structuredContent?.cardLast4}`);

  const order = await call("checkout_confirm", { token: preview.structuredContent.token });
  if (order.isError && text(order).includes("exige o backend")) {
    check("checkout_confirm explica que o json-server não finaliza compras", true, text(order));
    return;
  }
  check("checkout_confirm finaliza a compra", !order.isError, order.isError ? text(order) : `pedido ${order.structuredContent.id}`);
  if (order.isError) return;

  const { structuredContent: after } = await call("get_product", { id: ram.id });
  check("estoque −2 e vendidos +2", after.stock === before.stock - 2 && after.sold === before.sold + 2, `estoque ${before.stock}→${after.stock}, vendidos ${before.sold}→${after.sold}`);

  const reused = await call("checkout_confirm", { token: preview.structuredContent.token });
  check("o token não pode ser usado de novo", reused.isError === true, text(reused));

  const orders = await call("list_my_orders");
  check("list_my_orders mostra o pedido", orders.structuredContent?.orders?.[0]?.id === order.structuredContent.id);
  const empty = await call("get_cart");
  check("o carrinho fica vazio depois da compra", empty.structuredContent?.count === 0);
}

/** Admin flow: reads the dashboard and users; creates, edits and deletes a test product. */
async function adminFlow() {
  const stats = await call("dashboard_stats");
  check("dashboard_stats responde", !stats.isError, stats.isError ? text(stats) : `receita do mês R$ ${stats.structuredContent.month.revenue}, ${stats.structuredContent.stock.out} sem estoque`);
  if (stats.isError) return;

  const low = await call("list_low_stock");
  check("list_low_stock separa esgotados e poucas unidades", !low.isError, `${low.structuredContent?.out.length} esgotados, ${low.structuredContent?.low.length} com poucas unidades`);

  const users = await call("list_users");
  const all = users.structuredContent?.users ?? [];
  check("list_users lista as contas", !users.isError && all.length > 0, `${all.length} contas`);
  check("nenhuma senha na resposta", !text(users).toLowerCase().includes("password"));

  const admins = await call("list_users", { type: "admin", search: "ADMIN" });
  check(
    "list_users filtra por tipo e busca sem diferenciar maiúsculas",
    !admins.isError && admins.structuredContent.users.length > 0 && admins.structuredContent.users.every((u) => u.type === "admin"),
    admins.isError ? text(admins) : admins.structuredContent.users.map((u) => u.name).join(", "),
  );

  const invalid = await call("create_product", { name: "Teste", category: "gpu", brand: "X", description: "Y", price: 10, stock: 1 });
  check("create_product aplica a validação do formulário", invalid.isError === true, text(invalid));

  const created = await call("create_product", {
    name: "Produto de teste do smoke",
    category: "peripheral",
    brand: "HardwareHub",
    description: "Criado e excluído pelo npm run smoke.",
    price: 10,
    stock: 2,
    specs: { kind: "Teste" },
  });
  check("create_product cria o produto", !created.isError, created.isError ? text(created) : `id ${created.structuredContent.id}`);
  if (created.isError) return;
  const id = created.structuredContent.id;

  const stocked = await call("update_stock", { id, stock: 7 });
  check("update_stock altera o estoque", stocked.structuredContent?.stock === 7);

  const edited = await call("update_product", { id, changes: { price: 12.5, oldPrice: 15, specs: { connection: "USB" } } });
  check(
    "update_product altera só os campos pedidos",
    edited.structuredContent?.price === 12.5 && edited.structuredContent?.stock === 7 && edited.structuredContent?.specs.kind === "Teste",
    edited.isError ? text(edited) : JSON.stringify(edited.structuredContent.specs),
  );

  const preview = await call("delete_product_preview", { id });
  check("delete_product_preview mostra o impacto", !preview.isError, `${preview.structuredContent?.cartsWithProduct} carrinhos, ${preview.structuredContent?.savedBuildsWithProduct} montagens`);
  const deleted = await call("delete_product_confirm", { token: preview.structuredContent.token });
  check("delete_product_confirm exclui o produto", !deleted.isError);
  const gone = await call("get_product", { id });
  check("o produto excluído não existe mais", gone.isError === true, text(gone));

  const prompt = await client.getPrompt({ name: "relatorio-estoque", arguments: {} });
  check("prompt relatorio-estoque disponível", prompt.messages[0].content.text.includes("list_low_stock"));
}

try {
  await client.connect(transport);
  const parts = await readOnlyFlow();
  if (customerId) await customerFlow(parts);
  if (adminId) await adminFlow();
} catch (err) {
  check("execução", false, err.message);
} finally {
  await client.close();
}

console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
process.exitCode = failures ? 1 : 0;
