alter table public.artifacts
add column if not exists is_active boolean not null default true,
add column if not exists active_version_id uuid null,
add column if not exists deactivated_at timestamptz null,
add column if not exists source_provenance jsonb not null default '{}'::jsonb,
add column if not exists source_object_id text null,
add column if not exists ingestion_run_id text null,
add column if not exists artifact_fingerprint text null;

alter table public.artifacts
  drop constraint if exists artifacts_source_provenance_object,
  add constraint artifacts_source_provenance_object check (jsonb_typeof(source_provenance) = 'object');

create table if not exists public.artifact_versions (
  version_id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(artifact_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (
    operation in ('legacy_seed', 'manual_create', 'replace', 'reextract', 'deactivate')
  ),
  artifact_type text not null,
  artifact_data jsonb not null default '{}'::jsonb,
  file_refs jsonb not null default '[]'::jsonb,
  verification_status text null check (verification_status in ('verified', 'pending', 'unverified')),
  source_provenance jsonb not null default '{}'::jsonb,
  source_object_id text null,
  ingestion_run_id text null,
  artifact_fingerprint text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint artifact_versions_artifact_data_object check (jsonb_typeof(artifact_data) = 'object'),
  constraint artifact_versions_file_refs_array check (jsonb_typeof(file_refs) = 'array'),
  constraint artifact_versions_source_provenance_object check (jsonb_typeof(source_provenance) = 'object')
);

create index if not exists artifact_versions_artifact_created_idx
  on public.artifact_versions (artifact_id, created_at desc);
create index if not exists artifact_versions_profile_created_idx
  on public.artifact_versions (profile_id, created_at desc);
create index if not exists artifact_versions_fingerprint_idx
  on public.artifact_versions (profile_id, artifact_fingerprint)
  where artifact_fingerprint is not null;

insert into public.artifact_versions (
  artifact_id,
  profile_id,
  operation,
  artifact_type,
  artifact_data,
  file_refs,
  verification_status,
  source_provenance,
  source_object_id,
  ingestion_run_id,
  artifact_fingerprint,
  created_at
)
select
  artifacts.artifact_id,
  artifacts.profile_id,
  'legacy_seed',
  artifacts.artifact_type,
  artifacts.artifact_data,
  artifacts.file_refs,
  nullif(lower(trim(coalesce(artifacts.artifact_data->>'verification_status', ''))), ''),
  coalesce(artifacts.source_provenance, '{}'::jsonb),
  artifacts.source_object_id,
  artifacts.ingestion_run_id,
  artifacts.artifact_fingerprint,
  artifacts.updated_at
from public.artifacts as artifacts
where not exists (
  select 1
  from public.artifact_versions as versions
  where versions.artifact_id = artifacts.artifact_id
);

update public.artifacts as artifacts
set active_version_id = versions.version_id
from (
  select distinct on (artifact_id) artifact_id, version_id
  from public.artifact_versions
  order by artifact_id, created_at desc, version_id desc
) as versions
where artifacts.artifact_id = versions.artifact_id
  and artifacts.active_version_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'artifacts_active_version_id_fkey'
  ) then
    alter table public.artifacts
      add constraint artifacts_active_version_id_fkey
      foreign key (active_version_id)
      references public.artifact_versions(version_id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.claim_invite_redemptions (
  redemption_id uuid primary key default gen_random_uuid(),
  jti text not null,
  token_hash text not null,
  candidate_id uuid null references public.candidate_profiles(candidate_id) on delete set null,
  candidate_email text null,
  redeemed_by_profile_id uuid null references public.profiles(id) on delete set null,
  claimed_candidate_id uuid null references public.candidate_profiles(candidate_id) on delete set null,
  status text not null check (status in ('succeeded', 'rejected_conflict', 'rejected_invalid')),
  reason text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists claim_invite_redemptions_jti_key
  on public.claim_invite_redemptions (jti);
create index if not exists claim_invite_redemptions_candidate_idx
  on public.claim_invite_redemptions (candidate_id, created_at desc);
create index if not exists claim_invite_redemptions_redeemer_idx
  on public.claim_invite_redemptions (redeemed_by_profile_id, created_at desc);

create or replace function public.set_claim_invite_redemptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists claim_invite_redemptions_set_updated_at on public.claim_invite_redemptions;
create trigger claim_invite_redemptions_set_updated_at
before update on public.claim_invite_redemptions
for each row
execute function public.set_claim_invite_redemptions_updated_at();

alter table public.artifact_versions enable row level security;
alter table public.claim_invite_redemptions enable row level security;

drop policy if exists artifact_versions_select on public.artifact_versions;
create policy artifact_versions_select
on public.artifact_versions
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists artifact_versions_insert on public.artifact_versions;
create policy artifact_versions_insert
on public.artifact_versions
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists claim_invite_redemptions_select on public.claim_invite_redemptions;
create policy claim_invite_redemptions_select
on public.claim_invite_redemptions
for select
using (
  auth.uid() = redeemed_by_profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists claim_invite_redemptions_insert on public.claim_invite_redemptions;
create policy claim_invite_redemptions_insert
on public.claim_invite_redemptions
for insert
with check (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists claim_invite_redemptions_update on public.claim_invite_redemptions;
create policy claim_invite_redemptions_update
on public.claim_invite_redemptions
for update
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
)
with check (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert on table public.artifact_versions to authenticated;
grant all privileges on table public.artifact_versions to service_role;
grant select on table public.claim_invite_redemptions to authenticated;
grant all privileges on table public.claim_invite_redemptions to service_role;
grant execute on function public.set_claim_invite_redemptions_updated_at() to authenticated;
grant execute on function public.set_claim_invite_redemptions_updated_at() to service_role;
