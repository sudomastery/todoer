-- Task comments: freeform notes attached to a task, in creation order.

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id);

grant select, insert, update, delete on public.task_comments to authenticated;

alter table public.task_comments enable row level security;

-- with check also verifies the task belongs to the commenter, so a user
-- cannot attach comments to another user's tasks
create policy "own task_comments" on public.task_comments
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.task_comments;
