'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { buildExport, deleteAccount, friendlyError } from '@todoer/shared';
import { createClient } from '@/lib/supabase/client';
import { downloadBlob } from '@/lib/download';
import { Dialog, DialogContent } from '@/components/ui';

/**
 * Destructive account actions, kept behind two deliberate steps: the options
 * stay hidden until the warning is acknowledged, and deletion then needs the
 * account name typed out.
 */
export function DangerZoneDialog({
  open,
  onOpenChange,
  userName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every reopen starts from the warning again, never from the armed state.
  useEffect(() => {
    if (open) {
      setRevealed(false);
      setConfirmText('');
      setError(null);
    }
  }, [open]);

  async function exportFirst() {
    const supabase = createClient();
    const data = await buildExport(supabase);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `todoer-export-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      await deleteAccount(supabase);
    } catch (e) {
      setBusy(false);
      setError(friendlyError(e, 'Your account was not deleted. Please try again.'));
      return;
    }
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Danger zone" className="max-w-sm p-4">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-p1">
          <AlertTriangle className="h-4 w-4" /> Danger zone
        </h2>

        {!revealed ? (
          <>
            <p className="mb-4 text-sm leading-relaxed text-fg-secondary">
              The actions here permanently destroy data and cannot be undone. Export a copy of
              your data first if you might want it later.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md px-3 py-2 text-sm text-fg-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-md border border-p1 px-3 py-2 text-sm font-medium text-p1 hover:bg-p1/10"
              >
                I understand, show options
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-lg border border-p1 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Trash2 className="h-4 w-4 text-p1" /> Delete account
              </div>
              <p className="mb-3 text-xs leading-relaxed text-fg-secondary">
                Erases your account and every project, task, label, and comment. To confirm, type{' '}
                <span className="font-semibold text-fg">{userName}</span> below.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={userName}
                aria-label="Type your name to confirm deletion"
                className="mb-2 w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm outline-none focus:border-p1"
              />
              <button
                type="button"
                disabled={confirmText !== userName || busy}
                onClick={remove}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-p1 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete my account forever
              </button>
              {error && <p className="mt-2 text-xs text-p1">Could not delete the account: {error}</p>}
            </div>

            <button
              type="button"
              onClick={exportFirst}
              className="w-full rounded-md border border-border-strong py-2 text-sm hover:bg-bg-hover"
            >
              Export my data first
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
