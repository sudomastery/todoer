import { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { format, addDays, nextSaturday } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import {
  colorHex,
  formatDueDate,
  PRIORITY_COLORS,
  type Priority,
  type TaskWithLabels,
} from '@todoer/shared';
import { useLabels, useProjects, useSetTaskLabels, useUpdateTask } from '../lib/hooks';
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
  const setTaskLabels = useSetTaskLabels();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  const [content, setContent] = useState(task.content);
  const [description, setDescription] = useState(task.description);
  const [due, setDue] = useState<string | null>(task.due_date);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [projectId, setProjectId] = useState(task.project_id);
  const [labelIds, setLabelIds] = useState<string[]>(task.label_ids);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setContent(task.content);
      setDescription(task.description);
      setDue(task.due_date);
      setPriority(task.priority);
      setProjectId(task.project_id);
      setLabelIds(task.label_ids);
    }
  }, [visible, task]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function save() {
    const text = content.trim();
    if (!text) return;
    await updateTask.mutateAsync({
      id: task.id,
      patch: {
        content: text,
        description: description.trim(),
        due_date: due,
        priority,
        project_id: projectId,
      },
    });
    await setTaskLabels.mutateAsync({ task, labelIds });
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
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheetWrap, { paddingBottom: keyboardHeight }]}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 440 }}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
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
