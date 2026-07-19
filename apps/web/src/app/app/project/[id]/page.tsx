'use client';

import { use, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useActiveTasks,
  useCompletedTasks,
  useCreateSection,
  useDeleteSection,
  useProjects,
  useSections,
  useUpdateSection,
} from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/display';
import { AddTaskButton, TaskList } from '@/components/task-list';
import { TaskView } from '@/components/task-view';
import { DisplayMenu } from '@/components/display-menu';
import { ProjectDialog } from '@/components/project-dialog';
import { TaskListSkeleton } from '@/components/loading';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
} from '@/components/ui';

function SectionBlock({
  sectionId,
  name,
  projectId,
}: {
  sectionId: string | null;
  name: string | null;
  projectId: string;
}) {
  const { data: tasks } = useActiveTasks();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const all = tasks ?? [];
  const sectionTasks = all.filter(
    (t) => t.project_id === projectId && (t.section_id ?? null) === sectionId,
  );

  if (sectionId === null && sectionTasks.length === 0) return null;

  return (
    <section className="mt-6">
      {name && (
        <div className="group flex items-center justify-between border-b border-border-default pb-1.5">
          <h2 className="text-sm font-semibold">{name}</h2>
          {sectionId && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-label="Section options"
                  className="hidden rounded p-1 text-fg-faint hover:bg-bg-hover group-hover:block"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem
                  onSelect={() => {
                    const newName = prompt('Rename section', name);
                    if (newName?.trim())
                      updateSection.mutate({ id: sectionId, patch: { name: newName.trim() } });
                  }}
                >
                  <Pencil className="h-4 w-4" /> Rename
                </DropdownItem>
                <DropdownItem
                  danger
                  onSelect={() => {
                    if (confirm(`Delete section "${name}" and its tasks?`))
                      deleteSection.mutate(sectionId);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      )}
      <TaskList tasks={sectionTasks} allTasks={all} />
      <AddTaskButton defaultProjectId={projectId} sectionId={sectionId} />
    </section>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const { data: sections } = useSections();
  const { data: tasks } = useActiveTasks();
  const { data: completed } = useCompletedTasks();
  const display = useDisplayPrefs(`project.${id}`);
  const createSection = useCreateSection();
  const [editing, setEditing] = useState(false);

  const project = (projects ?? []).find((p) => p.id === id);
  const projectSections = (sections ?? []).filter((s) => s.project_id === id);

  if (isLoading) return <TaskListSkeleton className="py-2" />;
  if (!project) {
    return (
      <div className="py-8">
        <p className="text-sm text-fg-secondary">Project not found.</p>
        <button
          type="button"
          onClick={() => router.push('/app/inbox')}
          className="mt-2 text-sm text-brand hover:underline"
        >
          Go to Inbox
        </button>
      </div>
    );
  }

  const all = tasks ?? [];
  const projectTasks = all.filter((t) => t.project_id === project.id);
  const projectCompleted = (completed ?? []).filter((t) => t.project_id === project.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="flex items-center gap-1">
          <DisplayMenu state={display} hideGroupProject />
          {!project.is_inbox && (
            <IconButton label="Edit project" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>

      <TaskView
        prefs={display.prefs}
        tasks={projectTasks}
        completedTasks={projectCompleted}
        allTasks={all}
        fallback={
          <>
            <SectionBlock sectionId={null} name={null} projectId={project.id} />
            {/* fallback add button when the no-section block is hidden */}
            <NoSectionAdd projectId={project.id} />

            {projectSections.map((s) => (
              <SectionBlock key={s.id} sectionId={s.id} name={s.name} projectId={project.id} />
            ))}
          </>
        }
      />

      <button
        type="button"
        onClick={() => {
          const name = prompt('Section name');
          if (name?.trim()) createSection.mutate({ project_id: project.id, name: name.trim() });
        }}
        className="mt-8 flex items-center gap-2 text-sm text-fg-faint hover:text-brand"
      >
        <Plus className="h-4 w-4" /> Add section
      </button>

      <ProjectDialog open={editing} onOpenChange={setEditing} project={project} />
    </div>
  );
}

function NoSectionAdd({ projectId }: { projectId: string }) {
  const { data: tasks } = useActiveTasks();
  const hasUnsectioned = (tasks ?? []).some(
    (t) => t.project_id === projectId && !t.section_id,
  );
  if (hasUnsectioned) return null;
  return (
    <div className="mt-4">
      <AddTaskButton defaultProjectId={projectId} sectionId={null} />
    </div>
  );
}
