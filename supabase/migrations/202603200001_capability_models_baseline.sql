-- Baseline capability model schema.
-- Goal: keep capability models simple while preserving explicit ownership,
-- versioning, and active-model state.

create table if not exists public.capability_models (
  capability_model_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(company_id) on delete cascade,
  recruiter_id uuid not null references public.recruiters(recruiter_id) on delete restrict,
  model_data jsonb not null default '{}'::jsonb,
  active_version_id uuid null,
  current_version integer not null default 1 check (current_version > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.capability_models
  add column if not exists company_id uuid;

alter table public.capability_models
  add column if not exists recruiter_id uuid;

alter table public.capability_models
  add column if not exists model_data jsonb;

alter table public.capability_models
  add column if not exists active_version_id uuid;

alter table public.capability_models
  add column if not exists current_version integer;

alter table public.capability_models
  add column if not exists is_active boolean;

alter table public.capability_models
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

alter table public.capability_models
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

update public.capability_models
set current_version = 1
where current_version is null;

update public.capability_models
set is_active = false
where is_active is null;

update public.capability_models
set model_data = '{}'::jsonb
where model_data is null;

alter table public.capability_models
  alter column model_data set default '{}'::jsonb;

alter table public.capability_models
  alter column model_data set not null;

alter table public.capability_models
  alter column current_version set default 1;

alter table public.capability_models
  alter column current_version set not null;

alter table public.capability_models
  alter column is_active set default false;

alter table public.capability_models
  alter column is_active set not null;

create table if not exists public.capability_model_versions (
  capability_model_version_id uuid primary key default gen_random_uuid(),
  capability_model_id uuid not null references public.capability_models(capability_model_id) on delete cascade,
  version_number integer not null check (version_number > 0),
  model_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (capability_model_id, version_number)
);

alter table public.capability_model_versions
  add column if not exists capability_model_id uuid;

alter table public.capability_model_versions
  add column if not exists version_number integer;

alter table public.capability_model_versions
  add column if not exists model_payload jsonb not null default '{}'::jsonb;

alter table public.capability_model_versions
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

update public.capability_model_versions
set version_number = 1
where version_number is null;

alter table public.capability_model_versions
  alter column version_number set default 1;

alter table public.capability_model_versions
  alter column version_number set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_models_company_id_fkey'
  ) then
    alter table public.capability_models
      add constraint capability_models_company_id_fkey
      foreign key (company_id)
      references public.companies(company_id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_models_recruiter_id_fkey'
  ) then
    alter table public.capability_models
      add constraint capability_models_recruiter_id_fkey
      foreign key (recruiter_id)
      references public.recruiters(recruiter_id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_model_versions_capability_model_id_fkey'
  ) then
    alter table public.capability_model_versions
      add constraint capability_model_versions_capability_model_id_fkey
      foreign key (capability_model_id)
      references public.capability_models(capability_model_id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_models_active_version_id_fkey'
  ) then
    alter table public.capability_models
      add constraint capability_models_active_version_id_fkey
      foreign key (active_version_id)
      references public.capability_model_versions(capability_model_version_id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_models_current_version_check'
  ) then
    alter table public.capability_models
      add constraint capability_models_current_version_check
      check (current_version > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_model_versions_version_number_check'
  ) then
    alter table public.capability_model_versions
      add constraint capability_model_versions_version_number_check
      check (version_number > 0);
  end if;
end
$$;

create index if not exists capability_models_company_recruiter_idx
  on public.capability_models (company_id, recruiter_id);

create index if not exists capability_models_active_idx
  on public.capability_models (company_id, is_active)
  where is_active = true;

create index if not exists capability_model_versions_model_idx
  on public.capability_model_versions (capability_model_id, version_number desc);

create or replace function public.set_capability_models_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists capability_models_set_updated_at on public.capability_models;
create trigger capability_models_set_updated_at
before update on public.capability_models
for each row
execute function public.set_capability_models_updated_at();

alter table public.capability_models enable row level security;
alter table public.capability_model_versions enable row level security;

drop policy if exists capability_models_select on public.capability_models;
create policy capability_models_select
on public.capability_models
for select
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists capability_models_insert on public.capability_models;
create policy capability_models_insert
on public.capability_models
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists capability_models_update on public.capability_models;
create policy capability_models_update
on public.capability_models
for update
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists capability_model_versions_select on public.capability_model_versions;
create policy capability_model_versions_select
on public.capability_model_versions
for select
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists capability_model_versions_insert on public.capability_model_versions;
create policy capability_model_versions_insert
on public.capability_model_versions
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists capability_model_versions_update on public.capability_model_versions;
create policy capability_model_versions_update
on public.capability_model_versions
for update
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.capability_models to authenticated;
grant select, insert, update on table public.capability_model_versions to authenticated;
grant all privileges on table public.capability_models to service_role;
grant all privileges on table public.capability_model_versions to service_role;
