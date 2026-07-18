// End-to-end backend test against local Supabase.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx test-backend.mjs
import { createClient } from '@supabase/supabase-js';
import {
  fetchProjects,
  createProject,
  createSection,
  fetchSections,
  createTask,
  fetchActiveTasks,
  fetchCompletedTasks,
  completeTask,
  uncompleteTask,
  updateTask,
  deleteTask,
  ensureLabels,
  fetchLabels,
  setTaskLabels,
  deleteProject,
} from '../packages/shared/src/queries.ts';
import { parseQuickAdd } from '../packages/shared/src/quickadd.ts';
import { todayISO } from '../packages/shared/src/dates.ts';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(2);
}

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

function newDb() {
  return createClient(URL, KEY, { auth: { persistSession: false } });
}

const stamp = Date.now();
const alice = { email: `alice.${stamp}@test.local`, password: 'password-123' };
const bob = { email: `bob.${stamp}@test.local`, password: 'password-123' };

async function signup(db, creds, name, username) {
  const { data, error } = await db.auth.signUp({
    email: creds.email,
    password: creds.password,
    options: { data: { full_name: name, username } },
  });
  if (error) throw new Error(`signup ${creds.email}: ${error.message}`);
  if (!data.session) throw new Error('no session; disable email confirmation locally');
  return data.user;
}

const dbA = newDb();
const dbB = newDb();

console.log('== auth + signup trigger ==');
const userA = await signup(dbA, alice, 'Alice', `alice_${stamp}`);
await signup(dbB, bob, 'Bob', `bob_${stamp}`);
check('both users signed up with sessions', true);

const projectsA = await fetchProjects(dbA);
check('trigger created exactly one Inbox', projectsA.filter((p) => p.is_inbox).length === 1,
  JSON.stringify(projectsA));
const inboxA = projectsA.find((p) => p.is_inbox);

const { data: profileA } = await dbA.from('profiles').select('*').single();
check('profile created with name', profileA?.full_name === 'Alice', JSON.stringify(profileA));
check('profile stored username', profileA?.username === `alice_${stamp}`, JSON.stringify(profileA));

console.log('== username login helpers ==');
const anonDb = newDb();
const { data: availTaken } = await anonDb.rpc('username_available', { p_username: `ALICE_${stamp}` });
check('username_available: taken (case-insensitive)', availTaken === false);
const { data: availFree } = await anonDb.rpc('username_available', { p_username: `nobody_${stamp}` });
check('username_available: free', availFree === true);
const { data: resolvedEmail } = await anonDb.rpc('email_for_username', { p_username: `Alice_${stamp}` });
check('email_for_username resolves as anon', resolvedEmail === alice.email, JSON.stringify(resolvedEmail));
const { data: resolvedNone } = await anonDb.rpc('email_for_username', { p_username: `nobody_${stamp}` });
check('email_for_username: unknown -> null', resolvedNone === null);
const dupDb = newDb();
const { error: dupErr } = await dupDb.auth.signUp({
  email: `dup.${stamp}@test.local`,
  password: 'password-123',
  options: { data: { full_name: 'Dup', username: `alice_${stamp}` } },
});
check('duplicate username rejected at signup', dupErr !== null, dupErr?.message);
const { error: badErr } = await dupDb.auth.signUp({
  email: `bad.${stamp}@test.local`,
  password: 'password-123',
  options: { data: { full_name: 'Bad', username: 'no spaces!' } },
});
check('invalid username format rejected', badErr !== null, badErr?.message);

console.log('== projects and sections ==');
const work = await createProject(dbA, { name: 'Work', color: 'blue', is_favorite: true });
check('project created', work.name === 'Work' && work.color === 'blue' && work.is_favorite);
const sec = await createSection(dbA, { project_id: work.id, name: 'This week' });
check('section created', sec.project_id === work.id);

console.log('== quick add parse -> create ==');
const parsed = parseQuickAdd('Ship report tomorrow 3pm p1 @urgent every week');
const labels = await ensureLabels(dbA, parsed.labelNames);
const recurring = await createTask(dbA, {
  content: parsed.content,
  project_id: work.id,
  section_id: sec.id,
  priority: parsed.priority,
  due_date: parsed.due_date,
  due_time: parsed.due_time,
  recurrence: parsed.recurrence,
  label_ids: labels.map((l) => l.id),
});
check('recurring task created', recurring.content === 'Ship report' && recurring.priority === 1
  && recurring.recurrence?.startsWith('weekly:'), JSON.stringify(recurring));

const allLabels = await fetchLabels(dbA);
check('label auto-created once', allLabels.filter((l) => l.name === 'urgent').length === 1);
const withLabels = (await fetchActiveTasks(dbA)).find((t) => t.id === recurring.id);
check('task fetched with label ids', withLabels?.label_ids.length === 1);

console.log('== subtasks + complete cascade ==');
const parent = await createTask(dbA, { content: 'Parent', project_id: inboxA.id, due_date: todayISO() });
const child = await createTask(dbA, { content: 'Child', project_id: inboxA.id, parent_id: parent.id });
await completeTask(dbA, parent);
let active = await fetchActiveTasks(dbA);
check('completing parent removes both from active',
  !active.some((t) => t.id === parent.id || t.id === child.id));
const completed = await fetchCompletedTasks(dbA);
check('both in completed with timestamp',
  completed.filter((t) => [parent.id, child.id].includes(t.id) && t.completed_at).length === 2);
await uncompleteTask(dbA, parent.id);
active = await fetchActiveTasks(dbA);
check('uncomplete restores parent', active.some((t) => t.id === parent.id));

console.log('== recurring completion rolls forward ==');
const dueBefore = recurring.due_date;
await completeTask(dbA, recurring);
active = await fetchActiveTasks(dbA);
const rolled = active.find((t) => t.id === recurring.id);
check('recurring task still active', !!rolled);
check('due date advanced', rolled && rolled.due_date > dueBefore, `${dueBefore} -> ${rolled?.due_date}`);

console.log('== updates ==');
await updateTask(dbA, parent.id, { content: 'Parent v2', priority: 2, description: 'notes' });
const updated = (await fetchActiveTasks(dbA)).find((t) => t.id === parent.id);
check('update persisted', updated?.content === 'Parent v2' && updated?.priority === 2);
check('updated_at trigger fired', updated && updated.updated_at > updated.created_at);
await setTaskLabels(dbA, parent, labels.map((l) => l.id));
const relabeled = (await fetchActiveTasks(dbA)).find((t) => t.id === parent.id);
check('labels set', relabeled?.label_ids.length === 1);

console.log('== RLS isolation ==');
const bobTasks = await fetchActiveTasks(dbB);
check('bob sees none of alice tasks', bobTasks.length === 0, JSON.stringify(bobTasks));
const bobProjects = await fetchProjects(dbB);
check('bob sees only his inbox', bobProjects.length === 1 && bobProjects[0].is_inbox);
const { data: stolen } = await dbB.from('tasks').select('*').eq('id', parent.id);
check('direct select of alice task returns nothing', (stolen ?? []).length === 0);
const { error: updErr, data: updData } = await dbB
  .from('tasks').update({ content: 'hacked' }).eq('id', parent.id).select();
check('cross-user update affects zero rows', (updData ?? []).length === 0, updErr?.message ?? '');
const { data: insData, error: insErr } = await dbB
  .from('tasks')
  .insert({ content: 'forged', project_id: inboxA.id, user_id: userA.id })
  .select();
check('cannot insert rows as another user', !insData?.length && !!insErr, insErr?.message);

console.log('== constraints ==');
const { error: badPrio } = await dbA.from('tasks')
  .insert({ content: 'x', project_id: inboxA.id, user_id: userA.id, priority: 9 });
check('priority check constraint', !!badPrio, badPrio?.message);
const { error: emptyName } = await dbA.from('projects')
  .insert({ name: '', user_id: userA.id });
check('empty project name rejected', !!emptyName);
const { error: dupInbox } = await dbA.from('projects')
  .insert({ name: 'Inbox 2', user_id: userA.id, is_inbox: true });
check('second inbox rejected by unique index', !!dupInbox);

console.log('== realtime ==');
const gotEvent = new Promise((resolve) => {
  const ch = dbA
    .channel('e2e-test')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
      if (payload.new?.content === 'realtime ping') {
        resolve(payload.new.content);
        dbA.removeChannel(ch);
      }
    })
    // wait for the postgres_changes registration, not just the websocket join,
    // otherwise the insert can race the listener setup
    .on('system', {}, async (msg) => {
      if (msg.status === 'ok' && msg.extension === 'postgres_changes') {
        await createTask(dbA, { content: 'realtime ping', project_id: inboxA.id });
      }
    })
    .subscribe();
  setTimeout(() => resolve(null), 8000);
});
const eventContent = await gotEvent;
check('realtime INSERT event received', eventContent === 'realtime ping', String(eventContent));

console.log('== delete ==');
await deleteTask(dbA, parent.id);
active = await fetchActiveTasks(dbA);
check('delete cascades to subtask', !active.some((t) => t.id === parent.id || t.id === child.id));
await deleteProject(dbA, work.id);
check('project delete removes its tasks',
  !(await fetchActiveTasks(dbA)).some((t) => t.project_id === work.id));
const { data: inboxStillThere } = await dbA.from('projects').select('*').eq('is_inbox', true);
await deleteProject(dbA, inboxA.id); // guarded by .eq('is_inbox', false)
check('inbox cannot be deleted via data layer',
  (await fetchProjects(dbA)).some((p) => p.is_inbox) && inboxStillThere.length === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
