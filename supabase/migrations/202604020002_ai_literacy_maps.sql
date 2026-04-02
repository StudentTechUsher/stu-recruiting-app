create table if not exists public.ai_literacy_maps (
  ai_literacy_map_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_lens_key text not null,
  selected_capability_model_id uuid null references public.capability_models(capability_model_id) on delete set null,
  selected_role_lens jsonb not null default '{}'::jsonb,
  current_version_id uuid null,
  latest_version_number integer not null default 0 check (latest_version_number >= 0),
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'partial_available', 'available', 'needs_attention')
  ),
  generated_at timestamptz null,
  last_evaluated_at timestamptz null,
  profile_coverage_percent integer not null default 0 check (profile_coverage_percent between 0 and 100),
  recruiter_safe_coverage_percent integer not null default 0 check (
    recruiter_safe_coverage_percent between 0 and 100
    and recruiter_safe_coverage_percent <= profile_coverage_percent
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_literacy_maps_role_lens_key_not_blank check (char_length(trim(role_lens_key)) > 0),
  constraint ai_literacy_maps_selected_role_lens_object check (jsonb_typeof(selected_role_lens) = 'object')
);

comment on table public.ai_literacy_maps is
  'Head records for candidate AI Literacy Maps, scoped by profile and role_lens_key.';

create unique index if not exists ai_literacy_maps_profile_role_lens_key
  on public.ai_literacy_maps (profile_id, role_lens_key);

create index if not exists ai_literacy_maps_profile_status_idx
  on public.ai_literacy_maps (profile_id, status, updated_at desc);

create table if not exists public.ai_literacy_map_versions (
  ai_literacy_map_version_id uuid primary key default gen_random_uuid(),
  ai_literacy_map_id uuid not null references public.ai_literacy_maps(ai_literacy_map_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null check (
    status in ('not_started', 'in_progress', 'partial_available', 'available', 'needs_attention')
  ),
  evaluation_trigger text not null check (
    evaluation_trigger in (
      'initial_generation',
      'artifact_added',
      'artifact_updated',
      'artifact_deactivated',
      'verification_changed',
      'role_lens_changed',
      'framework_changed',
      'manual_refresh',
      'scheduled_recheck'
    )
  ),
  selected_capability_model_id uuid null references public.capability_models(capability_model_id) on delete set null,
  selected_role_lens jsonb not null default '{}'::jsonb,
  overall_indicative_literacy_level text null check (
    overall_indicative_literacy_level in ('Awareness', 'Foundational Use', 'Applied Judgment', 'Strategic Fluency')
  ),
  confidence jsonb not null default '{}'::jsonb,
  evidence_sufficiency jsonb not null default '{}'::jsonb,
  domain_breakdown jsonb not null default '[]'::jsonb,
  supporting_evidence_refs jsonb not null default '[]'::jsonb,
  inferred_observations jsonb not null default '[]'::jsonb,
  candidate_stated_claims jsonb not null default '[]'::jsonb,
  missing_signal_areas jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  model_metadata jsonb not null default '{}'::jsonb,
  version_delta_summary jsonb not null default '{}'::jsonb,
  evidence_snapshot_hash text null,
  profile_coverage_percent integer not null default 0 check (profile_coverage_percent between 0 and 100),
  recruiter_safe_coverage_percent integer not null default 0 check (
    recruiter_safe_coverage_percent between 0 and 100
    and recruiter_safe_coverage_percent <= profile_coverage_percent
  ),
  generated_at timestamptz null,
  evaluated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_literacy_map_versions_selected_role_lens_object check (jsonb_typeof(selected_role_lens) = 'object'),
  constraint ai_literacy_map_versions_confidence_object check (jsonb_typeof(confidence) = 'object'),
  constraint ai_literacy_map_versions_evidence_sufficiency_object check (jsonb_typeof(evidence_sufficiency) = 'object'),
  constraint ai_literacy_map_versions_domain_breakdown_array check (jsonb_typeof(domain_breakdown) = 'array'),
  constraint ai_literacy_map_versions_supporting_refs_array check (jsonb_typeof(supporting_evidence_refs) = 'array'),
  constraint ai_literacy_map_versions_inferred_array check (jsonb_typeof(inferred_observations) = 'array'),
  constraint ai_literacy_map_versions_claims_array check (jsonb_typeof(candidate_stated_claims) = 'array'),
  constraint ai_literacy_map_versions_missing_array check (jsonb_typeof(missing_signal_areas) = 'array'),
  constraint ai_literacy_map_versions_recommendations_array check (jsonb_typeof(recommendations) = 'array'),
  constraint ai_literacy_map_versions_model_metadata_object check (jsonb_typeof(model_metadata) = 'object'),
  constraint ai_literacy_map_versions_version_delta_object check (jsonb_typeof(version_delta_summary) = 'object'),
  unique (ai_literacy_map_id, version_number)
);

comment on table public.ai_literacy_map_versions is
  'Immutable version snapshots for AI Literacy Map evaluations.';

create index if not exists ai_literacy_map_versions_map_created_idx
  on public.ai_literacy_map_versions (ai_literacy_map_id, created_at desc);

create index if not exists ai_literacy_map_versions_profile_status_idx
  on public.ai_literacy_map_versions (profile_id, status, created_at desc);

create index if not exists ai_literacy_map_versions_eval_trigger_idx
  on public.ai_literacy_map_versions (evaluation_trigger, created_at desc);

create or replace function public.set_ai_literacy_maps_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists ai_literacy_maps_set_updated_at on public.ai_literacy_maps;
create trigger ai_literacy_maps_set_updated_at
before update on public.ai_literacy_maps
for each row
execute function public.set_ai_literacy_maps_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_literacy_maps_current_version_id_fkey'
  ) then
    alter table public.ai_literacy_maps
      add constraint ai_literacy_maps_current_version_id_fkey
      foreign key (current_version_id)
      references public.ai_literacy_map_versions(ai_literacy_map_version_id)
      on delete set null;
  end if;
end;
$$;

alter table public.ai_literacy_maps enable row level security;
alter table public.ai_literacy_map_versions enable row level security;

drop policy if exists ai_literacy_maps_select on public.ai_literacy_maps;
create policy ai_literacy_maps_select
on public.ai_literacy_maps
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_literacy_maps_insert on public.ai_literacy_maps;
create policy ai_literacy_maps_insert
on public.ai_literacy_maps
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_literacy_maps_update on public.ai_literacy_maps;
create policy ai_literacy_maps_update
on public.ai_literacy_maps
for update
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
)
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_literacy_map_versions_select on public.ai_literacy_map_versions;
create policy ai_literacy_map_versions_select
on public.ai_literacy_map_versions
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_literacy_map_versions_insert on public.ai_literacy_map_versions;
create policy ai_literacy_map_versions_insert
on public.ai_literacy_map_versions
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_literacy_map_versions_update on public.ai_literacy_map_versions;
create policy ai_literacy_map_versions_update
on public.ai_literacy_map_versions
for update
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
)
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.ai_literacy_maps to authenticated;
grant select, insert, update on table public.ai_literacy_map_versions to authenticated;
grant all privileges on table public.ai_literacy_maps to service_role;
grant all privileges on table public.ai_literacy_map_versions to service_role;
