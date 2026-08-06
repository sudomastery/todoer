'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { adminListUsers, friendlyError, type AdminAuditLogRow, type AdminUserRow } from '@todoer/shared';
import {
  useAdminAuditLogPage,
  useAdminBanUser,
  useAdminDbStats,
  useAdminDeleteUser,
  useAdminRealtime,
  useAdminSetRole,
  useAdminStats,
  useAdminUsers,
  useIsAdmin,
  useSupabase,
} from '@/lib/hooks';
import { useUser } from '@/lib/use-user';
import { RowSkeleton } from '@/components/loading';
import { Dialog, DialogContent, Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui';

const BAN_OPTIONS: { label: string; days: number }[] = [
  { label: 'Ban for 1 day', days: 1 },
  { label: 'Ban for 7 days', days: 7 },
  { label: 'Ban for 30 days', days: 30 },
  { label: 'Ban permanently', days: 36500 },
];

const STATS_WINDOW_DAYS = 30;
const PAGE_SIZE = 25;

function isBanned(row: AdminUserRow): boolean {
  return !!row.banned_until && new Date(row.banned_until) > new Date();
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-border-default p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-fg-secondary">{label}</div>
    </div>
  );
}

function Pager({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-fg-secondary">
      <span>
        {from}-{to} of {total}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="flex items-center rounded-md p-1.5 hover:bg-bg-hover disabled:opacity-30"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
          className="flex items-center rounded-md p-1.5 hover:bg-bg-hover disabled:opacity-30"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Confirmation dialogs
// ============================================================

function ReasonConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setReason('');
      }}
    >
      <DialogContent title={title} hideClose className="max-w-sm p-5">
        <h2 className="mb-1.5 text-base font-semibold">{title}</h2>
        {message && <p className="mb-3 text-sm text-fg-secondary">{message}</p>}
        <label className="mb-1 block text-xs font-medium text-fg-secondary">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Kept in the audit log"
          className="mb-4 w-full resize-none rounded-md border border-border-default bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-bg-hover px-3.5 py-2 text-sm font-semibold text-fg-secondary hover:bg-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              onConfirm(reason);
              onOpenChange(false);
              setReason('');
            }}
            className={clsx(
              'rounded-md px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90',
              danger ? 'bg-p1' : 'bg-brand',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TypedDeleteDialog({
  open,
  onOpenChange,
  email,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onConfirm: (reason: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase() && email !== '';

  function reset() {
    setTyped('');
    setReason('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent title="Delete this account?" hideClose className="max-w-sm p-5">
        <h2 className="mb-1.5 text-base font-semibold">Delete this account?</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Permanently erases {email}&rsquo;s account and all their data. This cannot be undone.
        </p>
        <label className="mb-1 block text-xs font-medium text-fg-secondary">
          Type <span className="font-semibold text-fg">{email}</span> to confirm
        </label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mb-3 w-full rounded-md border border-border-default bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
        />
        <label className="mb-1 block text-xs font-medium text-fg-secondary">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Kept in the audit log"
          className="mb-4 w-full resize-none rounded-md border border-border-default bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-bg-hover px-3.5 py-2 text-sm font-semibold text-fg-secondary hover:bg-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!matches}
            onClick={() => {
              onConfirm(reason);
              onOpenChange(false);
              reset();
            }}
            className="rounded-md bg-p1 px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete account
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// User row
// ============================================================

type Pending =
  | { kind: 'ban'; days: number; label: string }
  | { kind: 'unban' }
  | { kind: 'promote' }
  | { kind: 'demote' }
  | null;

function UserRow({ row, selfEmail }: { row: AdminUserRow; selfEmail: string }) {
  const banUser = useAdminBanUser();
  const deleteUser = useAdminDeleteUser();
  const setRole = useAdminSetRole();
  const [pending, setPending] = useState<Pending>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = row.email === selfEmail;
  const banned = isBanned(row);

  function runBan(days: number, reason: string) {
    setError(null);
    banUser.mutate(
      { userId: row.id, days, reason },
      { onError: (e) => setError(friendlyError(e, 'Could not update that user.')) },
    );
  }

  function runRole(role: 'user' | 'admin', reason: string) {
    setError(null);
    setRole.mutate(
      { userId: row.id, role, reason },
      { onError: (e) => setError(friendlyError(e, 'Could not update that user.')) },
    );
  }

  function runDelete(reason: string) {
    setError(null);
    deleteUser.mutate(
      { userId: row.id, reason },
      { onError: (e) => setError(friendlyError(e, 'Could not delete that user.')) },
    );
  }

  return (
    <div className="mb-2 rounded-xl border border-border-default bg-bg-card px-3 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {(row.full_name || row.username || row.email || '?').charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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
            {!row.email_confirmed_at && (
              <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[11px] font-semibold text-fg-faint">
                Unverified
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
              disabled={isSelf}
              className="shrink-0 rounded-md p-1.5 text-fg-faint hover:bg-bg-hover hover:text-fg disabled:opacity-30"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="end">
            {row.role === 'admin' ? (
              <DropdownItem danger onSelect={() => setPending({ kind: 'demote' })}>
                Remove admin
              </DropdownItem>
            ) : (
              <>
                {banned ? (
                  <DropdownItem onSelect={() => setPending({ kind: 'unban' })}>Unban</DropdownItem>
                ) : (
                  BAN_OPTIONS.map((opt) => (
                    <DropdownItem
                      key={opt.days}
                      onSelect={() => setPending({ kind: 'ban', days: opt.days, label: opt.label })}
                    >
                      {opt.label}
                    </DropdownItem>
                  ))
                )}
                <DropdownSeparator />
                <DropdownItem onSelect={() => setPending({ kind: 'promote' })}>Make admin</DropdownItem>
                <DropdownSeparator />
                <DropdownItem danger onSelect={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Delete account
                </DropdownItem>
              </>
            )}
          </DropdownContent>
        </Dropdown>
      </div>

      {error && <p className="mt-2 text-xs text-p1">{error}</p>}

      <ReasonConfirmDialog
        open={pending?.kind === 'ban'}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.kind === 'ban' ? pending.label : ''}
        message={`Blocks ${row.email} from signing in.`}
        confirmLabel="Ban"
        danger
        onConfirm={(reason) => pending?.kind === 'ban' && runBan(pending.days, reason)}
      />
      <ReasonConfirmDialog
        open={pending?.kind === 'unban'}
        onOpenChange={(o) => !o && setPending(null)}
        title="Unban this account?"
        message={`Restores ${row.email}'s access immediately.`}
        confirmLabel="Unban"
        onConfirm={(reason) => runBan(0, reason)}
      />
      <ReasonConfirmDialog
        open={pending?.kind === 'promote'}
        onOpenChange={(o) => !o && setPending(null)}
        title="Make this user an admin?"
        message={`${row.email} will get full admin access, including the ability to ban, delete, and promote other accounts.`}
        confirmLabel="Make admin"
        danger
        onConfirm={(reason) => runRole('admin', reason)}
      />
      <ReasonConfirmDialog
        open={pending?.kind === 'demote'}
        onOpenChange={(o) => !o && setPending(null)}
        title="Remove admin access?"
        message={`${row.email} will lose admin access immediately.`}
        confirmLabel="Remove admin"
        danger
        onConfirm={(reason) => runRole('user', reason)}
      />
      <TypedDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        email={row.email ?? ''}
        onConfirm={runDelete}
      />
    </div>
  );
}

// ============================================================
// Audit log row
// ============================================================

function auditActionLabel(action: string): string {
  switch (action) {
    case 'ban':
      return 'banned';
    case 'unban':
      return 'unbanned';
    case 'delete':
      return 'deleted';
    case 'self_delete':
      return 'self-deleted';
    case 'promote':
      return 'promoted';
    case 'demote':
      return 'demoted';
    default:
      return action;
  }
}

function AuditRow({ entry }: { entry: AdminAuditLogRow }) {
  const reason = typeof entry.detail?.reason === 'string' ? entry.detail.reason : null;
  const days = typeof entry.detail?.days === 'number' ? entry.detail.days : null;
  return (
    <div className="mb-2 rounded-xl border border-border-default bg-bg-card px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-semibold">{entry.admin_email ?? 'A deleted admin'}</span>{' '}
          <span className="text-fg-secondary">{auditActionLabel(entry.action)}</span>{' '}
          <span className="font-semibold">{entry.target_email ?? 'an account'}</span>
          {entry.action === 'ban' && days ? (
            <span className="text-fg-secondary"> for {days} {days === 1 ? 'day' : 'days'}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-fg-faint">
          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
        </span>
      </div>
      {reason && <p className="mt-1 text-xs text-fg-secondary">&ldquo;{reason}&rdquo;</p>}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

function toCsv(rows: AdminUserRow[]): string {
  const header = ['email', 'username', 'full_name', 'role', 'created_at', 'last_sign_in_at', 'banned_until'];
  const lines = rows.map((r) =>
    header
      .map((k) => {
        const v = (r as unknown as Record<string, unknown>)[k];
        const s = v == null ? '' : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function AdminPage() {
  const router = useRouter();
  const db = useSupabase();
  const { email: selfEmail } = useUser();
  const { data: admin, isLoading: adminLoading } = useIsAdmin();

  const [tab, setTab] = useState<'users' | 'audit'>('users');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [roleFilter, setRoleFilter] = useState<'' | 'user' | 'admin'>('');
  const [bannedOnly, setBannedOnly] = useState(false);
  const [sort, setSort] = useState<'created_at' | 'last_sign_in_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [userOffset, setUserOffset] = useState(0);

  useEffect(() => {
    setUserOffset(0);
  }, [search, roleFilter, bannedOnly, sort, sortDir]);

  const userParams = useMemo(
    () => ({
      search: search || undefined,
      role: (roleFilter || undefined) as 'user' | 'admin' | undefined,
      bannedOnly,
      sort,
      sortDir,
      limit: PAGE_SIZE,
      offset: userOffset,
    }),
    [search, roleFilter, bannedOnly, sort, sortDir, userOffset],
  );

  const { data: users, isLoading: usersLoading } = useAdminUsers(userParams);
  const userTotal = users?.[0]?.total_count ?? 0;

  const [auditOffset, setAuditOffset] = useState(0);
  const { data: auditEntries, isLoading: auditLoading } = useAdminAuditLogPage(PAGE_SIZE, auditOffset);
  const auditTotal = auditEntries?.[0]?.total_count ?? 0;

  const { data: stats } = useAdminStats(STATS_WINDOW_DAYS);
  const { data: dbStats } = useAdminDbStats();

  useAdminRealtime(admin === true);

  useEffect(() => {
    if (!adminLoading && admin === false) router.replace('/app/today');
  }, [adminLoading, admin, router]);

  async function exportCsv() {
    const all = await adminListUsers(db, { ...userParams, limit: 200, offset: 0 });
    const blob = new Blob([toCsv(all)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todoer-users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (adminLoading || admin !== true) {
    return <RowSkeleton rows={5} />;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Admin</h1>
      <p className="mb-5 text-sm text-fg-secondary">
        {userTotal ? `${userTotal} account${userTotal === 1 ? '' : 's'}` : 'Loading accounts...'}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={stats?.total_users ?? '–'} label="Total users" />
        <StatTile value={stats ? `+${stats.gained}` : '–'} label={`Gained (${STATS_WINDOW_DAYS}d)`} />
        <StatTile value={stats?.lost ?? '–'} label={`Lost (${STATS_WINDOW_DAYS}d)`} />
        <StatTile value={dbStats ? formatBytes(dbStats.db_size_bytes) : '–'} label="Database size" />
      </div>

      {dbStats && dbStats.table_sizes.length > 0 && (
        <details className="mb-6 rounded-lg border border-border-default p-3 text-xs">
          <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-fg-secondary">
            <Database className="h-3.5 w-3.5" /> Largest tables
          </summary>
          <div className="mt-2 space-y-1">
            {dbStats.table_sizes.map((t) => (
              <div key={t.table_name} className="flex justify-between text-fg-faint">
                <span>{t.table_name}</span>
                <span>{formatBytes(t.size_bytes)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mb-4 flex gap-1 border-b border-border-default">
        {(['users', 'audit'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'border-b-2 px-3 pb-2 text-sm font-semibold',
              tab === t
                ? 'border-brand text-fg'
                : 'border-transparent text-fg-faint hover:text-fg-secondary',
            )}
          >
            {t === 'users' ? 'Users' : 'Audit log'}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, username, or email"
              className="min-w-48 flex-1 rounded-md border border-border-default bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as '' | 'user' | 'admin')}
              className="rounded-md border border-border-default bg-bg px-2 py-1.5 text-sm outline-none"
            >
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-fg-secondary">
              <input
                type="checkbox"
                checked={bannedOnly}
                onChange={(e) => setBannedOnly(e.target.checked)}
              />
              Banned only
            </label>
            <select
              value={`${sort}:${sortDir}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split(':') as [typeof sort, typeof sortDir];
                setSort(s);
                setSortDir(d);
              }}
              className="rounded-md border border-border-default bg-bg px-2 py-1.5 text-sm outline-none"
            >
              <option value="created_at:desc">Newest joined</option>
              <option value="created_at:asc">Oldest joined</option>
              <option value="last_sign_in_at:desc">Recently active</option>
              <option value="last_sign_in_at:asc">Least recently active</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-sm font-medium text-fg-secondary hover:bg-bg-hover"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          {usersLoading && !users ? (
            <RowSkeleton rows={5} />
          ) : (users ?? []).length === 0 ? (
            <p className="text-sm text-fg-faint">No accounts match those filters.</p>
          ) : (
            (users ?? []).map((row) => <UserRow key={row.id} row={row} selfEmail={selfEmail} />)
          )}

          <Pager offset={userOffset} limit={PAGE_SIZE} total={userTotal} onChange={setUserOffset} />
        </>
      ) : (
        <>
          {auditLoading && !auditEntries ? (
            <RowSkeleton rows={5} />
          ) : (auditEntries ?? []).length === 0 ? (
            <p className="text-sm text-fg-faint">No admin actions yet.</p>
          ) : (
            (auditEntries ?? []).map((entry) => <AuditRow key={entry.id} entry={entry} />)
          )}

          <Pager offset={auditOffset} limit={PAGE_SIZE} total={auditTotal} onChange={setAuditOffset} />
        </>
      )}
    </div>
  );
}
