import { dbStatus, stopChildProcesses } from "./dev-workflow.js";

try {
  dbStatus();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
}
