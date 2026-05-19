import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve("supabase/migrations");

function migration(filename: string) {
  return readFileSync(path.join(migrationsDir, filename), "utf8");
}

describe("Supabase RPC migration contract", () => {
  it("defines deployment settings RPCs with the signatures used by the app", () => {
    const sql = migration("20260519070000_deployment_settings.sql");

    expect(sql).toContain(
      "create or replace function public.get_deployment_settings()",
    );
    expect(sql).toContain(
      "create or replace function public.upsert_deployment_settings(",
    );
    expect(sql).toContain("p_public_base_url text default null");
    expect(sql).toContain("p_redirect_base_url text default null");
    expect(sql).toContain("p_user_id uuid default null");
    expect(sql).toContain(
      "grant execute on function public.get_deployment_settings() to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.upsert_deployment_settings(text, text, uuid) to service_role",
    );
  });

  it("defines OAuth app config RPCs with the signatures used by the app", () => {
    const sql = [
      migration("20260519060000_oauth_app_config_vault.sql"),
      migration("20260519070000_deployment_settings.sql"),
    ].join("\n");

    expect(sql).toContain(
      "create or replace function public.get_oauth_app_config(",
    );
    expect(sql).toContain("p_platform public.growth_platform");
    expect(sql).toContain(
      "create or replace function public.upsert_oauth_app_config(",
    );
    expect(sql).toContain("p_client_id text");
    expect(sql).toContain("p_client_secret text");
    expect(sql).toContain("p_user_id uuid default null");
    expect(sql).toContain(
      "grant execute on function public.get_oauth_app_config(public.growth_platform) to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.upsert_oauth_app_config(public.growth_platform, text, text, uuid) to service_role",
    );
  });

  it("reloads the PostgREST schema cache after RPC migrations", () => {
    const sql = migration("20260519080000_reload_postgrest_schema.sql");

    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
