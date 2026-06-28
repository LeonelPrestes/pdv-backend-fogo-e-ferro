-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('TABLES', 'TABS', 'ORDERS', 'KITCHEN', 'PRODUCTS', 'STOCK', 'CASH_REGISTER', 'PAYMENTS', 'CUSTOMERS', 'DELIVERY', 'WHATSAPP', 'REPORTS', 'SETTINGS');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "document" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "key" "ModuleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "restaurant_modules" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "moduleKey" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_areas" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Seed structural data needed before adding required tenant fields.
INSERT INTO "restaurants" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('default_restaurant', 'Restaurante Padrao', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "modules" ("key", "name", "description", "createdAt", "updatedAt") VALUES
('TABLES', 'Mesas', 'Mapa e controle de mesas.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TABS', 'Comandas', 'Abertura, edicao e fechamento de comandas.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ORDERS', 'Pedidos', 'Lancamento e acompanhamento de pedidos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('KITCHEN', 'Cozinha', 'Tickets e status de producao.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('PRODUCTS', 'Produtos', 'Categorias e cardapio.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('STOCK', 'Estoque', 'Movimentacoes e saldo de produtos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('CASH_REGISTER', 'Caixa', 'Abertura e fechamento de caixa.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('PAYMENTS', 'Pagamentos', 'Registro de pagamentos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('CUSTOMERS', 'Clientes', 'Cadastro de clientes e enderecos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('DELIVERY', 'Delivery', 'Pedidos de entrega.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('WHATSAPP', 'WhatsApp', 'Conversas e automacoes futuras.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('REPORTS', 'Relatorios', 'Relatorios gerenciais.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('SETTINGS', 'Configuracoes', 'Configuracoes da loja.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "restaurant_modules" ("id", "restaurantId", "moduleKey", "enabled", "enabledAt", "createdAt", "updatedAt")
SELECT 'default_' || "key"::TEXT, 'default_restaurant', "key", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "modules"
ON CONFLICT DO NOTHING;

INSERT INTO "production_areas" ("id", "restaurantId", "name", "key", "createdAt", "updatedAt") VALUES
('default_area_kitchen', 'default_restaurant', 'Cozinha', 'kitchen', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('default_area_drinks', 'default_restaurant', 'Drinks', 'drinks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('default_area_ready_drinks', 'default_restaurant', 'Bebidas prontas', 'ready_drinks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Add tenant fields.
ALTER TABLE "users" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "tables" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "tabs" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "orders" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "categories" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "products" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "products" ADD COLUMN "productionAreaId" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "customers" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "payments" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "kitchen_tickets" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "kitchen_tickets" ADD COLUMN "productionAreaId" TEXT;
ALTER TABLE "settings" ADD COLUMN "restaurantId" TEXT;

-- Backfill tenant fields for existing data.
UPDATE "users" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "tables" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "tabs" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "orders" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "categories" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "products" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "products" SET "productionAreaId" = 'default_area_kitchen' WHERE "productionAreaId" IS NULL;
UPDATE "stock_movements" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "customers" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "deliveries" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "payments" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "cash_registers" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "kitchen_tickets" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;
UPDATE "kitchen_tickets" SET "productionAreaId" = 'default_area_kitchen' WHERE "productionAreaId" IS NULL;
UPDATE "settings" SET "restaurantId" = 'default_restaurant' WHERE "restaurantId" IS NULL;

-- Make tenant fields required.
ALTER TABLE "users" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "tables" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "tabs" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "deliveries" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "cash_registers" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "kitchen_tickets" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "settings" ALTER COLUMN "restaurantId" SET NOT NULL;

-- Replace global unique indexes with restaurant-scoped indexes.
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "tables_number_key";
DROP INDEX IF EXISTS "tabs_code_key";
DROP INDEX IF EXISTS "categories_name_key";
DROP INDEX IF EXISTS "products_name_key";
DROP INDEX IF EXISTS "settings_key_key";

CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");
CREATE UNIQUE INDEX "restaurant_modules_restaurantId_moduleKey_key" ON "restaurant_modules"("restaurantId", "moduleKey");
CREATE UNIQUE INDEX "production_areas_restaurantId_key_key" ON "production_areas"("restaurantId", "key");
CREATE UNIQUE INDEX "users_restaurantId_email_key" ON "users"("restaurantId", "email");
CREATE UNIQUE INDEX "tables_restaurantId_number_key" ON "tables"("restaurantId", "number");
CREATE UNIQUE INDEX "tabs_restaurantId_code_key" ON "tabs"("restaurantId", "code");
CREATE UNIQUE INDEX "categories_restaurantId_name_key" ON "categories"("restaurantId", "name");
CREATE UNIQUE INDEX "products_restaurantId_name_key" ON "products"("restaurantId", "name");
CREATE UNIQUE INDEX "settings_restaurantId_key_key" ON "settings"("restaurantId", "key");

-- Add foreign keys.
ALTER TABLE "restaurant_modules" ADD CONSTRAINT "restaurant_modules_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_modules" ADD CONSTRAINT "restaurant_modules_moduleKey_fkey" FOREIGN KEY ("moduleKey") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_areas" ADD CONSTRAINT "production_areas_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_productionAreaId_fkey" FOREIGN KEY ("productionAreaId") REFERENCES "production_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_productionAreaId_fkey" FOREIGN KEY ("productionAreaId") REFERENCES "production_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
