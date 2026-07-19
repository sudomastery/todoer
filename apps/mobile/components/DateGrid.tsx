import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { monthGrid, todayISO, toISODate, WEEKDAY_LABELS } from '@todoer/shared';
import { useTheme } from '../lib/theme';

/**
 * Month grid for choosing an exact due date. The preset chips cover the common
 * cases; this covers everything else, which previously could only be set by
 * typing a date into quick add.
 */
export function DateGrid({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string) => void;
}) {
  const t = useTheme();
  const [month, setMonth] = useState(() =>
    startOfMonth(value ? parseISO(value) : new Date()),
  );
  const weeks = useMemo(() => monthGrid(month), [month]);
  const today = todayISO();

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <Pressable hitSlop={12} onPress={() => setMonth((m) => addMonths(m, -1))}>
          <Text style={[styles.nav, { color: t.fgSecondary }]}>{'‹'}</Text>
        </Pressable>
        <Pressable onPress={() => setMonth(startOfMonth(new Date()))}>
          <Text style={[styles.title, { color: t.fg }]}>{format(month, 'MMMM yyyy')}</Text>
        </Pressable>
        <Pressable hitSlop={12} onPress={() => setMonth((m) => addMonths(m, 1))}>
          <Text style={[styles.nav, { color: t.fgSecondary }]}>{'›'}</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAY_LABELS.map((d) => (
          <Text key={d} style={[styles.weekday, { color: t.fgFaint }]}>
            {d.slice(0, 1)}
          </Text>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={toISODate(week[0])} style={styles.row}>
          {week.map((day) => {
            const iso = toISODate(day);
            const selected = iso === value;
            const outside = day.getMonth() !== month.getMonth();
            return (
              <Pressable
                key={iso}
                onPress={() => onChange(iso)}
                style={[styles.day, selected && { backgroundColor: t.brand, borderRadius: 999 }]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: selected
                      ? '#fff'
                      : outside
                        ? t.fgFaint
                        : iso === today
                          ? t.brand
                          : t.fg,
                    fontWeight: selected || iso === today ? '700' : '400',
                  }}
                >
                  {format(day, 'd')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  nav: { fontSize: 24, paddingHorizontal: 10 },
  title: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', paddingVertical: 4 },
  day: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 1 },
});
