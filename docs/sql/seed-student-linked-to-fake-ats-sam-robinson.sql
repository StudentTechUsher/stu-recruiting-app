-- Purpose:
-- Create a student profile + student record intentionally linked to a fake Greenhouse ATS candidate.
--
-- Fake ATS target (from .greenhouse-dev.db):
--   candidate_id: 19
--   name: Sam Robinson
--   email: sam.r@example.com
--   active applications:
--     - app 60 -> Data Scientist (job_id 5)
--     - app 19 -> Software Engineer - Backend (job_id 1)
--
-- Link mechanism:
-- Exact email match between ATS candidate email and public.profiles.personal_info->>'email'.

begin;

-- Resolve a user id:
-- 1) reuse existing auth user for sam.r@example.com if present
-- 2) otherwise use this stable UUID and create auth user
create temporary table if not exists _seed_ctx (user_id uuid not null primary key) on commit drop;
truncate table _seed_ctx;

insert into _seed_ctx (user_id)
select users.id
from auth.users as users
where lower(users.email) = 'sam.r@example.com'
limit 1;

insert into _seed_ctx (user_id)
select '11111111-1111-4111-8111-111111111119'::uuid
where not exists (select 1 from _seed_ctx);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  ctx.user_id,
  'authenticated',
  'authenticated',
  'sam.r@example.com',
  crypt('TempPass123!', gen_salt('bf')),
  timezone('utc'::text, now()),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'first_name', 'Sam',
    'last_name', 'Robinson',
    'full_name', 'Sam Robinson',
    'stu_persona', 'student'
  ),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from _seed_ctx as ctx
where not exists (
  select 1
  from auth.users as users
  where users.id = ctx.user_id
);

insert into public.profiles (id, role, personal_info)
select
  ctx.user_id,
  'student',
  jsonb_build_object(
    'first_name', 'Sam',
    'last_name', 'Robinson',
    'full_name', 'Sam Robinson',
    'email', 'sam.r@example.com'
  )
from _seed_ctx as ctx
on conflict (id) do update
set
  role = excluded.role,
  personal_info = excluded.personal_info,
  updated_at = timezone('utc'::text, now());

insert into public.students (profile_id, student_data)
select
  ctx.user_id,
  jsonb_build_object(
    'university', 'BYU',
    'graduation_year', 2026,
    'major', 'Computer Science',
    'employer_visibility_opt_in', true,
    'target_roles', jsonb_build_array('Data Scientist', 'Software Engineer - Backend'),
    'target_companies', jsonb_build_array(),
    'preferred_locations', jsonb_build_array('Utah')
  )
from _seed_ctx as ctx
on conflict (profile_id) do update
set
  student_data = excluded.student_data,
  updated_at = timezone('utc'::text, now());

-- Optional: create a share link only when that table exists in this environment.
do $$
begin
  if to_regclass('public.student_share_links') is not null then
    if to_regprocedure('public.generate_student_share_slug(uuid)') is not null then
      insert into public.student_share_links (profile_id, share_slug)
      select
        ctx.user_id,
        public.generate_student_share_slug(ctx.user_id)
      from _seed_ctx as ctx
      on conflict (profile_id) do nothing;
    else
      insert into public.student_share_links (profile_id, share_slug)
      select
        ctx.user_id,
        lower(replace(ctx.user_id::text, '-', ''))
      from _seed_ctx as ctx
      on conflict (profile_id) do nothing;
    end if;
  end if;
end
$$;

commit;

-- Quick verification:
-- select
--   p.id,
--   p.personal_info->>'full_name' as full_name,
--   p.personal_info->>'email' as email,
--   s.student_data->>'employer_visibility_opt_in' as employer_visibility_opt_in,
--   l.share_slug
-- from public.profiles p
-- join public.students s on s.profile_id = p.id
-- left join public.student_share_links l on l.profile_id = p.id
-- where p.personal_info->>'email' = 'sam.r@example.com';
