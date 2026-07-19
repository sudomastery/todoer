import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActiveTasks, useLabels, useProjects } from '../lib/hooks';
import { TaskRow } from '../components/TaskRow';
import { useTheme } from '../lib/theme';

export default function SearchScreen() {
  const t = useTheme();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (tasks ?? []).filter(
      (task) =>
        task.content.toLowerCase().includes(q) || task.description.toLowerCase().includes(q),
    );
  }, [tasks, query]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.searchBox, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
        <Ionicons name="search" size={17} color={t.fgFaint} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks"
          placeholderTextColor={t.fgFaint}
          style={[styles.input, { color: t.fg }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            project={(projects ?? []).find((p) => p.id === item.project_id)}
            labels={labels}
            showProject
          />
        )}
        ListEmptyComponent={
          <Text style={{ color: t.fgFaint, fontSize: 13, paddingTop: 24, textAlign: 'center' }}>
            {query.trim() ? 'No matching tasks.' : 'Type to search your tasks.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 9 },
});
