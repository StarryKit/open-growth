create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    user_id,
    display_name,
    avatar_url
  )
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'display_name',
        split_part(new.email, '@', 1)
      ),
      ''
    ),
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      ),
      ''
    )
  )
  on conflict (user_id) do update
  set display_name = coalesce(excluded.display_name, public.profiles.display_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_synced on auth.users;

create trigger on_auth_user_profile_synced
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth_user();

insert into public.profiles (
  user_id,
  display_name,
  avatar_url
)
select
  users.id,
  nullif(
    coalesce(
      users.raw_user_meta_data ->> 'full_name',
      users.raw_user_meta_data ->> 'name',
      users.raw_user_meta_data ->> 'display_name',
      split_part(users.email, '@', 1)
    ),
    ''
  ),
  nullif(
    coalesce(
      users.raw_user_meta_data ->> 'avatar_url',
      users.raw_user_meta_data ->> 'picture'
    ),
    ''
  )
from auth.users
on conflict (user_id) do update
set display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
