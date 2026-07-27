import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const FETCH_TIMEOUT_MS = 10_000;

// React Native's fetch has no built-in timeout, and on a flaky or airplane-mode
// connection a request can hang for minutes before the OS reports failure -
// long enough to make sheets look frozen and, worse, to leave a session's
// getSession()/refresh call hanging so the app never finishes deciding whether
// the user is logged in. Aborting after a fixed window turns that into a fast,
// normal "network error" that supabase-js already knows how to handle
// (AuthRetryableFetchError / PostgrestError) instead of an indefinite hang.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Left on the default implicit flow on purpose. Signup confirmation and
      // password reset links from this client are opened on the web, which
      // cannot complete a PKCE exchange started here. Google sign in uses its
      // own PKCE client, see lib/oauth.ts.
    },
    global: { fetch: fetchWithTimeout },
  },
);

// Mirrors the current user id outside of React, updated only by local auth
// state changes (sign in/out, token refresh) rather than a fresh network
// call. Mutation hooks that need a user id for an optimistic row or a queued
// outbox entry read this instead of awaiting getSession() - that call can
// trigger a real token-refresh request when the session is near/at expiry,
// which has no place blocking what's supposed to be an instant, offline-safe
// write.
let cachedUserId: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user.id ?? null;
});
void supabase.auth.getSession().then(({ data }) => {
  cachedUserId = data.session?.user.id ?? null;
});

export function getCachedUserId(): string | null {
  return cachedUserId;
}
