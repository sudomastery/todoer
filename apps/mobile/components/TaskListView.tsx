import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import {
  canReorder,
  sortTasksBy,
  type Label,
  type Project,
  type SortBy,
  type TaskWithLabels,
} from '@todoer/shared';
import { DraggableTaskList } from './DraggableTaskList';
import { TaskRow } from './TaskRow';
import { useReorderTasks } from '../lib/hooks';
import { useTheme } from '../lib/theme';

export interface TaskSection {
  title: string | null;
  data: TaskWithLabels[];
  accent?: string;
  /** Set for real project sections, so the header can offer rename and delete. */
  sectionId?: string;
}

/** Flattens parent tasks followed by their subtasks, preserving sections. */
export function TaskListView({
  sections,
  allTasks,
  projects,
  labels,
  showProject = false,
  emptyMessage = 'No tasks here.',
  sortBy = 'manual',
  onSectionLongPress,
}: {
  sections: TaskSection[];
  allTasks: TaskWithLabels[];
  projects?: Project[];
  labels?: Label[];
  showProject?: boolean;
  emptyMessage?: string;
  sortBy?: SortBy;
  onSectionLongPress?: (sectionId: string, name: string) => void;
}) {
  const t = useTheme();
  const reorder = useReorderTasks();

  const prepared = sections
    .map((s) => {
      const top = sortTasksBy(s.data.filter((task) => !task.parent_id), sortBy);
      const rows: { task: TaskWithLabels; depth: number }[] = [];
      for (const task of top) {
        rows.push({ task, depth: 0 });
        for (const sub of sortTasksBy(allTasks.filter((x) => x.parent_id === task.id), 'manual')) {
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

  // Dragging is only offered where a dropped position will actually survive:
  // manual sort, and a plain list with no section headers to move between.
  const single = prepared.length === 1 && prepared[0].title === null;
  if (canReorder(sortBy) && single && prepared[0].data.length > 1) {
    const top = sortTasksBy(sections[0].data.filter((task) => !task.parent_id), sortBy);
    return (
      <DraggableTaskList
        groups={top.map((task) => ({
          task,
          subtasks: sortTasksBy(
            allTasks.filter((x) => x.parent_id === task.id),
            'manual',
          ),
        }))}
        projects={projects}
        labels={labels}
        showProject={showProject}
        onReorder={(updates) => reorder.mutate(updates)}
      />
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
          <Pressable
            onLongPress={
              section.sectionId && onSectionLongPress
                ? () => onSectionLongPress(section.sectionId as string, section.title as string)
                : undefined
            }
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: section.accent ?? t.fg, borderBottomColor: t.border },
              ]}
            >
              {section.title}
            </Text>
          </Pressable>
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
