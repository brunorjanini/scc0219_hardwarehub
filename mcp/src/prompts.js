/**
 * @file MCP prompts: ready-made tasks a user can start from their client.
 */
import * as z from "zod/v4";

/** Uses the agent can build for (prompt arguments are strings in MCP). */
const USES = ["jogos", "trabalho", "básico"];

/**
 * Text of the "montar-pc" prompt.
 * @param {{ orcamento: string, uso?: string }} args
 */
export function buildPcPrompt({ orcamento, uso }) {
  const purpose = uso ? `O uso principal será: ${uso}.` : "Pergunte o uso principal se não estiver claro.";
  return [
    `Monte um PC completo na loja HardwareHub com orçamento de até R$ ${orcamento}. ${purpose}`,
    "",
    "Como fazer:",
    "1. Leia hardwarehub://rules/compatibility para entender as regras do Montador.",
    "2. Para cada uma das 7 posições (cpu, motherboard, ram, gpu, storage, psu, case), use suggest_parts",
    "   passando as peças já escolhidas, e escolha só opções compatíveis e com estoque.",
    "3. Comece pelas peças que mais pesam no uso (placa de vídeo para jogos, processador para trabalho).",
    "4. No fim, chame check_build com a montagem inteira. Corrija qualquer erro e evite avisos de fonte.",
    "5. Responda com uma tabela (posição, peça, preço), o total, o consumo estimado e a fonte recomendada,",
    "   e explique em poucas linhas por que cada peça foi escolhida. Não passe do orçamento.",
  ].join("\n");
}

/** Text of the "relatorio-estoque" prompt (admin mode). */
export const STOCK_REPORT_PROMPT = [
  "Prepare um relatório curto da loja HardwareHub para o administrador.",
  "",
  "1. Chame dashboard_stats e resuma receita, pedidos e ticket médio do mês, comparando com o mês anterior.",
  "2. Chame list_low_stock. Para cada produto esgotado ou com poucas unidades, sugira quantas unidades repor,",
  "   usando a quantidade vendida (sold) como referência de procura, e diga a prioridade (alta, média, baixa).",
  "3. Termine com uma tabela: produto, estoque atual, vendidos, reposição sugerida, prioridade.",
  "",
  "Não altere nenhum estoque. Se o administrador pedir para aplicar a reposição, confirme os números com ele",
  "antes e use update_stock produto a produto.",
].join("\n");

/**
 * Registers the prompts of a mode on a server.
 * @param {import("@modelcontextprotocol/server").McpServer} server
 * @param {string} [mode] Access mode; "relatorio-estoque" only exists in admin mode.
 */
export function registerPrompts(server, mode = "readonly") {
  if (mode === "admin") {
    server.registerPrompt(
      "relatorio-estoque",
      {
        title: "Relatório de estoque",
        description: "Resume os indicadores do mês e sugere reposições para produtos esgotados ou com poucas unidades.",
      },
      () => ({ messages: [{ role: "user", content: { type: "text", text: STOCK_REPORT_PROMPT } }] }),
    );
  }

  server.registerPrompt(
    "montar-pc",
    {
      title: "Montar um PC",
      description: "Monta um PC compatível dentro de um orçamento, usando as regras do Montador da loja.",
      argsSchema: z.object({
        orcamento: z.string().describe("Orçamento máximo em reais, por exemplo 6000"),
        uso: z.string().optional().describe(`Uso principal (${USES.join(", ")})`),
      }),
    },
    (args) => ({
      messages: [{ role: "user", content: { type: "text", text: buildPcPrompt(args) } }],
    }),
  );
}
