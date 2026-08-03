import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
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
import { pullToRefresh } from '../lib/sync';
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
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await pullToRefresh(qc);
    } finally {
      setRefreshing(false);
    }
  }

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={t.brand}
      colors={[t.brand]}
      progressBackgroundColor={t.bgElevated}
    />
  );

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
      <ScrollView contentContainerStyle={styles.empty} refreshControl={refreshControl}>
        <Text style={{ color: t.fgFaint, fontSize: 14 }}>{emptyMessage}</Text>
      </ScrollView>
    );
  }

  // Dragging is only offered where a dropped position will actually survive:
  // manual sort, and a single visible untitled list with no other section to
  // move between. Views like Today pass placeholder sections that may be
  // empty (Overdue with nothing in it), so only sections that actually hold
  // rows count here, and the data comes from that section, not sections[0].
  const visible = prepared.filter((s) => s.data.length > 0);
  const single = visible.length === 1 && visible[0].title === null;
  if (canReorder(sortBy) && single && visible[0].data.length > 1) {
    const source = sections.find((s) => s.data.some((task) => task.id === visible[0].data[0].task.id));
    const top = sortTasksBy((source ?? sections[0]).data.filter((task) => !task.parent_id), sortBy);
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
        refreshControl={refreshControl}
      />
    );
  }

  return (
    <SectionList
      sections={prepared}
      keyExtractor={(item) => item.task.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      refreshControl={refreshControl}
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
