-- Usernames: a unique handle per user that can be used to log in.

alter table public.profiles
  add column username text
  check (username ~ '^[A-Za-z0-9_]{3,30}$');

-- case-insensitive uniqueness: "Roy" and "roy" are the same handle
create unique index profiles_username_unique
  on public.profiles (lower(username));

-- Store the username chosen at signup (passed as auth metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', '')
  );

  insert into public.projects (user_id, name, is_inbox, color)
  values (new.id, 'Inbox', true, 'grey');

  return new;
end;
$$;

-- Login with a username: resolve it to the account email.
-- Security definer so the login page (anon role) can resolve without
-- read access to profiles. Callers must know the exact username.
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.profiles where lower(username) = lower(p_username);
$$;

-- Signup-time availability check.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

revoke execute on function public.email_for_username(text) from public;
revoke execute on function public.username_available(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
