import * as chrono from 'chrono-node';
import type { Priority } from './types';
import { nextOccurrence, parseRecurrence } from './recurrence';
import { toISODate } from './dates';

export interface ParsedQuickAdd {
  /** Task text with all recognized tokens removed */
  content: string;
  due_date: string | null;
  /** 'HH:MM:SS' when a specific time was given */
  due_time: string | null;
  recurrence: string | null;
  priority: Priority;
  /** Project name following '#', if any */
  projectName: string | null;
  /** Label names following '@' */
  labelNames: string[];
}

const PRIORITY_RE = /(?:^|\s)(?:p([1-4])|!!([1-4]))(?=\s|$)/i;
const PROJECT_RE = /(?:^|\s)#(?:"([^"]+)"|(\S+))/;
const LABEL_RE = /(?:^|\s)@(?:"([^"]+)"|(\S+))/g;
const RECURRENCE_RE =
  /(?:^|\s)(every other (?:day|week|month|year)|every \d+ (?:day|week|month|year)s?|every (?:day|weekday|week|month|year|sunday|monday|tuesday|wednesday|thursday|friday|saturday)|daily|weekly|monthly|yearly)(?=\s|$)/i;

function cut(text: string, start: number, length: number): string {
  return `${text.slice(0, start)} ${text.slice(start + length)}`;
}

/**
 * Parse a Todoist-style quick add string, e.g.
 *   'Pay rent tomorrow 9am #Bills @finance p1 every month'
 * Date phrases are parsed with chrono (English), tokens with regexes.
 */
export function parseQuickAdd(input: string, referenceDate: Date = new Date()): ParsedQuickAdd {
  let text = input;

  let priority: Priority = 4;
  const pm = text.match(PRIORITY_RE);
  if (pm && pm.index !== undefined) {
    priority = Number(pm[1] ?? pm[2]) as Priority;
    text = cut(text, pm.index, pm[0].length);
  }

  let projectName: string | null = null;
  const prm = text.match(PROJECT_RE);
  if (prm && prm.index !== undefined) {
    projectName = prm[1] ?? prm[2];
    text = cut(text, prm.index, prm[0].length);
  }

  const labelNames: string[] = [];
  text = text.replace(LABEL_RE, (_m, quoted, bare) => {
    labelNames.push(quoted ?? bare);
    return ' ';
  });

  let recurrence: string | null = null;
  const rm = text.match(RECURRENCE_RE);
  if (rm && rm.index !== undefined) {
    recurrence = parseRecurrence(rm[1]);
    text = cut(text, rm.index, rm[0].length);
  }

  let due_date: string | null = null;
  let due_time: string | null = null;
  const results = chrono.parse(text, referenceDate, { forwardDate: true });
  if (results.length > 0) {
    const r = results[0];
    due_date = toISODate(r.start.date());
    if (r.start.isCertain('hour')) {
      const d = r.start.date();
      due_time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
    }
    text = cut(text, r.index, r.text.length);
  }

  // a recurrence with no explicit date starts at its next natural occurrence
  if (recurrence && !due_date) {
    due_date = nextOccurrence(recurrence, null);
  }

  return {
    content: text.replace(/\s+/g, ' ').trim(),
    due_date,
    due_time,
    recurrence,
    priority,
    projectName,
    labelNames,
  };
}
