import { Buffer } from "node:buffer";
import net from "node:net";

type PrintableOrder = {
  sequentialNumber: number;
  createdAt: Date;
  sentToKitchenAt: Date | null;
  notes: string | null;
  tab: {
    code: string;
    customerName: string | null;
    table: {
      number: number;
    } | null;
  } | null;
  items: Array<{
    quantity: unknown;
    notes: string | null;
    product: {
      name: string;
    };
  }>;
};

const ESC = "\x1B";
const RESET = ESC + "@";
const ALIGN_LEFT = ESC + "a" + "\x00";
const ALIGN_CENTER = ESC + "a" + "\x01";
const MODE_NORMAL = ESC + "!" + "\x00";
const MODE_BOLD_TALL = ESC + "!" + "\x18";
const MODE_BOLD_LARGE = ESC + "!" + "\x38";
const MODE_BOLD_HUGE = ESC + "!" + "\x38";
const PARTIAL_CUT = "\n\n" + ESC + "i";

export class PrinterError extends Error {
  statusCode = 503;
  code = "printer_error";

  constructor(message: string) {
    super(message);
    this.name = "PrinterError";
  }
}

function envFlag(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "sim", "on"].includes(value.toLowerCase());
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function line(value = "") {
  return `${stripAccents(value)}\n`;
}

function wrapText(value: string, maxLength: number) {
  const words = stripAccents(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maxLength) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function quantityLabel(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: process.env.TZ || "America/Sao_Paulo"
  }).format(value);
}

export function printerEnabled() {
  return envFlag("PRINTER_ENABLED", false);
}

export function printerRequired() {
  return envFlag("PRINTER_REQUIRED", false);
}

export function buildKitchenTicket(order: PrintableOrder) {
  const tableNumber = order.tab?.table?.number ?? "-";
  const printedAt = order.sentToKitchenAt ?? order.createdAt;
  const chunks = [
    RESET,
    ALIGN_CENTER,
    MODE_BOLD_HUGE,
    line("COZINHA"),
    line(`MESA ${tableNumber}`),
    MODE_BOLD_TALL,
    line(`Mesa: ${tableNumber}`),
    line(`Pedido: ${order.sequentialNumber}`),
    line(`Comanda: ${order.tab?.customerName || order.tab?.code || "-"}`),
    line(`Horario: ${formatDate(printedAt)}`),
    line("--------------------------------"),
    ALIGN_LEFT,
    MODE_BOLD_LARGE
  ];

  for (const item of order.items) {
    const itemLines = wrapText(`${quantityLabel(item.quantity)}x ${item.product.name}`, 16);
    chunks.push(...itemLines.map((itemLine) => line(itemLine)));
    if (item.notes) {
      const noteLines = wrapText(`Obs: ${item.notes}`, 20);
      chunks.push(MODE_BOLD_TALL, ...noteLines.map((noteLine) => line(noteLine)), MODE_BOLD_LARGE);
    }
    chunks.push(line(""));
  }

  chunks.push(
    MODE_BOLD_TALL,
    line("--------------------------------")
  );

  if (order.notes) {
    const generalNotes = wrapText(`Obs geral: ${order.notes}`, 24);
    chunks.push(MODE_BOLD_TALL, ...generalNotes.map((noteLine) => line(noteLine)), line("--------------------------------"));
  }

  chunks.push(MODE_NORMAL, "\n\n\n\n", PARTIAL_CUT);
  return Buffer.from(chunks.join(""), "ascii");
}

export async function printKitchenTicket(order: PrintableOrder) {
  if (!printerEnabled()) {
    return { printed: false, skipped: true, reason: "printer_disabled" };
  }

  const host = process.env.PRINTER_HOST?.trim();
  const port = Number(process.env.PRINTER_PORT ?? 9100);
  const timeoutMs = Number(process.env.PRINTER_TIMEOUT_MS ?? 5000);

  if (!host) {
    throw new Error("PRINTER_HOST não configurado para impressão da cozinha.");
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PRINTER_PORT inválida para impressão da cozinha.");
  }

  const payload = buildKitchenTicket(order);

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) {
        reject(new PrinterError(`Não foi possível confirmar a impressão na cozinha: ${error.message}`));
      }
      else resolve();
    }

    socket.setTimeout(timeoutMs, () => {
      finish(new Error(`Tempo esgotado ao imprimir em ${host}:${port}.`));
    });

    socket.once("error", (error) => finish(error));
    socket.once("connect", () => {
      socket.write(payload, (error) => {
        if (error) {
          finish(error);
          return;
        }

        socket.end();
      });
    });
    socket.once("close", (hadError) => {
      if (!hadError) finish();
    });
  });

  return {
    printed: true,
    host,
    port
  };
}
