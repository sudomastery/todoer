-- Account deletion: a signed-in user can delete their own account.
-- Security definer so it may delete from auth.users; the cascade wipes
-- profiles, projects, sections, tasks, labels, and task_labels.

create or replace function public.delete_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
