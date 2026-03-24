alter table public.students
add column if not exists email text null;

insert into public.students (profile_id, email, student_data)
select
  profiles.id,
  nullif(lower(trim(coalesce(profiles.personal_info->>'email', ''))), '') as email,
  '{}'::jsonb as student_data
from public.profiles as profiles
left join public.students as students on students.profile_id = profiles.id
where profiles.role = 'student'
  and students.profile_id is null;

update public.students as students
set email = nullif(lower(trim(coalesce(profiles.personal_info->>'email', ''))), '')
from public.profiles as profiles
where profiles.id = students.profile_id
  and profiles.role = 'student';

create index if not exists students_email_lookup_idx
  on public.students (lower(trim(email)))
  where email is not null and char_length(trim(email)) > 0;

create or replace function public.hydrate_student_email_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and char_length(trim(new.email)) > 0 then
    new.email := lower(trim(new.email));
    return new;
  end if;

  select nullif(lower(trim(coalesce(profiles.personal_info->>'email', ''))), '')
  into new.email
  from public.profiles as profiles
  where profiles.id = new.profile_id
    and profiles.role = 'student';

  return new;
end;
$$;

drop trigger if exists students_hydrate_email on public.students;
create trigger students_hydrate_email
before insert or update on public.students
for each row
execute function public.hydrate_student_email_from_profile();

create or replace function public.sync_student_email_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
begin
  if new.role <> 'student' then
    return new;
  end if;

  normalized_email := nullif(lower(trim(coalesce(new.personal_info->>'email', ''))), '');

  insert into public.students (profile_id, email, student_data)
  values (new.id, normalized_email, '{}'::jsonb)
  on conflict (profile_id)
  do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists profiles_sync_student_email on public.profiles;
create trigger profiles_sync_student_email
after insert or update of personal_info, role on public.profiles
for each row
execute function public.sync_student_email_from_profile();

grant execute on function public.sync_student_email_from_profile() to authenticated;
grant execute on function public.sync_student_email_from_profile() to service_role;
grant execute on function public.hydrate_student_email_from_profile() to authenticated;
grant execute on function public.hydrate_student_email_from_profile() to service_role;
