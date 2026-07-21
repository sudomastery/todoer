import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { filterTasks, groupTasks } from '@todoer/shared';
import {
  useActiveTasks,
  useCreateSection,
  useDeleteSection,
  useLabels,
  useProjects,
  useSections,
  useUpdateSection,
} from '../../lib/hooks';
import { useDisplayPrefs } from '../../lib/display';
import { DisplayButton, DisplaySheet } from '../../components/DisplaySheet';
import { TaskListView, type TaskSection } from '../../components/TaskListView';
import { BoardView } from '../../components/BoardView';
import { CalendarView } from '../../components/CalendarView';
import { AddTaskSheet } from '../../components/AddTaskSheet';
import { Fab } from '../../components/Fab';
import { NamePrompt } from '../../components/NamePrompt';
import { ActionSheet } from '../../components/ActionSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { useTheme } from '../../lib/theme';

export default function ProjectScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useActiveTasks();
  const { data: projects } = useProjects();
  const { data: sections } = useSections();
  const { data: labels } = useLabels();
  const [adding, setAdding] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [sectionPrompt, setSectionPrompt] = useState<{ id?: string; name: string } | null>(null);
  const { prefs, update, reset } = useDisplayPrefs(`project.${id}`);
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();

  const [sectionMenu, setSectionMenu] = useState<{ id: string; name: string } | null>(null);
  const [deletingSection, setDeletingSection] = useState<{ id: string; name: string } | null>(null);

  function sectionActions(sectionId: string, name: string) {
    setSectionMenu({ id: sectionId, name });
  }

  const project = (projects ?? []).find((p) => p.id === id);
  const all = tasks ?? [];
  const projectTasks = filterTasks(all.filter((t) => t.project_id === id), prefs);
  const projectSections = (sections ?? []).filter((s) => s.project_id === id);

  const listSections: TaskSection[] =
    prefs.groupBy === 'none'
      ? [
          { title: null, data: projectTasks.filter((t) => !t.section_id) },
          ...projectSections.map((s) => ({
            title: s.name,
            data: projectTasks.filter((t) => t.section_id === s.id),
            sectionId: s.id,
          })),
        ]
      : groupTasks(projectTasks, prefs.groupBy, {
          projects: projects ?? [],
          labels: labels ?? [],
        }).map((g) => ({ title: g.title, data: g.tasks }));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: project?.name ?? 'Project',
          headerRight: () => (
            <Pressable onPress={() => setSectionPrompt({ name: '' })} hitSlop={10}>
              <Ionicons name="add-circle-outline" size={22} color={t.fgSecondary} />
            </Pressable>
          ),
        }}
      />
      <DisplayButton prefs={prefs} onPress={() => setDisplayOpen(true)} />
      {prefs.layout === 'calendar' ? (
        <CalendarView tasks={projectTasks} projects={projects} labels={labels} showProject={false} />
      ) : prefs.layout === 'board' ? (
        <BoardView
          sections={listSections}
          allTasks={all}
          projects={projects}
          labels={labels}
          sortBy={prefs.sortBy}
          emptyMessage="No tasks in this project yet."
        />
      ) : (
        <TaskListView
          sections={listSections}
          allTasks={all}
          projects={projects}
          labels={labels}
          sortBy={prefs.sortBy}
          emptyMessage="No tasks in this project yet."
          onSectionLongPress={sectionActions}
        />
      )}
      <Fab onPress={() => setAdding(true)} clearsSystemBar />
      <AddTaskSheet visible={adding} onClose={() => setAdding(false)} defaultProjectId={id} />
      <DisplaySheet
        visible={displayOpen}
        onClose={() => setDisplayOpen(false)}
        prefs={prefs}
        update={update}
        reset={reset}
        labels={labels ?? []}
        hideGroupProject
      />
      <NamePrompt
        visible={sectionPrompt !== null}
        title={sectionPrompt?.id ? 'Rename section' : 'Add section'}
        initial={sectionPrompt?.name ?? ''}
        placeholder="Section name"
        confirmLabel={sectionPrompt?.id ? 'Save' : 'Add'}
        onCancel={() => setSectionPrompt(null)}
        onSubmit={(name) => {
          if (sectionPrompt?.id) {
            updateSection.mutate({ id: sectionPrompt.id, patch: { name } });
          } else {
            createSection.mutate({ project_id: id, name });
          }
          setSectionPrompt(null);
        }}
      />

      <ActionSheet
        visible={sectionMenu !== null}
        title={sectionMenu?.name}
        onClose={() => setSectionMenu(null)}
        actions={[
          {
            label: 'Rename',
            icon: 'pencil-outline',
            onPress: () =>
              sectionMenu && setSectionPrompt({ id: sectionMenu.id, name: sectionMenu.name }),
          },
          {
            label: 'Delete section',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => sectionMenu && setDeletingSection(sectionMenu),
          },
        ]}
      />
      <ConfirmSheet
        visible={deletingSection !== null}
        title={`Delete "${deletingSection?.name ?? ''}"?`}
        message="The tasks in this section are deleted too."
        confirmLabel="Delete section"
        onConfirm={() => {
          if (deletingSection) deleteSection.mutate(deletingSection.id);
          setDeletingSection(null);
        }}
        onCancel={() => setDeletingSection(null)}
      />
    </View>
  );
}
