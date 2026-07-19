// End-to-end checks for @todoer/shared logic (parser, recurrence, dates).
// Run with: npx tsx test-shared.mjs  (from repo root, tsx resolves TS source)
import { parseQuickAdd } from '../packages/shared/src/quickadd.ts';
import {
  parseRecurrence,
  nextOccurrence,
  describeRecurrence,
} from '../packages/shared/src/recurrence.ts';
import {
  DEFAULT_NOTIFICATION_PREFS,
  digestBody,
  dueReminders,
  parseNotificationPrefs,
} from '../packages/shared/src/notifications.ts';
import {
  todayISO,
  formatDueDate,
  formatDue,
  upcomingDays,
} from '../packages/shared/src/dates.ts';

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const ref = new Date('2026-07-17T10:00:00'); // Friday

console.log('== parseQuickAdd ==');
const p1 = parseQuickAdd('Pay rent tomorrow 9am #Bills @finance p1 every month', ref);
check('content cleaned', p1.content === 'Pay rent', JSON.stringify(p1));
check('due tomorrow', p1.due_date === '2026-07-18', p1.due_date);
check('time 9am', p1.due_time === '09:00:00', p1.due_time);
check('priority 1', p1.priority === 1);
check('project Bills', p1.projectName === 'Bills');
check('label finance', p1.labelNames.length === 1 && p1.labelNames[0] === 'finance');
check('recurrence monthly', p1.recurrence?.startsWith('monthly:'), p1.recurrence);

const p2 = parseQuickAdd('Buy milk', ref);
check('plain task', p2.content === 'Buy milk' && !p2.due_date && p2.priority === 4);

const p3 = parseQuickAdd('Standup every weekday 9:30am', ref);
check('weekdays rule', p3.recurrence === 'weekdays', p3.recurrence);
check('weekday time', p3.due_time === '09:30:00', p3.due_time);
check('weekday content', p3.content === 'Standup', p3.content);

const p4 = parseQuickAdd('Review PR next monday p2 @work @"code review"', ref);
check('next monday', p4.due_date === '2026-07-20', p4.due_date);
check('p2', p4.priority === 2);
check('two labels incl quoted', p4.labelNames.join('|') === 'work|code review', JSON.stringify(p4.labelNames));

const p5 = parseQuickAdd('Water plants every 3 days', ref);
check('interval rule', p5.recurrence === 'every:3:days', p5.recurrence);
check('interval gets a start date', !!p5.due_date, p5.due_date);

const p6 = parseQuickAdd('Call mom jul 25 5pm', ref);
check('explicit date', p6.due_date === '2026-07-25', p6.due_date);
check('explicit time', p6.due_time === '17:00:00', p6.due_time);

const p7 = parseQuickAdd('Ship v2 #"Side Project" !!3', ref);
check('quoted project', p7.projectName === 'Side Project', p7.projectName);
check('!!3 priority', p7.priority === 3);

console.log('== parseRecurrence ==');
check('every day', parseRecurrence('every day') === 'daily');
check('every monday', parseRecurrence('every monday') === 'weekly:1');
check('every other week', parseRecurrence('every other week') === 'every:2:weeks');
check('monthly with due', parseRecurrence('monthly', '2026-07-15') === 'monthly:15');
check('yearly', parseRecurrence('every year') === 'yearly');
check('not a rule', parseRecurrence('sometimes') === null);

console.log('== nextOccurrence ==');
// note: these use the real current date since completion advances from max(due, today)
const today = todayISO();
check('daily overdue rolls to tomorrow', nextOccurrence('daily', '2020-01-01') > today);
check('daily future advances by 1', nextOccurrence('daily', '2030-01-01') === '2030-01-02');
check('weekly lands on target weekday', new Date(nextOccurrence('weekly:1', '2030-01-01') + 'T00:00').getDay() === 1);
check('weekdays skips weekend', (() => {
  const d = new Date(nextOccurrence('weekdays', '2030-01-04') + 'T00:00'); // sat
  return d.getDay() >= 1 && d.getDay() <= 5;
})());
check('monthly clamps short months', nextOccurrence('monthly:31', '2030-01-31') === '2030-02-28');
check('every:2:weeks', nextOccurrence('every:2:weeks', '2030-01-01') === '2030-01-15');
check('yearly', nextOccurrence('yearly', '2030-03-10') === '2031-03-10');

console.log('== describeRecurrence ==');
check('describe weekly', describeRecurrence('weekly:1') === 'every Monday', describeRecurrence('weekly:1'));
check('describe monthly', describeRecurrence('monthly:15') === 'every month on the 15th', describeRecurrence('monthly:15'));
check('describe interval', describeRecurrence('every:3:days') === 'every 3 days');

console.log('== dates ==');
check('formatDueDate today', formatDueDate(today) === 'Today');
check('formatDue with time', formatDue(today, '17:30:00') === 'Today 5:30 PM', formatDue(today, '17:30:00'));
check('upcomingDays starts today', upcomingDays(14)[0] === today && upcomingDays(14).length === 14);

console.log('== notifications ==');
{
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, enabled: true, leadMinutes: 10 };
  const now = new Date('2026-07-17T10:00:00');
  const task = (over) => ({
    id: 'a',
    content: 'Call the vet',
    is_completed: false,
    due_date: null,
    due_time: null,
    ...over,
  });

  check('defaults are off until the user opts in', DEFAULT_NOTIFICATION_PREFS.enabled === false);
  check('bad json falls back to defaults', parseNotificationPrefs('{oops').enabled === false);
  check(
    'stored prefs merge over defaults',
    parseNotificationPrefs('{"enabled":true}').digestHour === DEFAULT_NOTIFICATION_PREFS.digestHour,
  );
  check(
    'reminder fires lead minutes early',
    dueReminders([task({ due_date: '2026-07-17', due_time: '14:00:00' })], prefs, now)[0].at.getHours() === 13,
  );
  check(
    'all-day tasks are left to the digest',
    dueReminders([task({ due_date: '2026-07-17' })], prefs, now).length === 0,
  );
  check(
    'past reminders are skipped',
    dueReminders([task({ due_date: '2026-07-17', due_time: '09:00:00' })], prefs, now).length === 0,
  );
  check(
    'completed tasks are skipped',
    dueReminders([task({ due_date: '2026-07-17', due_time: '14:00:00', is_completed: true })], prefs, now).length === 0,
  );
  check(
    'nothing is scheduled while reminders are off',
    dueReminders([task({ due_date: '2026-07-17', due_time: '14:00:00' })], DEFAULT_NOTIFICATION_PREFS, now).length === 0,
  );
  check(
    'digest counts overdue and today',
    digestBody(
      [task({ due_date: '2026-07-16' }), task({ id: 'b', content: 'Pay rent', due_date: '2026-07-17' })],
      '2026-07-17',
    ).startsWith('2 tasks due today'),
  );
  check('digest is null when nothing is due', digestBody([task({ due_date: '2026-07-20' })], '2026-07-17') === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
