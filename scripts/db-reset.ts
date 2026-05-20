import { dbReset, stopChildProcesses } from "./dev-workflow.js";

try {
  dbReset();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
}
