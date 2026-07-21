'use client';

import clsx from 'clsx';
import { Calendar, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import type { DateFilter, GroupBy, LayoutMode, Priority, SortBy } from '@todoer/shared';
import { isDefaultDisplay } from '@todoer/shared';
import { useLabels } from '@/lib/hooks';
import type { DisplayState } from '@/lib/display';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';

const LAYOUTS: { value: LayoutMode; label: string; icon: React.ReactNode }[] = [
  { value: 'list', label: 'List', icon: <List className="h-4 w-4" /> },
  { value: 'board', label: 'Board', icon: <LayoutGrid className="h-4 w-4" /> },
  { value: 'calendar', label: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
];

/**
 * A row of selectable chips, matching the mobile display sheet. A native
 * <select> was used here before, which drew the operating system's own
 * dropdown inside our popover and rendered unreadable in dark mode.
 */
function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
  scroll = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** cap the height when the option list is user-generated (labels) */
  scroll?: boolean;
}) {
  return (
    <div className="py-1.5">
      <p className="mb-1.5 text-xs text-fg-secondary">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={clsx('flex flex-wrap gap-1.5', scroll && 'max-h-28 overflow-y-auto')}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              value === o.value
                ? 'border-brand/40 bg-brand-light font-semibold text-brand dark:bg-bg-active'
                : 'border-border-strong text-fg-secondary hover:bg-bg-hover',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DisplayMenu({
  state,
  hideGroupProject = false,
}: {
  state: DisplayState;
  /** hide the "Project" grouping in single-project views */
  hideGroupProject?: boolean;
}) {
  const { prefs, update, reset } = state;
  const { data: labels } = useLabels();

  const groupOptions: { value: GroupBy; label: string }[] = [
    { value: 'none', label: 'None' },
    ...(hideGroupProject ? [] : [{ value: 'project' as GroupBy, label: 'Project' }]),
    { value: 'priority', label: 'Priority' },
    { value: 'label', label: 'Label' },
    { value: 'date', label: 'Date' },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-bg-hover',
            isDefaultDisplay(prefs) ? 'text-fg-secondary' : 'text-brand',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Display
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[80vh] w-72 overflow-y-auto p-3">
        <p className="mb-2 text-sm font-semibold">Layout</p>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg-hover p-1">
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => update({ layout: l.value })}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-md py-2 text-xs',
                prefs.layout === l.value
                  ? 'bg-bg font-semibold shadow-sm'
                  : 'text-fg-secondary hover:text-fg',
              )}
            >
              {l.icon}
              {l.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm">Completed tasks</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.showCompleted}
            aria-label="Completed tasks"
            onClick={() => update({ showCompleted: !prefs.showCompleted })}
            className={clsx(
              'relative h-5 w-9 rounded-full transition-colors',
              prefs.showCompleted ? 'bg-brand' : 'bg-border-strong',
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                prefs.showCompleted ? 'left-[1.125rem]' : 'left-0.5',
              )}
            />
          </button>
        </div>

        <p className="mt-4 mb-1 text-sm font-semibold">Sort</p>
        <ChipRow
          label="Grouping"
          value={prefs.groupBy}
          options={groupOptions}
          onChange={(v) => update({ groupBy: v })}
        />
        <ChipRow<SortBy>
          label="Sorting"
          value={prefs.sortBy}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'date', label: 'Date' },
            { value: 'priority', label: 'Priority' },
            { value: 'name', label: 'Name' },
            { value: 'added', label: 'Date added' },
          ]}
          onChange={(v) => update({ sortBy: v })}
        />

        <p className="mt-4 mb-1 text-sm font-semibold">Filter</p>
        <ChipRow<DateFilter>
          label="Date filter"
          value={prefs.dateFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'today', label: 'Due today' },
            { value: 'week', label: 'Next 7 days' },
            { value: 'nodate', label: 'No date' },
          ]}
          onChange={(v) => update({ dateFilter: v })}
        />
        <ChipRow
          label="Priority filter"
          value={String(prefs.priorityFilter)}
          options={[
            { value: '0', label: 'All' },
            { value: '1', label: 'P1' },
            { value: '2', label: 'P2' },
            { value: '3', label: 'P3' },
            { value: '4', label: 'P4' },
          ]}
          onChange={(v) => update({ priorityFilter: Number(v) as 0 | Priority })}
        />
        <ChipRow
          label="Label filter"
          value={prefs.labelFilter ?? 'all'}
          scroll
          options={[
            { value: 'all', label: 'All' },
            ...(labels ?? []).map((l) => ({ value: l.id, label: `@${l.name}` })),
          ]}
          onChange={(v) => update({ labelFilter: v === 'all' ? null : v })}
        />

        {!isDefaultDisplay(prefs) && (
          <button
            type="button"
            onClick={reset}
            className="mt-3 w-full rounded-md border-t border-border-default py-2 text-center text-sm text-brand hover:bg-bg-hover"
          >
            Reset all
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
