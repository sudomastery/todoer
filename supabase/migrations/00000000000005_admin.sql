-- Admin role and dashboard tooling.
--
-- Every admin action goes through a security definer function that checks
-- is_admin() itself, the same pattern delete_account() already uses to reach
-- auth.users. This keeps the service-role key out of the app entirely: the
-- client only ever calls these RPCs with its normal session.

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin'));

-- Seed the one admin account.
update public.profiles set role = 'admin' where lower(username) = 'sudomastery';

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  -- Intentionally not a foreign key: the row should still explain a deleted
  -- account's history after that account is gone.
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admins can read audit log" on public.admin_audit_log
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Whether the signed-in user is an admin. Used by the other functions below
-- and by the client to decide whether to show admin UI at all.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Every user for the admin dashboard: auth.users isn't reachable by regular
-- clients, so this has to run as a security definer.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  username text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz
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
           u.last_sign_in_at, u.banned_until
    from auth.users u
    join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- Bans a user for p_days days, or unbans immediately when p_days is 0.
-- Refuses to touch yourself or another admin.
create or replace function public.admin_ban_user(p_user_id uuid, p_days integer)
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
    jsonb_build_object('days', p_days)
  );
end;
$$;

revoke execute on function public.admin_ban_user(uuid, integer) from public;
grant execute on function public.admin_ban_user(uuid, integer) to authenticated;

-- Permanently deletes another user's account. Mirrors delete_account(),
-- targets an arbitrary user, and is logged. Refuses to touch yourself or
-- another admin - self-deletion already exists via the account settings.
create or replace function public.admin_delete_user(p_user_id uuid)
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
  if p_user_id = auth.uid() then
    raise exception 'cannot delete yourself here; use account settings';
  end if;

  select (role = 'admin'), email into v_target_is_admin, v_email
    from public.profiles where id = p_user_id;
  if v_target_is_admin then
    raise exception 'cannot delete an admin';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (auth.uid(), 'delete', p_user_id, jsonb_build_object('email', v_email));

  delete from auth.users where id = p_user_id;
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
