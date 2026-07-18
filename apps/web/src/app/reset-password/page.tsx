'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
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

        <h1 className="mb-6 text-center text-xl font-semibold">Choose a new password</h1>

        {hasSession === false && (
          <p className="text-center text-sm text-fg-secondary">
            This page only works right after opening a password reset link.{' '}
            <Link href="/forgot-password" className="text-brand hover:underline">
              Request a new one
            </Link>
            .
          </p>
        )}

        {hasSession && (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="password"
              required
              minLength={6}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border-strong bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg-faint"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Repeat new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-border-strong bg-bg px-3 py-2.5 text-sm outline-none focus:border-fg-faint"
            />

            {error && <p className="text-sm text-p1">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save new password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
