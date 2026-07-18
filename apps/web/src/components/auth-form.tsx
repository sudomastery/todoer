'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { USERNAME_RE, isUsernameAvailable, resolveLoginEmail } from '@todoer/shared';
import { createClient } from '@/lib/supabase/client';

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

    if (mode === 'signup') {
      if (!USERNAME_RE.test(username)) {
        return setError('Usernames are 3-30 characters: letters, numbers, and underscores only.');
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
      if (error) return setError(error.message);
      if (data.session) return router.push('/app/today');
      setNotice('Check your email to confirm your account, then log in.');
      return;
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
    if (error) return setError(error.message);
    router.push('/app/today');
    router.refresh();
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

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <input
                type="text"
                required
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                required
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                required
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
              required
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
            required
            minLength={6}
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
