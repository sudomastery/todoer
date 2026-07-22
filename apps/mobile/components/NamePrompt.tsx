import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useBottomInset } from '../lib/insets';
import { useKeyboardOffset } from '../lib/keyboard';
import { useTheme } from '../lib/theme';

/**
 * Bottom sheet for naming or renaming something.
 *
 * This was a centred card. Every other surface in the app is a bottom sheet,
 * and the centred ones had a bug the sheets do not: with the keyboard up the
 * first tap on any control was swallowed dismissing the IME instead of
 * reaching the button, so every create took two taps.
 */
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
  const bottomInset = useBottomInset();
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
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.root, { paddingBottom: offset }]} onLayout={onLayout}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.bgElevated, paddingBottom: 16 + bottomInset },
          ]}
        >
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
          {/* Padded, full-size buttons rather than bare text. A tap that lands
              just outside a glyph-sized target falls through to the sheet, which
              dismisses the keyboard instead of pressing, so the create needed a
              second tap. onPressIn (not onPress) also matters: adjustResize
              reflows the sheet down as the keyboard hides, cancelling a
              touch-up-based press; touch-down fires before the reflow. */}
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.btn}>
              <Text style={{ color: t.fgSecondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPressIn={submit}
              disabled={!name.trim()}
              style={[styles.btn, styles.btnPrimary, { backgroundColor: t.brand, opacity: name.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{confirmLabel}</Text>
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
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  btn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { minWidth: 72 },
});
