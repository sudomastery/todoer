import { useActiveTasks, useLabels, useProjects } from '../lib/hooks';
import { CalendarView } from '../components/CalendarView';

export default function CalendarScreen() {
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  return <CalendarView tasks={tasks ?? []} projects={projects} labels={labels} showProject />;
}
