-- Candidate capability profile persistence and role-axis contract backfill.

create table if not exists public.capability_ontology_axes (
  ontology_version text not null,
  axis_id text not null,
  axis_label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (ontology_version, axis_id)
);

insert into public.capability_ontology_axes (ontology_version, axis_id, axis_label, is_active)
values
  ('2026.04.v1', 'communication', 'Communication', true),
  ('2026.04.v1', 'collaboration', 'Collaboration', true),
  ('2026.04.v1', 'execution_reliability', 'Execution Reliability', true),
  ('2026.04.v1', 'execution', 'Execution', true),
  ('2026.04.v1', 'technical_depth', 'Technical Depth', true),
  ('2026.04.v1', 'systems_thinking', 'Systems Thinking', true),
  ('2026.04.v1', 'data_management', 'Data Management', true),
  ('2026.04.v1', 'product_analytics', 'Product Analytics', true),
  ('2026.04.v1', 'research_methodology', 'Research Methodology', true),
  ('2026.04.v1', 'leadership', 'Leadership', true),
  ('2026.04.v1', 'other_evidence', 'Other Evidence', true),
  ('2026.04.v1', 'problem_solving', 'Problem Solving', true),
  ('2026.04.v1', 'business_judgment', 'Business Judgment', true),
  ('2026.04.v1', 'data_communication', 'Data Communication', true),
  ('2026.04.v1', 'operational_coordination', 'Operational Coordination', true)
on conflict (ontology_version, axis_id) do update
set
  axis_label = excluded.axis_label,
  is_active = excluded.is_active;

create table if not exists public.candidate_capability_profile_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ontology_version text not null,
  scoring_version text not null,
  input_state_hash text not null,
  computed_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (profile_id, ontology_version, scoring_version, input_state_hash)
);

create table if not exists public.candidate_capability_profile_heads (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  state text not null default 'stale' check (state in ('fresh', 'stale', 'recomputing', 'failed')),
  latest_snapshot_id uuid null references public.candidate_capability_profile_snapshots(snapshot_id) on delete set null,
  last_fresh_snapshot_id uuid null references public.candidate_capability_profile_snapshots(snapshot_id) on delete set null,
  latest_input_state_hash text null,
  latest_ontology_version text null,
  latest_scoring_version text null,
  stale_since timestamptz null,
  last_error_code text null,
  last_error_message text null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.candidate_capability_profile_axis_scores (
  snapshot_id uuid not null references public.candidate_capability_profile_snapshots(snapshot_id) on delete cascade,
  axis_id text not null,
  score_normalized numeric(6,5) not null check (score_normalized >= 0 and score_normalized <= 1),
  confidence numeric(6,5) not null check (confidence >= 0 and confidence <= 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  low_confidence boolean not null default false,
  confidence_reason text[] not null default '{}'::text[],
  confidence_level text not null check (confidence_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (snapshot_id, axis_id)
);

create table if not exists public.candidate_capability_profile_axis_evidence_links (
  snapshot_id uuid not null,
  axis_id text not null,
  artifact_id uuid not null references public.artifacts(artifact_id) on delete cascade,
  link_reason text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (snapshot_id, axis_id, artifact_id),
  foreign key (snapshot_id, axis_id)
    references public.candidate_capability_profile_axis_scores(snapshot_id, axis_id)
    on delete cascade
);

create table if not exists public.candidate_capability_profile_recompute_jobs (
  job_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ontology_version text not null,
  scoring_version text not null,
  input_state_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'superseded')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  enqueued_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz null,
  finished_at timestamptz null,
  last_error text null
);

create index if not exists candidate_capability_profile_snapshots_profile_idx
  on public.candidate_capability_profile_snapshots (profile_id, computed_at desc);

create index if not exists candidate_capability_profile_axis_scores_axis_idx
  on public.candidate_capability_profile_axis_scores (axis_id);

create index if not exists candidate_capability_profile_recompute_jobs_profile_idx
  on public.candidate_capability_profile_recompute_jobs (profile_id, enqueued_at desc);

create unique index if not exists candidate_capability_profile_recompute_jobs_inflight_idx
  on public.candidate_capability_profile_recompute_jobs (profile_id, ontology_version, scoring_version, input_state_hash)
  where status in ('queued', 'running');

create or replace function public.set_candidate_capability_profile_heads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists candidate_capability_profile_heads_set_updated_at on public.candidate_capability_profile_heads;
create trigger candidate_capability_profile_heads_set_updated_at
before update on public.candidate_capability_profile_heads
for each row
execute function public.set_candidate_capability_profile_heads_updated_at();

alter table public.candidate_capability_profile_snapshots enable row level security;
alter table public.candidate_capability_profile_heads enable row level security;
alter table public.candidate_capability_profile_axis_scores enable row level security;
alter table public.candidate_capability_profile_axis_evidence_links enable row level security;
alter table public.candidate_capability_profile_recompute_jobs enable row level security;
alter table public.capability_ontology_axes enable row level security;

drop policy if exists capability_ontology_axes_select on public.capability_ontology_axes;
create policy capability_ontology_axes_select
on public.capability_ontology_axes
for select
using (
  auth.role() in ('authenticated', 'service_role')
);

drop policy if exists candidate_capability_profile_snapshots_select on public.candidate_capability_profile_snapshots;
create policy candidate_capability_profile_snapshots_select
on public.candidate_capability_profile_snapshots
for select
using (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_snapshots_insert on public.candidate_capability_profile_snapshots;
create policy candidate_capability_profile_snapshots_insert
on public.candidate_capability_profile_snapshots
for insert
with check (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_heads_select on public.candidate_capability_profile_heads;
create policy candidate_capability_profile_heads_select
on public.candidate_capability_profile_heads
for select
using (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_heads_insert on public.candidate_capability_profile_heads;
create policy candidate_capability_profile_heads_insert
on public.candidate_capability_profile_heads
for insert
with check (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_heads_update on public.candidate_capability_profile_heads;
create policy candidate_capability_profile_heads_update
on public.candidate_capability_profile_heads
for update
using (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
)
with check (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_axis_scores_select on public.candidate_capability_profile_axis_scores;
create policy candidate_capability_profile_axis_scores_select
on public.candidate_capability_profile_axis_scores
for select
using (
  exists (
    select 1
    from public.candidate_capability_profile_snapshots snapshots
    where snapshots.snapshot_id = candidate_capability_profile_axis_scores.snapshot_id
      and (snapshots.profile_id = auth.uid() or auth.role() = 'service_role')
  )
);

drop policy if exists candidate_capability_profile_axis_scores_insert on public.candidate_capability_profile_axis_scores;
create policy candidate_capability_profile_axis_scores_insert
on public.candidate_capability_profile_axis_scores
for insert
with check (
  exists (
    select 1
    from public.candidate_capability_profile_snapshots snapshots
    where snapshots.snapshot_id = candidate_capability_profile_axis_scores.snapshot_id
      and (snapshots.profile_id = auth.uid() or auth.role() = 'service_role')
  )
);

drop policy if exists candidate_capability_profile_axis_evidence_links_select on public.candidate_capability_profile_axis_evidence_links;
create policy candidate_capability_profile_axis_evidence_links_select
on public.candidate_capability_profile_axis_evidence_links
for select
using (
  exists (
    select 1
    from public.candidate_capability_profile_snapshots snapshots
    where snapshots.snapshot_id = candidate_capability_profile_axis_evidence_links.snapshot_id
      and (snapshots.profile_id = auth.uid() or auth.role() = 'service_role')
  )
);

drop policy if exists candidate_capability_profile_axis_evidence_links_insert on public.candidate_capability_profile_axis_evidence_links;
create policy candidate_capability_profile_axis_evidence_links_insert
on public.candidate_capability_profile_axis_evidence_links
for insert
with check (
  exists (
    select 1
    from public.candidate_capability_profile_snapshots snapshots
    where snapshots.snapshot_id = candidate_capability_profile_axis_evidence_links.snapshot_id
      and (snapshots.profile_id = auth.uid() or auth.role() = 'service_role')
  )
);

drop policy if exists candidate_capability_profile_recompute_jobs_select on public.candidate_capability_profile_recompute_jobs;
create policy candidate_capability_profile_recompute_jobs_select
on public.candidate_capability_profile_recompute_jobs
for select
using (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_recompute_jobs_insert on public.candidate_capability_profile_recompute_jobs;
create policy candidate_capability_profile_recompute_jobs_insert
on public.candidate_capability_profile_recompute_jobs
for insert
with check (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

drop policy if exists candidate_capability_profile_recompute_jobs_update on public.candidate_capability_profile_recompute_jobs;
create policy candidate_capability_profile_recompute_jobs_update
on public.candidate_capability_profile_recompute_jobs
for update
using (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
)
with check (
  auth.uid() = profile_id
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.candidate_capability_profile_snapshots to authenticated;
grant select, insert, update on table public.candidate_capability_profile_heads to authenticated;
grant select, insert, update on table public.candidate_capability_profile_axis_scores to authenticated;
grant select, insert, update on table public.candidate_capability_profile_axis_evidence_links to authenticated;
grant select, insert, update on table public.candidate_capability_profile_recompute_jobs to authenticated;

grant all privileges on table public.candidate_capability_profile_snapshots to service_role;
grant all privileges on table public.candidate_capability_profile_heads to service_role;
grant all privileges on table public.candidate_capability_profile_axis_scores to service_role;
grant all privileges on table public.candidate_capability_profile_axis_evidence_links to service_role;
grant all privileges on table public.candidate_capability_profile_recompute_jobs to service_role;
grant select on table public.capability_ontology_axes to authenticated;
grant all privileges on table public.capability_ontology_axes to service_role;

-- Canonical axes[] backfill from legacy payloads.
do $$
begin
  if to_regclass('public.capability_models') is not null then
    with normalized_model_axes as (
      select
        models.capability_model_id,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'axis_id', btrim(weight_entry.key),
                'required_level', 0.7,
                'required_level_source', 'legacy_default',
                'weight', greatest(
                  case
                    when jsonb_typeof(weight_entry.value) = 'number' then (weight_entry.value::text)::numeric
                    else 0
                  end,
                  0
                ),
                'is_active', true
              )
            )
            from jsonb_each(coalesce(models.model_data->'weights', '{}'::jsonb)) as weight_entry
            where btrim(weight_entry.key) <> ''
          ),
          (
            select jsonb_agg(
              jsonb_build_object(
                'axis_id', btrim(capability_id),
                'required_level', 0.7,
                'required_level_source', 'legacy_default',
                'weight', 1,
                'is_active', true
              )
            )
            from jsonb_array_elements_text(coalesce(models.model_data->'capability_ids', '[]'::jsonb)) as capability_id
            where btrim(capability_id) <> ''
          ),
          '[]'::jsonb
        ) as axes
      from public.capability_models models
      where not (models.model_data ? 'axes')
    )
    update public.capability_models models
    set model_data = jsonb_set(
      jsonb_set(models.model_data, '{axes}', normalized_model_axes.axes, true),
      '{model_contract_version}',
      to_jsonb('role_axes.v1'::text),
      true
    )
    from normalized_model_axes
    where models.capability_model_id = normalized_model_axes.capability_model_id;
  end if;

  if to_regclass('public.capability_model_versions') is not null then
    with normalized_version_axes as (
      select
        versions.capability_model_version_id,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'axis_id', btrim(weight_entry.key),
                'required_level', 0.7,
                'required_level_source', 'legacy_default',
                'weight', greatest(
                  case
                    when jsonb_typeof(weight_entry.value) = 'number' then (weight_entry.value::text)::numeric
                    else 0
                  end,
                  0
                ),
                'is_active', true
              )
            )
            from jsonb_each(coalesce(versions.model_payload->'weights', '{}'::jsonb)) as weight_entry
            where btrim(weight_entry.key) <> ''
          ),
          (
            select jsonb_agg(
              jsonb_build_object(
                'axis_id', btrim(capability_id),
                'required_level', 0.7,
                'required_level_source', 'legacy_default',
                'weight', 1,
                'is_active', true
              )
            )
            from jsonb_array_elements_text(coalesce(versions.model_payload->'capability_ids', '[]'::jsonb)) as capability_id
            where btrim(capability_id) <> ''
          ),
          '[]'::jsonb
        ) as axes
      from public.capability_model_versions versions
      where not (versions.model_payload ? 'axes')
    )
    update public.capability_model_versions versions
    set model_payload = jsonb_set(
      jsonb_set(versions.model_payload, '{axes}', normalized_version_axes.axes, true),
      '{model_contract_version}',
      to_jsonb('role_axes.v1'::text),
      true
    )
    from normalized_version_axes
    where versions.capability_model_version_id = normalized_version_axes.capability_model_version_id;
  end if;
end
$$;

-- Mark candidate profiles stale when artifact inputs change.
create or replace function public.enqueue_candidate_capability_profile_recompute_from_artifact_change()
returns trigger
language plpgsql
as $$
declare
  candidate_profile_id uuid;
begin
  candidate_profile_id := coalesce(new.profile_id, old.profile_id);
  if candidate_profile_id is null then
    return coalesce(new, old);
  end if;

  insert into public.candidate_capability_profile_heads (
    profile_id,
    state,
    stale_since,
    latest_ontology_version,
    latest_scoring_version
  )
  values (
    candidate_profile_id,
    'stale',
    timezone('utc'::text, now()),
    '2026.04.v1',
    '2026.04.fit.v1'
  )
  on conflict (profile_id) do update
  set
    state = 'stale',
    stale_since = timezone('utc'::text, now()),
    latest_ontology_version = '2026.04.v1',
    latest_scoring_version = '2026.04.fit.v1';

  insert into public.candidate_capability_profile_recompute_jobs (
    profile_id,
    ontology_version,
    scoring_version,
    input_state_hash,
    status
  )
  values (
    candidate_profile_id,
    '2026.04.v1',
    '2026.04.fit.v1',
    'pending_artifact_change',
    'queued'
  )
  on conflict do nothing;

  return coalesce(new, old);
end;
$$;

drop trigger if exists artifacts_enqueue_candidate_capability_profile_recompute on public.artifacts;
create trigger artifacts_enqueue_candidate_capability_profile_recompute
after insert or update or delete on public.artifacts
for each row
execute function public.enqueue_candidate_capability_profile_recompute_from_artifact_change();

-- Mark all candidate heads stale when ontology changes.
create or replace function public.mark_candidate_capability_profiles_stale_on_ontology_change()
returns trigger
language plpgsql
as $$
begin
  update public.candidate_capability_profile_heads
  set
    state = 'stale',
    stale_since = timezone('utc'::text, now()),
    latest_ontology_version = new.ontology_version;
  return new;
end;
$$;

drop trigger if exists capability_ontology_axes_mark_candidate_profiles_stale on public.capability_ontology_axes;
create trigger capability_ontology_axes_mark_candidate_profiles_stale
after insert or update on public.capability_ontology_axes
for each row
execute function public.mark_candidate_capability_profiles_stale_on_ontology_change();
