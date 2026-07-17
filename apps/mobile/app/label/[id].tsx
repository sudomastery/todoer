import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useActiveTasks, useLabels, useProjects } from '../../lib/hooks';
import { TaskListView } from '../../components/TaskListView';

export default function LabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  const label = (labels ?? []).find((l) => l.id === id);
  const all = tasks ?? [];
  const labelTasks = all.filter((t) => t.label_ids.includes(id));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: label ? `@${label.name}` : 'Label' }} />
      <TaskListView
        sections={[{ title: null, data: labelTasks }]}
        allTasks={all}
        projects={projects}
        labels={labels}
        showProject
        emptyMessage="No active tasks with this label."
      />
    </View>
  );
}
