import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMonths, format, startOfMonth } from 'date-fns';
import {
  monthGrid,
  todayISO,
  WEEKDAY_LABELS as WEEKDAYS,
  type Label,
  type Project,
  type TaskWithLabels,
} from '@todoer/shared';
import { TaskRow } from './TaskRow';
import { useTheme } from '../lib/theme';

/** Month grid with a task list for the selected day. */
export function CalendarView({
  tasks,
  projects,
  labels,
  showProject = true,
}: {
  tasks: TaskWithLabels[];
  projects?: Project[];
  labels?: Label[];
  showProject?: boolean;
}) {
  const t = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(todayISO());

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const task of tasks) {
      if (task.due_date) m.set(task.due_date, (m.get(task.due_date) ?? 0) + 1);
    }
    return m;
  }, [tasks]);

  const weeks = useMemo(() => monthGrid(month), [month]);

  const today = todayISO();
  const monthPrefix = format(month, 'yyyy-MM');
  const dayTasks = tasks
    .filter((task) => task.due_date === selected)
    .sort((a, b) => a.priority - b.priority || (a.due_time ?? '99').localeCompare(b.due_time ?? '99'));
  const undated = tasks.filter((task) => !task.due_date).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      <View style={styles.controls}>
        <Pressable hitSlop={10} onPress={() => setMonth((m) => addMonths(m, -1))}>
          <Text style={[styles.navBtn, { color: t.fgSecondary }]}>{'‹'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMonth(startOfMonth(new Date()));
            setSelected(today);
          }}
        >
          <Text style={[styles.monthTitle, { color: t.fg }]}>{format(month, 'MMMM yyyy')}</Text>
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setMonth((m) => addMonths(m, 1))}>
          <Text style={[styles.navBtn, { color: t.fgSecondary }]}>{'›'}</Text>
        </Pressable>
      </View>

      <View style={styles.weekHead}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[styles.weekday, { color: t.fgFaint }]}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day) => {
            const iso = format(day, 'yyyy-MM-dd');
            const inMonth = iso.startsWith(monthPrefix);
            const count = byDay.get(iso) ?? 0;
            const isSelected = iso === selected;
            const isToday = iso === today;
            return (
              <Pressable
                key={iso}
                onPress={() => setSelected(iso)}
                style={[
                  styles.dayCell,
                  isSelected && { backgroundColor: `${t.brand}22`, borderRadius: 10 },
                ]}
              >
                <View
                  style={[styles.dayNum, isToday && { backgroundColor: t.brand, borderRadius: 12 }]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isToday || isSelected ? '700' : '400',
                      color: isToday ? '#fff' : inMonth ? t.fg : t.fgFaint,
                    }}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
                <View style={styles.dotRow}>
                  {count > 0 && <View style={[styles.dot, { backgroundColor: t.brand }]} />}
                  {count > 2 && <View style={[styles.dot, { backgroundColor: t.brand }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={[styles.selectedTitle, { color: t.fg, borderTopColor: t.border }]}>
        {format(new Date(`${selected}T00:00:00`), 'EEEE, MMM d')}
        <Text style={{ color: t.fgFaint, fontWeight: '400' }}>
          {'  '}
          {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
        </Text>
      </Text>
      {dayTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          project={(projects ?? []).find((p) => p.id === task.project_id)}
          labels={labels}
          showProject={showProject}
        />
      ))}
      {dayTasks.length === 0 && (
        <Text style={{ color: t.fgFaint, fontSize: 13, paddingTop: 8 }}>Nothing due this day.</Text>
      )}
      {undated > 0 && (
        <Text style={{ color: t.fgFaint, fontSize: 12, marginTop: 16 }}>
          {undated} {undated === 1 ? 'task has' : 'tasks have'} no due date and{' '}
          {undated === 1 ? 'is' : 'are'} not shown here.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { fontSize: 26, paddingHorizontal: 14, lineHeight: 30 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  weekHead: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11 },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dayNum: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: { flexDirection: 'row', gap: 2, height: 5, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  selectedTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
});
