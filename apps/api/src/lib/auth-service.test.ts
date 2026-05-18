import { describe, expect, it } from "vitest";
import { resolveAuthContext } from "./auth-service.js";

describe("auth service", () => {
  it("fails when Supabase env is absent", async () => {
    await expect(
      resolveAuthContext({
        headers: {},
      } as never),
    ).rejects.toThrow("Supabase API credentials are not configured.");
  });
});
