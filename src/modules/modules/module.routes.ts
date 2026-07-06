import type { FastifyInstance } from "fastify";
import type { ModuleKey } from "@prisma/client";
import {
  getRestaurantId,
  moduleDefinitions,
  requireModule
} from "../../lib/modules.js";
import { prisma } from "../../lib/prisma.js";

type UpdateModuleBody = {
  enabled: boolean;
};

const moduleKeys = new Set(moduleDefinitions.map((moduleDefinition) => moduleDefinition.key));

function parseModuleKey(value: string): ModuleKey {
  if (!moduleKeys.has(value as ModuleKey)) {
    throw new Error(`Módulo inválido: ${value}`);
  }

  return value as ModuleKey;
}

export async function moduleRoutes(app: FastifyInstance) {
  app.get("/modules", async (request) => {
    const restaurantId = await getRestaurantId(request);

    return prisma.restaurantModule.findMany({
      where: { restaurantId },
      orderBy: { moduleKey: "asc" },
      include: { module: true }
    });
  });

  app.patch<{ Params: { moduleKey: string }; Body: UpdateModuleBody }>(
    "/modules/:moduleKey",
    { preHandler: requireModule("SETTINGS") },
    async (request) => {
      const restaurantId = await getRestaurantId(request);
      const moduleKey = parseModuleKey(request.params.moduleKey);
      const now = new Date();

      return prisma.restaurantModule.upsert({
        where: {
          restaurantId_moduleKey: {
            restaurantId,
            moduleKey
          }
        },
        update: {
          enabled: request.body.enabled,
          enabledAt: request.body.enabled ? now : null
        },
        create: {
          restaurantId,
          moduleKey,
          enabled: request.body.enabled,
          enabledAt: request.body.enabled ? now : undefined
        },
        include: { module: true }
      });
    }
  );
}
