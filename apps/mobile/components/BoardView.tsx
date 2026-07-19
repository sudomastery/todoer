import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { sortTasksBy, type Label, type Project, type SortBy, type TaskWithLabels } from '@todoer/shared';
import { TaskRow } from './TaskRow';
import { useTheme } from '../lib/theme';
import type { TaskSection } from './TaskListView';

const COLUMN_WIDTH = 280;

/** Board layout: each section becomes a scrollable column of task cards. */
export function BoardView({
  sections,
  allTasks,
  projects,
  labels,
  showProject = false,
  emptyMessage = 'No tasks here.',
  sortBy = 'manual',
}: {
  sections: TaskSection[];
  allTasks: TaskWithLabels[];
  projects?: Project[];
  labels?: Label[];
  showProject?: boolean;
  emptyMessage?: string;
  sortBy?: SortBy;
}) {
  const t = useTheme();

  const columns = sections.map((s) => {
    const top = sortTasksBy(s.data.filter((task) => !task.parent_id), sortBy);
    const rows: { task: TaskWithLabels; depth: number }[] = [];
    for (const task of top) {
      rows.push({ task, depth: 0 });
      for (const sub of sortTasksBy(allTasks.filter((x) => x.parent_id === task.id), 'manual')) {
        rows.push({ task: sub, depth: 1 });
      }
    }
    return { title: s.title ?? 'Tasks', accent: s.accent, count: top.length, rows };
  });

  if (columns.every((c) => c.rows.length === 0)) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: t.fgFaint, fontSize: 14 }}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={styles.board}
    >
      {columns.map((col, i) => (
        <View
          key={`${i}-${col.title}`}
          style={[styles.column, { backgroundColor: t.bgElevated, borderColor: t.border }]}
        >
          <View style={styles.columnHead}>
            <Text style={{ color: col.accent ?? t.fg, fontSize: 14, fontWeight: '700' }}>
              {col.title}
            </Text>
            <Text style={{ color: t.fgFaint, fontSize: 13 }}>{col.count}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {col.rows.length === 0 ? (
              <Text style={{ color: t.fgFaint, fontSize: 13, paddingVertical: 8 }}>Empty</Text>
            ) : (
              col.rows.map(({ task, depth }) => (
                <View
                  key={task.id}
                  style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }]}
                >
                  <TaskRow
                    task={task}
                    depth={depth}
                    labels={labels}
                    project={(projects ?? []).find((p) => p.id === task.project_id)}
                    showProject={showProject}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  board: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 90, gap: 12 },
  column: {
    width: COLUMN_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },
  columnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
});
