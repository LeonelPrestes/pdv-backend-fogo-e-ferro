import type { FastifyInstance } from "fastify";
import { cashRegisterRoutes } from "./cash-register/cash-register.routes.js";
import { kitchenRoutes } from "./kitchen/kitchen.routes.js";
import { moduleRoutes } from "./modules/module.routes.js";
import { orderRoutes } from "./orders/order.routes.js";
import { paymentRoutes } from "./payments/payment.routes.js";
import { productRoutes } from "./products/product.routes.js";
import { stockRoutes } from "./stock/stock.routes.js";
import { tableRoutes } from "./tables/table.routes.js";
import { tabRoutes } from "./tabs/tab.routes.js";

const businessModules = [
  tableRoutes,
  moduleRoutes,
  tabRoutes,
  orderRoutes,
  kitchenRoutes,
  productRoutes,
  stockRoutes,
  paymentRoutes,
  cashRegisterRoutes
];

export async function registerBusinessModules(app: FastifyInstance) {
  for (const registerRoutes of businessModules) {
    await app.register(registerRoutes);
  }
}
