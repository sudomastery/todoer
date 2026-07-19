import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatDueTime, parseTimeInput } from '@todoer/shared';
import { useTheme } from '../lib/theme';

const PRESETS = [
  { label: 'Morning', value: '09:00:00' },
  { label: 'Noon', value: '12:00:00' },
  { label: 'Evening', value: '18:00:00' },
];

/**
 * Sets a due time. Matches the web time input, which previously had no mobile
 * counterpart: a time could only be attached by typing '8am' into quick add.
 */
export function TimeRow({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (time: string | null) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState(value ? formatDueTime(value) : '');

  // The date chips can clear the time out from under this input.
  useEffect(() => {
    setText(value ? formatDueTime(value) : '');
  }, [value]);

  function commit() {
    if (!text.trim()) return onChange(null);
    const parsed = parseTimeInput(text);
    if (parsed) return onChange(parsed);
    // Not a time: snap back to whatever is actually stored.
    setText(value ? formatDueTime(value) : '');
  }

  const chip = (active: boolean) => [
    styles.chip,
    { borderColor: active ? t.brand : t.border },
    active && { backgroundColor: t.bgPressed },
  ];

  return (
    <View style={styles.row}>
      {PRESETS.map((p) => (
        <Pressable key={p.label} onPress={() => onChange(p.value)} style={chip(value === p.value)}>
          <Text style={{ color: value === p.value ? t.brand : t.fgSecondary, fontSize: 13 }}>
            {p.label}
          </Text>
        </Pressable>
      ))}
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder="9:30 pm"
        placeholderTextColor={t.fgFaint}
        returnKeyType="done"
        style={[styles.input, { borderColor: t.border, color: t.fg }]}
      />
      {value && (
        <Pressable onPress={() => onChange(null)} style={chip(false)}>
          <Text style={{ color: t.fgSecondary, fontSize: 13 }}>Clear</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    minWidth: 90,
  },
});
