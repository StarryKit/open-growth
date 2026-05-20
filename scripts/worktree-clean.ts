import { cleanWorktree, stopChildProcesses } from "./dev-workflow.js";

try {
  cleanWorktree();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
}
