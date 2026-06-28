import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type OpenCashRegisterBody = {
  openedById: string;
  openingAmount: number;
};

type CloseCashRegisterBody = {
  closedById: string;
  closingAmount: number;
};

export async function cashRegisterRoutes(app: FastifyInstance) {
  app.post<{ Body: OpenCashRegisterBody }>(
    "/cash-registers/open",
    { preHandler: requireModule("CASH_REGISTER") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);

    await prisma.user.findFirstOrThrow({
      where: {
        id: request.body.openedById,
        restaurantId
      }
    });

    const cashRegister = await prisma.cashRegister.create({
      data: {
        restaurantId,
        openedById: request.body.openedById,
        openingAmount: toDecimal(request.body.openingAmount),
        movements: {
          create: {
            type: "OPENING",
            amount: toDecimal(request.body.openingAmount),
            reason: "Abertura de caixa"
          }
        }
      }
    });

    return reply.code(201).send(cashRegister);
    }
  );

  app.post<{ Params: { cashRegisterId: string }; Body: CloseCashRegisterBody }>(
    "/cash-registers/:cashRegisterId/close",
    { preHandler: requireModule("CASH_REGISTER") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);

      await prisma.user.findFirstOrThrow({
        where: {
          id: request.body.closedById,
          restaurantId
        }
      });

      const cashRegister = await prisma.cashRegister.findUniqueOrThrow({
        where: {
          id: request.params.cashRegisterId,
          restaurantId
        },
        include: { payments: true, movements: true }
      });

      const paymentsTotal = cashRegister.payments.reduce(
        (sum, payment) => sum + payment.amount.toNumber(),
        0
      );
      const manualMovementsTotal = cashRegister.movements.reduce(
        (sum, movement) => sum + movement.amount.toNumber(),
        0
      );
      const expectedAmount = paymentsTotal + manualMovementsTotal;
      const differenceAmount = request.body.closingAmount - expectedAmount;

      return prisma.cashRegister.update({
        where: {
          id: request.params.cashRegisterId,
          restaurantId
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: request.body.closedById,
          closingAmount: toDecimal(request.body.closingAmount),
          expectedAmount: toDecimal(expectedAmount),
          differenceAmount: toDecimal(differenceAmount),
          movements: {
            create: {
              type: "CLOSING",
              amount: toDecimal(request.body.closingAmount),
              reason: "Fechamento de caixa"
            }
          }
        }
      });
    }
  );
}
