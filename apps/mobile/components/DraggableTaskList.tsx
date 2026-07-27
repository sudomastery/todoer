import { useRef, useState, type ReactElement } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reorderSortOrders, type Label, type Project, type TaskWithLabels } from '@todoer/shared';
import { TaskRow } from './TaskRow';
import { useTheme } from '../lib/theme';

interface Group {
  task: TaskWithLabels;
  subtasks: TaskWithLabels[];
}

interface DragCallbacks {
  onGrant: (index: number) => void;
  onMove: (dy: number) => void;
  onRelease: (dy: number) => void;
  onTerminate: () => void;
}

/**
 * The grip for one row. The PanResponder is created exactly once per mounted
 * row and reads everything through refs: recreating it on render replaces the
 * handlers in the middle of the gesture, which is why the first version of
 * this list never received the move events (verified on the emulator).
 */
function DragHandle({
  index,
  active,
  callbacks,
}: {
  index: number;
  active: boolean;
  callbacks: React.MutableRefObject<DragCallbacks>;
}) {
  const t = useTheme();
  const indexRef = useRef(index);
  indexRef.current = index;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => callbacks.current.onGrant(indexRef.current),
      onPanResponderMove: (_e, g) => callbacks.current.onMove(g.dy),
      onPanResponderRelease: (_e, g) => callbacks.current.onRelease(g.dy),
      onPanResponderTerminate: () => callbacks.current.onTerminate(),
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      hitSlop={{ top: 10, bottom: 10, left: 14, right: 10 }}
      style={styles.handle}
    >
      <Ionicons name="reorder-three-outline" size={22} color={active ? t.brand : t.fgFaint} />
    </View>
  );
}

/**
 * Manual ordering by dragging. Only the grip claims the gesture, so the list
 * still scrolls normally when the finger lands anywhere else. Subtasks travel
 * with their parent: the unit being moved is the whole group.
 */
export function DraggableTaskList({
  groups,
  projects,
  labels,
  showProject = false,
  onReorder,
  contentPaddingBottom = 120,
  refreshControl,
}: {
  groups: Group[];
  projects?: Project[];
  labels?: Label[];
  showProject?: boolean;
  onReorder: (updates: { id: string; sort_order: number }[]) => void;
  contentPaddingBottom?: number;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const t = useTheme();
  const dragY = useRef(new Animated.Value(0)).current;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Geometry and gesture state live in refs so the stable PanResponder
  // callbacks always see current values.
  const layouts = useRef<{ y: number; height: number }[]>([]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const dragFrom = useRef<number | null>(null);
  const hoverTo = useRef<number | null>(null);

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

  function endDrag() {
    dragFrom.current = null;
    hoverTo.current = null;
    setDragIndex(null);
    setHoverIndex(null);
    dragY.setValue(0);
  }

  // One shared, always-current set of callbacks for every row's responder.
  const callbacks = useRef<DragCallbacks>({
    onGrant: () => undefined,
    onMove: () => undefined,
    onRelease: () => undefined,
    onTerminate: () => undefined,
  });
  callbacks.current = {
    onGrant: (index) => {
      dragFrom.current = index;
      hoverTo.current = index;
      setDragIndex(index);
      setHoverIndex(index);
      dragY.setValue(0);
    },
    onMove: (dy) => {
      dragY.setValue(dy);
      const next = targetIndexFor(dy);
      if (next !== hoverTo.current) {
        hoverTo.current = next;
        setHoverIndex(next);
      }
    },
    onRelease: (dy) => {
      const from = dragFrom.current;
      const to = targetIndexFor(dy);
      endDrag();
      if (from === null || from === to) return;
      const tasks = groupsRef.current.map((g) => g.task);
      const updates = reorderSortOrders(tasks, from, to);
      if (updates.length > 0) onReorder(updates);
    },
    onTerminate: endDrag,
  };

  return (
    <ScrollView
      // A drag in progress must not also scroll the list under the finger.
      scrollEnabled={dragIndex === null}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentPaddingBottom }}
      refreshControl={refreshControl}
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
              style={
                isDragging
                  ? {
                      transform: [{ translateY: dragY }],
                      zIndex: 10,
                      elevation: 8,
                      opacity: 0.95,
                      backgroundColor: t.bgElevated,
                      borderRadius: 8,
                    }
                  : undefined
              }
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
                <DragHandle index={index} active={isDragging} callbacks={callbacks} />
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBody: { flex: 1 },
  handle: { paddingHorizontal: 8, paddingVertical: 14 },
  dropLine: { height: 2, borderRadius: 1, marginVertical: 1 },
});
