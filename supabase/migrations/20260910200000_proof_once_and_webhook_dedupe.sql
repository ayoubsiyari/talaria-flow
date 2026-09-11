-- One pending submission per member; webhook events unique per provider + type.
-- Abandoned incoming uploads are swept by api/cron/purge-proofs (src/lib/server/purge.ts).

create unique index if not exists submissions_one_submitted_per_user
  on public.submissions (user_id)
  where status = 'submitted';

create unique index if not exists email_events_once_per_provider_event
  on public.email_events (provider_id, event)
  where provider_id is not null;
