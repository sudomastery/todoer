import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  describeRecurrence,
  formatDue,
  parseQuickAdd,
  PRIORITY_COLORS,
  recurrenceOptions,
  type Priority,
} from '@todoer/shared';
import { DateGrid } from './DateGrid';
import { TimeRow } from './TimeRow';
import { useProjects, useQuickAdd } from '../lib/hooks';
import { useBottomInset, useSheetMaxHeight } from '../lib/insets';
import { useKeyboardOffset } from '../lib/keyboard';
import { useTheme } from '../lib/theme';

export function AddTaskSheet({
  visible,
  onClose,
  defaultProjectId,
  defaultDueDate,
  parentId,
}: {
  visible: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultDueDate?: string | null;
  parentId?: string | null;
}) {
  const t = useTheme();
  const quickAdd = useQuickAdd();
  const { data: projects } = useProjects();
  const [text, setText] = useState('');
  const { offset, onLayout } = useKeyboardOffset();
  const bottomInset = useBottomInset(offset);
  const detailsMaxHeight = useSheetMaxHeight(0.45);

  // undefined means "whatever the typed text says"; an explicit choice wins.
  const [dueOverride, setDueOverride] = useState<string | null | undefined>(undefined);
  const [timeOverride, setTimeOverride] = useState<string | null | undefined>(undefined);
  const [repeatOverride, setRepeatOverride] = useState<string | null | undefined>(undefined);
  const [priorityOverride, setPriorityOverride] = useState<Priority | undefined>(undefined);
  const [showDetails, setShowDetails] = useState(false);

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);

  const effDue = dueOverride !== undefined ? dueOverride : (parsed.due_date ?? defaultDueDate ?? null);
  const effTime = timeOverride !== undefined ? timeOverride : parsed.due_time;
  const effRepeat = repeatOverride !== undefined ? repeatOverride : parsed.recurrence;
  const effPriority: Priority = priorityOverride ?? parsed.priority;

  function reset() {
    setText('');
    setDueOverride(undefined);
    setTimeOverride(undefined);
    setRepeatOverride(undefined);
    setPriorityOverride(undefined);
    setShowDetails(false);
  }

  async function submit() {
    const projectId = defaultProjectId ?? inbox?.id;
    if (!parsed.content || !projectId) return;
    await quickAdd.mutateAsync({
      input: text,
      defaultProjectId: projectId,
      defaultDueDate,
      parentId,
      overrides: {
        due_date: effDue,
        due_time: effTime,
        recurrence: effRepeat,
        priority: effPriority,
      },
    });
    reset();
    onClose();
  }

  const chipStyle = (active: boolean) => [
    styles.chip,
    { borderColor: active ? t.brand : t.border },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingBottom: offset }]} onLayout={onLayout}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.bgElevated, paddingBottom: 16 + bottomInset },
          ]}
        >
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder="e.g. Water plants tomorrow 8am p2 @home"
            placeholderTextColor={t.fgFaint}
            style={[styles.input, { color: t.fg }]}
            returnKeyType="done"
          />

          <View style={styles.chips}>
            <Pressable onPress={() => setShowDetails((s) => !s)} style={chipStyle(!!effDue)}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={effDue ? t.brand : t.fgSecondary}
              />
              <Text style={[styles.chipText, { color: effDue ? t.brand : t.fgSecondary }]}>
                {effDue ? formatDue(effDue, effTime) : 'Due date'}
              </Text>
            </Pressable>
            {effRepeat && (
              <View style={chipStyle(true)}>
                <Ionicons name="repeat" size={13} color={t.brand} />
                <Text style={[styles.chipText, { color: t.brand }]}>
                  {describeRecurrence(effRepeat)}
                </Text>
              </View>
            )}
            {effPriority < 4 && (
              <View style={chipStyle(true)}>
                <Ionicons name="flag" size={13} color={PRIORITY_COLORS[effPriority]} />
                <Text style={[styles.chipText, { color: t.fgSecondary }]}>P{effPriority}</Text>
              </View>
            )}
            {parsed.projectName && (
              <View style={[styles.chip, { borderColor: t.border }]}>
                <Ionicons name="grid-outline" size={13} color={t.fgSecondary} />
                <Text style={[styles.chipText, { color: t.fgSecondary }]}>
                  {parsed.projectName}
                </Text>
              </View>
            )}
            {parsed.labelNames.map((name) => (
              <View key={name} style={[styles.chip, { borderColor: t.border }]}>
                <Ionicons name="pricetag-outline" size={13} color={t.fgSecondary} />
                <Text style={[styles.chipText, { color: t.fgSecondary }]}>{name}</Text>
              </View>
            ))}
          </View>

          {showDetails && (
            <ScrollView style={{ maxHeight: detailsMaxHeight }} keyboardShouldPersistTaps="handled">
              <DateGrid value={effDue} onChange={setDueOverride} />
              {effDue && (
                <>
                  <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Time</Text>
                  <TimeRow value={effTime} onChange={setTimeOverride} />
                </>
              )}

              <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Priority</Text>
              <View style={styles.chips}>
                {([1, 2, 3, 4] as Priority[]).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPriorityOverride(p)}
                    style={chipStyle(effPriority === p)}
                  >
                    <Ionicons
                      name="flag"
                      size={13}
                      color={p < 4 ? PRIORITY_COLORS[p] : t.fgFaint}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: effPriority === p ? t.brand : t.fgSecondary },
                      ]}
                    >
                      P{p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Repeat</Text>
              <View style={styles.chips}>
                {recurrenceOptions(effDue).map((o) => (
                  <Pressable
                    key={o.label}
                    onPress={() => setRepeatOverride(effRepeat === o.rule ? null : o.rule)}
                    style={chipStyle(effRepeat === o.rule)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: effRepeat === o.rule ? t.brand : t.fgSecondary },
                      ]}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Text style={{ color: t.fgFaint, fontSize: 12 }}>
              Try: dates, p1-p4, #project, @label, every week
            </Text>
            <Pressable
              onPress={submit}
              disabled={!parsed.content || quickAdd.isPending}
              style={[
                styles.sendBtn,
                { backgroundColor: t.brand, opacity: parsed.content ? 1 : 0.4 },
              ]}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  input: { fontSize: 16, fontWeight: '500', paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '500' },
  groupLabel: { fontSize: 11, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
