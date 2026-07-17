'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Hash, Search } from 'lucide-react';
import { colorHex, formatDue, type TaskWithLabels } from '@todoer/shared';
import { useActiveTasks, useProjects } from '@/lib/hooks';
import { TaskCheckbox } from '@/components/task-item';
import { useCompleteTask } from '@/lib/hooks';
import { Dialog, DialogContent } from '@/components/ui';

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const completeTask = useCompleteTask();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { tasks: [] as TaskWithLabels[], projects: [] };
    return {
      tasks: (tasks ?? [])
        .filter(
          (t) =>
            t.content.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
        )
        .slice(0, 12),
      projects: (projects ?? []).filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query, tasks, projects]);

  function close() {
    onOpenChange(false);
    setQuery('');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent title="Search" hideClose className="top-16 p-0">
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
          <Search className="h-4 w-4 text-fg-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks and projects"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-faint"
          />
          <kbd className="rounded border border-border-strong px-1.5 py-0.5 text-[10px] text-fg-faint">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {results.projects.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-fg-secondary">Projects</div>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    router.push(`/app/project/${p.id}`);
                    close();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-bg-hover"
                >
                  <Hash className="h-4 w-4" style={{ color: colorHex(p.color) }} />
                  {p.name}
                </button>
              ))}
            </>
          )}

          {results.tasks.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-fg-secondary">Tasks</div>
              {results.tasks.map((t) => {
                const project = (projects ?? []).find((p) => p.id === t.project_id);
                return (
                  <div
                    key={t.id}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-hover"
                  >
                    <TaskCheckbox
                      priority={t.priority}
                      checked={false}
                      onToggle={() => completeTask.mutate(t)}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => {
                        router.push(`/app/project/${t.project_id}`);
                        close();
                      }}
                    >
                      <span className="truncate">{t.content}</span>
                      {t.due_date && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-fg-faint">
                          <CalendarDays className="h-3 w-3" />
                          {formatDue(t.due_date, t.due_time)}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-fg-faint">
                        {project?.name}
                      </span>
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {query && results.tasks.length === 0 && results.projects.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-fg-faint">No results for “{query}”</p>
          )}
          {!query && (
            <p className="px-2 py-6 text-center text-sm text-fg-faint">
              Type to search your tasks and projects
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
