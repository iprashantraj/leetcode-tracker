-- =====================================================================
-- LeetCode Tracker — schema, helper functions, RLS policies, triggers.
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================

-- ---------- enums ----------
do $$ begin
  create type privacy_level as enum ('public', 'friends', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type problem_difficulty as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum (
    'open', 'close', 'focus', 'blur', 'active', 'inactive',
    'run', 'submit', 'submit_accepted', 'submit_rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending', 'accepted', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type group_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  leetcode_username text,
  privacy_level privacy_level not null default 'friends',
  created_at timestamptz not null default now()
);

-- ---------- problems (enrichment catalogue) ----------
create table if not exists problems (
  slug text primary key,
  title text not null,
  difficulty problem_difficulty,
  topics text[] not null default '{}',
  is_premium boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists problems_topics_idx on problems using gin (topics);

-- ---------- attempts ----------
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  problem_slug text not null,
  problem_title text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  active_seconds integer not null default 0,
  run_count integer not null default 0,
  submit_count integer not null default 0,
  solved boolean not null default false,
  solved_at timestamptz,
  language text,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_started_idx on attempts(user_id, started_at desc);
create index if not exists attempts_user_problem_idx on attempts(user_id, problem_slug);
create index if not exists attempts_user_solved_idx on attempts(user_id, solved_at desc) where solved;

-- ---------- events (raw activity log) ----------
create table if not exists events (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  problem_slug text not null,
  event_type event_type not null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists events_user_time_idx on events(user_id, occurred_at desc);

-- ---------- friendships ----------
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friendships_requester_idx on friendships(requester_id);
create index if not exists friendships_addressee_idx on friendships(addressee_id);

-- ---------- groups ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references profiles(id) on delete cascade,
  is_public boolean not null default false,
  invite_code text unique not null default encode(gen_random_bytes(8), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on group_members(user_id);

-- =====================================================================
-- HELPER FUNCTIONS (security definer so they bypass RLS for the lookup)
-- =====================================================================

create or replace function is_friend(other uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = other)
        or (addressee_id = auth.uid() and requester_id = other))
  );
$$;

create or replace function is_group_member(gid uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function shares_group(other uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Auto-create a profile row when a user signs up via Supabase Auth.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  base_username text := coalesce(
    new.raw_user_meta_data->>'username',
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
begin
  insert into profiles (id, username, display_name)
  values (new.id, base_username, coalesce(new.raw_user_meta_data->>'display_name', base_username))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table profiles       enable row level security;
alter table problems       enable row level security;
alter table attempts       enable row level security;
alter table events         enable row level security;
alter table friendships    enable row level security;
alter table groups         enable row level security;
alter table group_members  enable row level security;

-- profiles
drop policy if exists "profiles read"   on profiles;
drop policy if exists "profiles insert" on profiles;
drop policy if exists "profiles update" on profiles;
create policy "profiles read" on profiles for select using (
  id = auth.uid()
  or privacy_level = 'public'
  or (privacy_level = 'friends' and (is_friend(id) or shares_group(id)))
);
create policy "profiles insert" on profiles for insert with check (id = auth.uid());
create policy "profiles update" on profiles for update using (id = auth.uid());

-- problems (catalog readable by everyone, writable by authenticated users)
drop policy if exists "problems read"   on problems;
drop policy if exists "problems insert" on problems;
drop policy if exists "problems update" on problems;
create policy "problems read"   on problems for select using (true);
create policy "problems insert" on problems for insert with check (auth.uid() is not null);
create policy "problems update" on problems for update using (auth.uid() is not null);

-- attempts
drop policy if exists "attempts read"   on attempts;
drop policy if exists "attempts insert" on attempts;
drop policy if exists "attempts update" on attempts;
drop policy if exists "attempts delete" on attempts;
create policy "attempts read" on attempts for select using (
  user_id = auth.uid()
  or exists (
    select 1 from profiles p
    where p.id = attempts.user_id
      and (
        p.privacy_level = 'public'
        or (p.privacy_level = 'friends' and (is_friend(p.id) or shares_group(p.id)))
      )
  )
);
create policy "attempts insert" on attempts for insert with check (user_id = auth.uid());
create policy "attempts update" on attempts for update using (user_id = auth.uid());
create policy "attempts delete" on attempts for delete using (user_id = auth.uid());

-- events (private — only the owner ever reads them)
drop policy if exists "events read"   on events;
drop policy if exists "events insert" on events;
drop policy if exists "events delete" on events;
create policy "events read"   on events for select using (user_id = auth.uid());
create policy "events insert" on events for insert with check (user_id = auth.uid());
create policy "events delete" on events for delete using (user_id = auth.uid());

-- friendships
drop policy if exists "friendships read"    on friendships;
drop policy if exists "friendships insert"  on friendships;
drop policy if exists "friendships update"  on friendships;
drop policy if exists "friendships delete"  on friendships;
create policy "friendships read" on friendships for select using (
  requester_id = auth.uid() or addressee_id = auth.uid()
);
create policy "friendships insert" on friendships for insert
  with check (requester_id = auth.uid() and requester_id <> addressee_id);
create policy "friendships update" on friendships for update
  using (addressee_id = auth.uid());
create policy "friendships delete" on friendships for delete using (
  requester_id = auth.uid() or addressee_id = auth.uid()
);

-- groups
drop policy if exists "groups read"   on groups;
drop policy if exists "groups insert" on groups;
drop policy if exists "groups update" on groups;
drop policy if exists "groups delete" on groups;
create policy "groups read" on groups for select using (
  is_public = true or is_group_member(id)
);
create policy "groups insert" on groups for insert with check (owner_id = auth.uid());
create policy "groups update" on groups for update using (owner_id = auth.uid());
create policy "groups delete" on groups for delete using (owner_id = auth.uid());

-- group_members
drop policy if exists "group_members read"   on group_members;
drop policy if exists "group_members insert" on group_members;
drop policy if exists "group_members delete" on group_members;
create policy "group_members read" on group_members for select using (
  is_group_member(group_id)
  or exists (select 1 from groups g where g.id = group_members.group_id and g.is_public)
);
create policy "group_members insert" on group_members for insert
  with check (user_id = auth.uid());
create policy "group_members delete" on group_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from groups g where g.id = group_members.group_id and g.owner_id = auth.uid())
);
