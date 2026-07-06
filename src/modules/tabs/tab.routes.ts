import type { FastifyInstance } from "fastify";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";
import { calculateTabTotals } from "../../lib/totals.js";

type CreateTabBody = {
  tableId?: string;
  customerName?: string;
};

type UpdateTabBody = {
  customerName?: string;
  serviceFeeEnabled?: boolean;
};

type TransferTabBody = {
  targetTableId: string;
  reason?: string;
};

function tabCode() {
  return `CMD-${Date.now()}`;
}

export async function tabRoutes(app: FastifyInstance) {
  app.get<{ Params: { tabId: string } }>(
    "/tabs/:tabId/summary",
    { preHandler: requireModule("TABS") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);
      const tab = await prisma.tab.findFirstOrThrow({
        where: { id: request.params.tabId, restaurantId },
        include: {
          table: true,
          orders: {
            include: {
              items: { include: { product: true } }
            },
            orderBy: { createdAt: "asc" }
          },
          payments: {
            orderBy: { createdAt: "asc" }
          }
        }
      });

      return {
        ...tab,
        totals: calculateTabTotals(tab)
      };
    }
  );

  app.post<{ Params: { tableId: string }; Body: CreateTabBody }>(
    "/tables/:tableId/tabs",
    { preHandler: requireModule("TABS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);
      const tab = await prisma.$transaction(async (tx) => {
        await tx.restaurantTable.findFirstOrThrow({
          where: {
            id: request.params.tableId,
            restaurantId
          }
        });

        const created = await tx.tab.create({
          data: {
            restaurantId,
            code: tabCode(),
            customerName: request.body.customerName,
            tableId: request.params.tableId
          }
        });

        await tx.restaurantTable.update({
          where: { id: request.params.tableId },
          data: { status: "OCCUPIED" }
        });

        return created;
      });

      return reply.code(201).send(tab);
    }
  );

  app.post<{ Body: CreateTabBody }>(
    "/tabs",
    { preHandler: requireModule("TABS") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);

    if (request.body.tableId) {
      await prisma.restaurantTable.findFirstOrThrow({
        where: {
          id: request.body.tableId,
          restaurantId
        }
      });
    }

    const tab = await prisma.tab.create({
      data: {
        restaurantId,
        code: tabCode(),
        tableId: request.body.tableId,
        customerName: request.body.customerName
      }
    });

    if (request.body.tableId) {
      await prisma.restaurantTable.update({
        where: { id: request.body.tableId },
        data: { status: "OCCUPIED" }
      });
    }

    return reply.code(201).send(tab);
    }
  );

  app.patch<{ Params: { tabId: string }; Body: UpdateTabBody }>(
    "/tabs/:tabId",
    { preHandler: requireModule("TABS") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);

      return prisma.tab.update({
        where: {
          id: request.params.tabId,
          restaurantId
        },
        data: {
          customerName: request.body.customerName,
          serviceFeeEnabled: request.body.serviceFeeEnabled
        }
      });
    }
  );

  app.post<{ Params: { tabId: string } }>(
    "/tabs/:tabId/close",
    { preHandler: requireModule("TABS") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.$transaction(async (tx) => {
      const currentTab = await tx.tab.findFirstOrThrow({
        where: { id: request.params.tabId, restaurantId, status: "OPEN" },
        include: {
          orders: { include: { items: true, kitchenTicket: true } },
          payments: true
        }
      });
      const totals = calculateTabTotals(currentTab);

      if (totals.balance > 0.009) {
        return reply.code(409).send({
          error: "tab_has_pending_balance",
          message: "Comanda possui saldo pendente.",
          totals
        });
      }

      const activeKitchenOrders = currentTab.orders.filter((order) =>
        order.kitchenTicket &&
        ["SENT_TO_KITCHEN", "PREPARING", "READY"].includes(order.kitchenTicket.status)
      );

      if (activeKitchenOrders.length > 0) {
        return reply.code(409).send({
          error: "tab_has_active_kitchen_orders",
          message: "Comanda possui pedidos ativos na cozinha.",
          orders: activeKitchenOrders.map((order) => ({
            id: order.id,
            sequentialNumber: order.sequentialNumber,
            status: order.status,
            kitchenStatus: order.kitchenTicket?.status
          }))
        });
      }

      const tab = await tx.tab.update({
        where: { id: request.params.tabId },
        data: {
          status: "CLOSED",
          closedAt: new Date()
        }
      });

      if (tab.tableId) {
        const openTabs = await tx.tab.count({
          where: {
            tableId: tab.tableId,
            restaurantId,
            status: "OPEN"
          }
        });

        if (openTabs === 0) {
          await tx.restaurantTable.update({
            where: { id: tab.tableId },
            data: { status: "AVAILABLE" }
          });
        }
      }

      return tab;
    });
    }
  );

  app.post<{ Params: { tabId: string }; Body: TransferTabBody }>(
    "/tabs/:tabId/transfer",
    { preHandler: requireModule("TABS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);

      if (!request.body.targetTableId) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Mesa destino é obrigatória."
        });
      }

      return prisma.$transaction(async (tx) => {
        const tab = await tx.tab.findFirstOrThrow({
          where: { id: request.params.tabId, restaurantId, status: "OPEN" }
        });

        const targetTable = await tx.restaurantTable.findFirstOrThrow({
          where: { id: request.body.targetTableId, restaurantId }
        });

        if (tab.tableId === targetTable.id) {
          return reply.code(400).send({
            error: "same_table_transfer",
            message: "Comanda já está na mesa destino."
          });
        }

        const sourceTableId = tab.tableId;
        const updated = await tx.tab.update({
          where: { id: tab.id },
          data: { tableId: targetTable.id }
        });

        await tx.restaurantTable.update({
          where: { id: targetTable.id },
          data: { status: "OCCUPIED" }
        });

        if (sourceTableId) {
          const sourceOpenTabs = await tx.tab.count({
            where: { restaurantId, tableId: sourceTableId, status: "OPEN" }
          });

          await tx.restaurantTable.update({
            where: { id: sourceTableId },
            data: { status: sourceOpenTabs === 0 ? "AVAILABLE" : "OCCUPIED" }
          });
        }

        await tx.auditLog.create({
          data: {
            restaurantId,
            action: "TAB_TRANSFERRED",
            entity: "Tab",
            entityId: tab.id,
            metadata: {
              fromTableId: sourceTableId,
              toTableId: targetTable.id,
              reason: request.body.reason ?? null
            }
          }
        });

        return updated;
      });
    }
  );
}
