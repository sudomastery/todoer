import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/theme';

const WIDTHS: `${number}%`[] = ['68%', '52%', '78%', '44%', '61%'];

function usePulse() {
  const value = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    // Ease in and out so the pulse breathes smoothly rather than tracking a
    // hard linear ramp that visibly snaps at each end.
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 750, easing: ease, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.45, duration: 750, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

/** Card-shaped placeholders matching TaskRow, so the list does not jump on load. */
export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  const t = useTheme();
  const opacity = usePulse();

  return (
    <Animated.View
      style={[styles.wrap, { opacity }]}
      accessibilityLabel="Loading tasks"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.checkbox, { borderColor: t.border }]} />
          <View style={styles.lines}>
            <View
              style={[styles.line, { backgroundColor: t.bgPressed, width: WIDTHS[i % WIDTHS.length] }]}
            />
            <View style={styles.metaRow}>
              <View style={[styles.meta, { backgroundColor: t.bgPressed, width: 60 }]} />
              <View style={[styles.meta, { backgroundColor: t.bgPressed, width: 38 }]} />
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, marginTop: 1 },
  lines: { flex: 1, gap: 8 },
  line: { height: 13, borderRadius: 4 },
  metaRow: { flexDirection: 'row', gap: 8 },
  meta: { height: 10, borderRadius: 4 },
});
