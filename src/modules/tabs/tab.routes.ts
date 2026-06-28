import type { FastifyInstance } from "fastify";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreateTabBody = {
  tableId?: string;
  customerName?: string;
};

type UpdateTabBody = {
  customerName?: string;
  serviceFeeEnabled?: boolean;
};

function tabCode() {
  return `CMD-${Date.now()}`;
}

export async function tabRoutes(app: FastifyInstance) {
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
    async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.$transaction(async (tx) => {
      const tab = await tx.tab.update({
        where: {
          id: request.params.tabId,
          restaurantId
        },
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
}
