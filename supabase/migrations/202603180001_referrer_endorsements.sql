create or replace function public.resolve_profile_role_from_metadata(raw_app_meta_data jsonb, raw_user_meta_data jsonb)
returns text
language plpgsql
stable
as $$
declare
  role_candidate text;
begin
  role_candidate := coalesce(
    raw_app_meta_data->>'stu_persona',
    raw_app_meta_data->>'role',
    raw_user_meta_data->>'stu_persona',
    raw_user_meta_data->>'role'
  );

  if role_candidate in ('student', 'recruiter', 'org_admin', 'admin', 'referrer') then
    return case when role_candidate = 'admin' then 'org_admin' else role_candidate end;
  end if;

  return null;
end;
$$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'recruiter', 'org_admin', 'referrer'));

create or replace function public.is_current_user_referrer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as profiles
    where profiles.id = auth.uid()
      and profiles.role = 'referrer'
  );
$$;

create or replace function public.is_current_user_recruiter_or_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as profiles
    where profiles.id = auth.uid()
      and profiles.role in ('recruiter', 'org_admin')
  );
$$;

create table if not exists public.referrers (
  referrer_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  referrer_data jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_referrers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists referrers_set_updated_at on public.referrers;
create trigger referrers_set_updated_at
before update on public.referrers
for each row
execute function public.set_referrers_updated_at();

create or replace function public.handle_profile_referrer_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'referrer' then
    insert into public.referrers (profile_id, onboarded_at)
    values (new.id, new.onboarding_completed_at)
    on conflict (profile_id) do update
      set onboarded_at = excluded.onboarded_at;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_created_referrer_row on public.profiles;
create trigger on_profile_created_referrer_row
after insert on public.profiles
for each row
execute function public.handle_profile_referrer_row();

create or replace function public.sync_referrer_onboarding_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.onboarded_at is distinct from old.onboarded_at then
    update public.profiles
    set onboarding_completed_at = new.onboarded_at
    where id = new.profile_id
      and role = 'referrer';
  end if;

  return new;
end;
$$;

drop trigger if exists referrers_sync_profile_onboarding on public.referrers;
create trigger referrers_sync_profile_onboarding
after insert or update on public.referrers
for each row
execute function public.sync_referrer_onboarding_to_profile();

insert into public.referrers (profile_id, onboarded_at)
select profiles.id, profiles.onboarding_completed_at
from public.profiles as profiles
left join public.referrers as referrers on referrers.profile_id = profiles.id
where profiles.role = 'referrer'
  and referrers.profile_id is null;

alter table public.referrers enable row level security;

drop policy if exists referrers_select on public.referrers;
create policy referrers_select
on public.referrers
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists referrers_insert on public.referrers;
create policy referrers_insert
on public.referrers
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists referrers_update on public.referrers;
create policy referrers_update
on public.referrers
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

drop policy if exists referrers_delete on public.referrers;
create policy referrers_delete
on public.referrers
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.referrers to authenticated;
grant all privileges on table public.referrers to service_role;

create table if not exists public.student_share_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  share_slug text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint student_share_links_slug_length_check check (char_length(share_slug) between 8 and 64)
);

create or replace function public.set_student_share_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists student_share_links_set_updated_at on public.student_share_links;
create trigger student_share_links_set_updated_at
before update on public.student_share_links
for each row
execute function public.set_student_share_links_updated_at();

create or replace function public.generate_student_share_slug(seed uuid)
returns text
language sql
immutable
as $$
  select lower(translate(seed::text, '-', ''));
$$;

create or replace function public.sync_student_share_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_share_links (profile_id, share_slug)
  values (new.profile_id, public.generate_student_share_slug(new.profile_id))
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists students_sync_share_link on public.students;
create trigger students_sync_share_link
after insert on public.students
for each row
execute function public.sync_student_share_link();

insert into public.student_share_links (profile_id, share_slug)
select students.profile_id, public.generate_student_share_slug(students.profile_id)
from public.students as students
left join public.student_share_links as links on links.profile_id = students.profile_id
where links.profile_id is null;

alter table public.student_share_links enable row level security;

drop policy if exists student_share_links_select on public.student_share_links;
create policy student_share_links_select
on public.student_share_links
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists student_share_links_insert on public.student_share_links;
create policy student_share_links_insert
on public.student_share_links
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists student_share_links_update on public.student_share_links;
create policy student_share_links_update
on public.student_share_links
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

drop policy if exists student_share_links_delete on public.student_share_links;
create policy student_share_links_delete
on public.student_share_links
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.student_share_links to authenticated;
grant all privileges on table public.student_share_links to service_role;

create or replace function public.resolve_student_share_profile(input_slug text)
returns table (
  profile_id uuid,
  share_slug text,
  full_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id as profile_id,
    links.share_slug,
    coalesce(
      nullif(trim(profiles.personal_info->>'full_name'), ''),
      nullif(trim(concat_ws(' ',
        nullif(trim(profiles.personal_info->>'first_name'), ''),
        nullif(trim(profiles.personal_info->>'last_name'), '')
      )), ''),
      nullif(split_part(coalesce(profiles.personal_info->>'email', ''), '@', 1), ''),
      'Student'
    ) as full_name,
    nullif(trim(coalesce(profiles.personal_info->>'avatar_url', profiles.personal_info->>'avatarUrl')), '') as avatar_url
  from public.student_share_links as links
  join public.profiles as profiles on profiles.id = links.profile_id
  where lower(links.share_slug) = lower(trim(input_slug))
    and profiles.role = 'student'
    and (
      auth.uid() = links.profile_id
      or public.is_current_user_referrer()
      or public.is_current_user_recruiter_or_org_admin()
      or auth.role() = 'service_role'
    )
  limit 1;
$$;

grant execute on function public.resolve_student_share_profile(text) to authenticated;
grant execute on function public.resolve_student_share_profile(text) to service_role;

create table if not exists public.endorsements (
  endorsement_id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  referrer_profile_id uuid not null references public.profiles(id) on delete cascade,
  student_share_slug text not null,
  student_full_name text not null,
  student_avatar_url text null,
  referrer_full_name text not null,
  referrer_company text null,
  referrer_position text null,
  referrer_linkedin_url text null,
  endorsement_text text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint endorsements_referrer_student_key unique (referrer_profile_id, student_profile_id),
  constraint endorsements_text_not_empty check (char_length(trim(endorsement_text)) > 0),
  constraint endorsements_text_max_length check (char_length(endorsement_text) <= 4000)
);

create or replace function public.set_endorsements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists endorsements_set_updated_at on public.endorsements;
create trigger endorsements_set_updated_at
before update on public.endorsements
for each row
execute function public.set_endorsements_updated_at();

create or replace function public.validate_endorsement_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_role text;
  referrer_role text;
begin
  select role into student_role
  from public.profiles
  where id = new.student_profile_id;

  if student_role is distinct from 'student' then
    raise exception 'endorsements.student_profile_id must reference a student profile';
  end if;

  select role into referrer_role
  from public.profiles
  where id = new.referrer_profile_id;

  if referrer_role is distinct from 'referrer' then
    raise exception 'endorsements.referrer_profile_id must reference a referrer profile';
  end if;

  return new;
end;
$$;

drop trigger if exists endorsements_validate_roles on public.endorsements;
create trigger endorsements_validate_roles
before insert or update on public.endorsements
for each row
execute function public.validate_endorsement_roles();

alter table public.endorsements enable row level security;

drop policy if exists endorsements_select on public.endorsements;
create policy endorsements_select
on public.endorsements
for select
using (
  auth.uid() = student_profile_id
  or auth.uid() = referrer_profile_id
  or public.is_current_user_recruiter_or_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists endorsements_insert on public.endorsements;
create policy endorsements_insert
on public.endorsements
for insert
with check (
  (
    auth.uid() = referrer_profile_id
    and public.is_current_user_referrer()
  )
  or auth.role() = 'service_role'
);

drop policy if exists endorsements_update on public.endorsements;
create policy endorsements_update
on public.endorsements
for update
using (
  (
    auth.uid() = referrer_profile_id
    and public.is_current_user_referrer()
  )
  or auth.role() = 'service_role'
)
with check (
  (
    auth.uid() = referrer_profile_id
    and public.is_current_user_referrer()
  )
  or auth.role() = 'service_role'
);

drop policy if exists endorsements_delete on public.endorsements;
create policy endorsements_delete
on public.endorsements
for delete
using (
  auth.uid() = referrer_profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.endorsements to authenticated;
grant all privileges on table public.endorsements to service_role;
