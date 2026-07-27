import { useEffect, useState } from 'react';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { Celebration } from '../components/Celebration';
import { supabase } from '../lib/supabase';
import { useRealtimeSync } from '../lib/hooks';
import { startSyncEngine } from '../lib/sync';
import { useTheme } from '../lib/theme';

// React Query's default online detection assumes the browser's `navigator`
// object, which doesn't exist in React Native - without this, every query
// thinks it's always online and tries (and hangs on) a real fetch while in
// airplane mode. Wiring it to NetInfo makes queries pause instantly instead.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    // React Query's default networkMode ('online') silently pauses a
    // mutation's mutationFn until connectivity returns, whenever
    // onlineManager reports offline - which it now accurately does (see the
    // NetInfo wiring above). Every mutation in this app does its real work
    // locally (an optimistic cache write and/or an outbox push) and is meant
    // to run immediately regardless of connectivity, so the default pause
    // behavior is exactly wrong here: it turned "instant offline write" into
    // "frozen until reconnect" for every sheet and checkbox in the app.
    mutations: { networkMode: 'always' },
  },
});

// Persists the last-known-good query cache (tasks, projects, labels, ...) to
// disk so a cold app start while offline can paint real data immediately
// instead of an empty list while a doomed fetch is still in flight.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@todoer/query-cache',
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Not tab-scoped: this must run regardless of which tab is active, both so
  // offline sync works from any screen and so a realtime change while
  // browsing Inbox/Upcoming/Browse still lands.
  useRealtimeSync();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Not gated on `session`: loading and draining the outbox doesn't need
  // auth, and gating it meant a session that came back null purely from an
  // offline refresh failure (see the redirect effect below) would strand any
  // already-queued offline work with nothing left to load or drain it.
  useEffect(() => {
    startSyncEngine();
  }, []);

  useEffect(() => {
    if (!ready) return;
    // The OAuth callback runs without a session by definition: it is the screen
    // that creates one. Leave it alone until the exchange finishes.
    const onPublicRoute = segments[0] === 'login' || segments[0] === 'auth';
    if (session && segments[0] === 'login') router.replace('/(tabs)/today');
    if (!session && !onPublicRoute) {
      // getSession() reports session: null both for a real sign-out and for a
      // proactive refresh that failed only because the device is offline - a
      // user mid-flight with queued offline changes must not be bounced to
      // the login screen for the latter. Only redirect once connectivity
      // confirms this is a genuine logged-out state.
      NetInfo.fetch().then((state) => {
        if (state.isConnected && state.isInternetReachable !== false) router.replace('/login');
      });
    }
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
    <KeyboardProvider>
    <PersistQueryClientProvider
      client={queryClient}
      // Bump when a cached row's shape changes incompatibly, so an old
      // persisted cache from a prior app version is discarded instead of
      // rehydrating stale/mismatched data on cold start.
      persistOptions={{ persister, buster: '1' }}
    >
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
    </PersistQueryClientProvider>
    </KeyboardProvider>
    </SafeAreaProvider>
  );
}
