import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomInset } from '../lib/insets';
import { useTheme } from '../lib/theme';

/**
 * App-styled confirmation for destructive actions, replacing the native
 * Alert.alert dialogs that looked nothing like the rest of the app. Same
 * bottom sheet language as the add and edit sheets.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  icon = 'trash-outline',
  tone = 'destructive',
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * 'notice' is for messages the user can only acknowledge (an error, a
   * blocked permission): the action is not destructive and there is nothing
   * to cancel, so the second button is dropped.
   */
  tone?: 'destructive' | 'notice';
}) {
  const t = useTheme();
  const bottomInset = useBottomInset();

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View
          style={[styles.sheet, { backgroundColor: t.bgElevated, paddingBottom: 16 + bottomInset }]}
        >
          <Text style={[styles.title, { color: t.fg }]} numberOfLines={2}>
            {title}
          </Text>
          {message ? (
            <Text style={[styles.message, { color: t.fgSecondary }]}>{message}</Text>
          ) : null}
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                backgroundColor: tone === 'notice' ? t.brand : '#d1453b',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name={icon} size={17} color="#fff" />
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
          {tone === 'destructive' && (
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelBtn, pressed && { backgroundColor: t.bgPressed }]}>
              <Text style={{ color: t.fgSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          )}
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
    padding: 20,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  message: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 12,
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 6,
  },
});
