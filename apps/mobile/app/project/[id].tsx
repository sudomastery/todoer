import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { filterTasks, groupTasks } from '@todoer/shared';
import { useActiveTasks, useLabels, useProjects, useSections } from '../../lib/hooks';
import { useDisplayPrefs } from '../../lib/display';
import { DisplayButton, DisplaySheet } from '../../components/DisplaySheet';
import { TaskListView, type TaskSection } from '../../components/TaskListView';
import { BoardView } from '../../components/BoardView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: sections } = useSections();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const { prefs, update, reset } = useDisplayPrefs(`project.${id}`);

  const project = (projects ?? []).find((p) => p.id === id);
  const all = tasks ?? [];
  const projectTasks = filterTasks(all.filter((t) => t.project_id === id), prefs);
  const projectSections = (sections ?? []).filter((s) => s.project_id === id);

  const listSections: TaskSection[] =
    prefs.groupBy === 'none'
      ? [
          { title: null, data: projectTasks.filter((t) => !t.section_id) },
          ...projectSections.map((s) => ({
            title: s.name,
            data: projectTasks.filter((t) => t.section_id === s.id),
          })),
        ]
      : groupTasks(projectTasks, prefs.groupBy, {
          projects: projects ?? [],
          labels: labels ?? [],
        }).map((g) => ({ title: g.title, data: g.tasks }));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: project?.name ?? 'Project' }} />
      <DisplayButton prefs={prefs} onPress={() => setDisplayOpen(true)} />
      {prefs.layout === 'board' ? (
        <BoardView
          sections={listSections}
          allTasks={all}
          projects={projects}
          labels={labels}
          sortBy={prefs.sortBy}
          emptyMessage="No tasks in this project yet."
        />
      ) : (
        <TaskListView
          sections={listSections}
          allTasks={all}
          projects={projects}
          labels={labels}
          sortBy={prefs.sortBy}
          emptyMessage="No tasks in this project yet."
        />
      )}
      <Fab onPress={() => setAdding(true)} />
      <AddTaskSheet visible={adding} onClose={() => setAdding(false)} defaultProjectId={id} />
      <DisplaySheet
        visible={displayOpen}
        onClose={() => setDisplayOpen(false)}
        prefs={prefs}
        update={update}
        reset={reset}
        labels={labels ?? []}
        hideGroupProject
      />
    </View>
  );
}
