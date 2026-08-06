-- Admin dashboard v2: search/filter/sort/pagination, ban+delete reasons,
-- a per-admin rate limit on destructive actions, promote/demote, and basic
-- DB size stats.
--
-- admin_list_users and admin_ban_user/admin_delete_user change shape, so the
-- old signatures are dropped first rather than "create or replace" - adding
-- columns/params in place would either fail (return type changed) or leave
-- both old and new overloads registered, which confuses PostgREST's RPC
-- dispatch.

drop function if exists public.admin_list_users();
drop function if exists public.admin_ban_user(uuid, integer);
drop function if exists public.admin_delete_user(uuid);

-- Shared guard: raises if the calling admin has logged too many actions
-- recently. Protects against a compromised admin session (or a fat-fingered
-- loop) tearing through the user table.
create or replace function public.admin_check_rate_limit()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if (
    select count(*) from public.admin_audit_log
    where admin_id = auth.uid() and created_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'too many admin actions in the last 10 minutes; wait a bit and try again';
  end if;
end;
$$;

revoke execute on function public.admin_check_rate_limit() from public;
grant execute on function public.admin_check_rate_limit() to authenticated;

-- Every user for the admin dashboard, now with search/filter/sort/pagination.
-- Sort is picked via CASE-per-column rather than dynamic SQL so p_sort/
-- p_sort_dir can never reach the query as raw text.
create or replace function public.admin_list_users(
  p_search text default null,
  p_role text default null,
  p_banned_only boolean default false,
  p_sort text default 'created_at',
  p_sort_dir text default 'desc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  username text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  email_confirmed_at timestamptz,
  total_count bigint
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select u.id, u.email::text, p.username, p.full_name, p.role, u.created_at,
           u.last_sign_in_at, u.banned_until, u.email_confirmed_at,
           count(*) over() as total_count
    from auth.users u
    join public.profiles p on p.id = u.id
    where
      (p_search is null or p_search = '' or
        u.email ilike '%' || p_search || '%' or
        p.username ilike '%' || p_search || '%' or
        p.full_name ilike '%' || p_search || '%')
      and (p_role is null or p_role = '' or p.role = p_role)
      and (not p_banned_only or (u.banned_until is not null and u.banned_until > now()))
    order by
      case when p_sort = 'last_sign_in_at' and p_sort_dir = 'asc' then u.last_sign_in_at end asc nulls last,
      case when p_sort = 'last_sign_in_at' and p_sort_dir = 'desc' then u.last_sign_in_at end desc nulls last,
      case when p_sort = 'created_at' and p_sort_dir = 'asc' then u.created_at end asc,
      case when p_sort = 'created_at' and p_sort_dir = 'desc' then u.created_at end desc,
      u.created_at desc
    limit least(p_limit, 200) offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.admin_list_users(text, text, boolean, text, text, integer, integer) from public;
grant execute on function public.admin_list_users(text, text, boolean, text, text, integer, integer) to authenticated;

-- Bans a user for p_days days, or unbans immediately when p_days is 0.
-- Refuses to touch yourself or another admin. p_reason is free text for the
-- audit trail only.
create or replace function public.admin_ban_user(p_user_id uuid, p_days integer, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_target_is_admin boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  perform public.admin_check_rate_limit();
  if p_user_id = auth.uid() then
    raise exception 'cannot ban yourself';
  end if;

  select (role = 'admin') into v_target_is_admin from public.profiles where id = p_user_id;
  if v_target_is_admin then
    raise exception 'cannot ban an admin';
  end if;

  update auth.users
    set banned_until = case when p_days > 0 then now() + (p_days || ' days')::interval else null end
    where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (
    auth.uid(),
    case when p_days > 0 then 'ban' else 'unban' end,
    p_user_id,
    jsonb_build_object('days', p_days, 'reason', p_reason)
  );
end;
$$;

revoke execute on function public.admin_ban_user(uuid, integer, text) from public;
grant execute on function public.admin_ban_user(uuid, integer, text) to authenticated;

-- Permanently deletes another user's account. Refuses to touch yourself or
-- another admin - self-deletion already exists via account settings.
create or replace function public.admin_delete_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_target_is_admin boolean;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  perform public.admin_check_rate_limit();
  if p_user_id = auth.uid() then
    raise exception 'cannot delete yourself here; use account settings';
  end if;

  select (role = 'admin'), email into v_target_is_admin, v_email
    from public.profiles where id = p_user_id;
  if v_target_is_admin then
    raise exception 'cannot delete an admin';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (auth.uid(), 'delete', p_user_id, jsonb_build_object('email', v_email, 'reason', p_reason));

  delete from auth.users where id = p_user_id;
end;
$$;

revoke execute on function public.admin_delete_user(uuid, text) from public;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;

-- Promotes or demotes another user. Never targets yourself (avoids an admin
-- locking themselves out or promoting under duress with no second party) and
-- refuses to demote the last remaining admin.
create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  perform public.admin_check_rate_limit();
  if p_role not in ('user', 'admin') then
    raise exception 'invalid role';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot change your own role';
  end if;

  if p_role = 'user' then
    select count(*) into v_admin_count from public.profiles where role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot remove the last admin';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (
    auth.uid(),
    case when p_role = 'admin' then 'promote' else 'demote' end,
    p_user_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

revoke execute on function public.admin_set_role(uuid, text, text) from public;
grant execute on function public.admin_set_role(uuid, text, text) to authenticated;

-- Paginated audit log with admin/target emails joined in, so the dashboard
-- doesn't have to show raw uuids. target_email falls back to the email
-- captured in detail at the time of the action, since a deleted target's
-- profile row is gone by the time this is read.
create or replace function public.admin_audit_log_page(p_limit integer default 25, p_offset integer default 0)
returns table (
  id uuid,
  admin_id uuid,
  admin_email text,
  action text,
  target_user_id uuid,
  target_email text,
  detail jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      l.id, l.admin_id, ap.email, l.action, l.target_user_id,
      coalesce(tp.email, l.detail->>'email'), l.detail, l.created_at,
      count(*) over() as total_count
    from public.admin_audit_log l
    left join public.profiles ap on ap.id = l.admin_id
    left join public.profiles tp on tp.id = l.target_user_id
    order by l.created_at desc
    limit least(p_limit, 200) offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.admin_audit_log_page(integer, integer) from public;
grant execute on function public.admin_audit_log_page(integer, integer) to authenticated;

-- Headline dashboard numbers, computed server-side so they stay correct once
-- admin_list_users is paginated (a page of 25 rows can no longer be counted
-- client-side to get a total).
create or replace function public.admin_stats(p_days integer default 30)
returns table (total_users bigint, gained bigint, lost bigint)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from public.profiles),
      (select count(*) from auth.users where created_at >= now() - (p_days || ' days')::interval),
      (
        select count(distinct target_user_id) from public.admin_audit_log
        where action in ('delete', 'self_delete') and created_at >= now() - (p_days || ' days')::interval
      );
end;
$$;

revoke execute on function public.admin_stats(integer) from public;
grant execute on function public.admin_stats(integer) to authenticated;

-- Total DB size plus the largest tables in the public schema, so the
-- dashboard can show storage headroom without a Supabase management API key.
create or replace function public.admin_db_stats()
returns table (db_size_bytes bigint, table_sizes jsonb)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      pg_database_size(current_database()),
      (
        select coalesce(jsonb_agg(t), '[]'::jsonb) from (
          select
            c.relname as table_name,
            pg_total_relation_size(c.oid) as size_bytes
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
          order by pg_total_relation_size(c.oid) desc
          limit 8
        ) t
      );
end;
$$;

revoke execute on function public.admin_db_stats() from public;
grant execute on function public.admin_db_stats() to authenticated;
