-- Move student share URLs to professional handle-style slugs and stop deriving from profile_id.

alter table public.student_share_links
  drop constraint if exists student_share_links_slug_length_check;

alter table public.student_share_links
  drop constraint if exists student_share_links_slug_format_check;

update public.student_share_links
set share_slug = lower(trim(share_slug))
where share_slug <> lower(trim(share_slug));

create or replace function public.slugify_student_share_handle(input_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.generate_student_share_slug_for_profile(input_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base_source text;
  base_slug text;
  candidate text;
  attempt int := 0;
  suffix text;
begin
  select coalesce(
      nullif(trim((profiles.personal_info->>'full_name')), ''),
      nullif(trim(concat_ws(' ',
        nullif(trim(profiles.personal_info->>'first_name'), ''),
        nullif(trim(profiles.personal_info->>'last_name'), '')
      )), ''),
      nullif(split_part(lower(trim(coalesce(profiles.personal_info->>'email', ''))), '@', 1), ''),
      'student'
    )
    into base_source
  from public.profiles
  where profiles.id = input_profile_id;

  base_slug := public.slugify_student_share_handle(base_source);
  if base_slug is null or char_length(base_slug) < 3 then
    base_slug := 'student';
  end if;

  -- Reserve room for collision suffix (e.g. "-01abcd").
  if char_length(base_slug) > 57 then
    base_slug := trim(both '-' from left(base_slug, 57));
  end if;
  if char_length(base_slug) < 3 then
    base_slug := 'student';
  end if;

  loop
    if attempt = 0 then
      candidate := base_slug;
    else
      suffix := '-' || to_char(attempt, 'FM00') || substring(md5(input_profile_id::text) from 1 for 4);
      candidate := trim(both '-' from left(base_slug, 64 - char_length(suffix)) || suffix);
      if char_length(candidate) < 3 then
        candidate := 'student' || suffix;
      end if;
    end if;

    exit when not exists (
      select 1
      from public.student_share_links as links
      where links.share_slug = candidate
        and links.profile_id <> input_profile_id
    );

    attempt := attempt + 1;
    if attempt > 99 then
      raise exception 'unable to generate unique student share slug for %', input_profile_id;
    end if;
  end loop;

  return candidate;
end;
$$;

create or replace function public.generate_student_share_slug(seed uuid)
returns text
language sql
stable
as $$
  select public.generate_student_share_slug_for_profile(seed);
$$;

create or replace function public.sync_student_share_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_share_links (profile_id, share_slug)
  values (new.profile_id, public.generate_student_share_slug_for_profile(new.profile_id))
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

do $$
declare
  link_row record;
  next_slug text;
begin
  for link_row in
    select links.profile_id
    from public.student_share_links as links
    where links.share_slug ~ '^[a-f0-9]{32}$'
    order by links.profile_id
  loop
    next_slug := public.generate_student_share_slug_for_profile(link_row.profile_id);
    update public.student_share_links
    set share_slug = next_slug,
        updated_at = timezone('utc'::text, now())
    where profile_id = link_row.profile_id
      and share_slug <> next_slug;
  end loop;
end;
$$;

alter table public.student_share_links
  add constraint student_share_links_slug_format_check
  check (share_slug ~ '^[a-z0-9](?:[a-z0-9_-]{1,62}[a-z0-9])?$');
