# HardwareHub — Servidor MCP

Servidor [Model Context Protocol](https://modelcontextprotocol.io) que expõe a loja para agentes de IA (Claude Code, Claude Desktop, MCP Inspector ou qualquer cliente MCP). Ele conversa com a mesma API REST que o site usa (backend Express ou json-server) e aplica as **mesmas regras** do Montador de PC, importadas de `frontend/src/utils`.

São três modos: `readonly` (catálogo e Montador), `customer` (também carrinho, montagens salvas, pedidos e compra) e `admin` (também indicadores, estoque, produtos e consulta de usuários). O plano completo, incluindo a próxima fase (analisador com IA), está em [docs/plano-mcp.md](../docs/plano-mcp.md).

## Requisitos

- Node.js 20 ou mais recente.
- A API da loja rodando: `npm run mock:server` em `frontend/` (json-server) ou o backend (`backend/README.md`), na porta 3000.

## Instalação

```bash
cd mcp
npm install
```

## Uso

### Claude Code

O arquivo `.mcp.json` na raiz do repositório já registra o servidor `hardwarehub`. Abra o projeto no Claude Code e aprove o servidor quando ele pedir. Depois, é só pedir, por exemplo: "monte um PC para jogos até R$ 7.000 na HardwareHub".

### MCP Inspector (sem conta nem chave)

```bash
cd mcp
npm run inspect
```

Abre uma página no navegador onde dá para listar e chamar as ferramentas, ler os recursos e testar o prompt.

### Claude Desktop (opcional)

Em `claude_desktop_config.json`, use o caminho absoluto do `index.js`:

```json
{
  "mcpServers": {
    "hardwarehub": {
      "command": "node",
      "args": ["C:/caminho/para/scc0219_hardwarehub/mcp/src/index.js"],
      "env": { "HARDWAREHUB_API_URL": "http://localhost:3000" }
    }
  }
}
```

## Configuração

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `HARDWAREHUB_API_URL` | `http://localhost:3000` | Endereço da API da loja |
| `HARDWAREHUB_MODE` | `readonly` | Modo de acesso: `readonly`, `customer` ou `admin` |
| `HARDWAREHUB_USER_ID` | — | Obrigatório nos modos `customer` e `admin`: id da conta que o agente usa. No seed, `1` é a cliente Ana Souza e `3` é o administrador `admin` |
| `HARDWAREHUB_TEST_CARD` | `0000 0000 0000 0000` | Cartão usado no checkout. A loja aceita qualquer número e guarda só os 4 últimos dígitos |

O servidor usa só stdio: não abre nenhuma porta de rede. Mensagens para pessoas vão para o stderr, porque o stdout carrega o protocolo.

### Segurança

A API da loja não tem autenticação, então o próprio servidor MCP limita o que o agente pode fazer:

- **Ferramentas por modo:** as ferramentas de um modo inativo nem são registradas.
- **Identidade fixa:** nos modos `customer` e `admin`, o id da conta vem da configuração e nunca é parâmetro de ferramenta. No modo `customer`, o agente não consegue mexer no carrinho, nas montagens ou nos pedidos de outra pessoa; um pedido de outro cliente aparece como "não encontrado". A conta é conferida no primeiro uso: o modo `customer` recusa um administrador e o modo `admin` recusa um cliente.
- **Duas etapas para o que não tem volta:** finalizar a compra, esvaziar o carrinho e excluir um produto começam com `*_preview`, que mostra o que vai acontecer e devolve um token de uso único (5 minutos). Só o `*_confirm` com esse token executa. Se o carrinho ou algum preço mudar entre a prévia e a confirmação, a compra é recusada.
- **Mesmas validações do painel:** produtos criados ou editados pelo agente passam pela validação do formulário do admin (`validateProduct`).
- **Contas só pelo painel:** criar, editar ou excluir clientes e administradores não está disponível para agentes; o modo `admin` só consulta usuários.
- **Sem dados de cartão no agente:** o número vem de `HARDWAREHUB_TEST_CARD`.
- **Sem senhas:** os dados de usuário enviados ao agente nunca incluem a senha.

### Exemplo: Claude Code como cliente ou administrador

O `.mcp.json` do repositório fica sempre em `readonly`. Para testar os outros modos, use a configuração de usuário do Claude Code (ou um `.mcp.json` só seu, sem commitar) com:

```json
"env": {
  "HARDWAREHUB_API_URL": "http://localhost:3000",
  "HARDWAREHUB_MODE": "customer",
  "HARDWAREHUB_USER_ID": "1"
}
```

Para administrador, troque por `"HARDWAREHUB_MODE": "admin"` e `"HARDWAREHUB_USER_ID": "3"`.

A compra (`checkout_confirm`) exige o **backend** (Express + MongoDB), que tem a rota `POST /checkout`. Com o json-server, todo o resto funciona e a confirmação da compra responde explicando isso.

## O que o agente consegue fazer (modo `readonly`)

### Ferramentas

Todas são somente leitura (`readOnlyHint: true`) e devolvem JSON validado (`outputSchema` + `structuredContent`).

| Ferramenta | Para quê |
| --- | --- |
| `search_products` | Buscar no catálogo por nome, categoria, marca, faixa de preço e disponibilidade, com ordenação e paginação |
| `get_product` | Detalhes de um produto, com as especificações rotuladas em português |
| `list_categories` | Categorias, posições do Montador e campos de especificação de cada uma |
| `list_brands` | Marcas (de uma categoria ou de toda a loja), com a quantidade de itens |
| `check_build` | Validar uma montagem com as regras do Montador: status, problemas, consumo estimado, fonte recomendada, total e peças sem estoque |
| `suggest_parts` | Opções para uma posição do Montador, ordenadas como na loja (compatíveis, disponíveis, mais baratas), com o motivo de cada incompatibilidade |

### Recursos

| URI | Conteúdo |
| --- | --- |
| `hardwarehub://categories` | O mesmo de `list_categories` |
| `hardwarehub://rules/compatibility` | As regras do Montador em Markdown |
| `hardwarehub://products/{id}` | Um produto |

### Prompts

| Prompt | Argumentos | O que faz |
| --- | --- | --- |
| `montar-pc` | `orcamento`, `uso` (opcional) | Pede ao agente um PC compatível dentro do orçamento, usando `suggest_parts` e `check_build` |

## O que o agente consegue fazer a mais (modo `customer`)

Tudo do modo `readonly`, mais as ferramentas abaixo, sempre para o cliente configurado. As regras de carrinho e de montagem são as mesmas da loja (`frontend/src/utils/cart.js`, `builder.js` e `savedBuilds.js`).

| Ferramenta | Para quê |
| --- | --- |
| `get_cart` | Carrinho com os preços de hoje, total e o que impediria a compra |
| `add_to_cart` | Adicionar produtos; tudo ou nada, respeitando o estoque (contando o que já está no carrinho) |
| `update_cart_item` | Mudar a quantidade de um produto (0 remove) |
| `remove_cart_item` | Remover um produto |
| `clear_cart_preview` → `clear_cart_confirm` | Esvaziar o carrinho, em duas etapas |
| `add_build_to_cart` | Adicionar uma montagem inteira, opcionalmente com o serviço de montagem; mesma regra do botão do Montador (7 peças, sem erros, todas com estoque) |
| `save_build` / `list_saved_builds` | Salvar montagens na conta e listá-las com o preço de hoje e as peças que mudaram |
| `list_my_orders` / `get_order` | Pedidos do cliente |
| `checkout_preview` → `checkout_confirm` | Finalizar a compra, em duas etapas (exige o backend) |

## O que o agente consegue fazer a mais (modo `admin`)

Tudo do modo `readonly`, mais as ferramentas abaixo. As regras são as do painel administrativo (`frontend/src/utils/productForm.js` e `dashboardStats.js`).

| Ferramenta | Para quê |
| --- | --- |
| `dashboard_stats` | Indicadores do painel: receita, pedidos e ticket médio do mês comparados com o mês anterior, estoque, receita dos últimos 7 dias e pedidos recentes |
| `list_low_stock` | Produtos esgotados ou com até 3 unidades, com a quantidade vendida |
| `update_stock` | Alterar o estoque de um produto (serviços não têm estoque) |
| `create_product` | Criar produto ou serviço, com a validação do formulário do admin e as specs obrigatórias da categoria |
| `update_product` | Alterar só alguns campos; specs são mescladas por chave (`null` remove uma); `sold` nunca é alterado |
| `delete_product_preview` → `delete_product_confirm` | Excluir um produto, em duas etapas; a prévia mostra quantos carrinhos e montagens salvas o usam |
| `list_users` | Consultar clientes e administradores, com busca; sem senhas |

O prompt `relatorio-estoque` (só neste modo) pede ao agente um resumo do mês e sugestões de reposição, sem alterar estoque até o administrador confirmar.

## Testes

```bash
npm run test:run                  # 89 testes, sem servidor: API falsa carregada do seed e cliente MCP no mesmo processo
npm run smoke                     # de ponta a ponta pelo stdio, só leitura, contra a API em HARDWAREHUB_API_URL
npm run smoke -- --customer [id]  # também o fluxo de compra do cliente `id` (padrão 1)
npm run smoke -- --admin [id]     # também o fluxo do administrador `id` (padrão 3): cria, edita e exclui um produto de teste
```

Os fluxos `--customer` e `--admin` **alteram os dados** (o de cliente faz uma compra de verdade). Depois, rode `npm run mock:reset` (json-server, em `frontend/`) ou `npm run seed` (backend).

## Estrutura

```
mcp/
├── scripts/smoke.js     Verificação de ponta a ponta pelo stdio
├── src/
│   ├── index.js         Entrada: lê a configuração e serve pelo stdio
│   ├── config.js        Variáveis de ambiente e modos de acesso
│   ├── server.js        Cria o servidor e registra as ferramentas do modo ativo
│   ├── api.js           Cliente HTTP da API da loja
│   ├── identity.js      Conta configurada (cliente ou admin, conferida no primeiro uso)
│   ├── confirmations.js Tokens de uso único das ações em duas etapas
│   ├── shared.js        Regras importadas do frontend (Montador, carrinho, produtos, painel)
│   ├── format.js        Formato dos produtos enviados ao agente; remoção de senhas
│   ├── schemas.js       Schemas Zod compartilhados
│   ├── errors.js        ToolError (falhas esperadas, devolvidas com isError)
│   ├── resources.js     Recursos (regras, categorias, produto)
│   ├── prompts.js       Prompts montar-pc e relatorio-estoque
│   └── tools/
│       ├── catalog.js   search_products, get_product, list_categories, list_brands
│       ├── builder.js   check_build, suggest_parts
│       ├── customer.js  carrinho, montagens salvas, pedidos e checkout
│       └── admin.js     painel, estoque, produtos e consulta de usuários
└── test/                Vitest
```
