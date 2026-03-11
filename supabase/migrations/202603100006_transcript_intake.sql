create table if not exists public.transcript_parse_sessions (
  session_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  transcript_artifact_id uuid not null unique references public.artifacts(artifact_id) on delete cascade,
  status text not null check (status in ('uploaded', 'processing', 'parsed', 'failed')),
  parser_model text not null default 'gpt-5-mini',
  parse_error jsonb null,
  parse_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transcript_parse_sessions_parse_summary_object check (jsonb_typeof(parse_summary) = 'object'),
  constraint transcript_parse_sessions_parse_error_object_or_null check (
    parse_error is null or jsonb_typeof(parse_error) = 'object'
  )
);

create table if not exists public.transcript_parsed_courses (
  parsed_course_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.transcript_parse_sessions(session_id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  course_code text null,
  course_title text not null,
  term text null,
  credits numeric(6,2) null,
  grade text null,
  course_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transcript_parsed_courses_course_meta_object check (jsonb_typeof(course_meta) = 'object'),
  constraint transcript_parsed_courses_session_ordinal_key unique (session_id, ordinal)
);

create index if not exists transcript_parse_sessions_profile_created_status_idx
  on public.transcript_parse_sessions (profile_id, created_at desc, status);
create index if not exists transcript_parsed_courses_session_ordinal_idx
  on public.transcript_parsed_courses (session_id, ordinal);

create or replace function public.set_transcript_parse_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists transcript_parse_sessions_set_updated_at on public.transcript_parse_sessions;
create trigger transcript_parse_sessions_set_updated_at
before update on public.transcript_parse_sessions
for each row
execute function public.set_transcript_parse_sessions_updated_at();

create or replace function public.set_transcript_parsed_courses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists transcript_parsed_courses_set_updated_at on public.transcript_parsed_courses;
create trigger transcript_parsed_courses_set_updated_at
before update on public.transcript_parsed_courses
for each row
execute function public.set_transcript_parsed_courses_updated_at();

alter table public.transcript_parse_sessions enable row level security;
alter table public.transcript_parsed_courses enable row level security;

drop policy if exists transcript_parse_sessions_select on public.transcript_parse_sessions;
create policy transcript_parse_sessions_select
on public.transcript_parse_sessions
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists transcript_parse_sessions_insert on public.transcript_parse_sessions;
create policy transcript_parse_sessions_insert
on public.transcript_parse_sessions
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists transcript_parse_sessions_update on public.transcript_parse_sessions;
create policy transcript_parse_sessions_update
on public.transcript_parse_sessions
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

drop policy if exists transcript_parse_sessions_delete on public.transcript_parse_sessions;
create policy transcript_parse_sessions_delete
on public.transcript_parse_sessions
for delete
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists transcript_parsed_courses_select on public.transcript_parsed_courses;
create policy transcript_parsed_courses_select
on public.transcript_parsed_courses
for select
using (
  exists (
    select 1
    from public.transcript_parse_sessions as sessions
    where sessions.session_id = transcript_parsed_courses.session_id
      and (
        sessions.profile_id = auth.uid()
        or public.is_current_user_org_admin()
        or auth.role() = 'service_role'
      )
  )
);

drop policy if exists transcript_parsed_courses_insert on public.transcript_parsed_courses;
create policy transcript_parsed_courses_insert
on public.transcript_parsed_courses
for insert
with check (
  exists (
    select 1
    from public.transcript_parse_sessions as sessions
    where sessions.session_id = transcript_parsed_courses.session_id
      and (
        sessions.profile_id = auth.uid()
        or public.is_current_user_org_admin()
        or auth.role() = 'service_role'
      )
  )
);

drop policy if exists transcript_parsed_courses_update on public.transcript_parsed_courses;
create policy transcript_parsed_courses_update
on public.transcript_parsed_courses
for update
using (
  exists (
    select 1
    from public.transcript_parse_sessions as sessions
    where sessions.session_id = transcript_parsed_courses.session_id
      and (
        sessions.profile_id = auth.uid()
        or public.is_current_user_org_admin()
        or auth.role() = 'service_role'
      )
  )
)
with check (
  exists (
    select 1
    from public.transcript_parse_sessions as sessions
    where sessions.session_id = transcript_parsed_courses.session_id
      and (
        sessions.profile_id = auth.uid()
        or public.is_current_user_org_admin()
        or auth.role() = 'service_role'
      )
  )
);

drop policy if exists transcript_parsed_courses_delete on public.transcript_parsed_courses;
create policy transcript_parsed_courses_delete
on public.transcript_parsed_courses
for delete
using (
  exists (
    select 1
    from public.transcript_parse_sessions as sessions
    where sessions.session_id = transcript_parsed_courses.session_id
      and (
        sessions.profile_id = auth.uid()
        or public.is_current_user_org_admin()
        or auth.role() = 'service_role'
      )
  )
);

grant select, insert, update, delete on table public.transcript_parse_sessions to authenticated;
grant all privileges on table public.transcript_parse_sessions to service_role;
grant select, insert, update, delete on table public.transcript_parsed_courses to authenticated;
grant all privileges on table public.transcript_parsed_courses to service_role;

insert into storage.buckets (id, name, public)
values ('student-artifacts-private', 'student-artifacts-private', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists student_artifacts_private_select on storage.objects;
create policy student_artifacts_private_select
on storage.objects
for select
using (
  bucket_id = 'student-artifacts-private'
  and (
    auth.role() = 'service_role'
    or public.is_current_user_org_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

drop policy if exists student_artifacts_private_insert on storage.objects;
create policy student_artifacts_private_insert
on storage.objects
for insert
with check (
  bucket_id = 'student-artifacts-private'
  and (
    auth.role() = 'service_role'
    or public.is_current_user_org_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

drop policy if exists student_artifacts_private_update on storage.objects;
create policy student_artifacts_private_update
on storage.objects
for update
using (
  bucket_id = 'student-artifacts-private'
  and (
    auth.role() = 'service_role'
    or public.is_current_user_org_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
)
with check (
  bucket_id = 'student-artifacts-private'
  and (
    auth.role() = 'service_role'
    or public.is_current_user_org_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

drop policy if exists student_artifacts_private_delete on storage.objects;
create policy student_artifacts_private_delete
on storage.objects
for delete
using (
  bucket_id = 'student-artifacts-private'
  and (
    auth.role() = 'service_role'
    or public.is_current_user_org_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);
