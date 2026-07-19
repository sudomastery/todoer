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
import {
  buildExport,
  colorHex,
  deleteAccount,
  DEFAULT_NOTIFICATION_PREFS,
  LEAD_OPTIONS,
  type NotificationPrefs,
} from '@todoer/shared';
import {
  ensurePermission,
  getNotificationPrefs,
  rescheduleAll,
  setNotificationPrefs,
} from '../../lib/notifications';
import {
  useActiveTasks,
  useCreateProject,
  useDeleteProject,
  useLabels,
  useProjects,
  useUpdateProject,
} from '../../lib/hooks';
import {
  COMPLETION_SOUNDS,
  getSoundPref,
  previewSound,
  setSoundPref,
  type SoundPref,
} from '../../lib/sound';
import { supabase } from '../../lib/supabase';
import { useAccentId, useTheme, setAccentId } from '../../lib/theme';
import { ACCENT_THEMES } from '@todoer/shared';

const SOUND_LABELS: Record<string, string> = {
  off: 'Off',
  random: 'Random',
  pop: 'Pop',
  ding: 'Ding',
  chime: 'Chime',
  tada: 'Tada',
};

function CollapsibleSection({
  title,
  color,
  children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.collapseHead,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.bgPressed },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: color ?? t.fg }]}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={17}
          color={color ?? t.fgSecondary}
        />
      </Pressable>
      {open && <View style={{ paddingTop: 4 }}>{children}</View>}
    </View>
  );
}

function ThemeSetting() {
  const t = useTheme();
  const accent = useAccentId();
  return (
    <View>
      <Text style={[styles.settingLabel, { color: t.fgSecondary }]}>Theme</Text>
      <View style={styles.chipRow}>
        {ACCENT_THEMES.map((theme) => {
          const active = accent === theme.id;
          return (
            <Pressable
              key={theme.id}
              onPress={() => setAccentId(theme.id)}
              style={[
                styles.chip,
                { borderColor: active ? theme.primary : t.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
                active && { backgroundColor: t.bgPressed },
              ]}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary }} />
              <Text style={{ color: active ? theme.primary : t.fgSecondary, fontSize: 13 }}>
                {theme.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ value, onPress }: { value: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[styles.toggle, { backgroundColor: value ? t.brand : t.border }]}
    >
      <View style={[styles.toggleKnob, value && { alignSelf: 'flex-end' }]} />
    </Pressable>
  );
}

function NotificationSetting() {
  const t = useTheme();
  const { data: tasks } = useActiveTasks();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    getNotificationPrefs().then(setPrefs);
  }, []);

  async function apply(patch: Partial<NotificationPrefs>) {
    let next = { ...prefs, ...patch };
    if (patch.enabled === true && !(await ensurePermission())) {
      Alert.alert(
        'Notifications are blocked',
        'Allow notifications for Todoer in your system settings to get reminders.',
      );
      next = { ...next, enabled: false };
    }
    setPrefs(next);
    await setNotificationPrefs(next);
    await rescheduleAll(tasks ?? []);
  }

  return (
    <View>
      <View style={styles.settingRow}>
        <Text style={[styles.rowText, { color: t.fg }]}>Reminders</Text>
        <Toggle value={prefs.enabled} onPress={() => void apply({ enabled: !prefs.enabled })} />
      </View>

      {prefs.enabled && (
        <>
          <View style={styles.settingRow}>
            <Text style={[styles.rowText, { color: t.fg }]}>Remind me at the due time</Text>
            <Toggle
              value={prefs.dueReminders}
              onPress={() => void apply({ dueReminders: !prefs.dueReminders })}
            />
          </View>

          {prefs.dueReminders && (
            <>
              <Text style={[styles.settingLabel, { color: t.fgSecondary }]}>How early</Text>
              <View style={styles.chipRow}>
                {LEAD_OPTIONS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => void apply({ leadMinutes: m })}
                    style={[
                      styles.chip,
                      { borderColor: prefs.leadMinutes === m ? t.brand : t.border },
                      prefs.leadMinutes === m && { backgroundColor: t.bgPressed },
                    ]}
                  >
                    <Text
                      style={{
                        color: prefs.leadMinutes === m ? t.brand : t.fgSecondary,
                        fontSize: 13,
                      }}
                    >
                      {m === 0 ? 'On time' : `${m} min`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View style={styles.settingRow}>
            <Text style={[styles.rowText, { color: t.fg }]}>Daily summary</Text>
            <Toggle
              value={prefs.dailyDigest}
              onPress={() => void apply({ dailyDigest: !prefs.dailyDigest })}
            />
          </View>

          {prefs.dailyDigest && (
            <>
              <Text style={[styles.settingLabel, { color: t.fgSecondary }]}>Summary time</Text>
              <View style={styles.chipRow}>
                {[6, 8, 9, 12, 18, 20].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => void apply({ digestHour: h })}
                    style={[
                      styles.chip,
                      { borderColor: prefs.digestHour === h ? t.brand : t.border },
                      prefs.digestHour === h && { backgroundColor: t.bgPressed },
                    ]}
                  >
                    <Text
                      style={{
                        color: prefs.digestHour === h ? t.brand : t.fgSecondary,
                        fontSize: 13,
                      }}
                    >
                      {h.toString().padStart(2, '0')}:00
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={{ color: t.fgFaint, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
            Reminders need a due time on the task. All-day tasks appear in the daily summary.
          </Text>
        </>
      )}
    </View>
  );
}

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
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.settingLabel, { color: t.fgSecondary }]}>Completion sound</Text>
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
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const regular = (projects ?? []).filter((p) => !p.is_inbox);
  const all = tasks ?? [];
  const [addingProject, setAddingProject] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  function submitProject() {
    const name = projectName.trim();
    if (!name) return;
    if (renamingProjectId) {
      updateProject.mutate({ id: renamingProjectId, patch: { name } });
    } else {
      createProject.mutate({ name, color: 'blue' });
    }
    setProjectName('');
    setAddingProject(false);
    setRenamingProjectId(null);
  }

  function projectActions(p: (typeof regular)[number]) {
    Alert.alert(p.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Rename',
        onPress: () => {
          setProjectName(p.name);
          setRenamingProjectId(p.id);
          setAddingProject(true);
        },
      },
      {
        text: p.is_favorite ? 'Remove from favorites' : 'Add to favorites',
        onPress: () => updateProject.mutate({ id: p.id, patch: { is_favorite: !p.is_favorite } }),
      },
      {
        text: 'Delete project',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete project', `Delete "${p.name}" and all its tasks?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteProject.mutate(p.id) },
          ]),
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Pressable
        onPress={() => router.push('/search')}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.bgPressed },
        ]}
      >
        <Ionicons name="search" size={18} color={t.fgSecondary} />
        <Text style={[styles.rowText, { color: t.fg }]}>Search</Text>
      </Pressable>
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
        onPress={() => router.push('/calendar')}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.bgPressed },
        ]}
      >
        <Ionicons name="calendar-number-outline" size={18} color="#7c3aed" />
        <Text style={[styles.rowText, { color: t.fg }]}>Calendar</Text>
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
            onLongPress={() => projectActions(p)}
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

      <View style={{ marginTop: 28 }} />
      <CollapsibleSection title="Personalisation">
        <ThemeSetting />
        <SoundSetting />
      </CollapsibleSection>

      <CollapsibleSection title="Notifications">
        <NotificationSetting />
      </CollapsibleSection>

      <CollapsibleSection title="Account">
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
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: t.border },
            pressed && { backgroundColor: t.bgPressed },
          ]}
        >
          <Ionicons name="download-outline" size={18} color={t.fgSecondary} />
          <Text style={[styles.rowText, { color: t.fg }]}>Export data</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert('Log out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])
          }
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: t.border },
            pressed && { backgroundColor: t.bgPressed },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={t.fgSecondary} />
          <Text style={[styles.rowText, { color: t.fg }]}>Log out</Text>
        </Pressable>
      </CollapsibleSection>

      <Modal
        visible={addingProject}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setAddingProject(false);
          setRenamingProjectId(null);
          setProjectName('');
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setAddingProject(false);
            setRenamingProjectId(null);
            setProjectName('');
          }}
        />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <View style={[styles.modalCard, { backgroundColor: t.bgElevated }]}>
            <Text style={[styles.sectionTitle, { color: t.fg, marginBottom: 10 }]}>
              {renamingProjectId ? 'Rename project' : 'Add project'}
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
              <Pressable
                onPress={() => {
                  setAddingProject(false);
                  setRenamingProjectId(null);
                  setProjectName('');
                }}
                hitSlop={6}
              >
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
                  {renamingProjectId ? 'Save' : 'Add'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CollapsibleSection title="Danger zone" color="#d1453b">
      <View style={[styles.dangerZone, { borderColor: '#d1453b' }]}>
        <Text style={{ color: t.fgSecondary, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
          Deleting your account permanently erases every project, task, label, and comment.
          This cannot be undone.
        </Text>
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
          style={({ pressed }) => [
            styles.dangerBtn,
            { borderColor: '#d1453b' },
            pressed && { backgroundColor: 'rgba(209,69,59,0.08)' },
          ]}
        >
          <Ionicons name="trash-outline" size={16} color="#d1453b" />
          <Text style={{ color: '#d1453b', fontSize: 14, fontWeight: '600' }}>Delete account</Text>
        </Pressable>
      </View>
      </CollapsibleSection>
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
  collapseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLabel: { fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 2 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
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
  dangerZone: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
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
