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

## Impressao da cozinha por TCP

O backend imprime tickets da cozinha enviando comandos ESC/POS direto para a impressora pela rede local. Esse modo e conhecido como impressao TCP pura, RAW TCP ou porta `9100`.

Nesse modelo, o Windows nao precisa ter a impressora instalada para o backend imprimir. O backend precisa apenas do IP da impressora e da porta TCP:

```env
PRINTER_ENABLED=true
PRINTER_REQUIRED=true
PRINTER_HOST=192.168.2.114
PRINTER_PORT=9100
PRINTER_TIMEOUT_MS=5000
```

- `PRINTER_ENABLED=true`: habilita a tentativa de impressao.
- `PRINTER_REQUIRED=true`: faz o envio para cozinha falhar se a impressora nao responder.
- `PRINTER_REQUIRED=false`: tenta imprimir, mas nao bloqueia o pedido se a impressora falhar.
- `PRINTER_HOST`: IP da impressora na rede local.
- `PRINTER_PORT`: porta RAW TCP da impressora, geralmente `9100`.

Depois de alterar o `.env`, reinicie o backend para as variaveis serem carregadas novamente.

### Como encontrar a impressora no Windows

Os comandos abaixo devem ser executados no PowerShell, nao no Git Bash. Se estiver no Git Bash, chame o PowerShell assim:

```bash
powershell -Command "Test-NetConnection 192.168.2.114 -Port 9100"
```

1. Descubra o IP do computador e a faixa da rede:

```powershell
ipconfig
```

Se o computador estiver em `192.168.2.115`, a impressora provavelmente estara em algum IP `192.168.2.x`.

2. Veja se o Windows ja conhece a impressora e a porta configurada:

```powershell
Get-Printer | Select-Object Name,DriverName,PortName | Format-Table -AutoSize
Get-PrinterPort | Select-Object Name,PrinterHostAddress,PortNumber,Protocol,Description | Format-Table -AutoSize
```

Se aparecer uma porta com `PrinterHostAddress` e `PortNumber`, use esses valores no `.env`.

3. Veja os dispositivos que o computador ja encontrou na rede:

```powershell
arp -a
```

Procure IPs na mesma faixa do computador, por exemplo `192.168.2.x`.

4. Teste se a porta de impressao esta aberta:

```powershell
Test-NetConnection 192.168.2.114 -Port 9100
```

O resultado esperado e:

```text
TcpTestSucceeded : True
```

Se retornar `False`, o IP pode estar errado, a porta pode ser outra, a impressora pode estar fora da rede ou o roteador pode estar isolando os dispositivos.

5. Teste a impressao pelo backend:

```bash
curl -X POST http://localhost:3333/kitchen/printer/test
```

Ou, a partir de outro dispositivo na rede:

```bash
curl -X POST http://IP-DO-SERVIDOR:3333/kitchen/printer/test
```

### Driver, fila do Windows e porta TCP

Existem dois caminhos diferentes para imprimir:

1. Impressao TCP pura:

```text
Backend -> IP da impressora -> porta 9100 -> papel
```

Esse e o modo usado por este backend.

2. Impressao pela fila do Windows:

```text
Aplicativo -> Windows -> driver/monitor da impressora -> papel
```

Nesse modo a impressora aparece em `Get-Printer`, por exemplo `MP-4200 TH`, e pode usar portas como `Bematech_COM3:`, `Bematech_USB` ou uma porta TCP criada pelo driver.

O backend atual nao imprime pela fila do Windows. Portanto, portas como `Bematech_COM3:` ou `Bematech_USB` nao devem ser usadas em `PRINTER_HOST`. Para este backend, use o IP da impressora e uma porta TCP acessivel, normalmente `9100`.

Em restaurante real, recomenda-se configurar IP fixo na impressora ou reserva DHCP no roteador. Assim o IP nao muda quando o roteador ou a impressora reiniciar.

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
