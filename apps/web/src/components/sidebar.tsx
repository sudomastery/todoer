'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import clsx from 'clsx';
import {
  Bot,
  Calendar,
  CalendarDays,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Download,
  ChevronRight,
  Hash,
  Inbox,
  LogOut,
  Moon,
  MoreHorizontal,
  Palette,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Star,
  StarOff,
  Sun,
  Volume2,
  Tag,
  Trash2,
} from 'lucide-react';
import { buildExport, colorHex, deleteAccount, isOverdue, isToday, todayISO, type Project } from '@todoer/shared';
import {
  useActiveTasks,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/lib/hooks';
import { useShell } from '@/components/app-shell';
import { ProjectDialog } from '@/components/project-dialog';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
} from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { SoundSettingsDialog } from '@/components/sound-settings';
import { McpSettingsDialog } from '@/components/mcp-settings';
import { ThemeSettingsDialog } from '@/components/theme-settings';

function NavLink({
  href,
  icon,
  label,
  count,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
        active ? 'bg-bg-active font-medium text-brand' : 'text-fg hover:bg-bg-hover',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-fg-faint">{count}</span>
      )}
    </Link>
  );
}

function ProjectRow({ project, active }: { project: Project; active: boolean }) {
  const router = useRouter();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: tasks } = useActiveTasks();
  const [editing, setEditing] = useState(false);

  const count = (tasks ?? []).filter((t) => t.project_id === project.id).length;

  return (
    <div
      className={clsx(
        'group flex items-center rounded-md',
        active ? 'bg-bg-active' : 'hover:bg-bg-hover',
      )}
    >
      <Link
        href={`/app/project/${project.id}`}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-sm',
          active ? 'font-medium text-brand' : 'text-fg',
        )}
      >
        <Hash className="h-4 w-4 shrink-0" style={{ color: colorHex(project.color) }} />
        <span className="truncate">{project.name}</span>
      </Link>
      <span className="pr-2 text-xs text-fg-faint group-hover:hidden">{count > 0 ? count : ''}</span>
      <div className="hidden pr-1 group-hover:block">
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              aria-label="Project options"
              className="rounded p-1 text-fg-faint hover:bg-bg-hover hover:text-fg"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem onSelect={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownItem>
            <DropdownItem
              onSelect={() =>
                updateProject.mutate({
                  id: project.id,
                  patch: { is_favorite: !project.is_favorite },
                })
              }
            >
              {project.is_favorite ? (
                <>
                  <StarOff className="h-4 w-4" /> Remove from favorites
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" /> Add to favorites
                </>
              )}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              danger
              onSelect={() => {
                if (confirm(`Delete "${project.name}" and all of its tasks?`)) {
                  deleteProject.mutate(project.id);
                  if (active) router.push('/app/inbox');
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
      <ProjectDialog open={editing} onOpenChange={setEditing} project={project} />
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  userEmail,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openQuickAdd, openSearch } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: projects } = useProjects();
  const { data: tasks } = useActiveTasks();
  const [addingProject, setAddingProject] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  if (!open) return null;

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const regular = (projects ?? []).filter((p) => !p.is_inbox);
  const favorites = regular.filter((p) => p.is_favorite);

  const today = todayISO();
  const inboxCount = (tasks ?? []).filter((t) => inbox && t.project_id === inbox.id).length;
  const todayCount = (tasks ?? []).filter(
    (t) => t.due_date && (isToday(t.due_date) || isOverdue(t.due_date)),
  ).length;
  const upcomingCount = (tasks ?? []).filter((t) => t.due_date && t.due_date > today).length;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function exportData() {
    const data = await buildExport(createClient());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todoer-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removeAccount() {
    const ok = confirm(
      'Delete your account? This permanently erases every project, task, and label. This cannot be undone. Consider using Export data first.',
    );
    if (!ok) return;
    const supabase = createClient();
    try {
      await deleteAccount(supabase);
    } catch (e) {
      alert(`Could not delete the account: ${e instanceof Error ? e.message : 'unknown error'}`);
      return;
    }
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border-default bg-bg-sidebar">
      <div className="flex items-center justify-between px-3 py-3">
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-bg-hover"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {(userName || userEmail || '?').charAt(0).toUpperCase()}
              </span>
              <span className="max-w-36 truncate text-sm font-semibold">
                {userName || userEmail}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-fg-faint" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <div className="px-2.5 py-1.5 text-xs text-fg-faint">{userEmail}</div>
            <DropdownSeparator />
            <DropdownItem
              onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" /> Light theme
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" /> Dark theme
                </>
              )}
            </DropdownItem>
            <DropdownItem onSelect={() => setThemeOpen(true)}>
              <Palette className="h-4 w-4" /> Theme
            </DropdownItem>
            <DropdownItem onSelect={() => setSoundSettingsOpen(true)}>
              <Volume2 className="h-4 w-4" /> Completion sound
            </DropdownItem>
            <DropdownItem onSelect={() => setMcpOpen(true)}>
              <Bot className="h-4 w-4" /> AI assistant
            </DropdownItem>
            <DropdownItem onSelect={exportData}>
              <Download className="h-4 w-4" /> Export data
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={logout}>
              <LogOut className="h-4 w-4" /> Log out
            </DropdownItem>
            <DropdownItem danger onSelect={removeAccount}>
              <Trash2 className="h-4 w-4" /> Delete account
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
        <IconButton label="Close sidebar (M)" onClick={onClose}>
          <PanelLeft className="h-5 w-5" />
        </IconButton>
      </div>
      <SoundSettingsDialog open={soundSettingsOpen} onOpenChange={setSoundSettingsOpen} />
      <McpSettingsDialog open={mcpOpen} onOpenChange={setMcpOpen} login={userEmail} />
      <ThemeSettingsDialog open={themeOpen} onOpenChange={setThemeOpen} />

      <div className="px-3">
        <button
          type="button"
          onClick={openQuickAdd}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-brand hover:bg-bg-hover"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
          Add task
        </button>
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-fg hover:bg-bg-hover"
        >
          <Search className="h-4 w-4 text-fg-secondary" />
          Search
          <span className="ml-auto text-xs text-fg-faint">Ctrl K</span>
        </button>
      </div>

      <nav className="mt-2 space-y-0.5 px-3">
        {inbox && (
          <NavLink
            href="/app/inbox"
            icon={<Inbox className="h-4 w-4 text-p3" />}
            label="Inbox"
            count={inboxCount}
            active={pathname === '/app/inbox'}
          />
        )}
        <NavLink
          href="/app/today"
          icon={<Calendar className="h-4 w-4 text-green-600" />}
          label="Today"
          count={todayCount}
          active={pathname === '/app/today'}
        />
        <NavLink
          href="/app/upcoming"
          icon={<CalendarDays className="h-4 w-4 text-purple-500" />}
          label="Upcoming"
          count={upcomingCount}
          active={pathname === '/app/upcoming'}
        />
        <NavLink
          href="/app/labels"
          icon={<Tag className="h-4 w-4 text-orange-500" />}
          label="Filters &amp; Labels"
          active={pathname.startsWith('/app/label')}
        />
        <NavLink
          href="/app/completed"
          icon={<CheckCircle2 className="h-4 w-4 text-fg-secondary" />}
          label="Completed"
          active={pathname === '/app/completed'}
        />
        <NavLink
          href="/app/stats"
          icon={<BarChart2 className="h-4 w-4 text-teal-600" />}
          label="Productivity"
          active={pathname === '/app/stats'}
        />
      </nav>

      {favorites.length > 0 && (
        <div className="mt-5 px-3">
          <div className="px-2 pb-1 text-xs font-semibold text-fg-secondary">Favorites</div>
          <div className="space-y-0.5">
            {favorites.map((p) => (
              <ProjectRow key={p.id} project={p} active={pathname === `/app/project/${p.id}`} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex-1 overflow-y-auto px-3 pb-4">
        <div className="group/head flex items-center justify-between px-2 pb-1">
          <button
            type="button"
            onClick={() => setProjectsExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-fg-secondary hover:text-fg"
          >
            My Projects
            {projectsExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
          <IconButton label="Add project" onClick={() => setAddingProject(true)} className="p-1">
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>
        {projectsExpanded && (
          <div className="space-y-0.5">
            {regular.map((p) => (
              <ProjectRow key={p.id} project={p} active={pathname === `/app/project/${p.id}`} />
            ))}
            {regular.length === 0 && (
              <p className="px-2 py-1 text-xs text-fg-faint">No projects yet.</p>
            )}
          </div>
        )}
      </div>

      <ProjectDialog open={addingProject} onOpenChange={setAddingProject} />
    </aside>
  );
}
