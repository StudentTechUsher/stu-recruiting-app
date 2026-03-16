create table if not exists public.ai_feature_usage (
  usage_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_feature_usage_feature_key_non_empty check (char_length(trim(feature_key)) > 0),
  constraint ai_feature_usage_profile_feature_key unique (profile_id, feature_key)
);

create index if not exists ai_feature_usage_profile_feature_idx
  on public.ai_feature_usage (profile_id, feature_key);

create or replace function public.set_ai_feature_usage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists ai_feature_usage_set_updated_at on public.ai_feature_usage;
create trigger ai_feature_usage_set_updated_at
before update on public.ai_feature_usage
for each row
execute function public.set_ai_feature_usage_updated_at();

alter table public.ai_feature_usage enable row level security;

drop policy if exists ai_feature_usage_select on public.ai_feature_usage;
create policy ai_feature_usage_select
on public.ai_feature_usage
for select
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_feature_usage_insert on public.ai_feature_usage;
create policy ai_feature_usage_insert
on public.ai_feature_usage
for insert
with check (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

drop policy if exists ai_feature_usage_update on public.ai_feature_usage;
create policy ai_feature_usage_update
on public.ai_feature_usage
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

drop policy if exists ai_feature_usage_delete on public.ai_feature_usage;
create policy ai_feature_usage_delete
on public.ai_feature_usage
for delete
using (
  auth.uid() = profile_id
  or public.is_current_user_org_admin()
  or auth.role() = 'service_role'
);

create or replace function public.consume_ai_feature_quota(p_feature_key text, p_max_uses integer default 5)
returns table (
  allowed boolean,
  used_count integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_feature_key text := lower(trim(p_feature_key));
  v_next_count integer;
begin
  if v_profile_id is null then
    raise exception 'ai_feature_quota_unauthenticated';
  end if;

  if v_feature_key is null or char_length(v_feature_key) = 0 then
    raise exception 'ai_feature_quota_invalid_feature_key';
  end if;

  if p_max_uses is null or p_max_uses < 1 then
    raise exception 'ai_feature_quota_invalid_max_uses';
  end if;

  insert into public.ai_feature_usage (profile_id, feature_key, used_count)
  values (v_profile_id, v_feature_key, 0)
  on conflict (profile_id, feature_key) do nothing;

  update public.ai_feature_usage
  set used_count = used_count + 1
  where profile_id = v_profile_id
    and feature_key = v_feature_key
    and used_count < p_max_uses
  returning ai_feature_usage.used_count into v_next_count;

  if v_next_count is not null then
    allowed := true;
    used_count := v_next_count;
  else
    allowed := false;
    select usage.used_count
      into used_count
      from public.ai_feature_usage as usage
      where usage.profile_id = v_profile_id
        and usage.feature_key = v_feature_key;
    used_count := coalesce(used_count, 0);
  end if;

  remaining := greatest(p_max_uses - used_count, 0);
  return next;
end;
$$;

revoke all on function public.consume_ai_feature_quota(text, integer) from public;
grant execute on function public.consume_ai_feature_quota(text, integer) to authenticated;
grant execute on function public.consume_ai_feature_quota(text, integer) to service_role;

grant select, insert, update, delete on table public.ai_feature_usage to authenticated;
grant all privileges on table public.ai_feature_usage to service_role;
