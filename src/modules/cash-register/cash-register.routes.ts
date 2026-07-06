import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type OpenCashRegisterBody = {
  openedById?: string;
  openingAmount: number;
};

type CloseCashRegisterBody = {
  closedById?: string;
  closingAmount: number;
};

async function getCashUserId(restaurantId: string, userId?: string) {
  if (userId) {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        id: userId,
        restaurantId
      }
    });
    return user.id;
  }

  const user = await prisma.user.upsert({
    where: {
      restaurantId_email: {
        restaurantId,
        email: "operador@local"
      }
    },
    update: {},
    create: {
      restaurantId,
      name: "Operador Local",
      email: "operador@local",
      passwordHash: "local-first-pending-auth",
      role: "CASHIER"
    }
  });

  return user.id;
}

export async function cashRegisterRoutes(app: FastifyInstance) {
  app.get("/cash-registers/open", { preHandler: requireModule("CASH_REGISTER") }, async (request) => {
    const restaurantId = await getRestaurantId(request);
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { restaurantId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: {
        payments: true,
        movements: {
          orderBy: { createdAt: "desc" }
        },
        openedBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!cashRegister) return null;

    const paymentsByMethod = cashRegister.payments.reduce<Record<string, number>>((acc, payment) => {
      acc[payment.method] = (acc[payment.method] ?? 0) + payment.amount.toNumber();
      return acc;
    }, {});
    const saleTotal = cashRegister.payments.reduce(
      (sum, payment) => sum + payment.amount.toNumber(),
      0
    );
    const cashInOut = cashRegister.movements
      .filter((movement) => movement.type === "CASH_IN" || movement.type === "CASH_OUT")
      .reduce((sum, movement) => sum + movement.amount.toNumber(), 0);
    const expectedAmount = cashRegister.openingAmount.toNumber() + saleTotal + cashInOut;

    return {
      ...cashRegister,
      summary: {
        paymentsByMethod,
        saleTotal,
        expectedAmount
      }
    };
  });

  app.post<{ Body: OpenCashRegisterBody }>(
    "/cash-registers/open",
    { preHandler: requireModule("CASH_REGISTER") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);

    const openedById = await getCashUserId(restaurantId, request.body.openedById);

    const openCashRegister = await prisma.cashRegister.findFirst({
      where: { restaurantId, status: "OPEN" }
    });

    if (openCashRegister) {
      return reply.code(409).send({
        error: "cash_register_already_open",
        message: "Já existe um caixa aberto."
      });
    }

    const cashRegister = await prisma.cashRegister.create({
      data: {
        restaurantId,
        openedById,
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

      const closedById = await getCashUserId(restaurantId, request.body.closedById);

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
      const manualMovementsTotal = cashRegister.movements
        .filter((movement) => movement.type === "CASH_IN" || movement.type === "CASH_OUT")
        .reduce(
        (sum, movement) => sum + movement.amount.toNumber(),
        0
      );
      const expectedAmount =
        cashRegister.openingAmount.toNumber() + paymentsTotal + manualMovementsTotal;
      const differenceAmount = request.body.closingAmount - expectedAmount;

      return prisma.cashRegister.update({
        where: {
          id: request.params.cashRegisterId,
          restaurantId
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById,
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
