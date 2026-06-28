import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreateOrderBody = {
  tabId?: string;
  customerName?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string;
  }>;
};

function tabCode() {
  return `CMD-${Date.now()}`;
}

export async function orderRoutes(app: FastifyInstance) {
  app.post<{ Params: { tableId: string }; Body: CreateOrderBody }>(
    "/tables/:tableId/orders",
    { preHandler: requireModule("ORDERS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);
      const order = await prisma.$transaction(async (tx) => {
        const tableId = request.params.tableId;
        let tabId = request.body.tabId;

        await tx.restaurantTable.findFirstOrThrow({
          where: {
            id: tableId,
            restaurantId
          }
        });

        if (!tabId) {
          const openTab = await tx.tab.findFirst({
            where: { tableId, restaurantId, status: "OPEN" },
            orderBy: { openedAt: "asc" }
          });

          if (openTab) {
            tabId = openTab.id;
          } else {
            const tab = await tx.tab.create({
              data: {
                restaurantId,
                code: tabCode(),
                tableId,
                customerName: request.body.customerName
              }
            });
            tabId = tab.id;
          }
        } else {
          await tx.tab.findFirstOrThrow({
            where: {
              id: tabId,
              restaurantId
            }
          });
        }

        await tx.restaurantTable.update({
          where: { id: tableId },
          data: { status: "OCCUPIED" }
        });

        const sequentialNumber = await tx.order.count({ where: { tabId, restaurantId } }) + 1;

        const products = await tx.product.findMany({
          where: {
            restaurantId,
            id: { in: request.body.items.map((item) => item.productId) }
          }
        });

        const productById = new Map(products.map((product) => [product.id, product]));

        const createdOrder = await tx.order.create({
          data: {
            restaurantId,
            tabId,
            sequentialNumber,
            notes: request.body.notes,
            items: {
              create: request.body.items.map((item) => {
                const product = productById.get(item.productId);
                if (!product) throw new Error(`Produto nao encontrado: ${item.productId}`);

                return {
                  productId: item.productId,
                  quantity: toDecimal(item.quantity),
                  unitPrice: product.price,
                  notes: item.notes
                };
              })
            }
          },
          include: {
            tab: true,
            items: { include: { product: true } }
          }
        });

        for (const item of createdOrder.items) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              restaurantId,
              type: "SAIDA_VENDA",
              quantity: item.quantity.mul(-1),
              reason: `Pedido ${createdOrder.sequentialNumber}`,
              orderItemId: item.id
            }
          });

          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                decrement: item.quantity
              }
            }
          });
        }

        return createdOrder;
      });

      return reply.code(201).send(order);
    }
  );

  app.post<{ Params: { orderId: string } }>(
    "/orders/:orderId/send-to-kitchen",
    { preHandler: requireModule("KITCHEN") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);
      const now = new Date();

      return prisma.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: {
            id: request.params.orderId,
            restaurantId
          },
          data: {
            status: "SENT_TO_KITCHEN",
            sentToKitchenAt: now
          }
        });

        await tx.kitchenTicket.upsert({
          where: { orderId: order.id },
          update: {
            status: "SENT_TO_KITCHEN",
            sentToKitchenAt: now
          },
          create: {
            restaurantId,
            orderId: order.id,
            status: "SENT_TO_KITCHEN",
            sentToKitchenAt: now
          }
        });

        return tx.order.findUnique({
          where: { id: order.id },
          include: {
            tab: { include: { table: true } },
            items: { include: { product: true } },
            kitchenTicket: true
          }
        });
      });
    }
  );
}
