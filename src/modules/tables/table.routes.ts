import type { FastifyInstance } from "fastify";
import { getRestaurantId, requireModule } from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type CreateTableBody = {
  number: number;
  name?: string;
};

export async function tableRoutes(app: FastifyInstance) {
  app.get("/tables", { preHandler: requireModule("TABLES") }, async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { number: "asc" },
      include: {
        tabs: {
          where: { status: "OPEN" },
          include: {
            orders: {
              include: { items: true }
            }
          }
        }
      }
    });
  });

  app.post<{ Body: CreateTableBody }>(
    "/tables",
    { preHandler: requireModule("TABLES") },
    async (request, reply) => {
    const restaurantId = await getRestaurantId(request);
    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId,
        number: request.body.number,
        name: request.body.name
      }
    });

    return reply.code(201).send(table);
    }
  );
}
