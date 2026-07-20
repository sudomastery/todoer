import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomInset } from '../lib/insets';
import { useTheme } from '../lib/theme';

/**
 * `clearsSystemBar` is for screens with no tab bar under them, where the
 * button would otherwise sit on top of the system navigation. Tab screens
 * already get that clearance from the tab bar itself.
 */
export function Fab({
  onPress,
  clearsSystemBar = false,
}: {
  onPress: () => void;
  clearsSystemBar?: boolean;
}) {
  const t = useTheme();
  const bottomInset = useBottomInset();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: t.brand, opacity: pressed ? 0.85 : 1 },
        clearsSystemBar && { bottom: 24 + bottomInset },
      ]}
      accessibilityLabel="Add task"
    >
      <Ionicons name="add" size={30} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
