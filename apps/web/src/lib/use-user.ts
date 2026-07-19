'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface SessionUser {
  email: string;
  name: string;
}

/**
 * The signed-in user, read from the locally stored session so it resolves
 * without a network round trip. Only used for display: every actual permission
 * is enforced by row level security on the database.
 */
export function useUser(): SessionUser {
  const [user, setUser] = useState<SessionUser>({ email: '', name: '' });

  useEffect(() => {
    const supabase = createClient();

    function apply(session: { user?: { email?: string; user_metadata?: Record<string, unknown> } } | null) {
      setUser({
        email: session?.user?.email ?? '',
        name: (session?.user?.user_metadata?.full_name as string) ?? '',
      });
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return user;
}
