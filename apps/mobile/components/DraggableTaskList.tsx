import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reorderSortOrders, type Label, type Project, type TaskWithLabels } from '@todoer/shared';
import { TaskRow } from './TaskRow';
import { useTheme } from '../lib/theme';

interface Group {
  task: TaskWithLabels;
  subtasks: TaskWithLabels[];
}

/**
 * Manual ordering by dragging.
 *
 * Only the grip claims the gesture, so the list still scrolls normally when
 * the finger lands anywhere else. Subtasks travel with their parent: the unit
 * being moved is the whole group, not an individual row.
 */
export function DraggableTaskList({
  groups,
  projects,
  labels,
  showProject = false,
  onReorder,
  contentPaddingBottom = 120,
}: {
  groups: Group[];
  projects?: Project[];
  labels?: Label[];
  showProject?: boolean;
  onReorder: (updates: { id: string; sort_order: number }[]) => void;
  contentPaddingBottom?: number;
}) {
  const t = useTheme();
  const dragY = useRef(new Animated.Value(0)).current;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Measured geometry of each group, keyed by position, so the drop target can
  // be worked out with rows of different heights.
  const layouts = useRef<{ y: number; height: number }[]>([]);
  // Mirrors of the drag state that the responder callbacks can read without
  // going stale between renders.
  const dragFrom = useRef<number | null>(null);
  const hoverTo = useRef<number | null>(null);

  const tasks = useMemo(() => groups.map((g) => g.task), [groups]);

  function targetIndexFor(dy: number): number {
    const from = dragFrom.current;
    if (from === null) return 0;
    const box = layouts.current[from];
    if (!box) return from;
    const centre = box.y + dy + box.height / 2;
    for (let i = 0; i < layouts.current.length; i++) {
      const l = layouts.current[i];
      if (!l) continue;
      if (centre < l.y + l.height) return i;
    }
    return layouts.current.length - 1;
  }

  function makeResponder(index: number) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Claim the gesture so the surrounding ScrollView does not steal it.
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragFrom.current = index;
        hoverTo.current = index;
        setDragIndex(index);
        setHoverIndex(index);
        dragY.setValue(0);
      },
      onPanResponderMove: (_e, gesture) => {
        dragY.setValue(gesture.dy);
        const next = targetIndexFor(gesture.dy);
        if (next !== hoverTo.current) {
          hoverTo.current = next;
          setHoverIndex(next);
        }
      },
      onPanResponderRelease: () => {
        const from = dragFrom.current;
        const to = hoverTo.current;
        dragFrom.current = null;
        hoverTo.current = null;
        setDragIndex(null);
        setHoverIndex(null);
        dragY.setValue(0);
        if (from === null || to === null || from === to) return;
        const updates = reorderSortOrders(tasks, from, to);
        if (updates.length > 0) onReorder(updates);
      },
      onPanResponderTerminate: () => {
        dragFrom.current = null;
        hoverTo.current = null;
        setDragIndex(null);
        setHoverIndex(null);
        dragY.setValue(0);
      },
    });
  }

  return (
    <ScrollView
      // A drag in progress must not also scroll the list under the finger.
      scrollEnabled={dragIndex === null}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentPaddingBottom }}
    >
      {groups.map((group, index) => {
        const isDragging = dragIndex === index;
        const showLine = hoverIndex === index && dragIndex !== null && dragIndex !== index;
        return (
          <View
            key={group.task.id}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              layouts.current[index] = { y, height };
            }}
          >
            {showLine && <View style={[styles.dropLine, { backgroundColor: t.brand }]} />}
            <Animated.View
              style={[
                isDragging && {
                  transform: [{ translateY: dragY }],
                  zIndex: 10,
                  elevation: 8,
                  opacity: 0.95,
                  backgroundColor: t.bgElevated,
                  borderRadius: 8,
                },
              ]}
            >
              <View style={styles.row}>
                <View style={styles.rowBody}>
                  <TaskRow
                    task={group.task}
                    depth={0}
                    labels={labels}
                    project={(projects ?? []).find((p) => p.id === group.task.project_id)}
                    showProject={showProject}
                  />
                </View>
                <View
                  {...makeResponder(index).panHandlers}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.handle}
                >
                  <Ionicons
                    name="reorder-three-outline"
                    size={20}
                    color={isDragging ? t.brand : t.fgFaint}
                  />
                </View>
              </View>
              {group.subtasks.map((sub) => (
                <TaskRow
                  key={sub.id}
                  task={sub}
                  depth={1}
                  labels={labels}
                  project={(projects ?? []).find((p) => p.id === sub.project_id)}
                  showProject={showProject}
                />
              ))}
            </Animated.View>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Shown when a list is long enough that dragging is worth mentioning. */
export function ReorderHint({ visible }: { visible: boolean }) {
  const t = useTheme();
  if (!visible) return null;
  return (
    <Text style={[styles.hint, { color: t.fgFaint }]}>Hold the grip to reorder</Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBody: { flex: 1 },
  handle: { paddingHorizontal: 6, paddingVertical: 12 },
  dropLine: { height: 2, borderRadius: 1, marginVertical: 1 },
  hint: { fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },
});
