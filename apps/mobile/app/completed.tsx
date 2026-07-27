import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatDue } from '@todoer/shared';
import { useCompletedTasks, useProjects, useUncompleteTask } from '../lib/hooks';
import { pullToRefresh } from '../lib/sync';
import { useTheme } from '../lib/theme';

export default function CompletedScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: completed, isLoading } = useCompletedTasks();
  const { data: projects } = useProjects();
  const uncompleteTask = useUncompleteTask();
  const [refreshing, setRefreshing] = useState(false);

  const tasks = completed ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await pullToRefresh(qc);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.brand} colors={[t.brand]} />
        }
        ListEmptyComponent={
          <Text style={{ color: t.fgFaint, fontSize: 13, paddingTop: 20 }}>
            {isLoading ? 'Loading…' : 'Nothing completed yet.'}
          </Text>
        }
        renderItem={({ item }) => {
          const project = (projects ?? []).find((p) => p.id === item.project_id);
          return (
            <Pressable
              onPress={() => router.push(`/task/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: t.border },
                pressed && { backgroundColor: t.bgPressed },
              ]}
            >
              <Pressable
                onPress={() => uncompleteTask.mutate(item.id)}
                hitSlop={10}
                style={[styles.checkbox, { backgroundColor: t.fgFaint }]}
              >
                <Ionicons name="checkmark" size={13} color={t.bg} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: t.fgFaint, fontSize: 15, textDecorationLine: 'line-through' }}
                  numberOfLines={2}
                >
                  {item.content}
                </Text>
                <Text style={{ color: t.fgFaint, fontSize: 12, marginTop: 2 }}>
                  {project?.name ?? ''}
                  {item.completed_at
                    ? `${project ? ' · ' : ''}${formatDue(item.completed_at.slice(0, 10), null)}`
                    : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
