import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Where Supabase sends the browser once Google is done. Registered as the app's
 * scheme in app.json, and allow-listed on the Supabase project.
 */
export const OAUTH_REDIRECT = makeRedirectUri({ scheme: 'todoer', path: 'auth/callback' });

/**
 * Google sign in for the app.
 *
 * The web flow cannot be reused: it relies on a client secret held by a server.
 * Here the app opens Supabase's authorize URL in a system browser tab, Google
 * returns to Supabase, and Supabase redirects back into the app with a
 * short-lived code that is exchanged for a session using PKCE.
 *
 * Returns false when the user simply closed the browser, and throws when the
 * flow actually failed.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start Google sign in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
  if (result.type !== 'success') return false;

  const url = new URL(result.url);
  const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (failure) throw new Error(failure);

  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google did not return an authorization code.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}
