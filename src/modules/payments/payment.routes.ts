import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreatePaymentBody = {
  tabId: string;
  cashRegisterId?: string;
  method: "MONEY" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "ON_CREDIT" | "OTHER";
  amount: number;
};

export async function paymentRoutes(app: FastifyInstance) {
  app.post<{ Body: CreatePaymentBody }>(
    "/payments",
    { preHandler: requireModule("PAYMENTS") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);

    await prisma.tab.findFirstOrThrow({
      where: {
        id: request.body.tabId,
        restaurantId
      }
    });

    if (request.body.cashRegisterId) {
      await prisma.cashRegister.findFirstOrThrow({
        where: {
          id: request.body.cashRegisterId,
          restaurantId
        }
      });
    }

    const payment = await prisma.payment.create({
      data: {
        restaurantId,
        tabId: request.body.tabId,
        cashRegisterId: request.body.cashRegisterId,
        method: request.body.method,
        status: request.body.method === "ON_CREDIT" ? "ON_CREDIT" : "PAID",
        amount: toDecimal(request.body.amount),
        paidAt: new Date()
      }
    });

    if (request.body.cashRegisterId) {
      await prisma.cashMovement.create({
        data: {
          cashRegisterId: request.body.cashRegisterId,
          type: "SALE",
          amount: toDecimal(request.body.amount),
          reason: `Pagamento ${payment.method}`
        }
      });
    }

    return reply.code(201).send(payment);
    }
  );
}
