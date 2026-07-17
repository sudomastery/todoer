import { SectionList, StyleSheet, Text, View } from 'react-native';
import type { Label, Project, TaskWithLabels } from '@todoer/shared';
import { TaskRow } from './TaskRow';
import { useTheme } from '../lib/theme';

export interface TaskSection {
  title: string | null;
  data: TaskWithLabels[];
  accent?: string;
}

function sortTasks(tasks: TaskWithLabels[]): TaskWithLabels[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Flattens parent tasks followed by their subtasks, preserving sections. */
export function TaskListView({
  sections,
  allTasks,
  projects,
  labels,
  showProject = false,
  emptyMessage = 'No tasks here.',
}: {
  sections: TaskSection[];
  allTasks: TaskWithLabels[];
  projects?: Project[];
  labels?: Label[];
  showProject?: boolean;
  emptyMessage?: string;
}) {
  const t = useTheme();

  const prepared = sections
    .map((s) => {
      const top = sortTasks(s.data.filter((task) => !task.parent_id));
      const rows: { task: TaskWithLabels; depth: number }[] = [];
      for (const task of top) {
        rows.push({ task, depth: 0 });
        for (const sub of sortTasks(allTasks.filter((x) => x.parent_id === task.id))) {
          rows.push({ task: sub, depth: 1 });
        }
      }
      return { ...s, data: rows };
    })
    .filter((s) => s.data.length > 0 || s.title === null);

  const isEmpty = prepared.every((s) => s.data.length === 0);

  if (isEmpty) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: t.fgFaint, fontSize: 14 }}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={prepared}
      keyExtractor={(item) => item.task.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <Text
            style={[
              styles.sectionTitle,
              { color: section.accent ?? t.fg, borderBottomColor: t.border },
            ]}
          >
            {section.title}
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <TaskRow
          task={item.task}
          depth={item.depth}
          labels={labels}
          project={(projects ?? []).find((p) => p.id === item.task.project_id)}
          showProject={showProject}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
