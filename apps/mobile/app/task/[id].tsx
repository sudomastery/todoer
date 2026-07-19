import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  colorHex,
  describeRecurrence,
  formatDue,
  isOverdue,
  isToday,
  PRIORITY_COLORS,
} from '@todoer/shared';
import {
  useActiveTasks,
  useAddComment,
  useComments,
  useCompletedTasks,
  useCompleteTask,
  useDeleteComment,
  useDeleteTask,
  useLabels,
  useProjects,
  useUncompleteTask,
} from '../../lib/hooks';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { TaskEditSheet } from '../../components/TaskEditSheet';
import { useTheme } from '../../lib/theme';

export default function TaskDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: active } = useActiveTasks();
  const { data: completedTasks } = useCompletedTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const { data: comments } = useComments(id);
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [commentText, setCommentText] = useState('');
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  const task =
    (active ?? []).find((x) => x.id === id) ?? (completedTasks ?? []).find((x) => x.id === id);

  if (!task) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 20 }}>
        <Text style={{ color: t.fgFaint }}>This task no longer exists.</Text>
      </View>
    );
  }

  const project = (projects ?? []).find((p) => p.id === task.project_id);
  const taskLabels = (labels ?? []).filter((l) => task.label_ids.includes(l.id));
  const priorityColor = task.priority < 4 ? PRIORITY_COLORS[task.priority] : t.fgFaint;
  const overdue = task.due_date ? isOverdue(task.due_date) : false;
  const dueToday = task.due_date ? isToday(task.due_date) : false;

  async function submitComment() {
    const content = commentText.trim();
    if (!content || addComment.isPending) return;
    await addComment.mutateAsync({ taskId: task!.id, content });
    setCommentText('');
    Keyboard.dismiss();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={styles.headRow}>
          <Pressable
            onPress={() =>
              task.is_completed ? uncompleteTask.mutate(task.id) : completeTask.mutate(task)
            }
            hitSlop={10}
            style={[
              styles.checkbox,
              {
                borderColor: priorityColor,
                backgroundColor: task.is_completed
                  ? priorityColor
                  : task.priority < 4
                    ? `${priorityColor}18`
                    : 'transparent',
              },
            ]}
          >
            {task.is_completed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </Pressable>
          <Text
            style={[
              styles.title,
              { color: t.fg },
              task.is_completed && { color: t.fgFaint, textDecorationLine: 'line-through' },
            ]}
          >
            {task.content}
          </Text>
        </View>

        {!!task.description && (
          <Text style={[styles.description, { color: t.fgSecondary }]}>{task.description}</Text>
        )}

        <View style={styles.metaBlock}>
          {project && (
            <View style={styles.metaLine}>
              <Ionicons name="grid-outline" size={15} color={colorHex(project.color)} />
              <Text style={[styles.metaText, { color: t.fgSecondary }]}>{project.name}</Text>
            </View>
          )}
          {task.due_date && (
            <View style={styles.metaLine}>
              <Ionicons
                name={task.recurrence ? 'repeat' : 'calendar-outline'}
                size={15}
                color={overdue ? '#d1453b' : dueToday ? '#299438' : t.fgSecondary}
              />
              <Text
                style={[
                  styles.metaText,
                  { color: overdue ? '#d1453b' : dueToday ? '#299438' : t.fgSecondary },
                ]}
              >
                {formatDue(task.due_date, task.due_time)}
                {task.recurrence ? ` · ${describeRecurrence(task.recurrence)}` : ''}
              </Text>
            </View>
          )}
          {task.priority < 4 && (
            <View style={styles.metaLine}>
              <Ionicons name="flag" size={15} color={priorityColor} />
              <Text style={[styles.metaText, { color: t.fgSecondary }]}>
                Priority {task.priority}
              </Text>
            </View>
          )}
          {taskLabels.length > 0 && (
            <View style={styles.metaLine}>
              <Ionicons name="pricetag-outline" size={15} color={t.fgSecondary} />
              <Text style={[styles.metaText, { color: t.fgSecondary }]}>
                {taskLabels.map((l) => l.name).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => setEditing(true)}
            style={[styles.actionBtn, { borderColor: t.border }]}
          >
            <Ionicons name="pencil-outline" size={15} color={t.fgSecondary} />
            <Text style={{ color: t.fgSecondary, fontSize: 13, fontWeight: '500' }}>Edit</Text>
          </Pressable>
          {!task.parent_id && !task.is_completed && (
            <Pressable
              onPress={() => setAddingSubtask(true)}
              style={[styles.actionBtn, { borderColor: t.border }]}
            >
              <Ionicons name="add" size={16} color={t.fgSecondary} />
              <Text style={{ color: t.fgSecondary, fontSize: 13, fontWeight: '500' }}>
                Add subtask
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: t.fg, borderTopColor: t.border }]}>
          Comments{comments && comments.length > 0 ? ` (${comments.length})` : ''}
        </Text>
        {(comments ?? []).map((c) => (
          <View key={c.id} style={[styles.comment, { borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontSize: 14, lineHeight: 19 }}>{c.content}</Text>
              <Text style={{ color: t.fgFaint, fontSize: 11, marginTop: 3 }}>
                {new Date(c.created_at).toLocaleString()}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => deleteComment.mutate({ id: c.id, taskId: task.id })}
            >
              <Ionicons name="trash-outline" size={16} color={t.fgFaint} />
            </Pressable>
          </View>
        ))}
        {(comments ?? []).length === 0 && (
          <Text style={{ color: t.fgFaint, fontSize: 13 }}>No comments yet.</Text>
        )}

        <Pressable
          onPress={() =>
            Alert.alert('Delete task', `Delete "${task.content}"?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  deleteTask.mutate(task.id);
                  router.back();
                },
              },
            ])
          }
          style={[styles.deleteBtn, { borderColor: '#d1453b' }]}
        >
          <Ionicons name="trash-outline" size={16} color="#d1453b" />
          <Text style={{ color: '#d1453b', fontSize: 14, fontWeight: '500' }}>Delete task</Text>
        </Pressable>
      </ScrollView>

      <TaskEditSheet task={task} visible={editing} onClose={() => setEditing(false)} />
      <AddTaskSheet
        visible={addingSubtask}
        onClose={() => setAddingSubtask(false)}
        defaultProjectId={task.project_id}
        parentId={task.id}
      />

      <View style={[styles.composer, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Add a comment"
          placeholderTextColor={t.fgFaint}
          style={[
            styles.composerInput,
            { color: t.fg, borderColor: t.border, backgroundColor: t.bgElevated },
          ]}
          onSubmitEditing={submitComment}
          returnKeyType="send"
        />
        <Pressable
          onPress={submitComment}
          disabled={!commentText.trim() || addComment.isPending}
          style={[
            styles.sendBtn,
            { backgroundColor: t.brand, opacity: commentText.trim() ? 1 : 0.4 },
          ]}
        >
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '600', flex: 1, lineHeight: 24 },
  description: { fontSize: 14, marginTop: 10, lineHeight: 20 },
  metaBlock: { marginTop: 16, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 10,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
