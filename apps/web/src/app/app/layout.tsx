import { AppShell } from '@/components/app-shell';

/**
 * No server-side auth call here on purpose: the middleware already gates /app,
 * and keeping this segment static means moving between views is a client-side
 * transition instead of a round trip to Supabase.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
