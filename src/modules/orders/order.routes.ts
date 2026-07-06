import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";
import { printKitchenTicket, printerRequired } from "../../lib/printer.js";

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

type CancelBody = {
  reason: string;
};

function tabCode() {
  return `CMD-${Date.now()}`;
}

export async function orderRoutes(app: FastifyInstance) {
  app.post<{ Params: { tableId: string }; Body: CreateOrderBody }>(
    "/tables/:tableId/orders/send-to-kitchen",
    { preHandler: requireModule("ORDERS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);
      if (!Array.isArray(request.body.items) || request.body.items.length === 0) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Pedido precisa ter ao menos um item."
        });
      }

      for (const item of request.body.items) {
        if (!item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
          return reply.code(400).send({
            error: "validation_error",
            message: "Todos os itens precisam ter produto e quantidade maior que zero."
          });
        }
      }

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

        for (const item of request.body.items) {
          const product = productById.get(item.productId);
          if (!product) {
            return reply.code(404).send({
              error: "product_not_found",
              message: `Produto não encontrado: ${item.productId}`
            });
          }

          const quantity = toDecimal(item.quantity);
          if (!product.available) {
            return reply.code(409).send({
              error: "product_unavailable",
              message: `Produto indisponível: ${product.name}`
            });
          }

          if (!product.allowNegativeStock && product.currentStock.lessThan(quantity)) {
            return reply.code(409).send({
              error: "insufficient_stock",
              message: `Estoque insuficiente para ${product.name}.`
            });
          }
        }

        const now = new Date();
        const createdOrder = await tx.order.create({
          data: {
            restaurantId,
            tabId,
            sequentialNumber,
            status: "SENT_TO_KITCHEN",
            sentToKitchenAt: now,
            notes: request.body.notes,
            items: {
              create: request.body.items.map((item) => {
                const product = productById.get(item.productId);
                if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);

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
            tab: { include: { table: true } },
            items: { include: { product: true } }
          }
        });

        await tx.kitchenTicket.create({
          data: {
            restaurantId,
            orderId: createdOrder.id,
            status: "SENT_TO_KITCHEN",
            sentToKitchenAt: now
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

        const orderToPrint = await tx.order.findUniqueOrThrow({
          where: { id: createdOrder.id },
          include: {
            tab: { include: { table: true } },
            items: { include: { product: true } },
            kitchenTicket: true
          }
        });

        if (printerRequired()) {
          await printKitchenTicket(orderToPrint);
        }

        return orderToPrint;
      });

      if (!printerRequired()) {
        try {
          await printKitchenTicket(order);
        } catch (error) {
          request.log.error({ error }, "Falha ao imprimir pedido da cozinha.");
        }
      }

      return reply.code(201).send(order);
    }
  );

  app.post<{ Params: { tableId: string }; Body: CreateOrderBody }>(
    "/tables/:tableId/orders",
    { preHandler: requireModule("ORDERS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);
      if (!Array.isArray(request.body.items) || request.body.items.length === 0) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Pedido precisa ter ao menos um item."
        });
      }

      for (const item of request.body.items) {
        if (!item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
          return reply.code(400).send({
            error: "validation_error",
            message: "Todos os itens precisam ter produto e quantidade maior que zero."
          });
        }
      }

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

        for (const item of request.body.items) {
          const product = productById.get(item.productId);
          if (!product) {
            return reply.code(404).send({
              error: "product_not_found",
              message: `Produto não encontrado: ${item.productId}`
            });
          }

          const quantity = toDecimal(item.quantity);
          if (!product.available) {
            return reply.code(409).send({
              error: "product_unavailable",
              message: `Produto indisponível: ${product.name}`
            });
          }

          if (!product.allowNegativeStock && product.currentStock.lessThan(quantity)) {
            return reply.code(409).send({
              error: "insufficient_stock",
              message: `Estoque insuficiente para ${product.name}.`
            });
          }
        }

        const createdOrder = await tx.order.create({
          data: {
            restaurantId,
            tabId,
            sequentialNumber,
            notes: request.body.notes,
            items: {
              create: request.body.items.map((item) => {
                const product = productById.get(item.productId);
                if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);

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

  app.post<{ Params: { orderId: string }; Body: CancelBody }>(
    "/orders/:orderId/cancel",
    { preHandler: requireModule("ORDERS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);
      const reason = request.body.reason?.trim();

      if (!reason) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Motivo do cancelamento é obrigatório."
        });
      }

      return prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirstOrThrow({
          where: { id: request.params.orderId, restaurantId },
          include: { items: true, kitchenTicket: true }
        });

        if (order.status === "CANCELED") {
          return reply.code(409).send({
            error: "order_already_canceled",
            message: "Pedido já está cancelado."
          });
        }

        const now = new Date();
        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELED" }
        });

        if (order.kitchenTicket) {
          await tx.kitchenTicket.update({
            where: { id: order.kitchenTicket.id },
            data: { status: "CANCELED" }
          });
        }

        for (const item of order.items) {
          if (item.canceledAt) continue;

          await tx.orderItem.update({
            where: { id: item.id },
            data: { canceledAt: now, cancellationReason: reason }
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } }
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              restaurantId,
              type: "CANCELAMENTO",
              quantity: item.quantity,
              reason,
              orderItemId: item.id
            }
          });
        }

        await tx.auditLog.create({
          data: {
            restaurantId,
            action: "ORDER_CANCELED",
            entity: "Order",
            entityId: order.id,
            metadata: { reason }
          }
        });

        return tx.order.findUnique({
          where: { id: order.id },
          include: { items: { include: { product: true } }, kitchenTicket: true }
        });
      });
    }
  );

  app.post<{ Params: { itemId: string }; Body: CancelBody }>(
    "/order-items/:itemId/cancel",
    { preHandler: requireModule("ORDERS") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);
      const reason = request.body.reason?.trim();

      if (!reason) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Motivo do cancelamento é obrigatório."
        });
      }

      return prisma.$transaction(async (tx) => {
        const item = await tx.orderItem.findFirstOrThrow({
          where: {
            id: request.params.itemId,
            order: { restaurantId }
          },
          include: { order: true }
        });

        if (item.canceledAt) {
          return reply.code(409).send({
            error: "item_already_canceled",
            message: "Item já está cancelado."
          });
        }

        const updated = await tx.orderItem.update({
          where: { id: item.id },
          data: { canceledAt: new Date(), cancellationReason: reason }
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } }
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            restaurantId,
            type: "CANCELAMENTO",
            quantity: item.quantity,
            reason,
            orderItemId: item.id
          }
        });
        await tx.auditLog.create({
          data: {
            restaurantId,
            action: "ORDER_ITEM_CANCELED",
            entity: "OrderItem",
            entityId: item.id,
            metadata: { orderId: item.orderId, reason }
          }
        });

        return updated;
      });
    }
  );
}
