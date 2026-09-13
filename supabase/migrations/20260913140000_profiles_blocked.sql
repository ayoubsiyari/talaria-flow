-- Hard reject: member cannot upload again until an admin restores access.
alter table public.profiles
  add column if not exists blocked boolean not null default false;

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
  new.resubmit_note := old.resubmit_note;
  new.blocked := old.blocked;
  return new;
end;
$$;
