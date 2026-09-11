-- =====================================================================
-- Talaria Flow — release fixes (2026-09-10)
--   * waitlist: plain unique constraint on email (api/waitlist upserts with on conflict (email);
--     the previous expression index on lower(email) could not back that clause)
--   * email_events: campaign link (send_id), FKs, status check, idempotency per send + recipient
--   * email_sends: campaign parameters the server needs to (re)run a send
--   * activity_log: members read their own rows
--   * decisions and campaigns are written by api/* with the service role only; the browser policies
--     that allowed admins to write them directly are removed (select stays)
-- =====================================================================

-- ---------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------
update public.waitlist set email = lower(email) where email <> lower(email);

-- de-duplicate again in case mixed-case duplicates existed before the normalisation
delete from public.waitlist a
using public.waitlist b
where a.email = b.email and a.created_at > b.created_at;

drop index if exists public.uq_waitlist_email;
alter table public.waitlist drop constraint if exists waitlist_email_key;
alter table public.waitlist add constraint waitlist_email_key unique (email);

-- ---------------------------------------------------------------------
-- email_events
-- ---------------------------------------------------------------------
alter table public.email_events
  add column if not exists send_id text;

-- Orphans first, then the foreign keys (profiles / submissions may have been deleted meanwhile).
update public.email_events e set member_id = null
  where member_id is not null and not exists (select 1 from public.profiles p where p.id = e.member_id);
update public.email_events e set submission_id = null
  where submission_id is not null and not exists (select 1 from public.submissions s where s.id = e.submission_id);

alter table public.email_events drop constraint if exists email_events_member_id_fkey;
alter table public.email_events
  add constraint email_events_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete set null;

alter table public.email_events drop constraint if exists email_events_submission_id_fkey;
alter table public.email_events
  add constraint email_events_submission_id_fkey
  foreign key (submission_id) references public.submissions(id) on delete set null;

-- Rows written by the Resend webhook carry no status; the API writes queued/sent/failed/skipped.
update public.email_events set status = null where status is not null and status not in ('queued', 'sent', 'failed', 'skipped');
alter table public.email_events drop constraint if exists email_events_status_check;
alter table public.email_events
  add constraint email_events_status_check
  check (status is null or status in ('queued', 'sent', 'failed', 'skipped'));

create unique index if not exists email_events_once_per_send
  on public.email_events (send_id, recipient)
  where send_id is not null;

create index if not exists idx_email_events_send_id on public.email_events (send_id) where send_id is not null;
create index if not exists idx_email_events_recipient_created on public.email_events (recipient, created_at desc);

-- ---------------------------------------------------------------------
-- email_sends (campaigns are created and executed by api/admin/campaigns + api/cron/send-campaigns)
-- ---------------------------------------------------------------------
alter table public.email_sends
  add column if not exists audience_key text check (audience_key is null or audience_key in ('approved', 'submitted', 'rejected', 'none', 'all', 'waitlist')),
  add column if not exists subject text,
  add column if not exists lang text not null default 'all' check (lang in ('all', 'en', 'ar')),
  add column if not exists note text,
  add column if not exists member_ids uuid[],
  add column if not exists skip_recent boolean not null default false,
  add column if not exists error text;

create index if not exists idx_email_sends_due on public.email_sends (scheduled_for) where state = 'scheduled';
create index if not exists idx_email_sends_created_at on public.email_sends (created_at desc);

drop policy if exists "Admins manage email sends" on public.email_sends;
create policy "Admins read email sends" on public.email_sends for select
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- activity_log: members see their own timeline (submitted / decision rows)
-- ---------------------------------------------------------------------
drop policy if exists "Members read own activity" on public.activity_log;
create policy "Members read own activity" on public.activity_log for select
  using (actor_id = auth.uid());
grant select on public.activity_log to authenticated;

-- ---------------------------------------------------------------------
-- submissions: decisions go through POST /api/admin/submission (service role)
-- ---------------------------------------------------------------------
drop policy if exists "Admins update submissions" on public.submissions;

-- ---------------------------------------------------------------------
-- Least privilege for the PostgREST roles (writes below are service-role only)
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.email_sends from anon, authenticated;
grant select on public.email_sends to authenticated;
