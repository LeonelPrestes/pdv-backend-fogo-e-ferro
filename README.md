# PDV Restaurante

Base inicial do PDV seguindo o fluxo:

`Mesa -> Comandas -> Pedidos -> Itens do pedido`

## Stack

- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma ORM

## Arquitetura local-first

O backend deve ser tratado como o servidor local do restaurante. Mesas, comandas, pedidos, cozinha, caixa, pagamentos internos e estoque basico devem funcionar pela rede local sem depender de internet.

Integracoes como fiscal/NFC-e, recebimento de notas, WhatsApp, IA, backups externos e servicos de terceiros devem ser isoladas para nao bloquear a operacao local do PDV.

Documento de referencia: `../docs/LOCAL_FIRST_ARCHITECTURE.md`.

## Como rodar

1. Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
2. Suba o PostgreSQL local:

```bash
docker compose up -d
```

3. Instale as dependencias:

```bash
npm install
```

4. Crie o banco e gere o client Prisma:

```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```

5. Suba a API:

```bash
npm run dev
```

API local: `http://localhost:3333`

Em rede local, outros dispositivos devem acessar a API pelo IP da maquina servidora, por exemplo `http://IP-DO-SERVIDOR:3333`.

## Rotas iniciais

- `GET /health`
- `GET /tables`
- `POST /tables`
- `POST /tables/:tableId/tabs`
- `POST /tabs`
- `PATCH /tabs/:tabId`
- `POST /tabs/:tabId/close`
- `POST /tables/:tableId/orders`
- `POST /orders/:orderId/send-to-kitchen`
- `GET /kitchen/tickets`
- `PATCH /kitchen/tickets/:ticketId/status`
- `GET /products`
- `POST /categories`
- `POST /products`
- `POST /cash-registers/open`
- `POST /cash-registers/:cashRegisterId/close`
- `POST /payments`

## Proximos passos

- Autenticacao e permissoes por usuario.
- Tela web para mesas, comandas, cozinha e caixa.
- Regras de cancelamento com motivo e auditoria.
- Delivery, clientes e enderecos.
- Integracao WhatsApp/IA isolada do fluxo sensivel.
