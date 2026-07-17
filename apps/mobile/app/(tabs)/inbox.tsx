import { useState } from 'react';
import { View } from 'react-native';
import { useActiveTasks, useLabels, useProjects } from '../../lib/hooks';
import { TaskListView } from '../../components/TaskListView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';

export default function InboxScreen() {
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const all = tasks ?? [];
  const inboxTasks = inbox ? all.filter((t) => t.project_id === inbox.id) : [];

  return (
    <View style={{ flex: 1 }}>
      <TaskListView
        sections={[{ title: null, data: inboxTasks }]}
        allTasks={all}
        projects={projects}
        labels={labels}
        emptyMessage="Your inbox is empty. Capture a task and sort it later."
      />
      <Fab onPress={() => setAdding(true)} />
      <AddTaskSheet
        visible={adding}
        onClose={() => setAdding(false)}
        defaultProjectId={inbox?.id}
      />
    </View>
  );
}
