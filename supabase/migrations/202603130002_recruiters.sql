create table if not exists public.recruiters (
  recruiter_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  recruiter_data jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_recruiters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists recruiters_set_updated_at on public.recruiters;
create trigger recruiters_set_updated_at
before update on public.recruiters
for each row
execute function public.set_recruiters_updated_at();

create or replace function public.handle_profile_recruiter_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'recruiter' then
    insert into public.recruiters (profile_id, onboarded_at)
    values (new.id, new.onboarding_completed_at)
    on conflict (profile_id) do update
      set onboarded_at = excluded.onboarded_at;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_created_recruiter_row on public.profiles;
create trigger on_profile_created_recruiter_row
after insert on public.profiles
for each row
execute function public.handle_profile_recruiter_row();

create or replace function public.sync_recruiter_onboarding_to_profile()
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
      and role = 'recruiter';
  end if;

  return new;
end;
$$;

drop trigger if exists recruiters_sync_profile_onboarding on public.recruiters;
create trigger recruiters_sync_profile_onboarding
after insert or update on public.recruiters
for each row
execute function public.sync_recruiter_onboarding_to_profile();

insert into public.recruiters (profile_id, onboarded_at)
select profiles.id, profiles.onboarding_completed_at
from public.profiles as profiles
left join public.recruiters as recruiters on recruiters.profile_id = profiles.id
where profiles.role = 'recruiter'
  and recruiters.profile_id is null;

alter table public.recruiters enable row level security;

drop policy if exists recruiters_select on public.recruiters;
create policy recruiters_select
on public.recruiters
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiters_insert on public.recruiters;
create policy recruiters_insert
on public.recruiters
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists recruiters_update on public.recruiters;
create policy recruiters_update
on public.recruiters
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

drop policy if exists recruiters_delete on public.recruiters;
create policy recruiters_delete
on public.recruiters
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.recruiters to authenticated;
grant all privileges on table public.recruiters to service_role;
