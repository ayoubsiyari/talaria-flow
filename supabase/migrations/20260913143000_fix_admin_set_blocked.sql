-- Fix restore: postgres is not superuser, so session_replication_role SET 500s.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() in ('service_role', 'postgres', 'supabase_admin')
     or current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or public.is_admin() then
    return new;
  end if;
  new.id := old.id;
  new.email := old.email;
  new.is_admin := old.is_admin;
  new.role := old.role;
  new.created_at := old.created_at;
  new.resubmit_note := old.resubmit_note;
  new.blocked := old.blocked;
  return new;
end;
$$;

create or replace function public.admin_set_blocked(p_id uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set blocked = p_blocked,
         resubmit_note = case when p_blocked then resubmit_note else null end
   where id = p_id;
  return found;
end;
$$;

revoke all on function public.admin_set_blocked(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean) to service_role;
