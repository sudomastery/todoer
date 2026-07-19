'use client';

import { useEffect, useState } from 'react';
import { LEAD_OPTIONS, type NotificationPrefs } from '@todoer/shared';
import {
  ensurePermission,
  getNotificationPrefs,
  notificationsSupported,
  setNotificationPrefs,
} from '@/lib/notifications';
import { Dialog, DialogContent } from '@/components/ui';

const DIGEST_HOURS = [6, 8, 9, 12, 18, 20];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand' : 'bg-border-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function Chips<T extends number>({
  options,
  value,
  onChange,
  format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1 text-xs ${
            value === o
              ? 'border-brand text-brand'
              : 'border-border-default text-fg-secondary hover:border-border-strong'
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function NotificationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (open) {
      setPrefs(getNotificationPrefs());
      setBlocked(notificationsSupported() && Notification.permission === 'denied');
    }
  }, [open]);

  async function apply(patch: Partial<NotificationPrefs>) {
    if (!prefs) return;
    let next = { ...prefs, ...patch };
    if (patch.enabled === true && !(await ensurePermission())) {
      setBlocked(true);
      next = { ...next, enabled: false };
    }
    setPrefs(next);
    setNotificationPrefs(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Notifications" className="max-w-sm p-4">
        <h2 className="mb-1 text-base font-semibold">Notifications</h2>
        <p className="mb-2 text-sm text-fg-secondary">
          Reminders are delivered by your browser while Todoer is open in a tab. The Android app
          delivers them even when it is closed.
        </p>

        {!notificationsSupported() ? (
          <p className="text-sm text-fg-faint">This browser does not support notifications.</p>
        ) : (
          prefs && (
            <>
              {blocked && (
                <p className="mb-2 rounded-md border border-p1 px-2.5 py-2 text-xs text-p1">
                  Notifications are blocked for this site. Allow them in your browser settings to
                  turn reminders on.
                </p>
              )}

              <Toggle
                label="Reminders"
                checked={prefs.enabled}
                onChange={(v) => void apply({ enabled: v })}
              />

              {prefs.enabled && (
                <div className="border-t border-border-default pt-1">
                  <Toggle
                    label="Remind me at the due time"
                    checked={prefs.dueReminders}
                    onChange={(v) => void apply({ dueReminders: v })}
                  />
                  {prefs.dueReminders && (
                    <Chips
                      options={LEAD_OPTIONS}
                      value={prefs.leadMinutes as (typeof LEAD_OPTIONS)[number]}
                      onChange={(v) => void apply({ leadMinutes: v })}
                      format={(v) => (v === 0 ? 'On time' : `${v} min early`)}
                    />
                  )}

                  <Toggle
                    label="Daily summary"
                    checked={prefs.dailyDigest}
                    onChange={(v) => void apply({ dailyDigest: v })}
                  />
                  {prefs.dailyDigest && (
                    <Chips
                      options={DIGEST_HOURS}
                      value={prefs.digestHour}
                      onChange={(v) => void apply({ digestHour: v })}
                      format={(v) => `${v.toString().padStart(2, '0')}:00`}
                    />
                  )}

                  <p className="pt-1 text-xs text-fg-faint">
                    Reminders need a due time on the task. All-day tasks appear in the daily
                    summary.
                  </p>
                </div>
              )}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
