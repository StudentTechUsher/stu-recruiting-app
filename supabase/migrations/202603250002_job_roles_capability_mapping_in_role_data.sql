alter table public.job_roles
  drop constraint if exists job_roles_role_data_object,
  add constraint job_roles_role_data_object check (jsonb_typeof(role_data) = 'object');

comment on column public.job_roles.role_data is
  'Stu-owned role metadata. Capability mapping is stored in role_data.capability_ids (array of capability_id strings).';

update public.job_roles
set role_data = role_data
  || jsonb_build_object(
    'capability_ids', to_jsonb(array['data_management', 'systems_thinking', 'product_analytics', 'communication']::text[]),
    'mapping_source', 'seed',
    'mapping_updated_at', timezone('utc'::text, now())
  )
where role_name_normalized = 'data analyst'
  and (
    not (role_data ? 'capability_ids')
    or jsonb_typeof(role_data->'capability_ids') <> 'array'
    or jsonb_array_length(role_data->'capability_ids') = 0
  );

update public.job_roles
set role_data = role_data
  || jsonb_build_object(
    'capability_ids', to_jsonb(array['technical_depth', 'data_management', 'research_methodology', 'systems_thinking']::text[]),
    'mapping_source', 'seed',
    'mapping_updated_at', timezone('utc'::text, now())
  )
where role_name_normalized = 'data scientist'
  and (
    not (role_data ? 'capability_ids')
    or jsonb_typeof(role_data->'capability_ids') <> 'array'
    or jsonb_array_length(role_data->'capability_ids') = 0
  );

update public.job_roles
set role_data = role_data
  || jsonb_build_object(
    'capability_ids', to_jsonb(array['communication', 'collaboration', 'systems_thinking', 'product_analytics']::text[]),
    'mapping_source', 'seed',
    'mapping_updated_at', timezone('utc'::text, now())
  )
where role_name_normalized = 'product designer'
  and (
    not (role_data ? 'capability_ids')
    or jsonb_typeof(role_data->'capability_ids') <> 'array'
    or jsonb_array_length(role_data->'capability_ids') = 0
  );

update public.job_roles
set role_data = role_data
  || jsonb_build_object(
    'capability_ids', to_jsonb(array['technical_depth', 'systems_thinking', 'execution_reliability', 'collaboration']::text[]),
    'mapping_source', 'seed',
    'mapping_updated_at', timezone('utc'::text, now())
  )
where role_name_normalized = 'software engineer'
  and (
    not (role_data ? 'capability_ids')
    or jsonb_typeof(role_data->'capability_ids') <> 'array'
    or jsonb_array_length(role_data->'capability_ids') = 0
  );

update public.job_roles
set role_data = role_data
  || jsonb_build_object(
    'capability_ids', to_jsonb(array['communication', 'collaboration', 'systems_thinking', 'product_analytics']::text[]),
    'mapping_source', 'seed',
    'mapping_updated_at', timezone('utc'::text, now())
  )
where role_name_normalized = 'product manager'
  and (
    not (role_data ? 'capability_ids')
    or jsonb_typeof(role_data->'capability_ids') <> 'array'
    or jsonb_array_length(role_data->'capability_ids') = 0
  );

update public.job_roles
set role_data = role_data
  || jsonb_build_object(
    'capability_ids', to_jsonb(array['communication', 'systems_thinking', 'collaboration', 'leadership']::text[]),
    'mapping_source', 'seed',
    'mapping_updated_at', timezone('utc'::text, now())
  )
where role_name_normalized = 'associate consultant'
  and (
    not (role_data ? 'capability_ids')
    or jsonb_typeof(role_data->'capability_ids') <> 'array'
    or jsonb_array_length(role_data->'capability_ids') = 0
  );
