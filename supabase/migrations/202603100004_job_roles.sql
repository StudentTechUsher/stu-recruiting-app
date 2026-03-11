create table if not exists public.job_roles (
  role_id uuid primary key default gen_random_uuid(),
  role_name text not null,
  role_name_normalized text generated always as (lower(btrim(role_name))) stored,
  role_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint job_roles_role_name_normalized_key unique (role_name_normalized)
);

create or replace function public.set_job_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists job_roles_set_updated_at on public.job_roles;
create trigger job_roles_set_updated_at
before update on public.job_roles
for each row
execute function public.set_job_roles_updated_at();

insert into public.job_roles (role_name)
values
  ('Software Engineer'),
  ('Data Analyst'),
  ('Product Analyst'),
  ('Data Engineer'),
  ('Business Analyst'),
  ('Associate Consultant'),
  ('Product Manager'),
  ('UX Researcher'),
  ('Solutions Engineer'),
  ('Operations Analyst')
on conflict (role_name_normalized) do nothing;

alter table public.job_roles enable row level security;

drop policy if exists job_roles_select on public.job_roles;
create policy job_roles_select
on public.job_roles
for select
using (
  auth.role() = 'authenticated'
  or auth.role() = 'service_role'
);

drop policy if exists job_roles_insert on public.job_roles;
create policy job_roles_insert
on public.job_roles
for insert
with check (
  auth.role() = 'authenticated'
  or auth.role() = 'service_role'
);

drop policy if exists job_roles_update on public.job_roles;
create policy job_roles_update
on public.job_roles
for update
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists job_roles_delete on public.job_roles;
create policy job_roles_delete
on public.job_roles
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert on table public.job_roles to authenticated;
grant all privileges on table public.job_roles to service_role;
