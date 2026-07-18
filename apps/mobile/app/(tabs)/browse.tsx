import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colorHex } from '@todoer/shared';
import {
  useActiveTasks,
  useCreateProject,
  useLabels,
  useProjects,
} from '../../lib/hooks';
import {
  COMPLETION_SOUNDS,
  getSoundPref,
  previewSound,
  setSoundPref,
  type SoundPref,
} from '../../lib/sound';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';

const SOUND_LABELS: Record<string, string> = {
  off: 'Off',
  random: 'Random',
  pop: 'Pop',
  ding: 'Ding',
  chime: 'Chime',
  tada: 'Tada',
};

function SoundSetting() {
  const t = useTheme();
  const [pref, setPref] = useState<SoundPref>('pop');

  useEffect(() => {
    getSoundPref().then(setPref);
  }, []);

  function choose(next: SoundPref) {
    setPref(next);
    void setSoundPref(next);
    if (next !== 'off' && next !== 'random') previewSound(next);
  }

  const options: SoundPref[] = ['off', 'random', ...COMPLETION_SOUNDS];

  return (
    <View>
      <View style={[styles.sectionHead, { marginTop: 28 }]}>
        <Text style={[styles.sectionTitle, { color: t.fg }]}>Completion sound</Text>
      </View>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => choose(o)}
            style={[
              styles.chip,
              { borderColor: pref === o ? t.brand : t.border },
              pref === o && { backgroundColor: t.bgPressed },
            ]}
          >
            <Text style={{ color: pref === o ? t.brand : t.fgSecondary, fontSize: 13 }}>
              {SOUND_LABELS[o]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function BrowseScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const { data: tasks } = useActiveTasks();
  const createProject = useCreateProject();

  const regular = (projects ?? []).filter((p) => !p.is_inbox);
  const all = tasks ?? [];

  function addProject() {
    Alert.prompt?.(
      'Add project',
      'Project name',
      (name) => {
        if (name?.trim()) createProject.mutate({ name: name.trim(), color: 'blue' });
      },
    ) ??
      // Alert.prompt is iOS-only; Android gets a quick default project they can rename on web
      createProject.mutate({ name: 'New project', color: 'blue' });
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: t.fg }]}>My Projects</Text>
        <Pressable onPress={addProject} hitSlop={8}>
          <Ionicons name="add" size={22} color={t.fgSecondary} />
        </Pressable>
      </View>

      {regular.map((p) => {
        const count = all.filter((task) => task.project_id === p.id).length;
        return (
          <Pressable
            key={p.id}
            onPress={() => router.push(`/project/${p.id}`)}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: t.border },
              pressed && { backgroundColor: t.bgPressed },
            ]}
          >
            <Ionicons name="grid-outline" size={18} color={colorHex(p.color)} />
            <Text style={[styles.rowText, { color: t.fg }]}>{p.name}</Text>
            {p.is_favorite && <Ionicons name="star" size={14} color="#eb8909" />}
            <Text style={[styles.count, { color: t.fgFaint }]}>{count > 0 ? count : ''}</Text>
          </Pressable>
        );
      })}
      {regular.length === 0 && (
        <Text style={{ color: t.fgFaint, fontSize: 13, paddingVertical: 8 }}>
          No projects yet.
        </Text>
      )}

      <View style={[styles.sectionHead, { marginTop: 28 }]}>
        <Text style={[styles.sectionTitle, { color: t.fg }]}>Labels</Text>
      </View>
      {(labels ?? []).map((l) => {
        const count = all.filter((task) => task.label_ids.includes(l.id)).length;
        return (
          <Pressable
            key={l.id}
            onPress={() => router.push(`/label/${l.id}`)}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: t.border },
              pressed && { backgroundColor: t.bgPressed },
            ]}
          >
            <Ionicons name="pricetag-outline" size={18} color={colorHex(l.color)} />
            <Text style={[styles.rowText, { color: t.fg }]}>{l.name}</Text>
            <Text style={[styles.count, { color: t.fgFaint }]}>{count > 0 ? count : ''}</Text>
          </Pressable>
        );
      })}
      {(labels ?? []).length === 0 && (
        <Text style={{ color: t.fgFaint, fontSize: 13, paddingVertical: 8 }}>
          No labels yet. Add one with @name when creating a task.
        </Text>
      )}

      <SoundSetting />

      <Pressable
        onPress={() =>
          Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
          ])
        }
        style={[styles.logout, { borderColor: t.border }]}
      >
        <Ionicons name="log-out-outline" size={18} color={t.fgSecondary} />
        <Text style={{ color: t.fgSecondary, fontSize: 14, fontWeight: '500' }}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 15, flex: 1 },
  count: { fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
});
