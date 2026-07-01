import cors from "@fastify/cors";
import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { registerBusinessModules } from "./modules/index.js";

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

  await registerBusinessModules(app);

  return app;
}
