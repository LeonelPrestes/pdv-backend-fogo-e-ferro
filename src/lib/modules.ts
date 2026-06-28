import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { ModuleKey } from "@prisma/client";
import { prisma } from "./prisma.js";

export const DEFAULT_RESTAURANT_SLUG = "default";

export const moduleDefinitions: Array<{
  key: ModuleKey;
  name: string;
  description: string;
  enabledByDefault: boolean;
}> = [
  {
    key: "TABLES",
    name: "Mesas",
    description: "Mapa e controle de mesas.",
    enabledByDefault: true
  },
  {
    key: "TABS",
    name: "Comandas",
    description: "Abertura, edicao e fechamento de comandas.",
    enabledByDefault: true
  },
  {
    key: "ORDERS",
    name: "Pedidos",
    description: "Lancamento e acompanhamento de pedidos.",
    enabledByDefault: true
  },
  {
    key: "KITCHEN",
    name: "Cozinha",
    description: "Tickets e status de producao.",
    enabledByDefault: true
  },
  {
    key: "PRODUCTS",
    name: "Produtos",
    description: "Categorias e cardapio.",
    enabledByDefault: true
  },
  {
    key: "STOCK",
    name: "Estoque",
    description: "Movimentacoes e saldo de produtos.",
    enabledByDefault: true
  },
  {
    key: "CASH_REGISTER",
    name: "Caixa",
    description: "Abertura e fechamento de caixa.",
    enabledByDefault: true
  },
  {
    key: "PAYMENTS",
    name: "Pagamentos",
    description: "Registro de pagamentos.",
    enabledByDefault: true
  },
  {
    key: "CUSTOMERS",
    name: "Clientes",
    description: "Cadastro de clientes e enderecos.",
    enabledByDefault: false
  },
  {
    key: "DELIVERY",
    name: "Delivery",
    description: "Pedidos de entrega.",
    enabledByDefault: false
  },
  {
    key: "WHATSAPP",
    name: "WhatsApp",
    description: "Conversas e automacoes futuras.",
    enabledByDefault: false
  },
  {
    key: "REPORTS",
    name: "Relatorios",
    description: "Relatorios gerenciais.",
    enabledByDefault: false
  },
  {
    key: "SETTINGS",
    name: "Configuracoes",
    description: "Configuracoes da loja.",
    enabledByDefault: true
  }
];

export async function ensureDefaultRestaurant() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: DEFAULT_RESTAURANT_SLUG },
    update: {},
    create: {
      name: "Restaurante Padrao",
      slug: DEFAULT_RESTAURANT_SLUG
    }
  });

  for (const moduleDefinition of moduleDefinitions) {
    await prisma.module.upsert({
      where: { key: moduleDefinition.key },
      update: {
        name: moduleDefinition.name,
        description: moduleDefinition.description
      },
      create: {
        key: moduleDefinition.key,
        name: moduleDefinition.name,
        description: moduleDefinition.description
      }
    });

    await prisma.restaurantModule.upsert({
      where: {
        restaurantId_moduleKey: {
          restaurantId: restaurant.id,
          moduleKey: moduleDefinition.key
        }
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        moduleKey: moduleDefinition.key,
        enabled: moduleDefinition.enabledByDefault,
        enabledAt: moduleDefinition.enabledByDefault ? new Date() : undefined
      }
    });
  }

  return restaurant;
}

export async function getRestaurantId(request: FastifyRequest) {
  const headerValue = request.headers["x-restaurant-id"];
  const restaurantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (restaurantId) {
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        active: true
      },
      select: { id: true }
    });

    if (!restaurant) {
      throw new Error("Restaurante nao encontrado ou inativo.");
    }

    return restaurant.id;
  }

  const restaurant = await ensureDefaultRestaurant();
  return restaurant.id;
}

export function requireModule(moduleKey: ModuleKey): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    let restaurantId: string;

    try {
      restaurantId = await getRestaurantId(request);
    } catch {
      return reply.code(404).send({
        error: "restaurant_not_found",
        message: "Restaurante nao encontrado ou inativo."
      });
    }

    const restaurantModule = await prisma.restaurantModule.findUnique({
      where: {
        restaurantId_moduleKey: {
          restaurantId,
          moduleKey
        }
      },
      include: {
        module: true
      }
    });

    if (
      !restaurantModule ||
      !restaurantModule.enabled ||
      restaurantModule.module.status !== "ACTIVE" ||
      (restaurantModule.expiresAt && restaurantModule.expiresAt < new Date())
    ) {
      return reply.code(403).send({
        error: "module_disabled",
        module: moduleKey,
        message: `Modulo ${moduleKey} nao esta habilitado para este restaurante.`
      });
    }
  };
}
