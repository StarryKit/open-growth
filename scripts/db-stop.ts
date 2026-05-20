import { dbStop, stopChildProcesses } from "./dev-workflow.js";

try {
  dbStop();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
}
