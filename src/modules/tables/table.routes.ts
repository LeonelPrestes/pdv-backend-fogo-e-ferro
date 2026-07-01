import type { FastifyInstance } from "fastify";
import { calculateTabTotals } from "../../lib/totals.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreateTableBody = {
  number: number;
  name?: string;
};

export async function tableRoutes(app: FastifyInstance) {
  app.get("/tables", { preHandler: requireModule("TABLES") }, async (request) => {
    const restaurantId = await getRestaurantId(request);

    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { number: "asc" },
      include: {
        tabs: {
          where: { status: "OPEN" },
          include: {
            orders: {
              include: { items: true }
            },
            payments: true
          }
        }
      }
    });

    return tables.map((table) => {
      const tabs = table.tabs.map((tab) => ({
        ...tab,
        totals: calculateTabTotals(tab)
      }));
      const total = tabs.reduce((sum, tab) => sum + tab.totals.total, 0);
      const balance = tabs.reduce((sum, tab) => sum + tab.totals.balance, 0);

      return {
        ...table,
        tabs,
        totals: {
          total,
          balance,
          openTabs: tabs.length
        }
      };
    });
  });

  app.post<{ Body: CreateTableBody }>(
    "/tables",
    { preHandler: requireModule("TABLES") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);
    const number = Number(request.body.number);

    if (!Number.isInteger(number) || number <= 0) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Numero da mesa deve ser um inteiro maior que zero."
      });
    }

    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId,
        number,
        name: request.body.name
      }
    });

    return reply.code(201).send(table);
    }
  );

  app.post<{ Params: { tableId: string } }>(
    "/tables/:tableId/close",
    { preHandler: requireModule("TABLES") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);

      return prisma.$transaction(async (tx) => {
        const table = await tx.restaurantTable.findFirstOrThrow({
          where: { id: request.params.tableId, restaurantId },
          include: {
            tabs: {
              where: { status: "OPEN" },
              include: {
                orders: { include: { items: true } },
                payments: true
              }
            }
          }
        });

        const pending = table.tabs
          .map((tab) => ({ tab, totals: calculateTabTotals(tab) }))
          .filter((entry) => entry.totals.balance > 0.009);

        if (pending.length > 0) {
          return reply.code(409).send({
            error: "table_has_pending_balance",
            message: "Mesa possui comandas com saldo pendente.",
            pendingTabs: pending.map(({ tab, totals }) => ({
              id: tab.id,
              code: tab.code,
              customerName: tab.customerName,
              balance: totals.balance
            }))
          });
        }

        await tx.tab.updateMany({
          where: { restaurantId, tableId: table.id, status: "OPEN" },
          data: { status: "CLOSED", closedAt: new Date() }
        });

        return tx.restaurantTable.update({
          where: { id: table.id },
          data: { status: "AVAILABLE" }
        });
      });
    }
  );
}
