drop function if exists public.upsert_oauth_app_config(
  public.growth_platform,
  text,
  text,
  text,
  text,
  uuid
);

drop function if exists public.upsert_oauth_app_config(
  public.growth_platform,
  text,
  text,
  uuid
);

drop function if exists public.get_oauth_app_config(public.growth_platform);

alter table public.oauth_app_configs
  drop column if exists public_base_url,
  drop column if exists redirect_base_url;

create or replace function public.get_oauth_app_config(
  p_platform public.growth_platform
)
returns table (
  platform public.growth_platform,
  client_id text,
  has_client_secret boolean,
  updated_at timestamptz,
  client_secret text
)
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select
    c.platform,
    c.client_id,
    c.client_secret_id is not null as has_client_secret,
    c.updated_at,
    s.decrypted_secret as client_secret
  from public.oauth_app_configs c
  left join vault.decrypted_secrets s on s.id = c.client_secret_id
  where c.platform = p_platform;
$$;

create or replace function public.upsert_oauth_app_config(
  p_platform public.growth_platform,
  p_client_id text,
  p_client_secret text,
  p_user_id uuid default null
)
returns table (
  platform public.growth_platform,
  client_id text,
  has_client_secret boolean,
  updated_at timestamptz,
  client_secret text
)
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  existing public.oauth_app_configs%rowtype;
  secret_id uuid;
  secret_name text := 'open-growth/oauth-app/' || p_platform::text;
begin
  if p_platform not in ('x', 'reddit') then
    raise exception 'OAuth app platform is not supported.';
  end if;

  if nullif(trim(p_client_id), '') is null or nullif(trim(p_client_secret), '') is null then
    raise exception 'Client ID and client secret are required.';
  end if;

  select * into existing
  from public.oauth_app_configs c
  where c.platform = p_platform;

  if existing.client_secret_id is null then
    select vault.create_secret(
      p_client_secret,
      secret_name,
      'Open Growth OAuth app secret for ' || p_platform::text
    ) into secret_id;
  else
    secret_id := existing.client_secret_id;
    perform vault.update_secret(
      secret_id,
      p_client_secret,
      secret_name,
      'Open Growth OAuth app secret for ' || p_platform::text
    );
  end if;

  insert into public.oauth_app_configs (
    platform,
    client_id,
    client_secret_id,
    created_by,
    updated_by,
    updated_at
  )
  values (
    p_platform,
    trim(p_client_id),
    secret_id,
    p_user_id,
    p_user_id,
    now()
  )
  on conflict (platform) do update set
    client_id = excluded.client_id,
    client_secret_id = excluded.client_secret_id,
    updated_by = excluded.updated_by,
    updated_at = now();

  return query
    select *
    from public.get_oauth_app_config(p_platform);
end;
$$;

create table if not exists public.deployment_settings (
  id integer primary key default 1,
  public_base_url text not null default 'http://localhost:5173',
  redirect_base_url text not null default 'http://localhost:3001',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.deployment_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.get_deployment_settings()
returns table (
  public_base_url text,
  redirect_base_url text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    public_base_url,
    redirect_base_url,
    updated_at
  from public.deployment_settings
  where id = 1;
$$;

create or replace function public.upsert_deployment_settings(
  p_public_base_url text default null,
  p_redirect_base_url text default null,
  p_user_id uuid default null
)
returns table (
  public_base_url text,
  redirect_base_url text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.deployment_settings
  set
    public_base_url = coalesce(nullif(trim(p_public_base_url), ''), public_base_url),
    redirect_base_url = coalesce(nullif(trim(p_redirect_base_url), ''), redirect_base_url),
    updated_by = p_user_id,
    updated_at = now()
  where id = 1;

  return query
    select
      public_base_url,
      redirect_base_url,
      updated_at
    from public.deployment_settings
    where id = 1;
end;
$$;

revoke all on table public.deployment_settings from anon, authenticated;
revoke all on function public.upsert_oauth_app_config(public.growth_platform, text, text, uuid) from anon, authenticated;
revoke all on function public.get_deployment_settings() from anon, authenticated;
revoke all on function public.upsert_deployment_settings(text, text, uuid) from anon, authenticated;
grant execute on function public.upsert_oauth_app_config(public.growth_platform, text, text, uuid) to service_role;
grant execute on function public.get_deployment_settings() to service_role;
grant execute on function public.upsert_deployment_settings(text, text, uuid) to service_role;
