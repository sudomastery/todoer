-- Todoer initial schema
-- Run via: supabase db push, or paste into the Supabase SQL editor.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color text not null default 'charcoal',
  is_inbox boolean not null default false,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- one inbox per user
create unique index projects_one_inbox_per_user
  on public.projects (user_id) where is_inbox;

create index projects_user_idx on public.projects (user_id);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index sections_project_idx on public.sections (project_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  parent_id uuid references public.tasks (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  description text not null default '',
  -- 1 = P1 (highest) .. 4 = P4 (none)
  priority smallint not null default 4 check (priority between 1 and 4),
  due_date date,
  -- set when the task has a specific time of day
  due_time time,
  -- recurrence rule, e.g. 'daily', 'weekly:MO', 'monthly:15', 'yearly'
  recurrence text,
  is_completed boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_idx on public.tasks (user_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_section_idx on public.tasks (section_id);
create index tasks_parent_idx on public.tasks (parent_id);
create index tasks_due_idx on public.tasks (user_id, due_date) where not is_completed;

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default 'charcoal',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (task_id, label_id)
);

create index task_labels_label_idx on public.task_labels (label_id);

-- ============================================================
-- updated_at trigger
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ============================================================
-- New user bootstrap: profile + Inbox project
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.projects (user_id, name, is_inbox, color)
  values (new.id, 'Inbox', true, 'grey');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Grants
-- RLS restricts rows; these grant the base table privileges that
-- signed-in users need. anon gets nothing: there is no public data.
-- ============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sections" on public.sections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own labels" on public.labels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own task_labels" on public.task_labels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.labels;
alter publication supabase_realtime add table public.task_labels;
