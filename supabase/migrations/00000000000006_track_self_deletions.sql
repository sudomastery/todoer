-- Track self-initiated account deletions in the audit log too, so the admin
-- dashboard's "lost" stat reflects real account loss, not just admin-
-- initiated removals.
--
-- admin_id previously cascaded away along with the deleted account, which
-- would have erased the very row meant to record that the account was
-- deleted. Switching to "on delete set null" lets the row outlive the
-- account it describes.

alter table public.admin_audit_log alter column admin_id drop not null;
alter table public.admin_audit_log drop constraint admin_audit_log_admin_id_fkey;
alter table public.admin_audit_log add constraint admin_audit_log_admin_id_fkey
  foreign key (admin_id) references auth.users (id) on delete set null;

create or replace function public.delete_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select email into v_email from public.profiles where id = v_uid;

  insert into public.admin_audit_log (admin_id, action, target_user_id, detail)
  values (v_uid, 'self_delete', v_uid, jsonb_build_object('email', v_email));

  delete from auth.users where id = v_uid;
end;
$$;
