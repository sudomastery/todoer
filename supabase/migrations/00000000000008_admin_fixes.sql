-- Fixes from code review of the admin dashboard v2 migration:
--   1. admin_set_role's last-admin check raced across concurrent demotions
--      (two unlocked COUNT reads could both pass before either UPDATE
--      committed) - serialized with a transaction-scoped advisory lock.
--   2. admin_ban_user/admin_delete_user read the target's admin status with
--      a plain SELECT, racing a concurrent admin_set_role promotion - now
--      locks the target's profile row first, so it waits for any in-flight
--      role change and reads the post-commit value.
--   3. admin_ban_user and admin_set_role never captured the target's email,
--      so a ban/promote/demote entry became unreadable ("an account")
--      after the target was later deleted.
--   4. Self-deletion audit rows showed "A deleted admin" as the actor even
--      though detail already carries that person's email - the admin_email
--      lookup now falls back to it for self_delete rows specifically (never
--      for other actions, where detail.email belongs to the target).
--   5. No index backed admin_check_rate_limit's per-admin, per-window scan.

create index if not exists admin_audit_log_admin_created_idx
  on public.admin_audit_log (admin_id, created_at);

create or replace function public.admin_ban_user(p_user_id uuid, p_days integer, p_reason text default null)
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
    raise exception 'cannot ban yourself';
  end if;

  select (role = 'admin'), email into v_target_is_admin, v_email
    from public.profiles where id = p_user_id for update;
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
    jsonb_build_object('days', p_days, 'reason', p_reason, 'email', v_email)
  );
end;
$$;

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
    from public.profiles where id = p_user_id for update;
  if v_target_is_admin then
    raise exception 'cannot delete an admin';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (auth.uid(), 'delete', p_user_id, jsonb_build_object('email', v_email, 'reason', p_reason));

  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin_count integer;
  v_email text;
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

  -- Serializes concurrent role changes so the last-admin count below can't
  -- be read by two demotions before either commits.
  perform pg_advisory_xact_lock(hashtext('admin_role_change'));

  if p_role = 'user' then
    select count(*) into v_admin_count from public.profiles where role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot remove the last admin';
    end if;
  end if;

  select email into v_email from public.profiles where id = p_user_id;
  update public.profiles set role = p_role where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (
    auth.uid(),
    case when p_role = 'admin' then 'promote' else 'demote' end,
    p_user_id,
    jsonb_build_object('reason', p_reason, 'email', v_email)
  );
end;
$$;

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
      l.id, l.admin_id,
      coalesce(ap.email, case when l.action = 'self_delete' then l.detail->>'email' end),
      l.action, l.target_user_id,
      coalesce(tp.email, l.detail->>'email'), l.detail, l.created_at,
      count(*) over() as total_count
    from public.admin_audit_log l
    left join public.profiles ap on ap.id = l.admin_id
    left join public.profiles tp on tp.id = l.target_user_id
    order by l.created_at desc
    limit least(p_limit, 200) offset greatest(p_offset, 0);
end;
$$;
