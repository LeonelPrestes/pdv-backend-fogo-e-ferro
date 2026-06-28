-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLOSING');

-- CreateEnum
CREATE TYPE "TabStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'CANCELED', 'ON_CREDIT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('WAITING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRADA', 'SAIDA_VENDA', 'AJUSTE_MANUAL', 'CANCELAMENTO', 'PERDA', 'DEVOLUCAO');

-- CreateEnum
CREATE TYPE "CashRegisterStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('OPENING', 'SALE', 'CASH_IN', 'CASH_OUT', 'CLOSING');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MONEY', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'ON_CREDIT', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'WAITER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerName" TEXT,
    "status" "TabStatus" NOT NULL DEFAULT 'OPEN',
    "serviceFeeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "serviceFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "tableId" TEXT,
    "transferredFromTabId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "sequentialNumber" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "isDelivery" BOOLEAN NOT NULL DEFAULT false,
    "tabId" TEXT,
    "sentToKitchenAt" TIMESTAMP(3),
    "startedPreparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currentStock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "reason" TEXT,
    "orderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'WAITING',
    "feeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tabId" TEXT,
    "cashRegisterId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingAmount" DECIMAL(10,2) NOT NULL,
    "closingAmount" DECIMAL(10,2),
    "expectedAmount" DECIMAL(10,2),
    "differenceAmount" DECIMAL(10,2),
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_tickets" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'SENT_TO_KITCHEN',
    "notes" TEXT,
    "sentToKitchenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedPreparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tables_number_key" ON "tables"("number");

-- CreateIndex
CREATE UNIQUE INDEX "tabs_code_key" ON "tabs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_tickets_orderId_key" ON "kitchen_tickets"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "customer_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
