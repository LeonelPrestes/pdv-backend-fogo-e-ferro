import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Restaurante Padrao",
      slug: "default"
    }
  });

  const modules = [
    ["TABLES", "Mesas", "Mapa e controle de mesas.", true],
    ["TABS", "Comandas", "Abertura, edicao e fechamento de comandas.", true],
    ["ORDERS", "Pedidos", "Lancamento e acompanhamento de pedidos.", true],
    ["KITCHEN", "Cozinha", "Tickets e status de producao.", true],
    ["PRODUCTS", "Produtos", "Categorias e cardapio.", true],
    ["STOCK", "Estoque", "Movimentacoes e saldo de produtos.", true],
    ["CASH_REGISTER", "Caixa", "Abertura e fechamento de caixa.", true],
    ["PAYMENTS", "Pagamentos", "Registro de pagamentos.", true],
    ["CUSTOMERS", "Clientes", "Cadastro de clientes e enderecos.", false],
    ["DELIVERY", "Delivery", "Pedidos de entrega.", false],
    ["WHATSAPP", "WhatsApp", "Conversas e automacoes futuras.", false],
    ["REPORTS", "Relatorios", "Relatorios gerenciais.", false],
    ["SETTINGS", "Configuracoes", "Configuracoes da loja.", true]
  ] as const;

  for (const [key, name, description, enabledByDefault] of modules) {
    await prisma.module.upsert({
      where: { key },
      update: { name, description },
      create: { key, name, description }
    });

    await prisma.restaurantModule.upsert({
      where: {
        restaurantId_moduleKey: {
          restaurantId: restaurant.id,
          moduleKey: key
        }
      },
      update: {
        enabled: enabledByDefault,
        enabledAt: enabledByDefault ? new Date() : null
      },
      create: {
        restaurantId: restaurant.id,
        moduleKey: key,
        enabled: enabledByDefault,
        enabledAt: enabledByDefault ? new Date() : undefined
      }
    });
  }

  const cozinha = await prisma.productionArea.upsert({
    where: {
      restaurantId_key: {
        restaurantId: restaurant.id,
        key: "kitchen"
      }
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Cozinha",
      key: "kitchen"
    }
  });

  await prisma.productionArea.upsert({
    where: {
      restaurantId_key: {
        restaurantId: restaurant.id,
        key: "drinks"
      }
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Drinks",
      key: "drinks"
    }
  });

  await prisma.productionArea.upsert({
    where: {
      restaurantId_key: {
        restaurantId: restaurant.id,
        key: "ready_drinks"
      }
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Bebidas prontas",
      key: "ready_drinks"
    }
  });

  const admin = await prisma.user.upsert({
    where: {
      restaurantId_email: {
        restaurantId: restaurant.id,
        email: "admin@pdv.local"
      }
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Administrador",
      email: "admin@pdv.local",
      passwordHash: "trocar-em-producao",
      role: "ADMIN"
    }
  });

  await prisma.setting.upsert({
    where: {
      restaurantId_key: {
        restaurantId: restaurant.id,
        key: "serviceFee"
      }
    },
    update: {
      value: {
        enabledByDefault: true,
        percent: 10
      }
    },
    create: {
      restaurantId: restaurant.id,
      key: "serviceFee",
      value: {
        enabledByDefault: true,
        percent: 10
      }
    }
  });

  for (let number = 1; number <= 12; number += 1) {
    await prisma.restaurantTable.upsert({
      where: {
        restaurantId_number: {
          restaurantId: restaurant.id,
          number
        }
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        number
      }
    });
  }

  const bebidas = await prisma.category.upsert({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: "Bebidas"
      }
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Bebidas"
    }
  });

  const lanches = await prisma.category.upsert({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: "Lanches"
      }
    },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Lanches"
    }
  });

  await prisma.product.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        name: "Coca-Cola lata",
        price: "6.50",
        currentStock: "24",
        categoryId: bebidas.id,
        productionAreaId: cozinha.id
      },
      {
        restaurantId: restaurant.id,
        name: "X-Burger",
        price: "24.90",
        currentStock: "10",
        categoryId: lanches.id,
        productionAreaId: cozinha.id
      }
    ],
    skipDuplicates: true
  });

  console.log(`Seed concluido. Usuario admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
