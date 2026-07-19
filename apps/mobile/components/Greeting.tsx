import { StyleSheet, Text, View } from 'react-native';
import { useProfile } from '../lib/hooks';
import { useTheme } from '../lib/theme';

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Compact time-of-day greeting for the header: one small line, right-aligned. */
export function Greeting() {
  const t = useTheme();
  const { data: profile } = useProfile();

  const name = profile?.username || profile?.full_name?.split(' ')[0] || '';
  if (!name) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: t.fgFaint }]} numberOfLines={1}>
        {greetingForHour(new Date().getHours())},{' '}
        <Text style={{ color: t.fgSecondary, fontWeight: '600' }}>{name}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingRight: 16, maxWidth: 200 },
  text: { fontSize: 12 },
});
