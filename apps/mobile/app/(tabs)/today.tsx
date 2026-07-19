import { useState } from 'react';
import { View } from 'react-native';
import { format } from 'date-fns';
import { isOverdue, isToday, todayISO } from '@todoer/shared';
import { useActiveTasks, useLabels, useProjects, useRealtimeSync } from '../../lib/hooks';
import { TaskListView } from '../../components/TaskListView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';
import { useTheme } from '../../lib/theme';

export default function TodayScreen() {
  useRealtimeSync();
  const t = useTheme();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);

  const all = tasks ?? [];
  const overdue = all.filter((t) => t.due_date && isOverdue(t.due_date));
  const today = all.filter((t) => t.due_date && isToday(t.due_date));

  return (
    <View style={{ flex: 1 }}>
      <TaskListView
        sections={[
          { title: overdue.length > 0 ? 'Overdue' : null, data: overdue, accent: t.brand },
          {
            title: overdue.length > 0 ? `${format(new Date(), 'MMM d')} - Today` : null,
            data: today,
          },
        ]}
        allTasks={all}
        projects={projects}
        labels={labels}
        showProject
        emptyMessage="Enjoy your day! Nothing due today."
      />
      <Fab onPress={() => setAdding(true)} />
      <AddTaskSheet
        visible={adding}
        onClose={() => setAdding(false)}
        defaultDueDate={todayISO()}
      />
    </View>
  );
}
