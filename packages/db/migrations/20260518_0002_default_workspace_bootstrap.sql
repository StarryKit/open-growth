create function public.ensure_default_workspace(
  p_user_id uuid,
  p_workspace_name text default 'Open Growth',
  p_project_name text default 'Launch Lab'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_row public.workspaces%rowtype;
  project_row public.projects%rowtype;
begin
  select w.*
  into workspace_row
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = p_user_id
  order by w.created_at asc
  limit 1;

  if workspace_row.id is null then
    insert into public.workspaces (name, created_by)
    values (p_workspace_name, p_user_id)
    returning * into workspace_row;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (workspace_row.id, p_user_id, 'owner')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  select p.*
  into project_row
  from public.projects p
  where p.workspace_id = workspace_row.id
  order by p.created_at asc
  limit 1;

  if project_row.id is null then
    insert into public.projects (
      workspace_id,
      name,
      description,
      created_by
    )
    values (
      workspace_row.id,
      p_project_name,
      'Default project for development',
      p_user_id
    )
    returning * into project_row;
  end if;

  return jsonb_build_object(
    'workspaceId', workspace_row.id,
    'projectId', project_row.id,
    'userId', p_user_id
  );
end;
$$;
