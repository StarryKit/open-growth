import { describe, expect, it } from "vitest";
import { resolveAuthContext } from "./auth-service.js";

describe("auth service", () => {
  it("uses local development identity when Supabase env is absent", async () => {
    const context = await resolveAuthContext({
      headers: {},
    } as never);

    expect(context).toMatchObject({
      mode: "local-dev",
      user: {
        id: "local-dev-user",
      },
    });
  });
});
