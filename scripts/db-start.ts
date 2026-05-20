import { dbStart, stopChildProcesses } from "./dev-workflow.js";

try {
  dbStart();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
}
