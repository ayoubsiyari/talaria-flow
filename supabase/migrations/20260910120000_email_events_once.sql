-- Unique transactional send: one row per template + member + submission.
-- status records queued / sent / failed; send failure must not roll back the trigger.

alter table public.email_events
  add column if not exists member_id uuid,
  add column if not exists submission_id uuid,
  add column if not exists status text;

create unique index if not exists email_events_once_per_submission
  on public.email_events (template_id, member_id, submission_id)
  where submission_id is not null;
