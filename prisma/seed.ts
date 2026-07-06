import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Restaurante Padrão",
      slug: "default"
    }
  });

  const modules = [
    ["TABLES", "Mesas", "Mapa e controle de mesas.", true],
    ["TABS", "Comandas", "Abertura, edição e fechamento de comandas.", true],
    ["ORDERS", "Pedidos", "Lancamento e acompanhamento de pedidos.", true],
    ["KITCHEN", "Cozinha", "Tickets e status de produção.", true],
    ["PRODUCTS", "Produtos", "Categorias e cardapio.", true],
    ["STOCK", "Estoque", "Movimentacoes e saldo de produtos.", true],
    ["CASH_REGISTER", "Caixa", "Abertura e fechamento de caixa.", true],
    ["PAYMENTS", "Pagamentos", "Registro de pagamentos.", true],
    ["CUSTOMERS", "Clientes", "Cadastro de clientes e enderecos.", false],
    ["DELIVERY", "Delivery", "Pedidos de entrega.", false],
    ["WHATSAPP", "WhatsApp", "Conversas e automacoes futuras.", false],
    ["REPORTS", "Relatórios", "Relatórios gerenciais.", false],
    ["SETTINGS", "Configurações", "Configurações da loja.", true]
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

  const drinks = await prisma.productionArea.upsert({
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

  const readyDrinks = await prisma.productionArea.upsert({
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

  const menuCategories = [
    "Executivos",
    "A La Carte",
    "Petiscos",
    "Não Alcoólicas",
    "Cervejas 600ml",
    "Drinks"
  ] as const;
  const categoryByName = new Map<string, Awaited<ReturnType<typeof prisma.category.upsert>>>();

  await prisma.category.updateMany({
    where: {
      restaurantId: restaurant.id,
      name: { notIn: [...menuCategories] }
    },
    data: { active: false }
  });

  for (const name of menuCategories) {
    const category = await prisma.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name
        }
      },
      update: { active: true },
      create: {
        restaurantId: restaurant.id,
        name
      }
    });
    categoryByName.set(name, category);
  }

  const products = [
    ["Executivos", "Executivo de picanha", "39.90", "12", cozinha.id],
    ["Executivos", "Executivo de frango grelhado", "29.90", "15", cozinha.id],
    ["Executivos", "Executivo de alcatra", "37.90", "11", cozinha.id],
    ["Executivos", "Executivo de peixe", "34.90", "9", cozinha.id],
    ["Executivos", "Executivo vegetariano", "27.90", "10", cozinha.id],
    ["Executivos", "Executivo de filé mignon", "42.90", "8", cozinha.id],
    ["Executivos", "Executivo à milanesa", "31.90", "14", cozinha.id],
    ["Executivos", "Executivo de carne de panela", "33.90", "10", cozinha.id],
    ["Executivos", "Executivo de linguiça artesanal", "28.90", "13", cozinha.id],
    ["Executivos", "Executivo de salmão", "44.90", "7", cozinha.id],
    ["A La Carte", "Picanha na chapa", "89.90", "8", cozinha.id],
    ["A La Carte", "Parmegiana da casa", "54.90", "10", cozinha.id],
    ["A La Carte", "Filé ao molho madeira", "62.90", "9", cozinha.id],
    ["A La Carte", "Bacalhau especial", "79.90", "6", cozinha.id],
    ["A La Carte", "Bife ancho", "68.90", "7", cozinha.id],
    ["A La Carte", "Risoto de camarão", "58.90", "8", cozinha.id],
    ["A La Carte", "Salmão grelhado", "64.90", "8", cozinha.id],
    ["A La Carte", "Costela ao barbecue", "59.90", "10", cozinha.id],
    ["A La Carte", "Lasanha da casa", "46.90", "12", cozinha.id],
    ["A La Carte", "Tilápia crocante", "49.90", "11", cozinha.id],
    ["Petiscos", "Batata frita com cheddar e bacon", "32.90", "20", cozinha.id],
    ["Petiscos", "Isca de tilápia", "44.90", "12", cozinha.id],
    ["Petiscos", "Bolinho de carne seca", "29.90", "16", cozinha.id],
    ["Petiscos", "Coxinha da asa", "27.90", "18", cozinha.id],
    ["Petiscos", "Calabresa acebolada", "26.90", "15", cozinha.id],
    ["Petiscos", "Provolone à milanesa", "31.90", "14", cozinha.id],
    ["Petiscos", "Mini hambúrguer", "34.90", "10", cozinha.id],
    ["Petiscos", "Mandioca frita", "24.90", "18", cozinha.id],
    ["Petiscos", "Pastel de queijo", "22.90", "20", cozinha.id],
    ["Petiscos", "Porção de anéis de cebola", "28.90", "16", cozinha.id],
    ["Não Alcoólicas", "Coca-Cola lata", "6.50", "24", readyDrinks.id],
    ["Não Alcoólicas", "Coca-Cola zero lata", "6.50", "24", readyDrinks.id],
    ["Não Alcoólicas", "Guaraná lata", "6.00", "24", readyDrinks.id],
    ["Não Alcoólicas", "Fanta laranja lata", "6.00", "24", readyDrinks.id],
    ["Não Alcoólicas", "Água sem gás", "4.50", "30", readyDrinks.id],
    ["Não Alcoólicas", "Água com gás", "4.90", "30", readyDrinks.id],
    ["Não Alcoólicas", "Suco natural de laranja", "9.90", "18", readyDrinks.id],
    ["Não Alcoólicas", "Suco natural de limão", "9.90", "18", readyDrinks.id],
    ["Não Alcoólicas", "H2O limoneto", "7.50", "20", readyDrinks.id],
    ["Não Alcoólicas", "Chá gelado pêssego", "8.50", "16", readyDrinks.id],
    ["Cervejas 600ml", "Brahma 600ml", "14.90", "24", readyDrinks.id],
    ["Cervejas 600ml", "Skol 600ml", "14.90", "24", readyDrinks.id],
    ["Cervejas 600ml", "Antarctica 600ml", "13.90", "24", readyDrinks.id],
    ["Cervejas 600ml", "Heineken 600ml", "18.90", "18", readyDrinks.id],
    ["Cervejas 600ml", "Budweiser 600ml", "17.90", "18", readyDrinks.id],
    ["Cervejas 600ml", "Original 600ml", "15.90", "20", readyDrinks.id],
    ["Cervejas 600ml", "Serra Malte 600ml", "16.90", "20", readyDrinks.id],
    ["Cervejas 600ml", "Itaipava 600ml", "13.50", "26", readyDrinks.id],
    ["Cervejas 600ml", "Amstel 600ml", "16.50", "20", readyDrinks.id],
    ["Cervejas 600ml", "Devassa 600ml", "14.50", "22", readyDrinks.id],
    ["Drinks", "Caipirinha de limão", "19.90", "15", drinks.id],
    ["Drinks", "Gin tônica", "24.90", "12", drinks.id],
    ["Drinks", "Mojito", "22.90", "12", drinks.id],
    ["Drinks", "Moscow mule", "23.90", "10", drinks.id],
    ["Drinks", "Negroni", "26.90", "8", drinks.id],
    ["Drinks", "Sex on the beach", "25.90", "10", drinks.id],
    ["Drinks", "Piña colada", "24.90", "10", drinks.id],
    ["Drinks", "Caipiroska de morango", "21.90", "12", drinks.id],
    ["Drinks", "Whisky sour", "27.90", "8", drinks.id],
    ["Drinks", "Aperol spritz", "28.90", "9", drinks.id]
  ] as const;

  for (const [categoryName, name, price, currentStock, productionAreaId] of products) {
    await prisma.product.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name
        }
      },
      update: {
        price,
        currentStock,
        categoryId: categoryByName.get(categoryName)?.id,
        productionAreaId,
        available: true
      },
      create: {
        restaurantId: restaurant.id,
        name,
        price,
        currentStock,
        categoryId: categoryByName.get(categoryName)?.id,
        productionAreaId
      }
    });
  }

  console.log(`Seed concluído. Usuário admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
