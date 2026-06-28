import cors from "@fastify/cors";
import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cashRegisterRoutes } from "./modules/cash-register/cash-register.routes.js";
import { kitchenRoutes } from "./modules/kitchen/kitchen.routes.js";
import { moduleRoutes } from "./modules/modules/module.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { productRoutes } from "./modules/products/product.routes.js";
import { tableRoutes } from "./modules/tables/table.routes.js";
import { tabRoutes } from "./modules/tabs/tab.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "pdv-restaurante"
  }));

  app.get("/", async (_request, reply) => {
    const html = await readFile(join(process.cwd(), "public", "index.html"), "utf8");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/styles.css", async (_request, reply) => {
    const css = await readFile(join(process.cwd(), "public", "styles.css"), "utf8");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/frontend.js", async (_request, reply) => {
    const script = await readFile(join(process.cwd(), "public", "frontend.js"), "utf8");
    return reply.type("application/javascript; charset=utf-8").send(script);
  });

  await app.register(tableRoutes);
  await app.register(moduleRoutes);
  await app.register(tabRoutes);
  await app.register(orderRoutes);
  await app.register(kitchenRoutes);
  await app.register(productRoutes);
  await app.register(paymentRoutes);
  await app.register(cashRegisterRoutes);

  return app;
}
