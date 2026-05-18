import { buildApp } from "./app.js";
import { startOutboxWorker, stopOutboxWorker } from "./lib/outbox-worker.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApp();
const outboxWorker = startOutboxWorker();

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`API server ready at http://${host}:${port}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    stopOutboxWorker();
    await app.close();
    process.exit(0);
  });
}

if (outboxWorker) {
  app.log.info("Outbox worker enabled.");
}
