-- =====================================================================
-- Phase 4 — Friends (search by username + bidirectional friendship guard)
-- Safe to re-run. Paste into Supabase SQL Editor → Run.
-- =====================================================================

-- ---------- Relax profiles read so username search works ----------
-- Any authenticated user can read profile rows (only basic public-ish columns
-- exist anyway). Attempt/event privacy is still enforced by their own RLS.
drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles read basic" on profiles;
create policy "profiles read basic" on profiles for select
  using (auth.uid() is not null);

-- ---------- Prevent reverse-direction duplicate friendships ----------
-- The unique (requester_id, addressee_id) constraint blocks A→B twice,
-- but doesn't prevent both A→B and B→A existing. This trigger covers that.
create or replace function check_friendship_uniqueness() returns trigger
  language plpgsql
as $$
begin
  if exists (
    select 1 from friendships
    where requester_id = new.addressee_id
      and addressee_id = new.requester_id
  ) then
    raise exception 'A friendship row already exists in the opposite direction'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_uniqueness on friendships;
create trigger friendships_uniqueness
  before insert on friendships
  for each row execute function check_friendship_uniqueness();
