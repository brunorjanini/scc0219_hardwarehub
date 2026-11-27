/**
 * @file MCP resources: read-only documents an agent can load by URI.
 */
import { ResourceTemplate } from "@modelcontextprotocol/server";
import { describeProduct } from "./format.js";
import { BASE_WATTS, PSU_HEADROOM } from "./shared.js";
import { categoryList, fetchProduct } from "./tools/catalog.js";

/**
 * The Builder rules in plain language, kept next to the constants they
 * mention so the text cannot drift from `frontend/src/utils/compatibility.js`.
 */
export const COMPATIBILITY_RULES = `# Regras de compatibilidade do Montador de PC (HardwareHub)

O Montador tem 7 posições: processador (cpu), placa-mãe (motherboard), memória (ram),
placa de vídeo (gpu), armazenamento (storage), fonte (psu) e gabinete (case).
Cada regra é verificada assim que as peças envolvidas estão escolhidas.

| Regra (id) | Verificação | Nível |
|---|---|---|
| socket | \`specs.socket\` do processador igual ao da placa-mãe | erro |
| memory | \`specs.memoryType\` da memória (DDR4/DDR5) igual ao da placa-mãe | erro |
| formFactor | \`specs.formFactor\` da placa-mãe está em \`specs.supportedFormFactors\` do gabinete | erro |
| gpuLength | \`specs.lengthMm\` da placa de vídeo ≤ \`specs.maxGpuLengthMm\` do gabinete | erro |
| psuPower | \`specs.watts\` da fonte ≥ consumo estimado | erro |
| psuMargin | \`specs.watts\` da fonte ≥ fonte recomendada | aviso |

- **Consumo estimado** = TDP do processador + TDP da placa de vídeo + ${BASE_WATTS} W (placa-mãe, memória, discos e ventoinhas).
- **Fonte recomendada** = consumo estimado × ${PSU_HEADROOM}, arredondado para cima de 50 em 50 W.
- Se faltar um dado técnico, a regra vira **aviso** ("Não foi possível verificar…") em vez de adivinhar.
- **Status geral:** \`error\` se houver qualquer erro; senão \`incomplete\` se faltar alguma posição;
  senão \`warning\` se houver avisos; senão \`ok\`.
- Na loja, só é possível adicionar a montagem ao carrinho com as 7 peças, sem erros e todas com estoque.
  Avisos não bloqueiam.
`;

/**
 * Registers the resources on a server.
 * @param {import("@modelcontextprotocol/server").McpServer} server
 * @param {ReturnType<import("./api.js").createApi>} api
 */
export function registerResources(server, api) {
  server.registerResource(
    "categories",
    "hardwarehub://categories",
    {
      title: "Categorias da loja",
      description: "Categorias, posições do Montador e campos de especificação de cada categoria.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ categories: categoryList() }, null, 2) }],
    }),
  );

  server.registerResource(
    "compatibility-rules",
    "hardwarehub://rules/compatibility",
    {
      title: "Regras de compatibilidade",
      description: "As regras que o Montador de PC usa para validar uma montagem.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: COMPATIBILITY_RULES }],
    }),
  );

  server.registerResource(
    "product",
    new ResourceTemplate("hardwarehub://products/{id}", { list: undefined }),
    {
      title: "Produto",
      description: "Um produto ou serviço da loja, pelo id.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const product = describeProduct(await fetchProduct(api, String(id)));
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(product, null, 2) }],
      };
    },
  );
}
