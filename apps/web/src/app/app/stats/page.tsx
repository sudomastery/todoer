'use client';

import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { BRAND, colorHex, todayISO, type TaskWithLabels } from '@todoer/shared';
import { RowSkeleton } from '@/components/loading';
import { useActiveTasks, useCompletedSince, useProjects } from '@/lib/hooks';

const DAYS_SHOWN = 14;
const RANGE_DAYS = 90;

function isoDaysAgo(days: number): string {
  return format(subDays(new Date(), days), 'yyyy-MM-dd');
}

function completionDay(t: TaskWithLabels): string | null {
  return t.completed_at ? t.completed_at.slice(0, 10) : null;
}

export default function StatsPage() {
  const since = useMemo(() => isoDaysAgo(RANGE_DAYS), []);
  const { data: completed, isLoading } = useCompletedSince(since);
  const { data: active } = useActiveTasks();
  const { data: projects } = useProjects();

  const done = completed ?? [];
  const activeTasks = active ?? [];
  const today = todayISO();

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of done) {
      const d = completionDay(t);
      if (d) m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [done]);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_SHOWN }, (_, i) => {
        const iso = isoDaysAgo(DAYS_SHOWN - 1 - i);
        return { iso, count: byDay.get(iso) ?? 0 };
      }),
    [byDay],
  );

  const completedToday = byDay.get(today) ?? 0;
  const completedWeek = days.slice(-7).reduce((s, d) => s + d.count, 0);

  // consecutive days with at least one completion, ending today or yesterday
  const streak = useMemo(() => {
    let n = 0;
    let day = byDay.has(today) ? today : isoDaysAgo(1);
    while (byDay.has(day)) {
      n += 1;
      day = format(subDays(new Date(`${day}T00:00:00`), 1), 'yyyy-MM-dd');
    }
    return n;
  }, [byDay, today]);

  const overallRate =
    done.length + activeTasks.length > 0
      ? Math.round((done.length / (done.length + activeTasks.length)) * 100)
      : 0;

  const projectRates = useMemo(() => {
    return (projects ?? [])
      .map((p) => {
        const doneCount = done.filter((t) => t.project_id === p.id).length;
        const activeCount = activeTasks.filter((t) => t.project_id === p.id).length;
        const total = doneCount + activeCount;
        return {
          id: p.id,
          name: p.name,
          color: colorHex(p.color),
          done: doneCount,
          total,
          rate: total > 0 ? Math.round((doneCount / total) * 100) : 0,
        };
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.rate - a.rate || b.done - a.done);
  }, [projects, done, activeTasks]);

  if (isLoading) return <RowSkeleton rows={4} />;

  return (
    <div>
      <h1 className="text-2xl font-bold">Productivity</h1>
      <p className="mt-1 text-sm text-fg-secondary">Last {RANGE_DAYS} days</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={completedToday} label="Completed today" />
        <StatTile value={completedWeek} label="Completed this week" />
        <StatTile value={streak} label={`Day streak${streak > 0 ? ' 🔥' : ''}`} />
        <StatTile value={`${overallRate}%`} label="Completion rate" />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Tasks completed per day</h2>
        <p className="text-xs text-fg-faint">Last {DAYS_SHOWN} days</p>
        <DailyBars days={days} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Completion rate by project</h2>
        <p className="text-xs text-fg-faint">
          Completed in the last {RANGE_DAYS} days vs currently active tasks
        </p>
        <div className="mt-3 space-y-3">
          {projectRates.length === 0 && (
            <p className="text-sm text-fg-faint">Nothing here yet. Complete a few tasks first.</p>
          )}
          {projectRates.map((p) => (
            <div key={p.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <span className="text-fg-secondary">
                  {p.done}/{p.total} {'·'} {p.rate}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-bg-hover"
                role="img"
                aria-label={`${p.name}: ${p.rate}% completed`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${p.rate}%`, backgroundColor: BRAND.primary }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-border-default p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-fg-secondary">{label}</div>
    </div>
  );
}

function DailyBars({ days }: { days: { iso: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const W = 700;
  const H = 180;
  const pad = { top: 18, bottom: 22, left: 8, right: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const step = innerW / days.length;
  const barW = Math.min(28, step - 8);
  const peak = Math.max(...days.map((d) => d.count));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 w-full"
      role="img"
      aria-label="Bar chart of tasks completed per day"
    >
      {/* recessive gridlines at 0 and max */}
      <line
        x1={pad.left}
        x2={W - pad.right}
        y1={H - pad.bottom}
        y2={H - pad.bottom}
        stroke="var(--color-border-default)"
      />
      {days.map((d, i) => {
        const h = Math.round((d.count / max) * innerH);
        const x = pad.left + i * step + (step - barW) / 2;
        const y = H - pad.bottom - h;
        const isPeak = d.count === peak && d.count > 0;
        const isToday = d.iso === todayISO();
        return (
          <g key={d.iso}>
            <title>{`${format(new Date(`${d.iso}T00:00:00`), 'EEE MMM d')}: ${d.count} completed`}</title>
            {/* hover target wider than the mark */}
            <rect x={pad.left + i * step} y={pad.top} width={step} height={innerH} fill="transparent" />
            {d.count > 0 && (
              <rect x={x} y={y} width={barW} height={h} rx={4} fill={BRAND.primary} />
            )}
            {(isPeak || (isToday && d.count > 0)) && (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                className="fill-[var(--color-fg-secondary)] text-[11px]"
              >
                {d.count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - 7}
              textAnchor="middle"
              className={
                isToday
                  ? 'fill-[var(--color-fg)] text-[10px] font-semibold'
                  : 'fill-[var(--color-fg-faint)] text-[10px]'
              }
            >
              {format(new Date(`${d.iso}T00:00:00`), 'd')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
