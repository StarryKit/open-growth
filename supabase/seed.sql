insert into public.workspaces (id, name, created_by)
values ('00000000-0000-0000-0000-000000000001', 'Open Growth', '00000000-0000-0000-0000-000000000001');

insert into public.workspace_members (workspace_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner');

insert into public.projects (id, workspace_id, name, description, created_by)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Launch Lab', 'Default project for local development', '00000000-0000-0000-0000-000000000001');

