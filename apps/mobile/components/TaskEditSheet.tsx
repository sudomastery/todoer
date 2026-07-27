import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { format, addDays, nextSaturday } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import {
  colorHex,
  describeRecurrence,
  formatDueDate,
  isOverdue,
  PRIORITY_COLORS,
  recurrenceOptions,
  type Priority,
  type TaskWithLabels,
} from '@todoer/shared';
import { ConfirmSheet } from './ConfirmSheet';
import { DateGrid } from './DateGrid';
import { TimeRow } from './TimeRow';
import { useLabels, useProjects, useUpdateTask } from '../lib/hooks';
import { useBottomInset, useSheetMaxHeight } from '../lib/insets';
import { useTheme } from '../lib/theme';

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Full task editor in a bottom sheet: text, description, due, priority, project, labels. */
export function TaskEditSheet({
  task,
  visible,
  onClose,
}: {
  task: TaskWithLabels;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const updateTask = useUpdateTask();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  const [content, setContent] = useState(task.content);
  const [description, setDescription] = useState(task.description);
  const [due, setDue] = useState<string | null>(task.due_date);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [projectId, setProjectId] = useState(task.project_id);
  const [dueTime, setDueTime] = useState<string | null>(task.due_time);
  const [recurrence, setRecurrence] = useState<string | null>(task.recurrence);
  const [showGrid, setShowGrid] = useState(false);
  const [labelIds, setLabelIds] = useState<string[]>(task.label_ids);
  const bottomInset = useBottomInset();
  const sheetMaxHeight = useSheetMaxHeight();

  useEffect(() => {
    if (visible) {
      setContent(task.content);
      setDescription(task.description);
      setDue(task.due_date);
      setDueTime(task.due_time);
      setRecurrence(task.recurrence);
      setPriority(task.priority);
      setProjectId(task.project_id);
      setLabelIds(task.label_ids);
      setShowGrid(false);
    }
  }, [visible, task]);

  const [pastDateConfirm, setPastDateConfirm] = useState(false);

  function save() {
    const text = content.trim();
    if (!text) return;
    // Only nags when the date is actually changing to a past value this
    // session - an already-overdue task being saved for an unrelated edit
    // shouldn't re-prompt every time.
    if (due && due !== task.due_date && isOverdue(due)) {
      setPastDateConfirm(true);
      return;
    }
    void doSave();
  }

  async function doSave() {
    const text = content.trim();
    await updateTask.mutateAsync({
      id: task.id,
      patch: {
        content: text,
        description: description.trim(),
        due_date: due,
        // Cleared alongside the date: a time with no day would never fire.
        due_time: due ? dueTime : null,
        recurrence,
        priority,
        project_id: projectId,
      },
      labelIds,
    });
    onClose();
  }

  const today = new Date();
  const dueOptions: { label: string; value: string | null }[] = [
    { label: 'Today', value: iso(today) },
    { label: 'Tomorrow', value: iso(addDays(today, 1)) },
    { label: 'Weekend', value: iso(nextSaturday(today)) },
    { label: 'Next week', value: iso(addDays(today, 7)) },
    { label: 'No date', value: null },
  ];
  const dueIsPreset = dueOptions.some((o) => o.value === due);

  const chip = (active: boolean) => [
    styles.chip,
    { borderColor: active ? t.brand : t.border },
    active && { backgroundColor: t.bgPressed },
  ];

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="height" style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.bgElevated, paddingBottom: 16 + bottomInset },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: sheetMaxHeight }}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Task name"
              placeholderTextColor={t.fgFaint}
              style={[styles.input, { color: t.fg }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={t.fgFaint}
              style={[styles.description, { color: t.fgSecondary }]}
            />

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Due</Text>
            <View style={styles.chipRow}>
              {dueOptions.map((o) => (
                <Pressable key={o.label} onPress={() => setDue(o.value)} style={chip(due === o.value)}>
                  <Text style={{ color: due === o.value ? t.brand : t.fgSecondary, fontSize: 13 }}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
              {due && !dueIsPreset && (
                <View style={chip(true)}>
                  <Text style={{ color: t.brand, fontSize: 13 }}>{formatDueDate(due)}</Text>
                </View>
              )}
              <Pressable onPress={() => setShowGrid((s) => !s)} style={chip(showGrid)}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={showGrid ? t.brand : t.fgSecondary}
                />
                <Text style={{ color: showGrid ? t.brand : t.fgSecondary, fontSize: 13 }}>
                  Pick date
                </Text>
              </Pressable>
            </View>
            {showGrid && <DateGrid value={due} onChange={setDue} />}

            {due && (
              <>
                <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Time</Text>
                <TimeRow value={dueTime} onChange={setDueTime} />
              </>
            )}

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Repeat</Text>
            <View style={styles.chipRow}>
              {recurrenceOptions(due).map((o) => (
                <Pressable
                  key={o.label}
                  onPress={() => setRecurrence(recurrence === o.rule ? null : o.rule)}
                  style={chip(recurrence === o.rule)}
                >
                  <Text
                    style={{
                      color: recurrence === o.rule ? t.brand : t.fgSecondary,
                      fontSize: 13,
                    }}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              ))}
              {recurrence && !recurrenceOptions(due).some((o) => o.rule === recurrence) && (
                <View style={chip(true)}>
                  <Text style={{ color: t.brand, fontSize: 13 }}>
                    {describeRecurrence(recurrence)}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Priority</Text>
            <View style={styles.chipRow}>
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <Pressable key={p} onPress={() => setPriority(p)} style={chip(priority === p)}>
                  <Ionicons
                    name="flag"
                    size={13}
                    color={p < 4 ? PRIORITY_COLORS[p] : t.fgFaint}
                  />
                  <Text style={{ color: priority === p ? t.brand : t.fgSecondary, fontSize: 13 }}>
                    P{p}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Project</Text>
            <View style={styles.chipRow}>
              {(projects ?? []).map((p) => (
                <Pressable key={p.id} onPress={() => setProjectId(p.id)} style={chip(projectId === p.id)}>
                  <Ionicons name="grid-outline" size={13} color={colorHex(p.color)} />
                  <Text style={{ color: projectId === p.id ? t.brand : t.fgSecondary, fontSize: 13 }}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            {(labels ?? []).length > 0 && (
              <>
                <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Labels</Text>
                <View style={styles.chipRow}>
                  {(labels ?? []).map((l) => {
                    const active = labelIds.includes(l.id);
                    return (
                      <Pressable
                        key={l.id}
                        onPress={() =>
                          setLabelIds((ids) =>
                            active ? ids.filter((x) => x !== l.id) : [...ids, l.id],
                          )
                        }
                        style={chip(active)}
                      >
                        <Ionicons name="pricetag-outline" size={13} color={colorHex(l.color)} />
                        <Text style={{ color: active ? t.brand : t.fgSecondary, fontSize: 13 }}>
                          {l.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: t.fgSecondary, fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={!content.trim() || updateTask.isPending}
              style={[styles.saveBtn, { backgroundColor: t.brand, opacity: content.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <ConfirmSheet
      visible={pastDateConfirm}
      title="This date is in the past"
      message="Fix the due date, or continue if this task is meant to be logged in the past."
      confirmLabel="Continue anyway"
      icon="calendar-outline"
      onConfirm={() => {
        setPastDateConfirm(false);
        void doSave();
      }}
      onCancel={() => setPastDateConfirm(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  input: { fontSize: 16, fontWeight: '600', paddingVertical: 4 },
  description: { fontSize: 13, paddingVertical: 2, marginBottom: 4 },
  groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 22,
    marginTop: 14,
  },
  saveBtn: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
});
