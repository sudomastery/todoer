import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKeyboardOffset } from '../lib/keyboard';
import { useTheme } from '../lib/theme';

/** Small centered dialog for naming or renaming something. */
export function NamePrompt({
  visible,
  title,
  initial = '',
  placeholder,
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initial?: string;
  placeholder: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const t = useTheme();
  const [name, setName] = useState(initial);
  const { offset, onLayout } = useKeyboardOffset();

  useEffect(() => {
    if (visible) setName(initial);
  }, [visible, initial]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.root, { paddingBottom: offset }]} onLayout={onLayout}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: t.bgElevated }]}>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
            {title}
          </Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder={placeholder}
            placeholderTextColor={t.fgFaint}
            style={[styles.input, { color: t.fg, borderColor: t.border }]}
            returnKeyType="done"
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} hitSlop={6}>
              <Text style={{ color: t.fgSecondary, fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} hitSlop={6} disabled={!name.trim()}>
              <Text
                style={{
                  color: t.brand,
                  fontSize: 14,
                  fontWeight: '700',
                  opacity: name.trim() ? 1 : 0.4,
                }}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  backdrop: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { alignSelf: 'stretch', borderRadius: 14, padding: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 16 },
});
