alter table public.students
add column if not exists claimed boolean not null default false;

update public.students as students
set claimed = true
from public.candidate_profiles as candidate_profiles
where candidate_profiles.claimed = true
  and candidate_profiles.canonical_profile_id = students.profile_id;

create or replace function public.sync_students_claimed_from_candidate_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.canonical_profile_id is not null
     and old.canonical_profile_id is distinct from new.canonical_profile_id then
    update public.students
    set claimed = false
    where profile_id = old.canonical_profile_id
      and not exists (
        select 1
        from public.candidate_profiles as cp
        where cp.candidate_id <> new.candidate_id
          and cp.claimed = true
          and cp.canonical_profile_id = old.canonical_profile_id
      );
  end if;

  if new.canonical_profile_id is null then
    return new;
  end if;

  insert into public.students (profile_id, claimed, student_data)
  values (new.canonical_profile_id, coalesce(new.claimed, false), '{}'::jsonb)
  on conflict (profile_id)
  do update set claimed = excluded.claimed;

  return new;
end;
$$;

drop trigger if exists candidate_profiles_sync_students_claimed on public.candidate_profiles;
create trigger candidate_profiles_sync_students_claimed
after insert or update of claimed, canonical_profile_id on public.candidate_profiles
for each row
execute function public.sync_students_claimed_from_candidate_profiles();

grant execute on function public.sync_students_claimed_from_candidate_profiles() to authenticated;
grant execute on function public.sync_students_claimed_from_candidate_profiles() to service_role;
