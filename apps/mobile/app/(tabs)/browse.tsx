import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { buildExport, colorHex, deleteAccount } from '@todoer/shared';
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
  const [addingProject, setAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');

  function submitProject() {
    const name = projectName.trim();
    if (!name) return;
    createProject.mutate({ name, color: 'blue' });
    setProjectName('');
    setAddingProject(false);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Pressable
        onPress={() => router.push('/stats')}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.bgPressed },
        ]}
      >
        <Ionicons name="bar-chart-outline" size={18} color="#0d9488" />
        <Text style={[styles.rowText, { color: t.fg }]}>Productivity</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/completed')}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.bgPressed },
        ]}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={t.fgSecondary} />
        <Text style={[styles.rowText, { color: t.fg }]}>Completed</Text>
      </Pressable>

      <View style={[styles.sectionHead, { marginTop: 28 }]}>
        <Text style={[styles.sectionTitle, { color: t.fg }]}>My Projects</Text>
        <Pressable onPress={() => setAddingProject(true)} hitSlop={8}>
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
        onPress={async () => {
          try {
            const data = await buildExport(supabase);
            await Share.share({
              title: 'Todoer export',
              message: JSON.stringify(data, null, 2),
            });
          } catch (e) {
            Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
          }
        }}
        style={[styles.logout, { borderColor: t.border }]}
      >
        <Ionicons name="download-outline" size={18} color={t.fgSecondary} />
        <Text style={{ color: t.fgSecondary, fontSize: 14, fontWeight: '500' }}>Export data</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
          ])
        }
        style={[styles.logout, { borderColor: t.border, marginTop: 12 }]}
      >
        <Ionicons name="log-out-outline" size={18} color={t.fgSecondary} />
        <Text style={{ color: t.fgSecondary, fontSize: 14, fontWeight: '500' }}>Log out</Text>
      </Pressable>

      <Modal
        visible={addingProject}
        animationType="fade"
        transparent
        onRequestClose={() => setAddingProject(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddingProject(false)} />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <View style={[styles.modalCard, { backgroundColor: t.bgElevated }]}>
            <Text style={[styles.sectionTitle, { color: t.fg, marginBottom: 10 }]}>
              Add project
            </Text>
            <TextInput
              autoFocus
              value={projectName}
              onChangeText={setProjectName}
              onSubmitEditing={submitProject}
              placeholder="Project name"
              placeholderTextColor={t.fgFaint}
              style={[styles.modalInput, { color: t.fg, borderColor: t.border }]}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAddingProject(false)} hitSlop={6}>
                <Text style={{ color: t.fgSecondary, fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitProject} hitSlop={6} disabled={!projectName.trim()}>
                <Text
                  style={{
                    color: t.brand,
                    fontSize: 14,
                    fontWeight: '700',
                    opacity: projectName.trim() ? 1 : 0.4,
                  }}
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Pressable
        onPress={() =>
          Alert.alert(
            'Delete account',
            'This permanently erases your account and every project, task, and label. It cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount(supabase);
                    await supabase.auth.signOut();
                  } catch (e) {
                    Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Unknown error');
                  }
                },
              },
            ],
          )
        }
        style={[styles.logout, { borderColor: '#d1453b', marginTop: 12 }]}
      >
        <Ionicons name="trash-outline" size={18} color="#d1453b" />
        <Text style={{ color: '#d1453b', fontSize: 14, fontWeight: '500' }}>Delete account</Text>
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
  modalBackdrop: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCenter: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    alignSelf: 'stretch',
    borderRadius: 14,
    padding: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginTop: 16,
  },
});
