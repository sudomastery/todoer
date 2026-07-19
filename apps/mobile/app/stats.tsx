import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, subDays } from 'date-fns';
import { BRAND, colorHex, todayISO, type TaskWithLabels } from '@todoer/shared';
import { useActiveTasks, useCompletedSince, useProjects } from '../lib/hooks';
import { useTheme, type Theme } from '../lib/theme';

const DAYS_SHOWN = 14;
const RANGE_DAYS = 90;
const CHART_H = 120;

function isoDaysAgo(days: number): string {
  return format(subDays(new Date(), days), 'yyyy-MM-dd');
}

function completionDay(t: TaskWithLabels): string | null {
  return t.completed_at ? t.completed_at.slice(0, 10) : null;
}

function StatTile({ value, label, t }: { value: number | string; label: string; t: Theme }) {
  return (
    <View style={[styles.tile, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
      <Text style={[styles.tileValue, { color: t.fg }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: t.fgSecondary }]}>{label}</Text>
    </View>
  );
}

/** Bar chart drawn with plain Views: one column per day, brand fill. */
function DailyBars({ days, t }: { days: { iso: string; count: number }[]; t: Theme }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const peak = Math.max(...days.map((d) => d.count));
  const today = todayISO();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Bar chart of tasks completed per day"
      style={[styles.chart, { borderBottomColor: t.border }]}
    >
      {days.map((d) => {
        const h = Math.max(d.count > 0 ? 4 : 0, Math.round((d.count / max) * CHART_H));
        const isToday = d.iso === today;
        const labeled = (d.count === peak && d.count > 0) || (isToday && d.count > 0);
        return (
          <View key={d.iso} style={styles.chartCol}>
            {labeled && (
              <Text style={[styles.barValue, { color: t.fgSecondary }]}>{d.count}</Text>
            )}
            <View
              style={[
                styles.bar,
                { height: h, backgroundColor: BRAND.primary },
                d.count === 0 && { backgroundColor: 'transparent' },
              ]}
            />
            <Text
              style={[
                styles.dayLabel,
                { color: isToday ? t.fg : t.fgFaint },
                isToday && { fontWeight: '700' },
              ]}
            >
              {format(new Date(`${d.iso}T00:00:00`), 'd')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StatsScreen() {
  const t = useTheme();
  const since = useMemo(() => isoDaysAgo(RANGE_DAYS), []);
  const { data: completed, isLoading } = useCompletedSince(since);
  const { data: active } = useActiveTasks();
  const { data: projects } = useProjects();

  const done = completed ?? [];
  const activeTasks = active ?? [];
  const today = todayISO();

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const task of done) {
      const d = completionDay(task);
      if (d) m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [done]);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_SHOWN }, (_, i) => {
        const iso = isoDaysAgo(DAYS_SHOWN - 1 - i);
        return { iso, count: byDay.get(iso) ?? 0 };
      }),
    [byDay],
  );

  const completedToday = byDay.get(today) ?? 0;
  const completedWeek = days.slice(-7).reduce((s, d) => s + d.count, 0);

  const streak = useMemo(() => {
    let n = 0;
    let day = byDay.has(today) ? today : isoDaysAgo(1);
    while (byDay.has(day)) {
      n += 1;
      day = format(subDays(new Date(`${day}T00:00:00`), 1), 'yyyy-MM-dd');
    }
    return n;
  }, [byDay, today]);

  const overallRate =
    done.length + activeTasks.length > 0
      ? Math.round((done.length / (done.length + activeTasks.length)) * 100)
      : 0;

  const projectRates = useMemo(() => {
    return (projects ?? [])
      .map((p) => {
        const doneCount = done.filter((task) => task.project_id === p.id).length;
        const activeCount = activeTasks.filter((task) => task.project_id === p.id).length;
        const total = doneCount + activeCount;
        return {
          id: p.id,
          name: p.name,
          color: colorHex(p.color),
          done: doneCount,
          total,
          rate: total > 0 ? Math.round((doneCount / total) * 100) : 0,
        };
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.rate - a.rate || b.done - a.done);
  }, [projects, done, activeTasks]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <Text style={{ color: t.fgFaint, padding: 20 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
    >
      <Text style={[styles.subtitle, { color: t.fgSecondary }]}>Last {RANGE_DAYS} days</Text>

      <View style={styles.tileGrid}>
        <StatTile value={completedToday} label="Completed today" t={t} />
        <StatTile value={completedWeek} label="Completed this week" t={t} />
        <StatTile value={streak} label={`Day streak${streak > 0 ? ' 🔥' : ''}`} t={t} />
        <StatTile value={`${overallRate}%`} label="Completion rate" t={t} />
      </View>

      <Text style={[styles.sectionTitle, { color: t.fg }]}>Tasks completed per day</Text>
      <Text style={[styles.sectionNote, { color: t.fgFaint }]}>Last {DAYS_SHOWN} days</Text>
      <DailyBars days={days} t={t} />

      <Text style={[styles.sectionTitle, { color: t.fg, marginTop: 28 }]}>
        Completion rate by project
      </Text>
      <Text style={[styles.sectionNote, { color: t.fgFaint }]}>
        Completed in the last {RANGE_DAYS} days vs currently active tasks
      </Text>
      {projectRates.length === 0 && (
        <Text style={{ color: t.fgFaint, fontSize: 13, marginTop: 10 }}>
          Nothing here yet. Complete a few tasks first.
        </Text>
      )}
      {projectRates.map((p) => (
        <View key={p.id} style={{ marginTop: 14 }}>
          <View style={styles.projectRow}>
            <View style={styles.projectName}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={{ color: t.fg, fontSize: 14 }} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
            <Text style={{ color: t.fgSecondary, fontSize: 13 }}>
              {p.done}/{p.total} · {p.rate}%
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${p.name}: ${p.rate}% completed`}
            style={[styles.track, { backgroundColor: t.bgPressed }]}
          >
            <View style={[styles.fill, { width: `${p.rate}%`, backgroundColor: BRAND.primary }]} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, marginBottom: 14 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 26 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  tileValue: { fontSize: 24, fontWeight: '700' },
  tileLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionNote: { fontSize: 12, marginTop: 2 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: CHART_H + 40,
    marginTop: 14,
    borderBottomWidth: 1,
    paddingBottom: 0,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', maxWidth: 22, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValue: { fontSize: 11, marginBottom: 3 },
  dayLabel: { fontSize: 10, marginTop: 4, marginBottom: 2 },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 10,
  },
  projectName: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
