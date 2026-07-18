'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { resolveLoginEmail } from '@todoer/shared';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();
    let email: string | null = null;
    try {
      email = await resolveLoginEmail(supabase, identifier);
    } catch {
      email = null;
    }
    if (!email) {
      setLoading(false);
      return setError('No account found with that username.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setNotice('Check your email for a password reset link.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-brand">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
          <span className="text-2xl font-bold text-fg">Todoer</span>
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold">Reset your password</h1>
        <p className="mb-6 text-center text-sm text-fg-secondary">
          Enter your email or username and we will send you a reset link.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Email or username"
            autoCapitalize="none"
            autoCorrect="off"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
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
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-fg-secondary">
          Remembered it?{' '}
          <Link href="/login" className="text-brand hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
