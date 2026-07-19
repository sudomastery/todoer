import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Greeting } from '../../components/Greeting';
import { useActiveTasks } from '../../lib/hooks';
import { rescheduleAll } from '../../lib/notifications';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const t = useTheme();
  const { data: tasks } = useActiveTasks();

  // Scheduled reminders are derived from the task list, so rebuild them
  // whenever it changes (add, edit, complete, or a realtime update).
  useEffect(() => {
    if (tasks) void rescheduleAll(tasks);
  }, [tasks]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.fg,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        headerRight: () => <Greeting />,
        tabBarStyle: { backgroundColor: t.bgElevated, borderTopColor: t.border },
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.fgFaint,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="file-tray-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upcoming"
        options={{
          title: 'Upcoming',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
