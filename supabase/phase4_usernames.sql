-- Use the email prefix as the default username so users are searchable.
-- Backfills existing profiles whose username is the auto-generated "user_<hex>"
-- and updates the signup trigger.

update profiles p
set
  username = split_part(au.email, '@', 1),
  display_name = case
    when p.display_name like 'user\_%' or p.display_name is null
      then split_part(au.email, '@', 1)
    else p.display_name
  end
from auth.users au
where p.id = au.id
  and (p.username like 'user\_%' or p.username is null);

create or replace function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  base_username text := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  candidate text := base_username;
  suffix int := 0;
begin
  while exists (select 1 from profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '_' || suffix;
  end loop;

  insert into profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'display_name', candidate))
  on conflict (id) do nothing;
  return new;
end;
$$;
