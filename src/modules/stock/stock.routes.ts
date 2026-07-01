import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreateStockMovementBody = {
  productId: string;
  type: "ENTRADA" | "AJUSTE_MANUAL" | "PERDA" | "DEVOLUCAO";
  quantity: number;
  reason?: string;
};

export async function stockRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { productId?: string } }>(
    "/stock/movements",
    { preHandler: requireModule("STOCK") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);

      return prisma.stockMovement.findMany({
        where: {
          restaurantId,
          productId: request.query.productId
        },
        orderBy: { createdAt: "desc" },
        include: { product: true }
      });
    }
  );

  app.post<{ Body: CreateStockMovementBody }>(
    "/stock/movements",
    { preHandler: requireModule("STOCK") },
    async (request, reply) => {
      const restaurantId = await getRestaurantId(request);

      if (!request.body.productId) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Produto e obrigatorio."
        });
      }

      if (!Number.isFinite(request.body.quantity) || request.body.quantity <= 0) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Quantidade deve ser maior que zero."
        });
      }

      const allowedTypes = ["ENTRADA", "AJUSTE_MANUAL", "PERDA", "DEVOLUCAO"];
      if (!allowedTypes.includes(request.body.type)) {
        return reply.code(400).send({
          error: "validation_error",
          message: "Tipo de movimentacao invalido."
        });
      }

      return prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirstOrThrow({
          where: { id: request.body.productId, restaurantId }
        });
        const signedQuantity =
          request.body.type === "PERDA"
            ? toDecimal(request.body.quantity).mul(-1)
            : toDecimal(request.body.quantity);

        const movement = await tx.stockMovement.create({
          data: {
            restaurantId,
            productId: product.id,
            type: request.body.type,
            quantity: signedQuantity,
            reason: request.body.reason
          }
        });

        await tx.product.update({
          where: { id: product.id },
          data: {
            currentStock: {
              increment: signedQuantity
            }
          }
        });

        return movement;
      });
    }
  );
}
