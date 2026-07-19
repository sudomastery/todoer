// End-to-end test of the Todoer MCP server against local Supabase.
// Spawns the stdio server as a subprocess and drives it with the MCP client SDK.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node e2e/test-mcp.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createClient } from '@supabase/supabase-js';

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

// -- create a fresh account for the server to log in as --
const stamp = Date.now();
const creds = { email: `mcp.${stamp}@test.local`, password: 'password-123' };
const username = `mcp_${stamp}`;
const setup = createClient(URL, KEY, { auth: { persistSession: false } });
const { error: signupErr } = await setup.auth.signUp({
  email: creds.email,
  password: creds.password,
  options: { data: { full_name: 'MCP Tester', username } },
});
if (signupErr) {
  console.error('signup failed:', signupErr.message);
  process.exit(2);
}

// -- spawn the MCP server, logging in with the username --
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'packages/mcp/src/index.ts'],
  env: {
    ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)),
    TODOER_URL: URL,
    TODOER_ANON_KEY: KEY,
    TODOER_LOGIN: username,
    TODOER_PASSWORD: creds.password,
  },
});
const client = new Client({ name: 'e2e', version: '0.0.1' });
await client.connect(transport);

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // error strings are not JSON
  }
  return { isError: res.isError === true, text, data };
}

try {
  console.log('== tool listing ==');
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const expected of ['add_task', 'list_tasks', 'complete_task', 'add_comment', 'export_data']) {
    check(`tool registered: ${expected}`, names.includes(expected));
  }

  console.log('== projects ==');
  const projects = await call('list_projects');
  check('inbox exists', projects.data.some((p) => p.is_inbox));
  const created = await call('create_project', { name: 'AI Work', color: 'blue' });
  check('project created', created.data.name === 'AI Work' && created.data.color === 'blue');

  console.log('== tasks ==');
  const added = await call('add_task', {
    text: 'Review the pull request tomorrow 3pm p1 @code',
    project: 'AI Work',
  });
  check('quick add parsed content', added.data.content === 'Review the pull request', added.text);
  check('quick add parsed priority', added.data.priority === 1);
  check('quick add parsed due date and time', !!added.data.due_date && added.data.due_time === '15:00:00');
  check('quick add created label', added.data.labels.includes('code'));
  check('task in named project', added.data.project === 'AI Work');
  const taskId = added.data.id;

  const inProject = await call('list_tasks', { project: 'ai work' });
  check('list_tasks filters by project (case-insensitive)',
    inProject.data.length === 1 && inProject.data[0].id === taskId);
  const byLabel = await call('list_tasks', { label: 'code' });
  check('list_tasks filters by label', byLabel.data.some((t) => t.id === taskId));
  const bySearch = await call('list_tasks', { search: 'pull request' });
  check('list_tasks searches text', bySearch.data.some((t) => t.id === taskId));
  const upcoming = await call('list_tasks', { view: 'upcoming' });
  check('tomorrow task is upcoming', upcoming.data.some((t) => t.id === taskId));

  const updated = await call('update_task', { task_id: taskId, priority: 2, description: 'ready for review' });
  check('update_task applies patch',
    updated.data.priority === 2 && updated.data.description === 'ready for review');
  const relabeled = await call('set_task_labels', { task_id: taskId, labels: ['code', 'urgent'] });
  check('set_task_labels replaces labels',
    relabeled.data.labels.length === 2 && relabeled.data.labels.includes('urgent'));

  console.log('== comments ==');
  const comment = await call('add_comment', { task_id: taskId, content: 'Started reviewing this' });
  check('comment added', comment.data.content === 'Started reviewing this');
  const comments = await call('list_comments', { task_id: taskId });
  check('comments listed', comments.data.length === 1 && comments.data[0].id === comment.data.id);

  console.log('== complete + stats ==');
  const done = await call('complete_task', { task_id: taskId });
  check('task completed', done.data.completed === taskId, done.text);
  const completedList = await call('list_completed_tasks', {});
  check('completed list shows task', completedList.data.some((t) => t.id === taskId));
  const stats = await call('productivity_stats');
  check('stats count today\'s completion', stats.data.completed_today >= 1, stats.text);

  console.log('== export ==');
  const exported = await call('export_data');
  check('export is todoer json v2', exported.data.format === 'todoer-export' && exported.data.version === 2);
  check('export includes the comment',
    exported.data.comments.some((c) => c.id === comment.data.id));

  console.log('== errors ==');
  const badProject = await call('add_task', { text: 'x', project: 'Does Not Exist' });
  check('unknown project is a tool error', badProject.isError && badProject.text.includes('No project'));
  const badTask = await call('complete_task', { task_id: '00000000-0000-0000-0000-000000000000' });
  check('unknown task is a tool error', badTask.isError, badTask.text);
  const inboxDelete = await call('delete_project', { project: 'Inbox' });
  check('inbox delete refused', inboxDelete.isError);

  console.log('== cleanup ==');
  const removed = await call('delete_project', { project: 'AI Work' });
  check('project deleted', removed.data.deleted === 'AI Work');
} catch (e) {
  failed++;
  console.log('FATAL:', e.message.split('\n')[0]);
} finally {
  await client.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
