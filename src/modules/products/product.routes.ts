import type { FastifyInstance } from "fastify";
import { toDecimal } from "../../lib/money.js";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreateCategoryBody = {
  name: string;
};

type CreateProductBody = {
  name: string;
  description?: string;
  price: number;
  currentStock?: number;
  allowNegativeStock?: boolean;
  available?: boolean;
  categoryId?: string;
  productionAreaId?: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", { preHandler: requireModule("PRODUCTS") }, async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.product.findMany({
      where: { restaurantId },
      orderBy: { name: "asc" },
      include: { category: true, productionArea: true }
    });
  });

  app.get("/categories", { preHandler: requireModule("PRODUCTS") }, async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.category.findMany({
      where: { restaurantId },
      orderBy: { name: "asc" }
    });
  });

  app.get("/production-areas", { preHandler: requireModule("PRODUCTS") }, async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.productionArea.findMany({
      where: { restaurantId, active: true },
      orderBy: { name: "asc" }
    });
  });

  app.post<{ Body: CreateCategoryBody }>(
    "/categories",
    { preHandler: requireModule("PRODUCTS") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);
    const name = normalizeText(request.body.name);

    if (!name) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Nome da categoria e obrigatorio."
      });
    }

    const category = await prisma.category.create({
      data: {
        restaurantId,
        name
      }
    });

    return reply.code(201).send(category);
    }
  );

  app.post<{ Body: CreateProductBody }>(
    "/products",
    { preHandler: requireModule("PRODUCTS") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);
    const name = normalizeText(request.body.name);

    if (!name) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Nome do produto e obrigatorio."
      });
    }

    if (!Number.isFinite(request.body.price) || request.body.price <= 0) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Preco do produto deve ser maior que zero."
      });
    }

    if (
      request.body.currentStock !== undefined &&
      (!Number.isFinite(request.body.currentStock) || request.body.currentStock < 0)
    ) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Estoque inicial deve ser maior ou igual a zero."
      });
    }

    if (request.body.categoryId) {
      await prisma.category.findFirstOrThrow({
        where: {
          id: request.body.categoryId,
          restaurantId
        }
      });
    }

    if (request.body.productionAreaId) {
      await prisma.productionArea.findFirstOrThrow({
        where: {
          id: request.body.productionAreaId,
          restaurantId
        }
      });
    }

    const product = await prisma.product.create({
      data: {
        restaurantId,
        name,
        description: request.body.description,
        price: toDecimal(request.body.price),
        currentStock: toDecimal(request.body.currentStock ?? 0),
        allowNegativeStock: request.body.allowNegativeStock ?? true,
        available: request.body.available ?? true,
        categoryId: request.body.categoryId,
        productionAreaId: request.body.productionAreaId
      }
    });

    return reply.code(201).send(product);
    }
  );
}
