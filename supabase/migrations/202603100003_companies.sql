create table if not exists public.companies (
  company_id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_name_normalized text generated always as (lower(btrim(company_name))) stored,
  company_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint companies_company_name_normalized_key unique (company_name_normalized)
);

create or replace function public.set_companies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_companies_updated_at();

insert into public.companies (company_name)
values
  ('Adobe'),
  ('Qualtrics'),
  ('Domo'),
  ('BambooHR'),
  ('Lucid Software'),
  ('Podium'),
  ('BILL (Divvy)'),
  ('Instructure (Canvas)'),
  ('Ancestry'),
  ('Pluralsight'),
  ('Entrata'),
  ('Weave Communications'),
  ('eBay'),
  ('MX Technologies'),
  ('Health Catalyst'),
  ('Nearmap'),
  ('Canopy'),
  ('ClearLink Technologies'),
  ('Beyond (Overstock)'),
  ('Ivanti'),
  ('MasterControl'),
  ('HireVue'),
  ('HealthEquity'),
  ('Vasion'),
  ('Solutionreach'),
  ('Xactware'),
  ('Galileo Financial'),
  ('Jane Technologies'),
  ('Chatbooks')
on conflict (company_name_normalized) do nothing;

alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select
on public.companies
for select
using (
  auth.role() = 'authenticated'
  or auth.role() = 'service_role'
);

drop policy if exists companies_insert on public.companies;
create policy companies_insert
on public.companies
for insert
with check (
  auth.role() = 'authenticated'
  or auth.role() = 'service_role'
);

drop policy if exists companies_update on public.companies;
create policy companies_update
on public.companies
for update
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists companies_delete on public.companies;
create policy companies_delete
on public.companies
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert on table public.companies to authenticated;
grant all privileges on table public.companies to service_role;
