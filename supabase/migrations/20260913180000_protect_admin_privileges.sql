-- Admins must not raise other accounts via PostgREST. Only service_role / postgres
-- may change is_admin and role. is_admin() still may set blocked / resubmit_note
-- only through admin_set_blocked (service_role). This trigger blocks privilege
-- columns for everyone except the service role.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged boolean;
begin
  privileged :=
    auth.role() in ('service_role', 'postgres', 'supabase_admin')
    or current_user in ('postgres', 'supabase_admin', 'service_role')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  if not privileged then
    new.id := old.id;
    new.email := old.email;
    new.is_admin := old.is_admin;
    new.role := old.role;
    new.created_at := old.created_at;
    if not public.is_admin() then
      new.resubmit_note := old.resubmit_note;
      new.blocked := old.blocked;
    else
      -- Authenticated admins cannot flip block flags from the browser either.
      new.resubmit_note := old.resubmit_note;
      new.blocked := old.blocked;
    end if;
  end if;
  return new;
end;
$$;
