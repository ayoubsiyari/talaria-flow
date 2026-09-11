-- =====================================================================
-- Talaria Flow — Supabase Backend Schema & Row-Level Security
-- Tables: profiles, submissions, submission_files, waitlist
-- Storage: private bucket "proofs" (5MB max per file, png/jpg/webp)
-- =====================================================================

-- 1. Helper function: is_admin
-- Security definer ensures no infinite recursion in RLS checks
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 2. Helper function: update_updated_at_column
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Table: profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_is_admin on public.profiles(is_admin);

alter table public.profiles enable row level security;

-- Profiles RLS:
-- Users can read their own profile; admins can read all profiles
create policy "Users can view own profile or admin can view all"
on public.profiles for select
using (
  auth.uid() = id or public.is_admin()
);

-- Users can update their own profile, but cannot elevate themselves to is_admin
create policy "Users can update own profile or admin can update"
on public.profiles for update
using (
  auth.uid() = id or public.is_admin()
)
with check (
  case
    when public.is_admin() then true
    when auth.uid() = id then is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
    else false
  end
);

-- Trigger: auto-sync new auth users into profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Table: submissions
-- ---------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null check (status in ('submitted', 'approved', 'rejected')) default 'submitted',
  note text,
  reviewer_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_submissions_user_id on public.submissions(user_id);
create index if not exists idx_submissions_status on public.submissions(status);
create index if not exists idx_submissions_created_at on public.submissions(created_at desc);

alter table public.submissions enable row level security;

-- Submissions RLS:
-- Users view own submissions, admins view all
create policy "Users view own submissions or admin view all"
on public.submissions for select
using (
  auth.uid() = user_id or public.is_admin()
);

-- Users can insert their own submission
create policy "Users can insert own submissions"
on public.submissions for insert
with check (
  auth.uid() = user_id
);

-- Users can update their own submission while submitted, admins can update any
create policy "Users update own submitted submissions or admin update all"
on public.submissions for update
using (
  (auth.uid() = user_id and status = 'submitted') or public.is_admin()
)
with check (
  (auth.uid() = user_id and status = 'submitted') or public.is_admin()
);

drop trigger if exists update_submissions_updated_at on public.submissions;
create trigger update_submissions_updated_at
  before update on public.submissions
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Table: submission_files
-- ---------------------------------------------------------------------
create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_submission_files_submission_id on public.submission_files(submission_id);
create index if not exists idx_submission_files_user_id on public.submission_files(user_id);

alter table public.submission_files enable row level security;

-- Submission files RLS:
create policy "Users view own submission files or admin view all"
on public.submission_files for select
using (
  auth.uid() = user_id or public.is_admin()
);

create policy "Users can insert own submission files"
on public.submission_files for insert
with check (
  auth.uid() = user_id
);

-- ---------------------------------------------------------------------
-- Table: waitlist
-- ---------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_email on public.waitlist(email);
create index if not exists idx_waitlist_created_at on public.waitlist(created_at desc);

alter table public.waitlist enable row level security;

-- Waitlist RLS:
-- Anyone (anon and authenticated) can join the waitlist
create policy "Anyone can insert waitlist"
on public.waitlist for insert
with check (true);

-- Only admin can read the waitlist
create policy "Only admin can view waitlist"
on public.waitlist for select
using (
  public.is_admin()
);

-- ---------------------------------------------------------------------
-- Storage Bucket: proofs
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Storage RLS on storage.objects
create policy "Users can upload proofs to own folder"
on storage.objects for insert
with check (
  bucket_id = 'proofs'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users and admins can view proofs"
on storage.objects for select
using (
  bucket_id = 'proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- ---------------------------------------------------------------------
-- Admin Helper: set_admin
-- ---------------------------------------------------------------------
create or replace function public.set_admin(target_email text, make_admin boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_admin = make_admin
  where email = target_email;
end;
$$;
