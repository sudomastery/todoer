import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import {
  describeRecurrence,
  formatDue,
  isOverdue,
  parseQuickAdd,
  PRIORITY_COLORS,
  recurrenceOptions,
  type Priority,
} from '@todoer/shared';
import { ConfirmSheet } from './ConfirmSheet';
import { DateGrid } from './DateGrid';
import { TimeRow } from './TimeRow';
import { useCreateSubtasks, useProjects, useQuickAdd } from '../lib/hooks';
import { useBottomInset, useSheetMaxHeight } from '../lib/insets';
import { raiseSoftKeyboard } from '../lib/keyboard';
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
  const createSubtasks = useCreateSubtasks();
  const { data: projects } = useProjects();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const bottomInset = useBottomInset();
  const detailsMaxHeight = useSheetMaxHeight(0.45);

  // undefined means "whatever the typed text says"; an explicit choice wins.
  const [dueOverride, setDueOverride] = useState<string | null | undefined>(undefined);
  const [timeOverride, setTimeOverride] = useState<string | null | undefined>(undefined);
  const [repeatOverride, setRepeatOverride] = useState<string | null | undefined>(undefined);
  const [priorityOverride, setPriorityOverride] = useState<Priority | undefined>(undefined);
  const [showDetails, setShowDetails] = useState(false);

  // Subtasks staged while the parent is still being typed: they cannot be
  // written until the parent exists, so they are held here until submit.
  // A subtask cannot itself have children, so this is hidden when parentId is set.
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskText, setSubtaskText] = useState('');
  // The box is revealed by its chip rather than sitting open, so a task with
  // no subtasks is not carrying an empty field around.
  const [showSubtasks, setShowSubtasks] = useState(false);
  const subtaskRef = useRef<TextInput>(null);
  const canNest = !parentId;

  function addSubtask() {
    const name = subtaskText.trim();
    if (!name) return;
    setSubtasks((prev) => [...prev, name]);
    setSubtaskText('');
  }

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
    setSubtasks([]);
    setSubtaskText('');
    setShowSubtasks(false);
  }

  const [pastDateConfirm, setPastDateConfirm] = useState(false);

  function submit() {
    const projectId = defaultProjectId ?? inbox?.id;
    if (!parsed.content || !projectId || quickAdd.isPending) return;
    if (effDue && isOverdue(effDue)) {
      setPastDateConfirm(true);
      return;
    }
    void doSubmit(projectId);
  }

  async function doSubmit(projectId: string) {
    const created = await quickAdd.mutateAsync({
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
    // A name still sitting in the subtask box counts: the user typed it and
    // tapping send should not quietly drop it.
    await createSubtasks.mutateAsync({ parent: created, names: [...subtasks, subtaskText] });
    reset();
    onClose();
  }

  // Dismissing throws the draft away. Keeping it meant reopening restored the
  // old name with the caret at its end, so the next task typed ran onto the
  // back of the abandoned one and any staged subtasks came along with it.
  function dismiss() {
    reset();
    onClose();
  }

  const chipStyle = (active: boolean) => [
    styles.chip,
    { borderColor: active ? t.brand : t.border },
  ];

  return (
    <>
    <Modal
      visible={visible}
      // A slide competes positionally with the keyboard-driven rise (both
      // move the sheet vertically via different mechanisms at once), and
      // "none" left the sheet's initial view inflation fully unmasked, which
      // showed up as a hitch right when it appeared. Fade is cheap (opacity
      // only, native driver, no relayout) and masks that inflate cost without
      // fighting the keyboard's vertical motion.
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={dismiss}
      onShow={() => raiseSoftKeyboard(inputRef.current)}
    >
      {/* KeyboardAvoidingView rather than hand-tracked padding: the Modal is a
          separate native window that never gets the Activity's own
          adjustResize (confirmed by testing with no offset at all - the sheet
          stayed hidden behind the keyboard), so something has to reposition
          content here. Meta's own component is tuned for this exact case and
          replaced a hand-rolled LayoutAnimation-driven version that still
          looked stepped rather than fluid. */}
      <KeyboardAvoidingView behavior="height" style={styles.root}>
        <Pressable style={styles.backdrop} onPress={dismiss} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.bgElevated, paddingBottom: 16 + bottomInset },
          ]}
        >
          <TextInput
            ref={inputRef}
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
            {canNest && (
              <Pressable
                onPress={() => {
                  setShowSubtasks(true);
                  // Opening the box and then making the user tap into it would
                  // be a pointless second step.
                  setTimeout(() => subtaskRef.current?.focus(), 0);
                }}
                style={chipStyle(subtasks.length > 0)}
              >
                <Ionicons
                  name="git-branch-outline"
                  size={13}
                  color={subtasks.length > 0 ? t.brand : t.fgSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: subtasks.length > 0 ? t.brand : t.fgSecondary },
                  ]}
                >
                  {subtasks.length > 0
                    ? `${subtasks.length} subtask${subtasks.length === 1 ? '' : 's'}`
                    : 'Subtasks'}
                </Text>
              </Pressable>
            )}
          </View>

          {canNest && (subtasks.length > 0 || showSubtasks) && (
            <View style={styles.subtasks}>
              {subtasks.map((name, i) => (
                <View key={`${name}-${i}`} style={styles.subtaskRow}>
                  <Ionicons name="ellipse" size={5} color={t.fgFaint} />
                  <Text numberOfLines={1} style={[styles.subtaskText, { color: t.fg }]}>
                    {name}
                  </Text>
                  <Pressable
                    onPress={() => setSubtasks((prev) => prev.filter((_, j) => j !== i))}
                    hitSlop={8}
                    accessibilityLabel={`Remove subtask ${name}`}
                  >
                    <Ionicons name="close" size={14} color={t.fgFaint} />
                  </Pressable>
                </View>
              ))}
              {/* Laid out as a staged row with an invisible bullet, so the
                  typed name lines up with the rows above instead of relying on
                  a hand-tuned indent. */}
              <View style={styles.subtaskRow}>
                {/* Hidden with opacity rather than a transparent colour, which
                    the icon font ignores and draws black. */}
                <Ionicons name="ellipse" size={5} color={t.fgFaint} style={{ opacity: 0 }} />
                <TextInput
                  ref={subtaskRef}
                  value={subtaskText}
                  onChangeText={setSubtaskText}
                // Return adds another subtask rather than saving the task, so a
                // whole checklist can be typed without leaving the keyboard.
                  onSubmitEditing={addSubtask}
                  blurOnSubmit={false}
                  returnKeyType="next"
                  placeholder="Add subtask"
                  placeholderTextColor={t.fgFaint}
                  style={[styles.subtaskInput, { color: t.fg }]}
                />
              </View>
            </View>
          )}

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
            {/* onPressIn, not onPress: windowSoftInputMode=adjustResize means
                tapping send dismisses the keyboard, which reflows the sheet down
                and cancels a touch-up-based press, so onPress needed two taps.
                onPressIn fires on touch-down, before the reflow. */}
            <Pressable
              onPressIn={submit}
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
        const projectId = defaultProjectId ?? inbox?.id;
        if (projectId) void doSubmit(projectId);
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
  subtasks: { marginTop: 10, paddingLeft: 4 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  subtaskText: { flex: 1, fontSize: 13 },
  subtaskInput: { flex: 1, fontSize: 13, paddingVertical: 2, paddingLeft: 0 },
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
