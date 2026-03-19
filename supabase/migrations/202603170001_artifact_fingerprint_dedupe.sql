alter table public.artifacts
add column if not exists artifact_fingerprint text;

comment on column public.artifacts.artifact_fingerprint is
  'Deterministic fingerprint for artifact deduplication across extracted sources.';

create or replace function public.compute_artifact_fingerprint(artifact_type text, artifact_data jsonb)
returns text
language sql
immutable
as $$
  select md5(
    trim(both '|' from concat_ws('|',
      regexp_replace(lower(coalesce(artifact_type, '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'title', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'source', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'organization', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'company', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'position', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'job_title', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'course_code', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'course_title', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'project_title', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'certification_name', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'assessment_name', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'competition_name', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'research_title', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'term', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'start_date', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'end_date', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'awarded_date', '')), '[^a-z0-9]+', ' ', 'g'),
      regexp_replace(lower(coalesce(artifact_data->>'provider', '')), '[^a-z0-9]+', ' ', 'g')
    ))
  );
$$;

update public.artifacts
set artifact_fingerprint = public.compute_artifact_fingerprint(artifact_type, artifact_data)
where artifact_fingerprint is null;

with duplicate_map as (
  select
    artifact_id,
    first_value(artifact_id) over (
      partition by profile_id, artifact_fingerprint
      order by created_at asc, artifact_id asc
    ) as keeper_id
  from public.artifacts
  where artifact_fingerprint is not null
),
merged_refs as (
  select
    dm.keeper_id,
    coalesce(
      jsonb_agg(distinct ref_entry.ref) filter (where ref_entry.ref is not null),
      '[]'::jsonb
    ) as refs
  from duplicate_map dm
  join public.artifacts a on a.artifact_id = dm.artifact_id
  left join lateral (
    select ref
    from jsonb_array_elements(
      case
        when jsonb_typeof(a.file_refs) = 'array' then a.file_refs
        else '[]'::jsonb
      end
    ) ref
  ) ref_entry on true
  group by dm.keeper_id
)
update public.artifacts keeper
set file_refs = merged_refs.refs
from merged_refs
where keeper.artifact_id = merged_refs.keeper_id;

with duplicate_map as (
  select
    artifact_id,
    first_value(artifact_id) over (
      partition by profile_id, artifact_fingerprint
      order by created_at asc, artifact_id asc
    ) as keeper_id
  from public.artifacts
  where artifact_fingerprint is not null
)
delete from public.artifacts a
using duplicate_map dm
where a.artifact_id = dm.artifact_id
  and dm.artifact_id <> dm.keeper_id;

create unique index if not exists artifacts_profile_fingerprint_unique_idx
on public.artifacts (profile_id, artifact_fingerprint)
where artifact_fingerprint is not null;
