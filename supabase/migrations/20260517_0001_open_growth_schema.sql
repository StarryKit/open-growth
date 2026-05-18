create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-assets',
  'content-assets',
  false,
  524288000,
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'text/plain',
    'text/markdown',
    'application/json'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create type public.workspace_role as enum ('owner');
create type public.content_asset_status as enum ('uploading', 'ready', 'failed', 'deleting', 'deleted');
create type public.published_content_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
create type public.platform_publish_target_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
create type public.growth_platform as enum ('x', 'reddit', 'hacker-news', 'xiaohongshu', 'wechat');
create type public.trend_post_status as enum ('new', 'saved', 'ignored', 'responded');
create type public.trend_run_status as enum ('queued', 'running', 'succeeded', 'failed');
create type public.outbox_status as enum ('pending', 'processing', 'succeeded', 'failed');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  original_filename text not null,
  title text,
  description text,
  tags text[] not null default '{}'::text[],
  source text,
  platforms public.growth_platform[] not null default '{}'::public.growth_platform[],
  status public.content_asset_status not null default 'uploading',
  usage_count integer not null default 0,
  preview text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.published_contents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  body text not null,
  asset_ids uuid[] not null default '{}'::uuid[],
  source_trend_post_id uuid,
  status public.published_content_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_publish_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  published_content_id uuid not null references public.published_contents(id) on delete cascade,
  platform public.growth_platform not null,
  status public.platform_publish_target_status not null default 'draft',
  body_override text,
  scheduled_at timestamptz,
  published_at timestamptz,
  platform_content_id text,
  platform_url text,
  last_error text,
  retry_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.engagement_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  published_content_id uuid not null references public.published_contents(id) on delete cascade,
  platform_target_id uuid not null references public.platform_publish_targets(id) on delete cascade,
  platform public.growth_platform not null,
  platform_content_id text,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb,
  platform_metrics jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  error text
);

create table public.trend_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  keywords text[] not null default '{}'::text[],
  excluded_keywords text[] not null default '{}'::text[],
  platforms public.growth_platform[] not null default '{}'::public.growth_platform[],
  language text,
  time_range text not null default '7d',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trend_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  trend_query_id uuid not null references public.trend_queries(id) on delete cascade,
  status public.trend_run_status not null default 'queued',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  platforms public.growth_platform[] not null default '{}'::public.growth_platform[],
  result_count integer not null default 0,
  error_summary text[]
);

create table public.trend_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  trend_query_id uuid not null references public.trend_queries(id) on delete cascade,
  trend_run_id uuid not null references public.trend_runs(id) on delete cascade,
  platform public.growth_platform not null,
  platform_post_id text not null,
  url text not null,
  title text not null,
  summary text not null,
  author text not null,
  posted_at timestamptz not null,
  captured_at timestamptz not null default now(),
  matched_keywords text[] not null default '{}'::text[],
  metrics jsonb not null default '{}'::jsonb,
  relevance_score numeric not null default 0,
  status public.trend_post_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_post_id)
);

create table public.connector_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform public.growth_platform not null,
  status text not null default 'active',
  credential_ref text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, platform)
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.content_assets enable row level security;
alter table public.published_contents enable row level security;
alter table public.platform_publish_targets enable row level security;
alter table public.engagement_snapshots enable row level security;
alter table public.trend_queries enable row level security;
alter table public.trend_runs enable row level security;
alter table public.trend_posts enable row level security;
alter table public.connector_accounts enable row level security;
alter table public.outbox_events enable row level security;

create function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create policy "profiles self access" on public.profiles
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "workspace members read" on public.workspace_members
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy "workspace access" on public.workspaces
  using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));

create policy "project access" on public.projects
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "content asset access" on public.content_assets
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "published content access" on public.published_contents
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "platform target access" on public.platform_publish_targets
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "engagement access" on public.engagement_snapshots
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "trend query access" on public.trend_queries
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "trend run access" on public.trend_runs
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "trend post access" on public.trend_posts
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "connector account access" on public.connector_accounts
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "outbox access" on public.outbox_events
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "content asset objects read" on storage.objects
  for select
  using (
    bucket_id = 'content-assets'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

create policy "content asset objects insert" on storage.objects
  for insert
  with check (
    bucket_id = 'content-assets'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

create policy "content asset objects update" on storage.objects
  for update
  using (
    bucket_id = 'content-assets'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'content-assets'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

create policy "content asset objects delete" on storage.objects
  for delete
  using (
    bucket_id = 'content-assets'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

create function public.prepare_content_asset_upload(
  p_workspace_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_storage_bucket text,
  p_original_filename text,
  p_mime_type text default null
)
returns jsonb
language plpgsql
as $$
declare
  asset_row public.content_assets%rowtype;
  storage_path text;
begin
  if not exists (
    select 1
    from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = p_project_id
      and p.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  ) then
    raise exception 'Project is not accessible';
  end if;

  insert into public.content_assets (
    workspace_id,
    project_id,
    storage_bucket,
    mime_type,
    original_filename,
    title,
    source,
    platforms,
    status,
    created_by
  )
  values (
    p_workspace_id,
    p_project_id,
    p_storage_bucket,
    p_mime_type,
    p_original_filename,
    p_original_filename,
    'upload',
    array['x','reddit','hacker-news']::public.growth_platform[],
    'uploading',
    p_user_id
  )
  returning * into asset_row;

  storage_path := p_workspace_id::text || '/' || p_project_id::text || '/' || asset_row.id::text || '/' || p_original_filename;

  return jsonb_build_object(
    'assetId', asset_row.id,
    'workspaceId', p_workspace_id,
    'projectId', p_project_id,
    'filename', p_original_filename,
    'storageBucket', p_storage_bucket,
    'storagePath', storage_path
  );
end;
$$;

create function public.complete_content_asset_upload(
  p_workspace_id uuid,
  p_project_id uuid,
  p_asset_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_byte_size bigint,
  p_mime_type text,
  p_sha256 text,
  p_preview text default null
)
returns jsonb
language plpgsql
as $$
declare
  asset_row public.content_assets%rowtype;
begin
  update public.content_assets
  set storage_bucket = p_storage_bucket,
      storage_path = p_storage_path,
      byte_size = p_byte_size,
      mime_type = p_mime_type,
      sha256 = p_sha256,
      preview = p_preview,
      status = 'ready',
      updated_at = now()
  where id = p_asset_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  returning * into asset_row;

  if asset_row.id is null then
    return null;
  end if;

  return to_jsonb(asset_row);
end;
$$;

create function public.mark_content_asset_upload_failed(
  p_workspace_id uuid,
  p_project_id uuid,
  p_asset_id uuid
)
returns boolean
language plpgsql
as $$
begin
  update public.content_assets
  set status = 'failed',
      updated_at = now()
  where id = p_asset_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id;

  return found;
end;
$$;

create function public.request_content_asset_delete_with_outbox(
  p_workspace_id uuid,
  p_project_id uuid,
  p_asset_id uuid
)
returns boolean
language plpgsql
as $$
declare
  asset_row public.content_assets%rowtype;
begin
  update public.content_assets
  set status = 'deleting',
      updated_at = now()
  where id = p_asset_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  returning * into asset_row;

  if asset_row.id is null then
    return false;
  end if;

  insert into public.outbox_events (
    workspace_id,
    project_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key,
    available_at
  )
  values (
    p_workspace_id,
    p_project_id,
    'storage.delete',
    'content_asset',
    p_asset_id,
    jsonb_build_object('storagePath', asset_row.storage_path),
    'storage.delete:' || p_asset_id::text,
    now()
  )
  on conflict (idempotency_key) do nothing;

  return true;
end;
$$;

create function public.create_published_content_with_targets(
  p_workspace_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_asset_ids uuid[] default '{}'::uuid[],
  p_source_trend_post_id uuid default null,
  p_platforms public.growth_platform[] default array['x','reddit','wechat']::public.growth_platform[]
)
returns jsonb
language plpgsql
as $$
declare
  content_row public.published_contents%rowtype;
  targets_json jsonb;
begin
  if not exists (
    select 1
    from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = p_project_id
      and p.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  ) then
    raise exception 'Project is not accessible';
  end if;

  insert into public.published_contents (
    workspace_id,
    project_id,
    title,
    body,
    asset_ids,
    source_trend_post_id,
    status,
    created_by
  )
  values (
    p_workspace_id,
    p_project_id,
    p_title,
    p_body,
    coalesce(p_asset_ids, '{}'::uuid[]),
    p_source_trend_post_id,
    'draft',
    p_user_id
  )
  returning * into content_row;

  insert into public.platform_publish_targets (
    workspace_id,
    project_id,
    published_content_id,
    platform,
    status,
    body_override
  )
  select
    p_workspace_id,
    p_project_id,
    content_row.id,
    platform,
    'draft',
    p_body
  from unnest(coalesce(p_platforms, array['x','reddit','wechat']::public.growth_platform[])) as platform;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at), '[]'::jsonb)
  into targets_json
  from public.platform_publish_targets t
  where t.published_content_id = content_row.id;

  return jsonb_build_object(
    'content',
    to_jsonb(content_row),
    'targets',
    targets_json
  );
end;
$$;

create function public.schedule_published_content_with_outbox(
  p_workspace_id uuid,
  p_project_id uuid,
  p_content_id uuid,
  p_scheduled_at timestamptz
)
returns jsonb
language plpgsql
as $$
declare
  content_row public.published_contents%rowtype;
  targets_json jsonb;
begin
  update public.published_contents
  set status = 'scheduled',
      updated_at = now()
  where id = p_content_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  returning * into content_row;

  if content_row.id is null then
    return null;
  end if;

  update public.platform_publish_targets
  set status = 'scheduled',
      scheduled_at = p_scheduled_at,
      updated_at = now()
  where workspace_id = p_workspace_id
    and project_id = p_project_id
    and published_content_id = p_content_id;

  insert into public.outbox_events (
    workspace_id,
    project_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key,
    available_at
  )
  values (
    p_workspace_id,
    p_project_id,
    'publish.schedule',
    'published_content',
    p_content_id,
    jsonb_build_object('scheduledAt', p_scheduled_at),
    'publish.schedule:' || p_content_id::text || ':' || p_scheduled_at::text,
    p_scheduled_at
  )
  on conflict (idempotency_key) do nothing;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at), '[]'::jsonb)
  into targets_json
  from public.platform_publish_targets t
  where t.published_content_id = p_content_id;

  return jsonb_build_object('content', to_jsonb(content_row), 'targets', targets_json);
end;
$$;

create function public.request_publish_content_with_outbox(
  p_workspace_id uuid,
  p_project_id uuid,
  p_content_id uuid,
  p_event_type text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
as $$
declare
  content_row public.published_contents%rowtype;
  targets_json jsonb;
begin
  update public.published_contents
  set status = 'publishing',
      updated_at = now()
  where id = p_content_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  returning * into content_row;

  if content_row.id is null then
    return null;
  end if;

  update public.platform_publish_targets
  set status = 'publishing',
      retry_count = case when p_event_type = 'publish.retry' then retry_count + 1 else retry_count end,
      updated_at = now()
  where workspace_id = p_workspace_id
    and project_id = p_project_id
    and published_content_id = p_content_id
    and (p_event_type <> 'publish.retry' or status = 'failed');

  insert into public.outbox_events (
    workspace_id,
    project_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key,
    available_at
  )
  values (
    p_workspace_id,
    p_project_id,
    p_event_type,
    'published_content',
    p_content_id,
    jsonb_build_object('requestedAt', now()),
    p_idempotency_key,
    now()
  )
  on conflict (idempotency_key) do nothing;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at), '[]'::jsonb)
  into targets_json
  from public.platform_publish_targets t
  where t.published_content_id = p_content_id;

  return jsonb_build_object('content', to_jsonb(content_row), 'targets', targets_json);
end;
$$;

create function public.create_trend_run_with_outbox(
  p_workspace_id uuid,
  p_project_id uuid,
  p_query_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  query_row public.trend_queries%rowtype;
  run_row public.trend_runs%rowtype;
begin
  select *
  into query_row
  from public.trend_queries
  where id = p_query_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id;

  if query_row.id is null then
    return null;
  end if;

  insert into public.trend_runs (
    workspace_id,
    project_id,
    trend_query_id,
    status,
    platforms,
    result_count
  )
  values (
    p_workspace_id,
    p_project_id,
    query_row.id,
    'running',
    query_row.platforms,
    0
  )
  returning * into run_row;

  insert into public.outbox_events (
    workspace_id,
    project_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  )
  values (
    p_workspace_id,
    p_project_id,
    'trends.run',
    'trend_run',
    run_row.id,
    jsonb_build_object('queryId', query_row.id, 'platforms', query_row.platforms),
    'trends.run:' || run_row.id::text
  )
  on conflict (idempotency_key) do nothing;

  return to_jsonb(run_row);
end;
$$;

create function public.create_response_draft_from_trend_post(
  p_workspace_id uuid,
  p_project_id uuid,
  p_post_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  post_row public.trend_posts%rowtype;
  draft_result jsonb;
begin
  update public.trend_posts
  set status = 'responded',
      updated_at = now()
  where id = p_post_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id
  returning * into post_row;

  if post_row.id is null then
    return null;
  end if;

  draft_result := public.create_published_content_with_targets(
    p_workspace_id,
    p_project_id,
    p_user_id,
    'Response: ' || post_row.title,
    'Reply to ' || post_row.platform::text || ' post ' || post_row.url || E'\n\n' || post_row.summary,
    '{}'::uuid[],
    post_row.id,
    array[post_row.platform]::public.growth_platform[]
  );

  return jsonb_build_object(
    'post',
    to_jsonb(post_row),
    'draft',
    draft_result->'content',
    'targets',
    draft_result->'targets'
  );
end;
$$;
