import { useState } from 'react';
import { View } from 'react-native';
import { filterTasks, groupTasks } from '@todoer/shared';
import { useActiveTasks, useLabels, useProjects } from '../../lib/hooks';
import { useDisplayPrefs } from '../../lib/display';
import { DisplayButton, DisplaySheet } from '../../components/DisplaySheet';
import { TaskListView, type TaskSection } from '../../components/TaskListView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';

export default function InboxScreen() {
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const { prefs, update, reset } = useDisplayPrefs('inbox');

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const all = tasks ?? [];
  const inboxTasks = inbox ? all.filter((t) => t.project_id === inbox.id) : [];
  const filtered = filterTasks(inboxTasks, prefs);

  const sections: TaskSection[] =
    prefs.groupBy === 'none'
      ? [{ title: null, data: filtered }]
      : groupTasks(filtered, prefs.groupBy, {
          projects: projects ?? [],
          labels: labels ?? [],
        }).map((g) => ({ title: g.title, data: g.tasks }));

  return (
    <View style={{ flex: 1 }}>
      <DisplayButton prefs={prefs} onPress={() => setDisplayOpen(true)} />
      <TaskListView
        sections={sections}
        allTasks={all}
        projects={projects}
        labels={labels}
        sortBy={prefs.sortBy}
        emptyMessage="Your inbox is empty. Capture a task and sort it later."
      />
      <Fab onPress={() => setAdding(true)} />
      <AddTaskSheet
        visible={adding}
        onClose={() => setAdding(false)}
        defaultProjectId={inbox?.id}
      />
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
