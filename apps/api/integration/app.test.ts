import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("api app", () => {
  it("returns health status", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });

  it("requires Supabase auth for protected workspace APIs", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Supabase API credentials are not configured.",
    });
    await app.close();
  });

  it("protects content repository write APIs", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/content-assets/text-snippets",
      payload: { title: "Untitled snippet", body: "" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Supabase API credentials are not configured.",
    });
    await app.close();
  });
});
