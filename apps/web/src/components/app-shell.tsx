'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PanelLeft } from 'lucide-react';
import { useActiveTasks, useRealtimeSync } from '@/lib/hooks';
import { runNotificationTick } from '@/lib/notifications';
import { useUser } from '@/lib/use-user';
import { Sidebar } from '@/components/sidebar';
import { Celebration } from '@/components/celebration';
import { QuickAddDialog } from '@/components/quick-add-dialog';
import { SearchDialog } from '@/components/search-dialog';
import { IconButton } from '@/components/ui';

interface ShellContextValue {
  openQuickAdd: () => void;
  openSearch: () => void;
}

const ShellContext = createContext<ShellContextValue>({
  openQuickAdd: () => {},
  openSearch: () => {},
});

export const useShell = () => useContext(ShellContext);

/** Checks once a minute whether a reminder or the daily summary is due. */
function useNotificationTicker() {
  const { data: tasks } = useActiveTasks();
  useEffect(() => {
    if (!tasks) return;
    runNotificationTick(tasks);
    const id = window.setInterval(() => runNotificationTick(tasks), 60_000);
    return () => window.clearInterval(id);
  }, [tasks]);
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { email: userEmail, name: userName } = useUser();
  useRealtimeSync();
  useNotificationTicker();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (typing) return;
      if (e.key === 'q') {
        e.preventDefault();
        setQuickAddOpen(true);
      }
      if (e.key === 'm') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <ShellContext.Provider
      value={{ openQuickAdd: () => setQuickAddOpen(true), openSearch: () => setSearchOpen(true) }}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userEmail={userEmail}
          userName={userName}
        />
        <main className="relative flex-1 overflow-y-auto">
          {!sidebarOpen && (
            <div className="absolute left-3 top-3 z-10">
              <IconButton label="Open sidebar (M)" onClick={() => setSidebarOpen(true)}>
                <PanelLeft className="h-5 w-5" />
              </IconButton>
            </div>
          )}
          <div className="mx-auto max-w-4xl px-6 py-8 md:px-14">{children}</div>
        </main>
      </div>

      <Celebration />
      <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </ShellContext.Provider>
  );
}

export function AppShell(props: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ShellInner {...props} />
    </QueryClientProvider>
  );
}
