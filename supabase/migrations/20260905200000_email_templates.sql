create table if not exists public.email_templates (
  id text not null,
  name text not null,
  kind text not null default 'auto',
  trigger text,
  spec jsonb not null default '{}'::jsonb,
  lang text not null default 'en',
  updated_at timestamptz not null default now(),
  created_by uuid,
  primary key (id, lang)
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  event text not null,
  recipient text,
  provider_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_events_template on public.email_events (template_id, event);

alter table public.email_templates enable row level security;
alter table public.email_events enable row level security;

create policy "Admins manage email templates"
on public.email_templates for all
using (public.is_admin())
with check (public.is_admin());

create policy "Admins read email events"
on public.email_events for select
using (public.is_admin());

create policy "Service role writes email events"
on public.email_events for insert
with check (true);
