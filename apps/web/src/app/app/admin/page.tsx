'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { friendlyError, type AdminUserRow } from '@todoer/shared';
import {
  useAdminAuditLog,
  useAdminBanUser,
  useAdminDeleteUser,
  useAdminUsers,
  useIsAdmin,
} from '@/lib/hooks';
import { useUser } from '@/lib/use-user';
import { RowSkeleton } from '@/components/loading';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui';

const BAN_OPTIONS: { label: string; days: number }[] = [
  { label: 'Ban for 1 day', days: 1 },
  { label: 'Ban for 7 days', days: 7 },
  { label: 'Ban for 30 days', days: 30 },
  { label: 'Ban permanently', days: 36500 },
];

const STATS_WINDOW_DAYS = 30;

function isBanned(row: AdminUserRow): boolean {
  return !!row.banned_until && new Date(row.banned_until) > new Date();
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-border-default p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-fg-secondary">{label}</div>
    </div>
  );
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

        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              aria-label="User options"
              disabled={locked}
              className="shrink-0 rounded-md p-1.5 text-fg-faint hover:bg-bg-hover hover:text-fg disabled:opacity-30"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="end">
            {banned ? (
              <DropdownItem onSelect={() => ban(0)}>Unban</DropdownItem>
            ) : (
              BAN_OPTIONS.map((opt) => (
                <DropdownItem key={opt.days} onSelect={() => ban(opt.days)}>
                  {opt.label}
                </DropdownItem>
              ))
            )}
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete account
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
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

  const sinceISO = useMemo(() => subDays(new Date(), STATS_WINDOW_DAYS).toISOString(), []);
  const { data: auditLog } = useAdminAuditLog(sinceISO);

  useEffect(() => {
    if (!adminLoading && admin === false) router.replace('/app/today');
  }, [adminLoading, admin, router]);

  const stats = useMemo(() => {
    const since = subDays(new Date(), STATS_WINDOW_DAYS);
    const gained = (users ?? []).filter((u) => new Date(u.created_at) >= since).length;
    const lost = new Set(
      (auditLog ?? [])
        .filter((e) => e.action === 'delete' || e.action === 'self_delete')
        .map((e) => e.target_user_id),
    ).size;
    return { total: users?.length ?? 0, gained, lost };
  }, [users, auditLog]);

  if (adminLoading || admin !== true) {
    return <RowSkeleton rows={5} />;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Admin</h1>
      <p className="mb-5 text-sm text-fg-secondary">
        {users ? `${users.length} account${users.length === 1 ? '' : 's'}` : 'Loading accounts...'}
      </p>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile value={stats.total} label="Total users" />
        <StatTile value={`+${stats.gained}`} label={`Gained (${STATS_WINDOW_DAYS}d)`} />
        <StatTile value={stats.lost} label={`Lost (${STATS_WINDOW_DAYS}d)`} />
      </div>

      {usersLoading ? (
        <RowSkeleton rows={5} />
      ) : (
        (users ?? []).map((row) => <UserRow key={row.id} row={row} selfEmail={selfEmail} />)
      )}
    </div>
  );
}
