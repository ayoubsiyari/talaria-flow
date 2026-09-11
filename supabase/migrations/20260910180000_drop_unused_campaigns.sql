-- The app stores campaign runs on email_sends. public.campaigns was created in
-- 20260909000000_release_hardening.sql and never read or written.
drop policy if exists "Admins manage campaigns" on public.campaigns;
drop table if exists public.campaigns;
