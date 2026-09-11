-- =====================================================================
-- Talaria Flow — release hardening (SHIP.md §2 P1)
--   * profiles: member fields the app reads/writes; privilege columns locked by trigger
--   * submissions: reviewer_note (client field name), file_count, decided_at for retention
--   * member writes to submissions / submission_files / waitlist go through api/* with the
--     service role, so the anon/authenticated insert policies are removed
--   * new admin-only tables: campaigns, email_sends, activity_log
--   * proofs bucket: members may only upload into <uid>/incoming/, delete their own incoming files
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'member' check (role in ('member', 'admin')),
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists name text,
  add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$'),
  add column if not exists lang text not null default 'en' check (lang in ('en', 'ar')),
  add column if not exists notify jsonb not null default '{"course": true, "newsletter": true, "tools": false}'::jsonb;

update public.profiles set role = 'admin' where is_admin and role <> 'admin';

-- is_admin() also honours role = 'admin'
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_admin or p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Members can never change their own privilege or identity columns; only admins / the service role can.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  new.id := old.id;
  new.email := old.email;
  new.is_admin := old.is_admin;
  new.role := old.role;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Copy signup metadata (first_name, last_name, country, lang) into the profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, is_admin, first_name, last_name, name, country, lang)
  values (
    new.id,
    new.email,
    false,
    left(meta->>'first_name', 120),
    left(meta->>'last_name', 120),
    nullif(trim(concat_ws(' ', left(meta->>'first_name', 120), left(meta->>'last_name', 120))), ''),
    case when meta->>'country' ~ '^[A-Z]{2}$' then meta->>'country' else null end,
    case when meta->>'lang' in ('en', 'ar') then meta->>'lang' else 'en' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- set_admin keeps role and is_admin in sync
create or replace function public.set_admin(target_email text, make_admin boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_admin = make_admin,
      role = case when make_admin then 'admin' else 'member' end
  where lower(email) = lower(target_email);
end;
$$;
revoke execute on function public.set_admin(text, boolean) from public, anon, authenticated;

-- Members can delete nothing directly; account deletion runs through api/account/delete (service role).

-- ---------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------
alter table public.submissions
  add column if not exists reviewer_note text,
  add column if not exists file_count integer not null default 0 check (file_count between 0 and 4),
  add column if not exists decided_at timestamptz,
  add column if not exists files_purged_at timestamptz;

update public.submissions set reviewer_note = reviewer_reason where reviewer_note is null and reviewer_reason is not null;
alter table public.submissions drop column if exists reviewer_reason;

-- Stamp the decision time (drives the 90-day proof purge) and the reviewer.
create or replace function public.stamp_submission_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') then
      new.decided_at := now();
      new.reviewed_at := now();
      if auth.uid() is not null then new.reviewed_by := auth.uid(); end if;
    else
      new.decided_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_submission_decision on public.submissions;
create trigger stamp_submission_decision
  before update on public.submissions
  for each row execute function public.stamp_submission_decision();

drop policy if exists "Users can insert own submissions" on public.submissions;
drop policy if exists "Users update own submitted submissions or admin update all" on public.submissions;

create policy "Admins update submissions"
on public.submissions for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete submissions"
on public.submissions for delete
using (public.is_admin());

create index if not exists idx_submissions_decided_at on public.submissions(decided_at) where decided_at is not null;

-- ---------------------------------------------------------------------
-- submission_files
-- ---------------------------------------------------------------------
drop policy if exists "Users can insert own submission files" on public.submission_files;

create policy "Admins delete submission files"
on public.submission_files for delete
using (public.is_admin());

-- ---------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------
alter table public.waitlist
  add column if not exists lang text not null default 'en' check (lang in ('en', 'ar'));

-- de-duplicate before adding the unique constraint
delete from public.waitlist a
using public.waitlist b
where a.email = b.email and a.created_at > b.created_at;
create unique index if not exists uq_waitlist_email on public.waitlist(lower(email));

drop policy if exists "Anyone can insert waitlist" on public.waitlist;

create policy "Admins delete waitlist"
on public.waitlist for delete
using (public.is_admin());

-- ---------------------------------------------------------------------
-- campaigns / email_sends / activity_log (admin console)
-- ---------------------------------------------------------------------
create table if not exists public.campaigns (
  id text primary key,
  template text,
  audience text,
  language text,
  count integer not null default 0,
  test boolean not null default false,
  at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.campaigns enable row level security;
create policy "Admins manage campaigns" on public.campaigns for all
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.email_sends (
  id text primary key,
  state text not null default 'scheduled' check (state in ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  template_id text,
  template_name text,
  audience text,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  opened_count integer not null default 0,
  scheduled_for timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.email_sends enable row level security;
create policy "Admins manage email sends" on public.email_sends for all
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  text text not null,
  color text,
  filter text,
  actor_id uuid references public.profiles(id) on delete set null,
  submission_id uuid references public.submissions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);
alter table public.activity_log enable row level security;
create policy "Admins read activity" on public.activity_log for select using (public.is_admin());
create policy "Admins write activity" on public.activity_log for insert with check (public.is_admin());

-- email_events: only the service role (Resend webhook) writes; drop the open insert policy
drop policy if exists "Service role writes email events" on public.email_events;

-- ---------------------------------------------------------------------
-- storage: proofs bucket
-- ---------------------------------------------------------------------
drop policy if exists "Users can upload proofs to own folder" on storage.objects;

-- Members upload originals to <uid>/incoming/ only; api/proof re-encodes them into <uid>/<submission>/.
create policy "Members upload to own incoming folder"
on storage.objects for insert
with check (
  bucket_id = 'proofs'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'incoming'
);

create policy "Members delete own incoming files"
on storage.objects for delete
using (
  bucket_id = 'proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'incoming'
);

create policy "Admins delete proofs"
on storage.objects for delete
using (bucket_id = 'proofs' and public.is_admin());

-- ---------------------------------------------------------------------
-- Least privilege for the PostgREST roles
-- ---------------------------------------------------------------------
revoke all on public.waitlist from anon;
revoke all on public.email_events from anon, authenticated;
grant select on public.email_events to authenticated;
revoke all on public.activity_log from anon;
revoke all on public.campaigns from anon;
revoke all on public.email_sends from anon;
