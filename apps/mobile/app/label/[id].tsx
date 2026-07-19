import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { filterTasks, groupTasks } from '@todoer/shared';
import { useActiveTasks, useLabels, useProjects } from '../../lib/hooks';
import { useDisplayPrefs } from '../../lib/display';
import { DisplayButton, DisplaySheet } from '../../components/DisplaySheet';
import { TaskListView, type TaskSection } from '../../components/TaskListView';
import { BoardView } from '../../components/BoardView';
import { CalendarView } from '../../components/CalendarView';

export default function LabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const [displayOpen, setDisplayOpen] = useState(false);
  const { prefs, update, reset } = useDisplayPrefs(`label.${id}`);

  const label = (labels ?? []).find((l) => l.id === id);
  const all = tasks ?? [];
  const labelTasks = filterTasks(all.filter((t) => t.label_ids.includes(id)), prefs);

  const sections: TaskSection[] =
    prefs.groupBy === 'none'
      ? [{ title: null, data: labelTasks }]
      : groupTasks(labelTasks, prefs.groupBy, {
          projects: projects ?? [],
          labels: labels ?? [],
        }).map((g) => ({ title: g.title, data: g.tasks }));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: label ? `@${label.name}` : 'Label' }} />
      <DisplayButton prefs={prefs} onPress={() => setDisplayOpen(true)} />
      {prefs.layout === 'calendar' ? (
        <CalendarView tasks={labelTasks} projects={projects} labels={labels} showProject />
      ) : prefs.layout === 'board' ? (
        <BoardView
          sections={sections}
          allTasks={all}
          projects={projects}
          labels={labels}
          showProject
          sortBy={prefs.sortBy}
          emptyMessage="No active tasks with this label."
        />
      ) : (
        <TaskListView
          sections={sections}
          allTasks={all}
          projects={projects}
          labels={labels}
          showProject
          sortBy={prefs.sortBy}
          emptyMessage="No active tasks with this label."
        />
      )}
      <DisplaySheet
        visible={displayOpen}
        onClose={() => setDisplayOpen(false)}
        prefs={prefs}
        update={update}
        reset={reset}
        labels={labels ?? []}
      />
    </View>
  );
}
