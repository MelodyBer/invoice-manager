-- חיבורי חשבונות והגדרות זיהוי. אין שינוי במסמכים או בתנועות קיימים.
begin;
create table if not exists public.integration_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recognition_names text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint integration_names_limit check (cardinality(recognition_names) <= 20)
);
create table if not exists public.integration_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'payplus')),
  account_label text not null,
  encrypted_credentials text not null,
  connected_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.integration_settings enable row level security;
alter table public.integration_connections enable row level security;
drop policy if exists own_integration_settings on public.integration_settings;
create policy own_integration_settings on public.integration_settings
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists own_integration_connections on public.integration_connections;
create policy own_integration_connections on public.integration_connections
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.integration_settings, public.integration_connections from anon;
grant select, insert, update, delete on public.integration_settings, public.integration_connections to authenticated;
commit;
