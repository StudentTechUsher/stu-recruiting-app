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

  if role_candidate in ('student', 'recruiter', 'org_admin', 'admin') then
    return case when role_candidate = 'admin' then 'org_admin' else role_candidate end;
  end if;

  return null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'recruiter', 'org_admin')),
  personal_info jsonb not null default '{}'::jsonb,
  auth_preferences jsonb not null default '{"passkeys_enabled": false}'::jsonb,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role text;
  resolved_personal_info jsonb;
begin
  resolved_role := coalesce(
    public.resolve_profile_role_from_metadata(new.raw_app_meta_data, new.raw_user_meta_data),
    'student'
  );

  resolved_personal_info := jsonb_strip_nulls(
    jsonb_build_object(
      'first_name', coalesce(new.raw_user_meta_data->>'first_name', null),
      'full_name', coalesce(new.raw_user_meta_data->>'full_name', null),
      'email', new.email
    )
  );

  insert into public.profiles (id, role, personal_info)
  values (new.id, resolved_role, resolved_personal_info)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_auth_user_profile();

insert into public.profiles (id, role, personal_info)
select
  users.id,
  coalesce(public.resolve_profile_role_from_metadata(users.raw_app_meta_data, users.raw_user_meta_data), 'student') as role,
  jsonb_strip_nulls(
    jsonb_build_object(
      'first_name', coalesce(users.raw_user_meta_data->>'first_name', null),
      'full_name', coalesce(users.raw_user_meta_data->>'full_name', null),
      'email', users.email
    )
  ) as personal_info
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;

alter table public.profiles enable row level security;

create or replace function public.is_current_user_org_admin()
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
      and profiles.role = 'org_admin'
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
using (
  auth.uid() = id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
on public.profiles
for insert
with check (
  auth.uid() = id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update
using (
  auth.uid() = id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
)
with check (
  auth.uid() = id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
on public.profiles
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;
