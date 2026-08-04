'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { Ban, ShieldCheck, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { friendlyError, type AdminUserRow } from '@todoer/shared';
import { useAdminBanUser, useAdminDeleteUser, useAdminUsers, useIsAdmin } from '@/lib/hooks';
import { useUser } from '@/lib/use-user';
import { RowSkeleton } from '@/components/loading';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '@/components/ui';

const BAN_OPTIONS: { label: string; days: number }[] = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'Permanently', days: 36500 },
];

function isBanned(row: AdminUserRow): boolean {
  return !!row.banned_until && new Date(row.banned_until) > new Date();
}

function UserRow({ row, selfEmail }: { row: AdminUserRow; selfEmail: string }) {
  const banUser = useAdminBanUser();
  const deleteUser = useAdminDeleteUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = row.email === selfEmail;
  const locked = row.role === 'admin' || isSelf;
  const banned = isBanned(row);

  function ban(days: number) {
    setError(null);
    banUser.mutate(
      { userId: row.id, days },
      { onError: (e) => setError(friendlyError(e, 'Could not update that user.')) },
    );
  }

  function remove() {
    setError(null);
    deleteUser.mutate(row.id, {
      onError: (e) => setError(friendlyError(e, 'Could not delete that user.')),
    });
  }

  return (
    <div className="mb-2 rounded-xl border border-border-default bg-bg-card px-3 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {(row.full_name || row.username || row.email || '?').charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {row.full_name || row.username || row.email}
            </span>
            {row.role === 'admin' && (
              <span className="flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand dark:bg-bg-active">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            )}
            {banned && (
              <span className="rounded-full bg-p1/10 px-2 py-0.5 text-[11px] font-semibold text-p1">
                Banned{row.banned_until ? ` until ${format(new Date(row.banned_until), 'MMM d, yyyy')}` : ''}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-fg-secondary">{row.email}</div>
        </div>

        <div className="shrink-0 text-right text-xs text-fg-faint">
          <div>Joined {format(new Date(row.created_at), 'MMM d, yyyy')}</div>
          <div>
            {row.last_sign_in_at
              ? `Active ${formatDistanceToNow(new Date(row.last_sign_in_at), { addSuffix: true })}`
              : 'Never signed in'}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {banned ? (
            <button
              type="button"
              disabled={locked || banUser.isPending}
              onClick={() => ban(0)}
              className="rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-medium hover:bg-bg-hover disabled:opacity-40"
            >
              Unban
            </button>
          ) : (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  disabled={locked || banUser.isPending}
                  className="flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-medium hover:bg-bg-hover disabled:opacity-40"
                >
                  <Ban className="h-3.5 w-3.5" /> Ban
                </button>
              </DropdownTrigger>
              <DropdownContent align="end">
                {BAN_OPTIONS.map((opt) => (
                  <DropdownItem key={opt.days} onSelect={() => ban(opt.days)}>
                    {opt.label}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          )}

          <button
            type="button"
            disabled={locked || deleteUser.isPending}
            onClick={() => setConfirmDelete(true)}
            className={clsx(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40',
              'border-border-strong text-p1 hover:bg-p1/10',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-p1">{error}</p>}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this account?"
        message={`Permanently erases ${row.email}'s account and all their data. This cannot be undone.`}
        confirmLabel="Delete account"
        onConfirm={remove}
      />
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { email: selfEmail } = useUser();
  const { data: admin, isLoading: adminLoading } = useIsAdmin();
  const { data: users, isLoading: usersLoading } = useAdminUsers();

  useEffect(() => {
    if (!adminLoading && admin === false) router.replace('/app/today');
  }, [adminLoading, admin, router]);

  if (adminLoading || admin !== true) {
    return <RowSkeleton rows={5} />;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Admin</h1>
      <p className="mb-5 text-sm text-fg-secondary">
        {users ? `${users.length} account${users.length === 1 ? '' : 's'}` : 'Loading accounts...'}
      </p>

      {usersLoading ? (
        <RowSkeleton rows={5} />
      ) : (
        (users ?? []).map((row) => <UserRow key={row.id} row={row} selfEmail={selfEmail} />)
      )}
    </div>
  );
}
