'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { USERNAME_RE, isUsernameAvailable, resolveLoginEmail } from '@todoer/shared';
import { createClient } from '@/lib/supabase/client';

/**
 * Low-level fetch failures surface as the raw string "Failed to fetch", which
 * means nothing to a user. Map those to a plain sentence and pass anything
 * else (real auth errors) through unchanged.
 */
function friendlyError(message: string): string {
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message;
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'auth') {
      setError(
        'That confirmation link could not be used: it may have expired or been opened in a different browser. Log in with your password, or sign up again to get a new link.'
      );
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const supabase = createClient();

    // Validation runs through the themed error slot below rather than the
    // browser's native "Please fill out this field" bubble, which the form
    // suppresses with noValidate. Keeps every message in the app's own voice.
    if (mode === 'signup') {
      if (!name.trim() || !username.trim() || !email.trim() || !password) {
        return setError('Please fill in every field.');
      }
      if (!USERNAME_RE.test(username)) {
        return setError('Usernames are 3-30 characters: letters, numbers, and underscores only.');
      }
      if (password.length < 6) {
        return setError('Passwords must be at least 6 characters.');
      }
      setLoading(true);
      try {
        if (!(await isUsernameAvailable(supabase, username))) {
          setLoading(false);
          return setError('That username is taken.');
        }
      } catch {
        // availability check is best-effort; the database still enforces uniqueness
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, username },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (error) return setError(friendlyError(error.message));
      if (data.session) return router.push('/app/today');
      setNotice('Check your email to confirm your account, then log in.');
      return;
    }

    if (!identifier.trim() || !password) {
      return setError('Please fill in every field.');
    }
    setLoading(true);
    let loginEmail: string | null = null;
    try {
      loginEmail = await resolveLoginEmail(supabase, identifier);
    } catch {
      loginEmail = null;
    }
    if (!loginEmail) {
      setLoading(false);
      return setError('No account found with that username.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) return setError(friendlyError(error.message));
    router.push('/app/today');
    router.refresh();
  }

  // Only offered once Google is configured as a provider in the Supabase
  // dashboard; without that the redirect just fails.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === '1';

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(friendlyError(error.message));
  }

  const inputClass =
    'w-full rounded-md border border-border-strong bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg-faint';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-brand">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
          <span className="text-2xl font-bold text-fg">Todoer</span>
        </div>

        <h1 className="mb-6 text-center text-xl font-semibold">
          {mode === 'login' ? 'Log in to Todoer' : 'Create your account'}
        </h1>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {mode === 'signup' && (
            <>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </>
          )}
          {mode === 'login' && (
            <input
              type="text"
              placeholder="Email or username"
              autoCapitalize="none"
              autoCorrect="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />

          {mode === 'login' && (
            <p className="text-right text-xs">
              <Link href="/forgot-password" className="text-fg-secondary hover:text-brand hover:underline">
                Forgot password?
              </Link>
            </p>
          )}

          {error && <p className="text-sm text-p1">{error}</p>}
          {notice && <p className="text-sm text-p3">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-fg-faint">
              <span className="h-px flex-1 bg-border-default" />
              or
              <span className="h-px flex-1 bg-border-default" />
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border-strong py-2.5 text-sm font-medium hover:bg-bg-hover"
            >
              <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
                <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.3-.2-1.9H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.6Z" />
                <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.9 10.6a5.4 5.4 0 0 1 0-3.4V4.9H.9a9 9 0 0 0 0 8.1l3-2.4Z" />
                <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 4.9l3 2.3C4.6 5.1 6.6 3.6 9 3.6Z" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-fg-secondary">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-brand hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/login" className="text-brand hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
