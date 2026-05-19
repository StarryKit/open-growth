import { afterEach, describe, expect, it } from "vitest";
import { isAdminUserId, resolveAuthContext } from "./auth-service.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("auth service", () => {
  it("fails when Supabase env is absent", async () => {
    await expect(
      resolveAuthContext({
        headers: {},
      } as never),
    ).rejects.toThrow("Supabase API credentials are not configured.");
  });

  it("resolves admin users from the env allowlist", () => {
    process.env.OPEN_GROWTH_ADMIN_USER_IDS = "user-1, user-2";

    expect(isAdminUserId("user-1")).toBe(true);
    expect(isAdminUserId("user-3")).toBe(false);
  });
});
