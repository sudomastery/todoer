import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  isDefaultDisplay,
  type DateFilter,
  type DisplayPrefs,
  type GroupBy,
  type Label,
  type Priority,
  type SortBy,
} from '@todoer/shared';
import { useTheme } from '../lib/theme';

const GROUPS: { label: string; value: GroupBy }[] = [
  { label: 'None', value: 'none' },
  { label: 'Project', value: 'project' },
  { label: 'Priority', value: 'priority' },
  { label: 'Label', value: 'label' },
  { label: 'Due date', value: 'date' },
];
const SORTS: { label: string; value: SortBy }[] = [
  { label: 'Smart', value: 'manual' },
  { label: 'Due date', value: 'date' },
  { label: 'Priority', value: 'priority' },
  { label: 'Name', value: 'name' },
  { label: 'Date added', value: 'added' },
];
const DATES: { label: string; value: DateFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Today', value: 'today' },
  { label: 'Next 7 days', value: 'week' },
  { label: 'No date', value: 'nodate' },
];

/** Trigger pill for the display sheet; highlights when prefs differ from default. */
export function DisplayButton({
  prefs,
  onPress,
}: {
  prefs: DisplayPrefs;
  onPress: () => void;
}) {
  const t = useTheme();
  const active = !isDefaultDisplay(prefs);
  return (
    <View style={styles.buttonRow}>
      <Pressable
        onPress={onPress}
        style={[styles.button, { borderColor: active ? t.brand : t.border }]}
      >
        <Ionicons name="options-outline" size={14} color={active ? t.brand : t.fgSecondary} />
        <Text style={{ color: active ? t.brand : t.fgSecondary, fontSize: 13, fontWeight: '500' }}>
          Display
        </Text>
      </Pressable>
    </View>
  );
}

export function DisplaySheet({
  visible,
  onClose,
  prefs,
  update,
  reset,
  labels,
  hideGroupProject = false,
}: {
  visible: boolean;
  onClose: () => void;
  prefs: DisplayPrefs;
  update: (patch: Partial<DisplayPrefs>) => void;
  reset: () => void;
  labels: Label[];
  hideGroupProject?: boolean;
}) {
  const t = useTheme();

  const chip = (active: boolean) => [
    styles.chip,
    { borderColor: active ? t.brand : t.border },
    active && { backgroundColor: t.bgPressed },
  ];
  const chipText = (active: boolean) => ({
    color: active ? t.brand : t.fgSecondary,
    fontSize: 13,
  });

  const groups = hideGroupProject ? GROUPS.filter((g) => g.value !== 'project') : GROUPS;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated }]}>
          <View style={styles.header}>
            <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700' }}>Display</Text>
            {!isDefaultDisplay(prefs) && (
              <Pressable onPress={reset} hitSlop={8}>
                <Text style={{ color: t.brand, fontSize: 13, fontWeight: '600' }}>Reset all</Text>
              </Pressable>
            )}
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Grouping</Text>
            <View style={styles.chipRow}>
              {groups.map((g) => (
                <Pressable key={g.value} onPress={() => update({ groupBy: g.value })} style={chip(prefs.groupBy === g.value)}>
                  <Text style={chipText(prefs.groupBy === g.value)}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Sorting</Text>
            <View style={styles.chipRow}>
              {SORTS.map((s) => (
                <Pressable key={s.value} onPress={() => update({ sortBy: s.value })} style={chip(prefs.sortBy === s.value)}>
                  <Text style={chipText(prefs.sortBy === s.value)}>{s.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Date filter</Text>
            <View style={styles.chipRow}>
              {DATES.map((d) => (
                <Pressable key={d.value} onPress={() => update({ dateFilter: d.value })} style={chip(prefs.dateFilter === d.value)}>
                  <Text style={chipText(prefs.dateFilter === d.value)}>{d.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Priority filter</Text>
            <View style={styles.chipRow}>
              <Pressable onPress={() => update({ priorityFilter: 0 })} style={chip(prefs.priorityFilter === 0)}>
                <Text style={chipText(prefs.priorityFilter === 0)}>All</Text>
              </Pressable>
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <Pressable key={p} onPress={() => update({ priorityFilter: p })} style={chip(prefs.priorityFilter === p)}>
                  <Text style={chipText(prefs.priorityFilter === p)}>P{p}</Text>
                </Pressable>
              ))}
            </View>

            {labels.length > 0 && (
              <>
                <Text style={[styles.groupLabel, { color: t.fgFaint }]}>Label filter</Text>
                <View style={[styles.chipRow, { marginBottom: 8 }]}>
                  <Pressable onPress={() => update({ labelFilter: null })} style={chip(prefs.labelFilter === null)}>
                    <Text style={chipText(prefs.labelFilter === null)}>All</Text>
                  </Pressable>
                  {labels.map((l) => (
                    <Pressable key={l.id} onPress={() => update({ labelFilter: l.id })} style={chip(prefs.labelFilter === l.id)}>
                      <Text style={chipText(prefs.labelFilter === l.id)}>{l.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
});
