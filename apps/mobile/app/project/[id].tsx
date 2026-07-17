import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useActiveTasks, useLabels, useProjects, useSections } from '../../lib/hooks';
import { TaskListView, type TaskSection } from '../../components/TaskListView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: sections } = useSections();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);

  const project = (projects ?? []).find((p) => p.id === id);
  const all = tasks ?? [];
  const projectTasks = all.filter((t) => t.project_id === id);
  const projectSections = (sections ?? []).filter((s) => s.project_id === id);

  const listSections: TaskSection[] = [
    { title: null, data: projectTasks.filter((t) => !t.section_id) },
    ...projectSections.map((s) => ({
      title: s.name,
      data: projectTasks.filter((t) => t.section_id === s.id),
    })),
  ];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: project?.name ?? 'Project' }} />
      <TaskListView
        sections={listSections}
        allTasks={all}
        projects={projects}
        labels={labels}
        emptyMessage="No tasks in this project yet."
      />
      <Fab onPress={() => setAdding(true)} />
      <AddTaskSheet visible={adding} onClose={() => setAdding(false)} defaultProjectId={id} />
    </View>
  );
}
