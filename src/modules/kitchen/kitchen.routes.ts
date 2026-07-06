import type { FastifyInstance } from "fastify";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";
import { printKitchenTicket } from "../../lib/printer.js";

type UpdateTicketBody = {
  status: "PREPARING" | "READY" | "DELIVERED" | "CANCELED";
};

export async function kitchenRoutes(app: FastifyInstance) {
  app.post("/kitchen/printer/test", { preHandler: requireModule("KITCHEN") }, async () => {
    const now = new Date();

    return printKitchenTicket({
      sequentialNumber: 1,
      createdAt: now,
      sentToKitchenAt: now,
      notes: "Teste de impressao Bematech MP-4200 TH",
      tab: {
        code: "TESTE",
        customerName: "Teste",
        table: {
          number: 0
        }
      },
      items: [
        {
          quantity: 1,
          notes: "Se este texto saiu, a cozinha esta configurada.",
          product: {
            name: "Pedido de teste"
          }
        }
      ]
    });
  });

  app.get("/kitchen/tickets", { preHandler: requireModule("KITCHEN") }, async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.kitchenTicket.findMany({
      where: {
        restaurantId,
        status: {
          in: ["SENT_TO_KITCHEN", "PREPARING", "READY"]
        }
      },
      orderBy: [
        { priority: "desc" },
        { sentToKitchenAt: "asc" }
      ],
      include: {
        order: {
          include: {
            tab: { include: { table: true } },
            items: { include: { product: true } }
          }
        }
      }
    });
  });

  app.patch<{ Params: { ticketId: string }; Body: UpdateTicketBody }>(
    "/kitchen/tickets/:ticketId/status",
    { preHandler: requireModule("KITCHEN") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);
      const now = new Date();
      const status = request.body.status;

      return prisma.$transaction(async (tx) => {
        const timestamps = {
          startedPreparingAt: status === "PREPARING" ? now : undefined,
          readyAt: status === "READY" ? now : undefined,
          deliveredAt: status === "DELIVERED" ? now : undefined
        };

        const ticket = await tx.kitchenTicket.update({
          where: {
            id: request.params.ticketId,
            restaurantId
          },
          data: {
            status,
            ...timestamps
          }
        });

        await tx.order.update({
          where: {
            id: ticket.orderId,
            restaurantId
          },
          data: {
            status,
            ...timestamps
          }
        });

        return ticket;
      });
    }
  );
}
