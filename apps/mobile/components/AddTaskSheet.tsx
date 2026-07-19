import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  describeRecurrence,
  formatDueDate,
  parseQuickAdd,
  PRIORITY_COLORS,
} from '@todoer/shared';
import { useProjects, useQuickAdd } from '../lib/hooks';
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // KeyboardAvoidingView is unreliable inside a transparent Modal on Android,
  // so track the keyboard height ourselves and pad the sheet up by that much.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const dueLabel = parsed.due_date ?? defaultDueDate ?? null;

  async function submit() {
    const projectId = defaultProjectId ?? inbox?.id;
    if (!parsed.content || !projectId) return;
    await quickAdd.mutateAsync({
      input: text,
      defaultProjectId: projectId,
      defaultDueDate,
      parentId,
    });
    setText('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheetWrap, { paddingBottom: keyboardHeight }]}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated }]}>
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
            {dueLabel && (
              <View style={[styles.chip, { borderColor: t.border }]}>
                <Ionicons name="calendar-outline" size={13} color="#299438" />
                <Text style={[styles.chipText, { color: t.fgSecondary }]}>
                  {formatDueDate(dueLabel)}
                </Text>
              </View>
            )}
            {parsed.recurrence && (
              <View style={[styles.chip, { borderColor: t.border }]}>
                <Ionicons name="repeat" size={13} color={t.fgSecondary} />
                <Text style={[styles.chipText, { color: t.fgSecondary }]}>
                  {describeRecurrence(parsed.recurrence)}
                </Text>
              </View>
            )}
            {parsed.priority < 4 && (
              <View style={[styles.chip, { borderColor: t.border }]}>
                <Ionicons name="flag" size={13} color={PRIORITY_COLORS[parsed.priority]} />
                <Text style={[styles.chipText, { color: t.fgSecondary }]}>
                  P{parsed.priority}
                </Text>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
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
