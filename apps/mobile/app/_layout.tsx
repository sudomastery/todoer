import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { Celebration } from '../components/Celebration';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    // The OAuth callback runs without a session by definition: it is the screen
    // that creates one. Leave it alone until the exchange finishes.
    const onPublicRoute = segments[0] === 'login' || segments[0] === 'auth';
    if (!session && !onPublicRoute) router.replace('/login');
    if (session && segments[0] === 'login') router.replace('/(tabs)/today');
  }, [ready, session, segments, router]);

  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const t = useTheme();
  return (
    // The app draws edge to edge on Android, so every surface that sits at the
    // bottom of the screen has to know how tall the system bars are. Seeding
    // with initialWindowMetrics means the first frame is already correct
    // instead of jumping once the insets are measured.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.bg },
            headerTintColor: t.fg,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="project/[id]" options={{ title: '' }} />
          <Stack.Screen name="label/[id]" options={{ title: '' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="completed" options={{ title: 'Completed' }} />
          <Stack.Screen name="stats" options={{ title: 'Productivity' }} />
          <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
          <Stack.Screen name="assistant" options={{ title: 'AI assistant' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
        </Stack>
      </AuthGate>
      <Celebration />
    </QueryClientProvider>
    </SafeAreaProvider>
  );
}
