import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  colorHex,
  formatDue,
  isOverdue,
  isToday,
  PRIORITY_COLORS,
  type Label,
  type Project,
  type TaskWithLabels,
} from '@todoer/shared';
import { useCompleteTask, useDeleteTask } from '../lib/hooks';
import { useTheme } from '../lib/theme';

export function TaskRow({
  task,
  project,
  labels,
  showProject = false,
  depth = 0,
}: {
  task: TaskWithLabels;
  project?: Project;
  labels?: Label[];
  showProject?: boolean;
  depth?: number;
}) {
  const t = useTheme();
  const router = useRouter();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const priorityColor = task.priority < 4 ? PRIORITY_COLORS[task.priority] : t.fgFaint;
  const overdue = task.due_date ? isOverdue(task.due_date) : false;
  const dueToday = task.due_date ? isToday(task.due_date) : false;
  const taskLabels = (labels ?? []).filter((l) => task.label_ids.includes(l.id));

  return (
    <Pressable
      onPress={() => router.push(`/task/${task.id}`)}
      onLongPress={() =>
        Alert.alert(task.content, undefined, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete task',
            style: 'destructive',
            onPress: () => deleteTask.mutate(task.id),
          },
        ])
      }
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: t.border, marginLeft: depth * 28 },
        pressed && { backgroundColor: t.bgPressed },
      ]}
    >
      <Pressable
        onPress={() => completeTask.mutate(task)}
        hitSlop={10}
        style={[
          styles.checkbox,
          {
            borderColor: priorityColor,
            backgroundColor: task.priority < 4 ? `${priorityColor}18` : 'transparent',
          },
        ]}
      />
      <View style={styles.body}>
        <Text style={[styles.content, { color: t.fg }]} numberOfLines={2}>
          {task.content}
        </Text>
        {!!task.description && (
          <Text style={[styles.description, { color: t.fgFaint }]} numberOfLines={1}>
            {task.description}
          </Text>
        )}
        {(task.due_date || taskLabels.length > 0 || (showProject && project)) && (
          <View style={styles.metaRow}>
            {task.due_date && (
              <View style={styles.metaItem}>
                <Ionicons
                  name={task.recurrence ? 'repeat' : 'calendar-outline'}
                  size={12}
                  color={overdue ? t.brand : dueToday ? '#299438' : t.fgSecondary}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: overdue ? t.brand : dueToday ? '#299438' : t.fgSecondary },
                  ]}
                >
                  {formatDue(task.due_date, task.due_time)}
                </Text>
              </View>
            )}
            {taskLabels.map((l) => (
              <View key={l.id} style={styles.metaItem}>
                <Ionicons name="pricetag-outline" size={12} color={colorHex(l.color)} />
                <Text style={[styles.metaText, { color: t.fgSecondary }]}>{l.name}</Text>
              </View>
            ))}
            {showProject && project && (
              <View style={[styles.metaItem, styles.metaRight]}>
                <Text style={[styles.metaText, { color: t.fgFaint }]}>{project.name}</Text>
                <Ionicons name="grid-outline" size={11} color={colorHex(project.color)} />
              </View>
            )}
          </View>
        )}
      </View>
      {task.priority < 4 && <Ionicons name="flag" size={14} color={priorityColor} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 1,
  },
  body: { flex: 1 },
  content: { fontSize: 15, lineHeight: 20 },
  description: { fontSize: 12, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaRight: { marginLeft: 'auto' },
  metaText: { fontSize: 12 },
});
