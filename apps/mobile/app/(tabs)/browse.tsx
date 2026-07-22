import { useEffect, useState } from 'react';
import {
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
  COLOR_KEYS,
  colorHex,
  deleteAccount,
  friendlyError,
  PALETTE,
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
  useCreateLabel,
  useCreateProject,
  useDeleteLabel,
  useDeleteProject,
  useLabels,
  useProfile,
  useProjects,
  useUpdateLabel,
  useUpdateProject,
} from '../../lib/hooks';
import { NamePrompt } from '../../components/NamePrompt';
import { ActionSheet } from '../../components/ActionSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import {
  COMPLETION_SOUNDS,
  getSoundPref,
  previewSound,
  setSoundPref,
  type SoundPref,
} from '../../lib/sound';
import { supabase } from '../../lib/supabase';
import { useBottomInset } from '../../lib/insets';
import { useKeyboardOffset } from '../../lib/keyboard';
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
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    getNotificationPrefs().then(setPrefs);
  }, []);

  async function apply(patch: Partial<NotificationPrefs>) {
    let next = { ...prefs, ...patch };
    if (patch.enabled === true && !(await ensurePermission())) {
      setNotice({
        title: 'Notifications are blocked',
        message: 'Allow notifications for Todoer in your system settings to get reminders.',
      });
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
      <ConfirmSheet
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message}
        confirmLabel="Got it"
        icon="notifications-off-outline"
        tone="notice"
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
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
  const keyboard = useKeyboardOffset();
  const bottomInset = useBottomInset();
  const router = useRouter();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const { data: tasks } = useActiveTasks();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const regular = (projects ?? []).filter((p) => !p.is_inbox);
  const all = tasks ?? [];
  const [addingProject, setAddingProject] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectColor, setProjectColor] = useState('blue');
  const [projectFavorite, setProjectFavorite] = useState(false);
  const [labelPrompt, setLabelPrompt] = useState<{ id?: string; name: string } | null>(null);
  const [dangerRevealed, setDangerRevealed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [labelMenu, setLabelMenu] = useState<{ id: string; name: string } | null>(null);
  const [deletingLabel, setDeletingLabel] = useState<{ id: string; name: string } | null>(null);
  const [projectMenu, setProjectMenu] = useState<(typeof regular)[number] | null>(null);
  const [deletingProject, setDeletingProject] = useState<(typeof regular)[number] | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const { data: profile } = useProfile();
  const profileName = profile?.username || profile?.full_name || 'DELETE';

  function submitProject() {
    const name = projectName.trim();
    if (!name) return;
    const patch = { name, color: projectColor, is_favorite: projectFavorite };
    if (renamingProjectId) {
      updateProject.mutate({ id: renamingProjectId, patch });
    } else {
      createProject.mutate(patch);
    }
    closeProjectDialog();
  }

  function closeProjectDialog() {
    setProjectName('');
    setProjectColor('blue');
    setProjectFavorite(false);
    setAddingProject(false);
    setRenamingProjectId(null);
  }

  function labelActions(l: { id: string; name: string }) {
    setLabelMenu(l);
  }

  function projectActions(p: (typeof regular)[number]) {
    setProjectMenu(p);
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
        onPress={() => router.push('/assistant')}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.bgPressed },
        ]}
      >
        <Ionicons name="hardware-chip-outline" size={18} color="#2563eb" />
        <Text style={[styles.rowText, { color: t.fg }]}>AI assistant</Text>
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
        <Pressable onPress={() => setLabelPrompt({ name: '' })} hitSlop={8}>
          <Ionicons name="add" size={22} color={t.fgSecondary} />
        </Pressable>
      </View>
      {(labels ?? []).map((l) => {
        const count = all.filter((task) => task.label_ids.includes(l.id)).length;
        return (
          <Pressable
            key={l.id}
            onPress={() => router.push(`/label/${l.id}`)}
            onLongPress={() => labelActions(l)}
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
              setNotice({
                title: 'Export failed',
                message: friendlyError(e, 'Your data could not be exported. Please try again.'),
              });
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
          onPress={() => setLoggingOut(true)}
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
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeProjectDialog}
      >
        <View
          style={[styles.modalRoot, { paddingBottom: keyboard.offset }]}
          onLayout={keyboard.onLayout}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeProjectDialog} />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: t.bgElevated, paddingBottom: 16 + bottomInset },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: t.fg, marginBottom: 10 }]}>
              {renamingProjectId ? 'Edit project' : 'Add project'}
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

            <Text style={[styles.settingLabel, { color: t.fgSecondary }]}>Color</Text>
            <View style={styles.swatchRow}>
              {COLOR_KEYS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setProjectColor(key)}
                  accessibilityLabel={PALETTE[key].label}
                  style={[
                    styles.swatch,
                    { backgroundColor: colorHex(key) },
                    projectColor === key && { borderWidth: 2, borderColor: t.fg },
                  ]}
                />
              ))}
            </View>

            <Pressable
              onPress={() => setProjectFavorite((v) => !v)}
              style={styles.favoriteRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: projectFavorite }}
            >
              <Ionicons
                name={projectFavorite ? 'star' : 'star-outline'}
                size={18}
                color={projectFavorite ? '#eb8909' : t.fgSecondary}
              />
              <Text style={{ color: t.fg, fontSize: 14 }}>Add to favorites</Text>
            </Pressable>

            {/* Padded, full-size buttons rather than bare text. A tap that lands
                just outside a glyph-sized target falls through to the sheet,
                which dismisses the keyboard instead of pressing, so the create
                needed a second tap. onPressIn (not onPress) also matters:
                adjustResize reflows the sheet down as the keyboard hides,
                cancelling a touch-up-based press; touch-down fires before it. */}
            <View style={styles.modalActions}>
              <Pressable onPress={closeProjectDialog} style={styles.modalBtn}>
                <Text style={{ color: t.fgSecondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPressIn={submitProject}
                disabled={!projectName.trim()}
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: t.brand, opacity: projectName.trim() ? 1 : 0.4 }]}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  {renamingProjectId ? 'Save' : 'Add'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <NamePrompt
        visible={labelPrompt !== null}
        title={labelPrompt?.id ? 'Rename label' : 'Add label'}
        initial={labelPrompt?.name ?? ''}
        placeholder="Label name"
        confirmLabel={labelPrompt?.id ? 'Save' : 'Add'}
        onCancel={() => setLabelPrompt(null)}
        onSubmit={(name) => {
          if (labelPrompt?.id) {
            updateLabel.mutate({ id: labelPrompt.id, patch: { name } });
          } else {
            createLabel.mutate({ name });
          }
          setLabelPrompt(null);
        }}
      />

      <CollapsibleSection title="Danger zone" color="#d1453b">
        <View style={[styles.dangerZone, { borderColor: '#d1453b' }]}>
          {!dangerRevealed ? (
            <>
              <Text style={{ color: t.fgSecondary, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
                The actions here permanently destroy data and cannot be undone. Export a copy of
                your data first if you might want it later.
              </Text>
              <Pressable
                onPress={() => setDangerRevealed(true)}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  { borderColor: '#d1453b' },
                  pressed && { backgroundColor: 'rgba(209,69,59,0.08)' },
                ]}
              >
                <Text style={{ color: '#d1453b', fontSize: 14, fontWeight: '600' }}>
                  I understand, show options
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: '700', marginBottom: 6 }}>
                Delete account
              </Text>
              <Text style={{ color: t.fgSecondary, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
                Erases your account and every project, task, label, and comment. To confirm, type{' '}
                <Text style={{ color: t.fg, fontWeight: '700' }}>{profileName}</Text> below.
              </Text>
              <TextInput
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder={profileName}
                placeholderTextColor={t.fgFaint}
                accessibilityLabel="Type your name to confirm deletion"
                style={[styles.modalInput, { color: t.fg, borderColor: t.border, marginBottom: 10 }]}
              />
              <Pressable
                disabled={deleteConfirm !== profileName || deleting}
                onPress={() => setConfirmingDeleteAccount(true)}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  {
                    backgroundColor: '#d1453b',
                    borderColor: '#d1453b',
                    opacity: deleteConfirm === profileName && !deleting ? 1 : 0.4,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  Delete my account forever
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </CollapsibleSection>

      <ActionSheet
        visible={labelMenu !== null}
        title={labelMenu?.name}
        onClose={() => setLabelMenu(null)}
        actions={[
          {
            label: 'Rename',
            icon: 'pencil-outline',
            onPress: () => labelMenu && setLabelPrompt({ id: labelMenu.id, name: labelMenu.name }),
          },
          {
            label: 'Delete label',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => labelMenu && setDeletingLabel(labelMenu),
          },
        ]}
      />
      <ConfirmSheet
        visible={deletingLabel !== null}
        title={`Delete "${deletingLabel?.name ?? ''}"?`}
        message="Tasks keep their other labels."
        confirmLabel="Delete label"
        onConfirm={() => {
          if (deletingLabel) deleteLabel.mutate(deletingLabel.id);
          setDeletingLabel(null);
        }}
        onCancel={() => setDeletingLabel(null)}
      />

      <ActionSheet
        visible={projectMenu !== null}
        title={projectMenu?.name}
        onClose={() => setProjectMenu(null)}
        actions={[
          {
            label: 'Edit',
            icon: 'pencil-outline',
            onPress: () => {
              if (!projectMenu) return;
              setProjectName(projectMenu.name);
              setProjectColor(projectMenu.color);
              setProjectFavorite(projectMenu.is_favorite);
              setRenamingProjectId(projectMenu.id);
              setAddingProject(true);
            },
          },
          {
            label: projectMenu?.is_favorite ? 'Remove from favorites' : 'Add to favorites',
            icon: projectMenu?.is_favorite ? 'star-outline' : 'star',
            onPress: () =>
              projectMenu &&
              updateProject.mutate({
                id: projectMenu.id,
                patch: { is_favorite: !projectMenu.is_favorite },
              }),
          },
          {
            label: 'Delete project',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => projectMenu && setDeletingProject(projectMenu),
          },
        ]}
      />
      <ConfirmSheet
        visible={deletingProject !== null}
        title={`Delete "${deletingProject?.name ?? ''}"?`}
        message="Every task in this project is deleted too."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (deletingProject) deleteProject.mutate(deletingProject.id);
          setDeletingProject(null);
        }}
        onCancel={() => setDeletingProject(null)}
      />

      <ConfirmSheet
        visible={loggingOut}
        title="Log out?"
        message="You will need to sign in again to see your tasks."
        confirmLabel="Log out"
        icon="log-out-outline"
        onConfirm={() => {
          setLoggingOut(false);
          void supabase.auth.signOut();
        }}
        onCancel={() => setLoggingOut(false)}
      />

      <ConfirmSheet
        visible={confirmingDeleteAccount}
        title="Delete account?"
        message="This cannot be undone. Every task, project, and label is destroyed."
        confirmLabel="Delete forever"
        onConfirm={async () => {
          setConfirmingDeleteAccount(false);
          setDeleting(true);
          try {
            await deleteAccount(supabase);
            await supabase.auth.signOut();
          } catch (e) {
            setDeleting(false);
            setNotice({
              title: 'Could not delete account',
              message: friendlyError(e, 'Your account was not deleted. Please try again.'),
            });
          }
        }}
        onCancel={() => setConfirmingDeleteAccount(false)}
      />

      <ConfirmSheet
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message}
        confirmLabel="Got it"
        icon="alert-circle-outline"
        tone="notice"
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
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
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
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
    gap: 12,
    marginTop: 16,
  },
  modalBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalBtnPrimary: { minWidth: 72 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  favoriteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
});
