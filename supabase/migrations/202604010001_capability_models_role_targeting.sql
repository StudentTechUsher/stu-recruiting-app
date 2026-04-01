alter table public.capability_models
  add column if not exists role_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'capability_models_role_id_fkey'
  ) then
    alter table public.capability_models
      add constraint capability_models_role_id_fkey
      foreign key (role_id)
      references public.job_roles(role_id)
      on delete set null;
  end if;
end
$$;

create index if not exists capability_models_company_role_active_idx
  on public.capability_models (company_id, role_id, is_active);

update public.capability_models
set role_id = nullif(btrim(model_data->>'role_id'), '')::uuid
where role_id is null
  and model_data ? 'role_id'
  and btrim(model_data->>'role_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.capability_models as models
set role_id = roles.role_id
from public.job_roles as roles
where models.role_id is null
  and nullif(btrim(models.model_data->>'role_name'), '') is not null
  and lower(btrim(models.model_data->>'role_name')) = roles.role_name_normalized;
