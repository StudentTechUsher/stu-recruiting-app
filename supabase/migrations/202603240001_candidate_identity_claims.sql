create table if not exists public.candidate_profiles (
  candidate_id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  claimed boolean not null default false,
  claimed_at timestamptz null,
  canonical_profile_id uuid null references public.profiles(id) on delete set null,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint candidate_profiles_email_length_check check (char_length(trim(normalized_email)) >= 3)
);

create unique index if not exists candidate_profiles_normalized_email_key
  on public.candidate_profiles (lower(trim(normalized_email)));

create table if not exists public.candidate_profile_variants (
  variant_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles(candidate_id) on delete cascade,
  employer_id text null,
  ownership text not null default 'employer' check (ownership in ('employer', 'candidate')),
  state text not null default 'active' check (state in ('active', 'merged')),
  source_profile_id uuid null references public.profiles(id) on delete set null,
  variant_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint candidate_profile_variants_scope_check check (
    (ownership = 'employer' and employer_id is not null)
    or (ownership = 'candidate' and employer_id is null)
  )
);

create unique index if not exists candidate_profile_variants_one_active_candidate_variant
  on public.candidate_profile_variants (candidate_id)
  where ownership = 'candidate' and state = 'active';

create unique index if not exists candidate_profile_variants_one_active_employer_variant
  on public.candidate_profile_variants (candidate_id, employer_id)
  where ownership = 'employer' and state = 'active';

create table if not exists public.candidate_application_links (
  application_link_id uuid primary key default gen_random_uuid(),
  application_id text not null,
  candidate_id uuid not null references public.candidate_profiles(candidate_id) on delete cascade,
  employer_id text not null,
  role_context jsonb not null default '{}'::jsonb,
  artifact_snapshot_ids jsonb not null default '[]'::jsonb,
  source_provenance_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint candidate_application_links_role_context_object check (jsonb_typeof(role_context) = 'object'),
  constraint candidate_application_links_artifact_snapshot_ids_array check (jsonb_typeof(artifact_snapshot_ids) = 'array'),
  constraint candidate_application_links_source_provenance_refs_array check (jsonb_typeof(source_provenance_refs) = 'array'),
  constraint candidate_application_links_application_employer_unique unique (application_id, employer_id)
);

create index if not exists candidate_application_links_candidate_created_idx
  on public.candidate_application_links (candidate_id, created_at desc);

create or replace function public.set_candidate_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.set_candidate_profile_variants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.set_candidate_application_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists candidate_profiles_set_updated_at on public.candidate_profiles;
create trigger candidate_profiles_set_updated_at
before update on public.candidate_profiles
for each row
execute function public.set_candidate_profiles_updated_at();

drop trigger if exists candidate_profile_variants_set_updated_at on public.candidate_profile_variants;
create trigger candidate_profile_variants_set_updated_at
before update on public.candidate_profile_variants
for each row
execute function public.set_candidate_profile_variants_updated_at();

drop trigger if exists candidate_application_links_set_updated_at on public.candidate_application_links;
create trigger candidate_application_links_set_updated_at
before update on public.candidate_application_links
for each row
execute function public.set_candidate_application_links_updated_at();

create or replace function public.is_candidate_owner(candidate_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidate_profiles cp
    where cp.candidate_id = candidate_uuid
      and cp.canonical_profile_id = auth.uid()
  );
$$;

alter table public.candidate_profiles enable row level security;
alter table public.candidate_profile_variants enable row level security;
alter table public.candidate_application_links enable row level security;

drop policy if exists candidate_profiles_select on public.candidate_profiles;
create policy candidate_profiles_select
on public.candidate_profiles
for select
using (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_profiles_insert on public.candidate_profiles;
create policy candidate_profiles_insert
on public.candidate_profiles
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_profiles_update on public.candidate_profiles;
create policy candidate_profiles_update
on public.candidate_profiles
for update
using (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_profile_variants_select on public.candidate_profile_variants;
create policy candidate_profile_variants_select
on public.candidate_profile_variants
for select
using (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_profile_variants_insert on public.candidate_profile_variants;
create policy candidate_profile_variants_insert
on public.candidate_profile_variants
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_profile_variants_update on public.candidate_profile_variants;
create policy candidate_profile_variants_update
on public.candidate_profile_variants
for update
using (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_application_links_select on public.candidate_application_links;
create policy candidate_application_links_select
on public.candidate_application_links
for select
using (
  public.is_candidate_owner(candidate_id)
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_application_links_insert on public.candidate_application_links;
create policy candidate_application_links_insert
on public.candidate_application_links
for insert
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists candidate_application_links_update on public.candidate_application_links;
create policy candidate_application_links_update
on public.candidate_application_links
for update
using (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

grant select on table public.candidate_profiles to authenticated;
grant select on table public.candidate_profile_variants to authenticated;
grant select on table public.candidate_application_links to authenticated;
grant all privileges on table public.candidate_profiles to service_role;
grant all privileges on table public.candidate_profile_variants to service_role;
grant all privileges on table public.candidate_application_links to service_role;
grant execute on function public.is_candidate_owner(uuid) to authenticated;
grant execute on function public.is_candidate_owner(uuid) to service_role;
