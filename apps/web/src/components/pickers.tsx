'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  Armchair,
  CalendarDays,
  CircleSlash,
  Flag,
  Hash,
  Sun,
  Sunrise,
  Tag,
} from 'lucide-react';
import { addDays, format, nextSaturday, nextMonday } from 'date-fns';
import * as chrono from 'chrono-node';
import {
  colorHex,
  formatDueDate,
  PRIORITY_COLORS,
  toISODate,
  type Label,
  type Priority,
  type Project,
} from '@todoer/shared';
import { useLabels, useProjects } from '@/lib/hooks';
import { Chip, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';

// ============================================================
// Due date picker
// ============================================================

export function DuePicker({
  value,
  onChange,
  children,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const today = new Date();
  const parsed = text ? chrono.parseDate(text, today, { forwardDate: true }) : null;

  function pick(date: string | null) {
    onChange(date);
    setOpen(false);
    setText('');
  }

  const quick = [
    { label: 'Today', icon: <Sun className="h-4 w-4 text-green-600" />, date: toISODate(today) },
    {
      label: 'Tomorrow',
      icon: <Sunrise className="h-4 w-4 text-orange-400" />,
      date: toISODate(addDays(today, 1)),
    },
    {
      label: 'This weekend',
      icon: <Armchair className="h-4 w-4 text-p3" />,
      date: toISODate(nextSaturday(today)),
    },
    {
      label: 'Next week',
      icon: <CalendarDays className="h-4 w-4 text-purple-500" />,
      date: toISODate(nextMonday(today)),
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <div className="border-b border-border-default p-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && parsed) pick(toISODate(parsed));
            }}
            placeholder="Type a date, e.g. next friday"
            className="w-full rounded-md border border-border-strong bg-bg px-2 py-1.5 text-sm outline-none focus:border-fg-faint"
          />
          {parsed && (
            <button
              type="button"
              onClick={() => pick(toISODate(parsed))}
              className="mt-1 w-full rounded-md px-2 py-1 text-left text-sm text-brand hover:bg-bg-hover"
            >
              {format(parsed, 'EEE MMM d')}
            </button>
          )}
        </div>
        <div className="p-1">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => pick(q.date)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-bg-hover"
            >
              {q.icon}
              <span className="flex-1 text-left">{q.label}</span>
              <span className="text-xs text-fg-faint">{formatDueDate(q.date)}</span>
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-fg-secondary hover:bg-bg-hover"
            >
              <CircleSlash className="h-4 w-4" />
              No date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Priority picker
// ============================================================

export function PriorityPicker({
  value,
  onChange,
  children,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-44">
        {([1, 2, 3, 4] as Priority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
            className={clsx(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-bg-hover',
              value === p && 'bg-bg-hover',
            )}
          >
            <Flag
              className="h-4 w-4"
              style={{ color: PRIORITY_COLORS[p] }}
              fill={p < 4 ? PRIORITY_COLORS[p] : 'none'}
            />
            Priority {p}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Label picker (multi-select)
// ============================================================

export function LabelPicker({
  value,
  onChange,
  children,
}: {
  value: string[];
  onChange: (labelIds: string[]) => void;
  children: React.ReactNode;
}) {
  const { data: labels } = useLabels();
  const [query, setQuery] = useState('');

  const filtered = (labels ?? []).filter((l) =>
    l.name.toLowerCase().includes(query.toLowerCase()),
  );

  function toggle(label: Label) {
    onChange(
      value.includes(label.id) ? value.filter((id) => id !== label.id) : [...value, label.id],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        <div className="border-b border-border-default p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search labels"
            className="w-full rounded-md border border-border-strong bg-bg px-2 py-1.5 text-sm outline-none focus:border-fg-faint"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle(l)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-bg-hover"
            >
              <Tag className="h-4 w-4" style={{ color: colorHex(l.color) }} />
              <span className="flex-1 text-left">{l.name}</span>
              <input type="checkbox" readOnly checked={value.includes(l.id)} className="accent-brand" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-fg-faint">
              No labels. Type @name in the task field to create one.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Project picker
// ============================================================

export function ProjectPicker({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (projectId: string) => void;
  children: React.ReactNode;
}) {
  const { data: projects } = useProjects();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="max-h-64 w-56 overflow-y-auto">
        {(projects ?? []).map((p: Project) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onChange(p.id);
              setOpen(false);
            }}
            className={clsx(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-bg-hover',
              value === p.id && 'bg-bg-hover',
            )}
          >
            <Hash className="h-4 w-4" style={{ color: colorHex(p.color) }} />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Chips used by editors
// ============================================================

export function DueChip({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  return (
    <DuePicker value={value} onChange={onChange}>
      <Chip active={!!value}>
        <CalendarDays className="h-3.5 w-3.5" />
        {value ? formatDueDate(value) : 'Due date'}
      </Chip>
    </DuePicker>
  );
}

export function PriorityChip({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <PriorityPicker value={value} onChange={onChange}>
      <Chip active={value < 4}>
        <Flag
          className="h-3.5 w-3.5"
          style={value < 4 ? { color: PRIORITY_COLORS[value] } : undefined}
          fill={value < 4 ? PRIORITY_COLORS[value] : 'none'}
        />
        {value < 4 ? `P${value}` : 'Priority'}
      </Chip>
    </PriorityPicker>
  );
}
