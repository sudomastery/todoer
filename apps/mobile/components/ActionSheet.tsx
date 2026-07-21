import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomInset } from '../lib/insets';
import { useTheme } from '../lib/theme';

export interface SheetAction {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}

/**
 * App-styled options menu, replacing the native Alert.alert action lists that
 * rendered in the system's own style. Same bottom sheet language as the add,
 * edit, and confirm sheets.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const t = useTheme();
  const bottomInset = useBottomInset();

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[styles.sheet, { backgroundColor: t.bgElevated, paddingBottom: 12 + bottomInset }]}
        >
          {title ? (
            <Text style={[styles.title, { color: t.fgSecondary }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}

          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.action,
                pressed && { backgroundColor: t.bgPressed },
              ]}
            >
              {action.icon ? (
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={action.destructive ? '#d1453b' : t.fgSecondary}
                />
              ) : null}
              <Text
                style={{
                  color: action.destructive ? '#d1453b' : t.fg,
                  fontSize: 15,
                  fontWeight: '500',
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && { backgroundColor: t.bgPressed }]}
          >
            <Text style={{ color: t.fgSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
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
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  cancel: {
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 4,
  },
});
