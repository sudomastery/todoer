import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Where Supabase sends the browser once Google is done. Registered as the app's
 * scheme in app.json and in the Android manifest, and allow-listed on the
 * Supabase project.
 *
 * Note that under Expo Go this resolves to an exp://host:port URL that is not
 * on the allow list, so Google sign in only works in a real build.
 */
export const OAUTH_REDIRECT = makeRedirectUri({ scheme: 'todoer', path: 'auth/callback' });

/**
 * PKCE has to be scoped to this flow rather than turned on for the whole app.
 * The main client also sends signup confirmation and password reset emails, and
 * those links are opened on the web, where the verifier this device generated
 * does not exist. Keeping PKCE on a separate client with its own storage key
 * leaves those email flows alone.
 */
const oauthClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      storageKey: 'todoer.oauth',
      // Only ever holds a code verifier for the few seconds the browser is
      // open, so it must survive a cold start but never refresh on its own.
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

export type GoogleSignInResult = 'success' | 'cancelled';

/**
 * Exchanges the code Supabase appended to the redirect and hands the resulting
 * session to the main client.
 *
 * Shared by the in-app browser flow below and the auth/callback route, which
 * picks up the redirect when the OS delivers it as a deep link instead.
 */
export async function completeOAuthRedirect(redirectUrl: string): Promise<void> {
  const url = new URL(redirectUrl);
  const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (failure) throw new Error(failure);

  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google did not return an authorization code.');

  const { data, error } = await oauthClient.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session) throw new Error('Google sign in did not return a session.');

  const { error: setError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setError) throw setError;

  // The temporary client has served its purpose; drop its copy of the session
  // so only the main client refreshes it. Local only, the tokens stay valid.
  await oauthClient.auth.signOut({ scope: 'local' });
}

/**
 * Google sign in for the app.
 *
 * The web flow cannot be reused: it relies on a client secret held by a server.
 * Here the app opens Supabase's authorize URL in a system browser tab, Google
 * returns to Supabase, and Supabase redirects back into the app with a
 * short-lived code that is exchanged for a session using PKCE.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const { data, error } = await oauthClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start Google sign in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
  // The user closed the tab, or the OS handed the redirect to the deep link
  // handler instead. Either way there is nothing to exchange here.
  if (result.type !== 'success') return 'cancelled';

  await completeOAuthRedirect(result.url);
  return 'success';
}
