import { initWorktree, stopChildProcesses } from "./dev-workflow.js";

initWorktree().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildProcesses();
  process.exit(1);
});
