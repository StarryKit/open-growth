alter table public.connector_accounts
  drop constraint if exists connector_accounts_workspace_id_user_id_platform_key;

alter table public.connector_accounts
  alter column workspace_id drop not null,
  alter column user_id drop not null,
  alter column credential_ref drop not null;

alter table public.connector_accounts
  add column if not exists identity_kind text not null default 'publishing',
  add column if not exists auth_mode text not null default 'oauth',
  add column if not exists use_cases text[] not null default array['publish','reply','engagement']::text[],
  add column if not exists owner_scope text not null default 'user',
  add column if not exists display_name text,
  add column if not exists platform_account_id text,
  add column if not exists adapter_backend text not null default 'official_api',
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.connector_accounts
  add constraint connector_accounts_identity_kind_check
  check (identity_kind in ('publishing', 'collector'));

alter table public.connector_accounts
  add constraint connector_accounts_auth_mode_check
  check (auth_mode in ('oauth', 'api_key', 'public', 'browser_profile', 'vendor'));

alter table public.connector_accounts
  add constraint connector_accounts_owner_scope_check
  check (owner_scope in ('user', 'workspace', 'system'));

alter table public.connector_accounts
  add constraint connector_accounts_adapter_backend_check
  check (adapter_backend in ('official_api', 'custom_api', 'opencli', 'vendor', 'public_api'));

alter table public.connector_accounts
  add constraint connector_accounts_publishing_owner_check
  check (
    identity_kind <> 'publishing'
    or (user_id is not null and owner_scope = 'user')
  );

alter table public.connector_accounts
  add constraint connector_accounts_collector_secret_check
  check (
    identity_kind <> 'collector'
    or auth_mode = 'public'
    or credential_ref is not null
  );

create unique index if not exists connector_accounts_user_publishing_platform_key
  on public.connector_accounts (user_id, platform)
  where identity_kind = 'publishing';

create unique index if not exists connector_accounts_workspace_collector_platform_key
  on public.connector_accounts (workspace_id, platform)
  where identity_kind = 'collector' and owner_scope = 'workspace';

create unique index if not exists connector_accounts_system_collector_platform_key
  on public.connector_accounts (platform)
  where identity_kind = 'collector' and owner_scope = 'system';

create table if not exists public.workspace_connector_accounts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connector_account_id uuid not null references public.connector_accounts(id) on delete cascade,
  enabled_by uuid not null references auth.users(id),
  enabled_at timestamptz not null default now(),
  primary key (workspace_id, connector_account_id)
);

alter table public.workspace_connector_accounts enable row level security;

drop policy if exists "connector account access" on public.connector_accounts;

create policy "connector account read" on public.connector_accounts
  for select
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
    or exists (
      select 1
      from public.workspace_connector_accounts wca
      where wca.connector_account_id = id
        and public.is_workspace_member(wca.workspace_id)
    )
  );

create policy "connector account write" on public.connector_accounts
  for all
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

create policy "workspace connector account access" on public.workspace_connector_accounts
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.platform_publish_targets
  add column if not exists connector_account_id uuid references public.connector_accounts(id);
