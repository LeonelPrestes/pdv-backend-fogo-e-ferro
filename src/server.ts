import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 3333);
const host = "0.0.0.0";

const app = await buildApp();

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
