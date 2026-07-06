import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";
import { calculateTabTotals } from "../../lib/totals.js";

type CreatePaymentBody = {
  tabId: string;
  cashRegisterId?: string;
  method: "MONEY" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "ON_CREDIT" | "OTHER";
  amount?: number | string;
};

function parseAmount(value: number | string | undefined) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  return Number(value.trim().replace(/\./g, "").replace(",", "."));
}

export async function paymentRoutes(app: FastifyInstance) {
  app.post<{ Body: CreatePaymentBody }>(
    "/payments",
    { preHandler: requireModule("PAYMENTS") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);

    const amount = parseAmount(request.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Valor do pagamento deve ser maior que zero."
      });
    }

    const tab = await prisma.tab.findFirstOrThrow({
      where: {
        id: request.body.tabId,
        restaurantId
      },
      include: {
        orders: { include: { items: true } },
        payments: true
      }
    });
    const totals = calculateTabTotals(tab);

    if (amount > totals.balance + 0.009) {
      return reply.code(409).send({
        error: "payment_above_balance",
        message: "Pagamento maior que o saldo pendente.",
        totals
      });
    }

    if (request.body.cashRegisterId) {
      await prisma.cashRegister.findFirstOrThrow({
        where: {
          id: request.body.cashRegisterId,
          restaurantId,
          status: "OPEN"
        }
      });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          restaurantId,
          tabId: request.body.tabId,
          cashRegisterId: request.body.cashRegisterId,
          method: request.body.method,
          status: request.body.method === "ON_CREDIT" ? "ON_CREDIT" : "PAID",
          amount: toDecimal(amount),
          paidAt: new Date()
        }
      });

      if (request.body.cashRegisterId) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: request.body.cashRegisterId,
            type: "SALE",
            amount: toDecimal(amount),
            reason: `Pagamento ${created.method}`
          }
        });
      }

      return created;
    });

    return reply.code(201).send(payment);
    }
  );
}
