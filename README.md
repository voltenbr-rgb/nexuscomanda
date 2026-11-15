# Nexus Comanda

Sistema SaaS multi-tenant de pedidos e cardápio digital para restaurantes, pizzarias, lanchonetes, sushi e bares.
Baseado no Nexus Gestor (mesmo cadastro, planos, limite de lojas, master, caixa, financeiro, maquininha e Pix).

- Repositório: `nexus-comanda`
- Banco D1: `nexus_comanda` (id `c0149390-7fed-44c8-94e6-a8911dd4ecda`), já criado e com as tabelas aplicadas
- Hospedagem: Cloudflare Pages + Functions (`wrangler.toml` já aponta para o banco novo)

## As três frentes
| Frente | Endereço | Acesso |
|---|---|---|
| Cardápio digital (delivery e retirada) | `/cardapio/<loja>` | público |
| Garçom / atendente (celular) | `/garcom/<loja>` | nome + PIN de 4 a 6 números |
| Pedido na mesa (cliente) | `/mesa/<loja>` | escolhe a mesa + senha da mesa (o garçom cria; some ao fechar a conta) |
| Telas de produção | `/producao/<loja>/cozinha?t=…` e `/producao/<loja>/bar?t=…` | código secreto no link |

Os links (com QR Code) ficam no painel em **Links e operação**. Cada loja do plano tem o seu próprio link.

## Roteamento por setor
Cada produto tem um **destino de preparo**: Cozinha, Bar ou Sem preparo. Ao enviar um pedido, cada item vai só para a tela do seu setor.
Preço, nome e setor sempre vêm do cadastro no servidor (o navegador não define preço).

## Fluxo da conta
Comanda (mesa, balcão, delivery ou retirada) → pedidos (cada envio, numerados por dia) → itens (novo → em preparo → pronto → entregue).
Ao fechar, a entrada é lançada sozinha no **Caixa / Financeiro** da loja (tabela `registros`, store `finance`).
Quem fecha a conta da mesa: qualquer garçom ou só atendentes com papel **Caixa**, conforme a configuração da loja.

## Banco (tabelas novas `cm_*`, sempre com `tenant_id` + `loja`)
`cm_config`, `cm_categorias`, `cm_produtos`, `cm_mesas`, `cm_atendentes`, `cm_comandas`, `cm_pedidos`, `cm_itens`.
O sistema também cria/atualiza tudo sozinho no primeiro acesso (`functions/_lib/schema.js`). Estrutura completa em `estrutura-banco-d1.sql`.

## APIs
- Painel (sessão do dono, `?loja=N`): `/api/comanda/config | catalogo | mesas | equipe | pedidos | links`
- Cardápio: `/api/cardapio/<loja>` e `/api/cardapio/<loja>/pedido`
- Garçom: `/api/garcom/<loja>/login` e `/api/garcom/<loja>`
- Produção: `/api/producao/<loja>/<setor>`

Tempo real: consulta curta a cada 3–5 s, que devolve só o que mudou (`since`). Impressão térmica de 80 mm pelo navegador.

## Demonstração
"Ver demonstração" cria a conta de teste com cardápio modelo, 12 mesas, garçom **Garçom Teste (PIN 1234)** e **Caixa Teste (PIN 4321)**.

## Publicar
1. Criar o repositório `nexus-comanda` e enviar esta pasta.
2. Cloudflare → Workers & Pages → criar projeto Pages ligado ao repositório (saída: `public`).
3. Settings → Bindings → D1: `DB` = `nexus_comanda`.
4. Segredos: `SESSION_SECRET`, `TERMINALS_SECRET`, `MASTER_PASSWORD` (e `MP_CLIENT_ID`/`MP_CLIENT_SECRET` se usar Mercado Pago).
