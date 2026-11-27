# Plano: servidor MCP do HardwareHub

## Progresso

- [x] 0. Preparação: imports com `.js` em 5 arquivos de `frontend/src/utils`; pacote `mcp/` com `@modelcontextprotocol/server` 2.4.0
- [x] 1. Somente leitura via stdio: 6 ferramentas, 3 recursos, prompt `montar-pc`, `.mcp.json`, 40 testes e `npm run smoke`
- [x] 2. Modo cliente: 13 ferramentas, tokens de confirmação, 69 testes no total. `npm run smoke -- --customer` passou nas 19 verificações contra o backend (Express + MongoDB via Docker): compra concluída, estoque −2 e vendidos +2, pedido no histórico, carrinho vazio e token sem reuso. Contra o json-server, tudo passou e a confirmação da compra explicou que exige o backend
- [x] 3. Modo admin: 8 ferramentas e o prompt `relatorio-estoque`, 89 testes no total. `npm run smoke -- --admin` passou nas 20 verificações contra o backend (produto de teste criado, editado e excluído; nenhuma senha nas respostas), e o fluxo do cliente foi repetido sem falhas. O servidor também foi usado pelo Claude Code, carregado pelo `.mcp.json` do repositório
- [x] 5. Analisador com IA: `GET`/`POST /builds/analyze` no backend e o painel "Análise com IA" no Montador. 5 testes no backend (cliente falso da Anthropic) e 8 no frontend (508 no total). Testado de ponta a ponta sem custo: o SDK apontado para um servidor falso local (`ANTHROPIC_BASE_URL`) recebeu a requisição esperada, e no navegador o painel mostrou a análise e a troca sugerida funcionou. **Ainda não houve uma chamada real à API**, porque não há chave configurada nesta máquina
- [ ] 4. Streamable HTTP (fora do escopo, ver "Decisões tomadas")

Desvios do plano na fase 5:

- Os campos da resposta ficaram em inglês (`summary`, `issues`, `suggestions`, `slot`, `reason`), como o resto da API do backend, em vez de `resumo`/`problemas`/`sugestoes`.
- Além das posições com problema, as **posições vazias** também recebem até 3 candidatas, para a IA poder sugerir como completar a montagem.
- Entrou `GET /builds/analyze` (`{ enabled }`), para o Montador saber se mostra o painel sem precisar fazer uma análise. Com o json-server, essa rota não existe, e o painel simplesmente não aparece.
- Explicações de problemas que as regras não apontaram também são descartadas, não só as sugestões fora da lista.
- A chamada usa effort `medium` (o padrão do modelo, escrito explicitamente) e `fallbacks: "default"` com o beta `server-side-fallback-2026-07-01`. Assim, se o modelo recusar por segurança, a API tenta de novo no modelo recomendado pela Anthropic; se ainda assim recusar, a rota responde 502.
- Os testes do backend usam o `node:test`, que vem no Node, sem acrescentar dependências.

Desvios do plano na fase 3:

- `create_product`/`update_product` montam os mesmos "valores de formulário" do painel e passam por `validateProduct` e `toProductRecord` do frontend, em vez de validar à parte. `update_product` recebe só os campos que mudam (`changes`), mescla as specs por chave (`null` remove) e recomeça as specs quando a categoria muda.
- `delete_product_preview` informa quantos carrinhos e montagens salvas usam o produto, para o administrador decidir.
- O prompt `relatorio-estoque` só é registrado no modo `admin`.
- Com todos os modos prontos, a checagem de "modo ainda não disponível" saiu do `config.js`.

Desvios do plano na fase 2:

- A conta do cliente é conferida **no primeiro uso**, não na inicialização. Clientes MCP costumam iniciar o servidor ao abrir a sessão, talvez antes de a API estar no ar; um servidor que encerrasse nesse momento sumiria sem explicação.
- `HARDWAREHUB_TEST_CARD` tem um padrão fictício (`0000 0000 0000 0000`), para o modo cliente funcionar sem configuração extra.
- Para reaproveitar as regras do carrinho e das montagens salvas, `sameId` saiu de `api/http.js` para `utils/ids.js` (o `http.js` continua reexportando a função), e `cart.js` e `savedBuilds.js` ganharam `.js` nos imports.
- `checkout_confirm` também recusa a compra se algum preço mudou depois da prévia, não só se o carrinho mudou.

Desvios do plano na fase 1: `sanitize.js` virou `format.js` (formata produtos e remove senhas); `shared.js`, `schemas.js` e `errors.js` foram acrescentados; `suggest_parts` devolve também `compatibleOutOfStock` (opções compatíveis escondidas por falta de estoque), porque sem isso o agente não sabia que existe, por exemplo, uma placa LGA1700 esgotada.

## Objetivo

Expor a loja para agentes de IA pelo **Model Context Protocol (MCP)**. Um agente (Claude Code, Claude Desktop ou qualquer cliente MCP) passa a conseguir, sem código de integração próprio:

- consultar o catálogo com os mesmos filtros da loja;
- montar e validar um PC usando o **mesmo motor de compatibilidade** do Montador;
- como cliente: gerenciar o carrinho, salvar montagens e finalizar compras;
- como administrador: ver indicadores, consultar estoque e gerenciar produtos.

Isso é um extra do grupo: o enunciado não pede MCP. O servidor MCP fica fora do frontend e não muda nada do que já é avaliado.

## Arquitetura

```
Agente (Claude Code / Desktop / outro cliente MCP)
        │  MCP via stdio (HTTP fica fora do escopo; ver fase 4)
        ▼
mcp/  ── servidor MCP (Node.js, ESM, SDK oficial v2)
        │  HTTP (mesma API REST que o frontend usa)
        ▼
backend/ (Express + MongoDB)   ou   json-server (mock do Milestone 2)
```

### Decisões

| Área | Decisão | Por quê |
|---|---|---|
| Onde fica | Pacote novo `mcp/` na raiz, com `package.json` próprio | Mesmo padrão de `frontend/` e `backend/`; não mistura dependências |
| SDK | `@modelcontextprotocol/server` **v2** (linha estável, spec MCP 2026-07-28) + `zod/v4` para os schemas | O v1 (`@modelcontextprotocol/sdk`) só recebe correções. Fixar a versão exata no `package.json` |
| Linguagem | JavaScript ESM com JSDoc, como o resto do projeto | O projeto não usa TypeScript |
| Fonte dos dados | **A API REST**, nunca o MongoDB direto | Reaproveita validações, a proteção da conta `admin` e o checkout atômico do backend. De quebra, funciona também com o json-server, que tem os mesmos endpoints (só o `POST /checkout` exige o backend) |
| URL da API | Variável `HARDWAREHUB_API_URL` (padrão `http://localhost:3000`) | Igual ao `VITE_API_URL` do frontend |
| Regras reaproveitadas | Importar `analyzeCompatibility`, `rankOptions`, `dashboardStats`, `SPEC_FIELDS` e `maxPurchasable` de `frontend/src/utils/` | Uma regra só para a loja e para os agentes. Exige acrescentar `.js` em 12 imports de 5 arquivos (`builder.js`, `compatibility.js`, `specs.js`, `dashboardStats.js`, `productForm.js`): o Node exige a extensão em ESM, e o Vite aceita os dois jeitos. `utils/cart.js` **não** pode ser importado, porque depende de `api/http.js` (que lê `import.meta.env`, só existente no Vite); a regra de quantidade do carrinho usa `maxPurchasable` de `stock.js` |
| Lógica das ferramentas | Funções puras em `mcp/src/tools/*.js`, registradas no SDK por uma camada fina | Testáveis sem o SDK e sem servidor rodando |
| Formato das respostas | `outputSchema` + `structuredContent` em toda ferramenta de leitura | O agente recebe JSON validado em vez de texto solto |

### Segurança: quem o agente é

O backend **não tem autenticação** (combinado com o professor). Se o MCP repassasse tudo, qualquer agente conectado poderia comprar em nome de qualquer cliente ou apagar produtos. Por isso o próprio servidor MCP define a identidade e o que é permitido:

| Modo (`HARDWAREHUB_MODE`) | Identidade | Ferramentas registradas |
|---|---|---|
| `readonly` (**padrão**) | Visitante | Catálogo e Montador (só leitura) |
| `customer` | `HARDWAREHUB_USER_ID` (obrigatório; o servidor confere na inicialização que é um cliente) | `readonly` + carrinho, montagens salvas, pedidos e checkout **do próprio cliente** |
| `admin` | `HARDWAREHUB_USER_ID` de um administrador | `readonly` + painel administrativo |

Regras:

- As ferramentas de um modo que não está ativo **nem são registradas**. Esconder não basta, porque o agente nem deve saber que elas existem.
- O `userId` nunca é parâmetro de ferramenta: ele vem da configuração. Assim o agente não consegue agir em nome de outro cliente.
- **Senhas nunca saem do servidor MCP.** Todo usuário passa por uma função `sanitizeUser()` que remove `password`.
- **Ações irreversíveis em duas etapas**, que funcionam em qualquer cliente MCP sem depender de elicitação:
  1. `*_preview` devolve um resumo (itens, total, o que será apagado) e um `confirmationToken` de uso único, válido por 5 minutos;
  2. `*_confirm` só executa com esse token.
- **O número do cartão não passa pelo agente.** O checkout usa `HARDWAREHUB_TEST_CARD`, da configuração. A loja aceita qualquer número e guarda só os 4 últimos dígitos.
- Todas as ferramentas levam `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`), para o cliente saber o que pedir confirmação ao usuário.
- Só há transporte stdio: o servidor MCP não abre nenhuma porta de rede.

## Superfície MCP

### Ferramentas

**Catálogo** (todos os modos, só leitura)

| Ferramenta | Entrada | Saída |
|---|---|---|
| `search_products` | `query?`, `category?`, `brand?`, `minPrice?`, `maxPrice?`, `inStock?`, `sort?` (`price`, `-price`, `-sold`, `name`), `page?`, `perPage?` (máx. 50) | Lista paginada: `id`, nome, categoria, marca, preço, preço antigo, estoque, specs principais |
| `get_product` | `id` | Produto completo, com specs rotuladas em português (`formatSpecs`) |
| `list_categories` | — | Categorias, quais entram no Montador e quais specs cada uma usa |
| `list_brands` | `category?` | Marcas existentes |

**Montador** (todos os modos, só leitura)

| Ferramenta | Entrada | Saída |
|---|---|---|
| `check_build` | `parts`: `{ cpu?, motherboard?, ram?, gpu?, storage?, psu?, case? }` com ids de produto | O resultado de `analyzeCompatibility` (status, problemas por peça, consumo estimado, fonte recomendada), mais o total e as peças sem estoque |
| `suggest_parts` | `slot`, `parts` (montagem atual), `maxPrice?`, `limit?` | Opções da posição ordenadas por `rankOptions` (compatíveis, depois disponíveis, depois mais baratas), cada uma com o motivo se não for compatível |

**Cliente** (modo `customer`)

| Ferramenta | Observação |
|---|---|
| `get_cart` | Itens com preço e subtotal atuais |
| `add_to_cart` | `items: [{ productId, quantity }]`, tudo ou nada, respeitando o estoque (`maxPurchasable`, como o carrinho da loja) |
| `update_cart_item` / `remove_cart_item` | Quantidade limitada ao estoque |
| `clear_cart_preview` → `clear_cart_confirm` | Duas etapas |
| `add_build_to_cart` | `parts` + `includeAssembly?`; recusa se `check_build` tiver erro, como o botão do Montador |
| `save_build` / `list_saved_builds` | Montagens da conta (`/builds`) |
| `list_my_orders` / `get_order` | Só pedidos do próprio cliente |
| `checkout_preview` → `checkout_confirm` | O preview mostra itens, total e endereço; o confirm chama `POST /checkout` (exige o backend) |

**Administrador** (modo `admin`)

| Ferramenta | Observação |
|---|---|
| `dashboard_stats` | Reaproveita `dashboardStats()`: receita, pedidos e ticket médio do mês, produtos sem estoque, vendas dos últimos 7 dias |
| `list_low_stock` | Produtos com 0 a 3 unidades |
| `update_stock` | `id`, `stock` (inteiro ≥ 0; serviços recusados) |
| `create_product` / `update_product` | Valida as specs obrigatórias de cada categoria com `SPEC_FIELDS` de `utils/productForm.js` |
| `delete_product_preview` → `delete_product_confirm` | Duas etapas |
| `list_users` | `type`, busca; sem senhas |

Criar ou excluir clientes e administradores **fica de fora** de propósito. É raro e arriscado demais para delegar a um agente; continua no painel web.

### Recursos (leitura por URI)

| URI | Conteúdo |
|---|---|
| `hardwarehub://categories` | Mesmo conteúdo de `list_categories` |
| `hardwarehub://products/{id}` | Produto (template de recurso) |
| `hardwarehub://rules/compatibility` | As 6 regras do Montador em Markdown (soquete, memória, formato, comprimento da GPU, potência e folga da fonte), para o agente explicar decisões |

### Prompts

| Prompt | Argumentos | O que pede ao agente |
|---|---|---|
| `montar-pc` | `orcamento`, `uso` (jogos, trabalho, básico) | Montar um PC compatível dentro do orçamento usando `suggest_parts` e `check_build`, e explicar as escolhas |
| `relatorio-estoque` | — (modo `admin`) | Resumir `dashboard_stats` e `list_low_stock` e sugerir reposições |

## Estrutura de arquivos

```
mcp/
├── package.json            "type": "module"; scripts start, test, test:run, smoke, inspect
├── README.md               Configuração dos modos e dos clientes
├── scripts/smoke.js        Verificação de ponta a ponta pelo stdio
├── test/                   Vitest (API falsa carregada do seed)
└── src/
    ├── index.js            Lê a configuração e serve pelo stdio (serveStdio)
    ├── config.js           Variáveis de ambiente, validação do modo e da identidade
    ├── server.js           createServer(config, api): registra ferramentas, recursos e prompts do modo
    ├── api.js              Cliente HTTP da API (fetch, filtros, ApiError → resultado com isError)
    ├── shared.js           Regras importadas de frontend/src/utils
    ├── format.js           Resumo/detalhe de produtos, sanitizeUser()
    ├── schemas.js          Schemas Zod compartilhados
    ├── errors.js           ToolError
    ├── confirmations.js    (fase 2) Tokens de uso único das ações em duas etapas
    ├── tools/
    │   ├── catalog.js
    │   ├── builder.js
    │   ├── customer.js     (fase 2)
    │   └── admin.js        (fase 3)
    ├── resources.js
    └── prompts.js
```

O `api.js` do MCP é próprio: o `frontend/src/api/http.js` lê `import.meta.env`, que só existe no Vite.

## Fases

| # | Entrega | Pronto quando |
|---|---|---|
| 0 | **Preparação.** Acrescentar `.js` aos imports relativos de `builder.js`, `compatibility.js`, `specs.js`, `dashboardStats.js` e `productForm.js`. Criar `mcp/` com o SDK v2 fixado. | `npm --prefix frontend run test:run` continua 500/500, e `node -e "import('./frontend/src/utils/builder.js')"` funciona |
| 1 | **Somente leitura via stdio.** `config.js`, `api.js`, ferramentas de catálogo e Montador, recursos, prompt `montar-pc`. Arquivo `.mcp.json` na raiz para o Claude Code. | Pelo Claude Code, o agente busca produtos e monta um PC compatível dentro de um orçamento |
| 2 | **Modo cliente.** Carrinho, montagens, pedidos, checkout em duas etapas, cartão vindo da configuração. | O agente monta, adiciona ao carrinho e compra; estoque −1 e vendidos +1 conferidos na API |
| 3 | **Modo admin.** Dashboard, estoque baixo, CRUD de produtos com exclusão em duas etapas, `list_users` sem senha, prompt `relatorio-estoque`. | O agente gera o relatório de estoque e repõe um produto |
| 4 | **Streamable HTTP: fora do escopo.** Fica registrado para o futuro: `createMcpHandler` + `createMcpExpressApp` em `/mcp`, só `localhost`, com `requireBearerAuth` para acesso externo. | — |
| 5 | **Analisador com IA** (depois das fases 1 a 3; cumpre o item 2.6 do README). Detalhes abaixo. | Com chave configurada, o painel do Montador mostra a explicação e as sugestões; sem chave, o painel continua igual e nada quebra |

Ordem de entrega: 0 → 1 → 2 → 3 → 5.

### Fase 5: analisador de compatibilidade com IA

- **Uma chamada, sem agente.** Rota nova no backend, `POST /builds/analyze`, recebe `parts` (ids). O backend:
  1. busca as peças;
  2. calcula o resultado das regras (`analyzeCompatibility`) e, para cada posição com problema, as melhores alternativas (`rankOptions`, até 3 por posição);
  3. faz **uma** chamada à API do Claude (SDK `@anthropic-ai/sdk`, modelo `claude-opus-5-5`, saída estruturada com `output_config.format`) e devolve `{ resumo, problemas: [{ posicao, explicacao }], sugestoes: [{ posicao, productId, motivo }] }`.
- **As regras continuam decidindo.** A IA não muda o status de compatibilidade nem libera o botão de adicionar ao carrinho: ela só explica e sugere. O backend descarta qualquer `productId` sugerido que não esteja na lista de candidatas que ele mesmo enviou.
- **Opcional em tempo de execução.** Sem `ANTHROPIC_API_KEY` no `.env` do backend, a rota responde 503 e o Montador não mostra a seção de análise. Revisores sem chave usam a loja normalmente.
- **Custo.** A análise só roda quando o cliente clica em "Analisar com IA", nunca a cada peça escolhida.
- **Testes.** O SDK da Anthropic é substituído por um mock nos testes automáticos; só o teste manual faz chamadas reais.

## Testes

- **Unitários (Vitest, como no frontend):** as funções de `tools/` com `fetch` substituído por um banco em memória construído a partir de `frontend/src/seed.json`. Casos obrigatórios:
  - filtros do catálogo;
  - `check_build` com AM5 + LGA1700 (erro de soquete);
  - `suggest_parts` ordenando compatíveis primeiro;
  - carrinho respeitando o estoque;
  - token de confirmação expirado, reutilizado ou de outra ação;
  - nenhuma resposta contendo `password`.
- **Protocolo:** cliente e servidor no mesmo processo pelo SDK. A documentação do v2 avisa que `InMemoryTransport.createLinkedPair()` só cobre conexões da era 2025; para a spec 2026-07-28 ela recomenda `handler.fetch`. Testar os dois caminhos. Conferir que cada modo registra só as suas ferramentas.
- **Integração:** com o json-server (`npm --prefix frontend run mock:server`), rodar as ferramentas de leitura contra a API real; com o backend, o checkout completo.
- **Manual:** MCP Inspector (`npx @modelcontextprotocol/inspector node mcp/src/index.js`) e um roteiro no Claude Code repetindo os fluxos de compra e de administração do roteiro manual do README.

## Configuração no Claude Code (fase 1)

`.mcp.json` na raiz do repositório:

```json
{
  "mcpServers": {
    "hardwarehub": {
      "command": "node",
      "args": ["mcp/src/index.js"],
      "env": {
        "HARDWAREHUB_API_URL": "http://localhost:3000",
        "HARDWAREHUB_MODE": "readonly"
      }
    }
  }
}
```

Para os modos `customer` e `admin`, cada pessoa ajusta `HARDWAREHUB_MODE` e `HARDWAREHUB_USER_ID` na sua configuração local. O arquivo do repositório fica sempre em `readonly`.

## Riscos

- **SDK v2 recente.** A API mudou em relação ao v1 (pacotes, `serveStdio`, fluxo de elicitação). Fixar a versão, seguir a documentação do v2 e conferir na fase 1 se o Claude Code conecta com a versão de protocolo negociada.
- **Mudança no frontend.** Os imports com `.js` nos 5 arquivos são a única alteração fora de `mcp/`. A suíte de 500 testes e o build cobrem esse risco.
- **Checkout com json-server.** `POST /checkout` só existe no backend. Com o json-server, `checkout_confirm` responde com uma mensagem clara em vez de reimplementar a compra.
- **Concorrência.** As garantias de estoque continuam sendo as do backend (update condicional); o MCP não acrescenta nenhuma.

## Decisões tomadas

| # | Pergunta | Decisão | Motivo |
|---|---|---|---|
| 1 | Modos de acesso | Os três: `readonly`, `customer` e `admin` | Cobre visitante, cliente e administrador, como a loja |
| 2 | Transporte | Só stdio; HTTP (fase 4) fora do escopo | O backend não tem autenticação, e HTTP abriria mais uma porta de rede sem ganho para o trabalho. Avaliadores rodam tudo localmente |
| 3 | Clientes para demonstrar | Claude Code (principal) e MCP Inspector (apoio); Claude Desktop citado como opcional no README | O `.mcp.json` do repositório configura o Claude Code sozinho. O Inspector não exige conta nem chave, então qualquer revisor consegue conferir as ferramentas |
| 4 | Analisador com IA | Sim, como fase 5: uma chamada estruturada, opcional (só com `ANTHROPIC_API_KEY`), depois das fases 1 a 3 | O README promete essa funcionalidade desde o Milestone 1. Sendo opcional e com as regras decidindo, não quebra nada para quem não tem chave |
