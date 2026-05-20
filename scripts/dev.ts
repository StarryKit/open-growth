import { dev, stopChildProcesses } from "./dev-workflow.js";

process.on("SIGINT", () => {
  stopChildProcesses();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopChildProcesses();
  process.exit(0);
});
process.on("exit", stopChildProcesses);

dev().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
});
