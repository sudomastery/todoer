'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (error) return setError(error.message);
      if (data.session) return router.push('/app/today');
      setNotice('Check your email to confirm your account, then log in.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push('/app/today');
    router.refresh();
  }

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
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border-strong bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg-faint"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg-faint"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg-faint"
          />

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
