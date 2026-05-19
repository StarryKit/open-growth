create table if not exists public.connector_oauth_authorizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform public.growth_platform not null,
  state text not null unique,
  code_verifier text,
  redirect_to text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.connector_oauth_authorizations enable row level security;

create policy "connector oauth authorization access"
  on public.connector_oauth_authorizations
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
