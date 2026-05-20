alter table public.content_assets
  add column if not exists kind text not null default 'image',
  add column if not exists current_storage_path text;

alter table public.content_assets
  drop constraint if exists content_assets_kind_check;

alter table public.content_assets
  add constraint content_assets_kind_check
  check (kind in ('text', 'image', 'video', 'other'));

update public.content_assets
set kind = case
  when lower(original_filename) ~ '\.(png|jpg|jpeg|gif|webp|svg)$' then 'image'
  when lower(original_filename) ~ '\.(mp4|webm)$' then 'video'
  when lower(original_filename) ~ '\.(txt|md|json)$' then 'text'
  else 'other'
end,
current_storage_path = coalesce(current_storage_path, storage_path);

create table if not exists public.content_asset_texts (
  asset_id uuid primary key references public.content_assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  body_markdown text not null default '',
  body_preview text not null default '',
  character_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_asset_image_edits (
  asset_id uuid primary key references public.content_assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  edited_storage_path text not null,
  edit_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_asset_texts enable row level security;
alter table public.content_asset_image_edits enable row level security;

drop policy if exists "content asset text access" on public.content_asset_texts;
create policy "content asset text access" on public.content_asset_texts
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "content asset image edit access" on public.content_asset_image_edits;
create policy "content asset image edit access" on public.content_asset_image_edits
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "content asset objects read" on storage.objects;
drop policy if exists "content asset objects insert" on storage.objects;
drop policy if exists "content asset objects update" on storage.objects;
drop policy if exists "content asset objects delete" on storage.objects;

create policy "content asset objects read" on storage.objects
  for select
  using (
    bucket_id = 'content-assets'
    and (
      public.is_workspace_member(split_part(name, '/', 1)::uuid)
      or public.is_workspace_member(split_part(name, '/', 2)::uuid)
    )
  );

create policy "content asset objects insert" on storage.objects
  for insert
  with check (
    bucket_id = 'content-assets'
    and (
      public.is_workspace_member(split_part(name, '/', 1)::uuid)
      or public.is_workspace_member(split_part(name, '/', 2)::uuid)
    )
  );

create policy "content asset objects update" on storage.objects
  for update
  using (
    bucket_id = 'content-assets'
    and (
      public.is_workspace_member(split_part(name, '/', 1)::uuid)
      or public.is_workspace_member(split_part(name, '/', 2)::uuid)
    )
  )
  with check (
    bucket_id = 'content-assets'
    and (
      public.is_workspace_member(split_part(name, '/', 1)::uuid)
      or public.is_workspace_member(split_part(name, '/', 2)::uuid)
    )
  );

create policy "content asset objects delete" on storage.objects
  for delete
  using (
    bucket_id = 'content-assets'
    and (
      public.is_workspace_member(split_part(name, '/', 1)::uuid)
      or public.is_workspace_member(split_part(name, '/', 2)::uuid)
    )
  );

create or replace function public.prepare_content_asset_upload(
  p_workspace_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_storage_bucket text,
  p_original_filename text,
  p_mime_type text default null,
  p_kind text default 'other'
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
    kind,
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
    p_kind,
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

  storage_path := p_user_id::text || '/' || p_workspace_id::text || '/' || p_project_id::text || '/' || asset_row.id::text || '/original/' || p_original_filename;

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

create or replace function public.complete_content_asset_upload(
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
      current_storage_path = p_storage_path,
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

create or replace function public.request_content_asset_delete_with_outbox(
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
    jsonb_build_object(
      'storagePath', asset_row.storage_path,
      'currentStoragePath', asset_row.current_storage_path
    ),
    'storage.delete:' || p_asset_id::text,
    now()
  )
  on conflict (idempotency_key) do nothing;

  return true;
end;
$$;
