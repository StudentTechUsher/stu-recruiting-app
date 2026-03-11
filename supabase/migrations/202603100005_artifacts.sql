create table if not exists public.artifacts (
  artifact_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  artifact_type text not null,
  artifact_data jsonb not null default '{}'::jsonb,
  file_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint artifacts_artifact_data_object check (jsonb_typeof(artifact_data) = 'object'),
  constraint artifacts_file_refs_array check (jsonb_typeof(file_refs) = 'array')
);

comment on table public.artifacts is
  'Student-owned artifacts. artifact_data holds type-specific payload; file_refs is reserved for Supabase Storage links.';
comment on column public.artifacts.artifact_type is
  'Application-controlled discriminator for how artifact_data should be interpreted.';
comment on column public.artifacts.file_refs is
  'Array of file metadata objects (e.g. bucket/path/url) for future storage uploads.';

create index if not exists artifacts_profile_created_idx on public.artifacts (profile_id, created_at desc);
create index if not exists artifacts_profile_type_idx on public.artifacts (profile_id, artifact_type);
create index if not exists artifacts_data_gin_idx on public.artifacts using gin (artifact_data);

create or replace function public.set_artifacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists artifacts_set_updated_at on public.artifacts;
create trigger artifacts_set_updated_at
before update on public.artifacts
for each row
execute function public.set_artifacts_updated_at();

alter table public.artifacts enable row level security;

drop policy if exists artifacts_select on public.artifacts;
create policy artifacts_select
on public.artifacts
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists artifacts_insert on public.artifacts;
create policy artifacts_insert
on public.artifacts
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists artifacts_update on public.artifacts;
create policy artifacts_update
on public.artifacts
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

drop policy if exists artifacts_delete on public.artifacts;
create policy artifacts_delete
on public.artifacts
for delete
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update, delete on table public.artifacts to authenticated;
grant all privileges on table public.artifacts to service_role;
