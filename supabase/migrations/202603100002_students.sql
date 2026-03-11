create table if not exists public.students (
  student_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  student_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_students_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row
execute function public.set_students_updated_at();

insert into public.students (profile_id, student_data)
select profiles.id, '{}'::jsonb
from public.profiles as profiles
left join public.students as students on students.profile_id = profiles.id
where profiles.role = 'student'
  and students.profile_id is null;

alter table public.students enable row level security;

drop policy if exists students_select on public.students;
create policy students_select
on public.students
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists students_insert on public.students;
create policy students_insert
on public.students
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists students_update on public.students;
create policy students_update
on public.students
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

drop policy if exists students_delete on public.students;
create policy students_delete
on public.students
for delete
using (
  public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

grant select, insert, update on table public.students to authenticated;
grant all privileges on table public.students to service_role;
