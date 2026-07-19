import { useState } from 'react';
import { View } from 'react-native';
import { formatDayHeading, isOverdue, upcomingDays } from '@todoer/shared';
import { useActiveTasks, useLabels, useProjects } from '../../lib/hooks';
import { TaskListView, type TaskSection } from '../../components/TaskListView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';
import { useTheme } from '../../lib/theme';

export default function UpcomingScreen() {
  const t = useTheme();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);

  const all = tasks ?? [];
  const days = upcomingDays(14);
  const lastDay = days[days.length - 1];

  const sections: TaskSection[] = [
    {
      title: 'Overdue',
      data: all.filter((t) => t.due_date && isOverdue(t.due_date)),
      accent: t.brand,
    },
    ...days.map((day) => ({
      title: formatDayHeading(day),
      data: all.filter((t) => t.due_date === day),
    })),
    { title: 'Later', data: all.filter((t) => t.due_date && t.due_date > lastDay) },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={{ flex: 1 }}>
      <TaskListView
        sections={sections}
        allTasks={all}
        projects={projects}
        labels={labels}
        showProject
        emptyMessage="Nothing scheduled. Add a task with a due date."
      />
      <Fab onPress={() => setAdding(true)} />
      <AddTaskSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}
