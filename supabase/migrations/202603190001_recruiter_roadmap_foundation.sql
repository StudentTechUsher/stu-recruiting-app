-- ATS config hardening -------------------------------------------------------

alter table if exists public.org_ats_configs
  add column if not exists provider_settings jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table if exists public.org_ats_configs
  drop constraint if exists org_ats_configs_provider_check;

alter table if exists public.org_ats_configs
  add constraint org_ats_configs_provider_check
  check (provider in ('greenhouse', 'lever', 'bamboohr'));

update public.org_ats_configs
set provider_settings = jsonb_set(
  coalesce(provider_settings, '{}'::jsonb),
  '{api_key}',
  to_jsonb(api_key),
  true
)
where api_key is not null
  and not (coalesce(provider_settings, '{}'::jsonb) ? 'api_key');

alter table if exists public.org_ats_configs
  drop constraint if exists org_ats_configs_org_id_fkey;

alter table if exists public.org_ats_configs
  add constraint org_ats_configs_org_id_fkey
  foreign key (org_id) references public.companies(company_id) on delete cascade;

with ranked as (
  select
    id,
    row_number() over (partition by org_id order by created_at desc, id desc) as row_number
  from public.org_ats_configs
  where enabled = true
)
update public.org_ats_configs as configs
set enabled = false
from ranked
where configs.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists org_ats_configs_one_enabled_per_org
on public.org_ats_configs (org_id)
where enabled = true;

create or replace function public.set_org_ats_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists org_ats_configs_set_updated_at on public.org_ats_configs;
create trigger org_ats_configs_set_updated_at
before update on public.org_ats_configs
for each row
execute function public.set_org_ats_configs_updated_at();

-- Recommendation discovery + CRM event store --------------------------------

create table if not exists public.recruiter_recommendation_events (
  event_id uuid primary key default gen_random_uuid(),
  org_id text not null,
  candidate_key text not null,
  ats_provider text null check (ats_provider in ('greenhouse', 'lever', 'bamboohr')),
  ats_candidate_id text null,
  student_profile_id uuid null references public.profiles(id) on delete set null,
  candidate_email text null,
  event_type text not null check (event_type in ('recommendation', 'recruiter_action')),
  recommendation_state text null check (recommendation_state in ('recommended', 'hold', 'manual_review')),
  reason_code text null,
  action_name text null,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists recruiter_recommendation_events_org_created_idx
  on public.recruiter_recommendation_events (org_id, created_at desc);

create index if not exists recruiter_recommendation_events_candidate_idx
  on public.recruiter_recommendation_events (candidate_key, created_at desc);

alter table public.recruiter_recommendation_events enable row level security;

drop policy if exists recruiter_recommendation_events_select on public.recruiter_recommendation_events;
create policy recruiter_recommendation_events_select
on public.recruiter_recommendation_events
for select
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiter_recommendation_events_insert on public.recruiter_recommendation_events;
create policy recruiter_recommendation_events_insert
on public.recruiter_recommendation_events
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert on table public.recruiter_recommendation_events to authenticated;
grant all privileges on table public.recruiter_recommendation_events to service_role;

-- Capability models + immutable versions ------------------------------------

create table if not exists public.capability_models (
  capability_model_id uuid primary key default gen_random_uuid(),
  org_id text not null,
  model_name text not null,
  description text null,
  active_version_id uuid null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists capability_models_org_name_key
  on public.capability_models (org_id, lower(trim(model_name)));

create table if not exists public.capability_model_versions (
  capability_model_version_id uuid primary key default gen_random_uuid(),
  capability_model_id uuid not null references public.capability_models(capability_model_id) on delete cascade,
  org_id text not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  weights jsonb not null default '{}'::jsonb,
  thresholds jsonb not null default '{}'::jsonb,
  required_evidence jsonb not null default '[]'::jsonb,
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  published_at timestamptz null,
  unique (capability_model_id, version_number)
);

create unique index if not exists capability_model_versions_one_published_per_model
  on public.capability_model_versions (capability_model_id)
  where status = 'published';

alter table public.capability_models
  drop constraint if exists capability_models_active_version_id_fkey;

alter table public.capability_models
  add constraint capability_models_active_version_id_fkey
  foreign key (active_version_id)
  references public.capability_model_versions(capability_model_version_id)
  on delete set null;

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

-- Candidate CRM notes/reminders ---------------------------------------------

create table if not exists public.recruiter_candidate_notes (
  note_id uuid primary key default gen_random_uuid(),
  org_id text not null,
  candidate_key text not null,
  student_profile_id uuid null references public.profiles(id) on delete set null,
  note_text text not null check (char_length(trim(note_text)) between 1 and 4000),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.recruiter_candidate_reminders (
  reminder_id uuid primary key default gen_random_uuid(),
  org_id text not null,
  candidate_key text not null,
  student_profile_id uuid null references public.profiles(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 512),
  due_at timestamptz null,
  status text not null default 'open' check (status in ('open', 'completed', 'dismissed')),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz null
);

create or replace function public.set_recruiter_candidate_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists recruiter_candidate_notes_set_updated_at on public.recruiter_candidate_notes;
create trigger recruiter_candidate_notes_set_updated_at
before update on public.recruiter_candidate_notes
for each row
execute function public.set_recruiter_candidate_notes_updated_at();

create index if not exists recruiter_candidate_notes_org_created_idx
  on public.recruiter_candidate_notes (org_id, created_at desc);

create index if not exists recruiter_candidate_reminders_org_created_idx
  on public.recruiter_candidate_reminders (org_id, created_at desc);

alter table public.recruiter_candidate_notes enable row level security;
alter table public.recruiter_candidate_reminders enable row level security;

drop policy if exists recruiter_candidate_notes_select on public.recruiter_candidate_notes;
create policy recruiter_candidate_notes_select
on public.recruiter_candidate_notes
for select
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiter_candidate_notes_insert on public.recruiter_candidate_notes;
create policy recruiter_candidate_notes_insert
on public.recruiter_candidate_notes
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiter_candidate_notes_update on public.recruiter_candidate_notes;
create policy recruiter_candidate_notes_update
on public.recruiter_candidate_notes
for update
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiter_candidate_reminders_select on public.recruiter_candidate_reminders;
create policy recruiter_candidate_reminders_select
on public.recruiter_candidate_reminders
for select
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiter_candidate_reminders_insert on public.recruiter_candidate_reminders;
create policy recruiter_candidate_reminders_insert
on public.recruiter_candidate_reminders
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiter_candidate_reminders_update on public.recruiter_candidate_reminders;
create policy recruiter_candidate_reminders_update
on public.recruiter_candidate_reminders
for update
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.recruiter_candidate_notes to authenticated;
grant select, insert, update on table public.recruiter_candidate_reminders to authenticated;
grant all privileges on table public.recruiter_candidate_notes to service_role;
grant all privileges on table public.recruiter_candidate_reminders to service_role;
