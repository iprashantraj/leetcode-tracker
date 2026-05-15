-- Phase 5 — attach events to attempts for the per-attempt timeline UI,
-- and schedule automatic cleanup of events older than 90 days.
-- Safe to re-run.

-- Schema: link events to attempts.
alter table events add column if not exists attempt_id uuid references attempts(id) on delete set null;
create index if not exists events_attempt_idx on events(attempt_id, occurred_at);

-- New verdict-flavored event types.
do $$ begin
  alter type event_type add value if not exists 'run_accepted';
exception when others then null; end $$;
do $$ begin
  alter type event_type add value if not exists 'run_rejected';
exception when others then null; end $$;

-- Auto-cleanup: events older than 90 days get deleted nightly at 03:00 UTC.
-- Keeps storage roughly constant at ~110 MB even for 50 heavy users.
create extension if not exists pg_cron;

-- Drop previous schedule of this name if it exists (idempotent re-run).
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'cleanup-old-events' loop
    perform cron.unschedule(jid);
  end loop;
end $$;

select cron.schedule(
  'cleanup-old-events',
  '0 3 * * *',
  $$ delete from events where occurred_at < now() - interval '90 days' $$
);
