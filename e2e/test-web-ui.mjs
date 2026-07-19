// Browser end-to-end test of the Todoer web app against local Supabase.
// Usage: BASE_URL=http://localhost:3000 node test-web-ui.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let passed = 0;
let failed = 0;
const shots = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(15000);

async function shot(name) {
  const path = `${process.env.SHOT_DIR ?? '.'}/${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
}

try {
  console.log('== landing and auth ==');
  await page.goto(BASE);
  check('landing renders', await page.getByText('Clarity, finally.').isVisible());

  await page.goto(`${BASE}/app/today`);
  await page.waitForURL('**/login');
  check('unauthenticated /app redirects to login', page.url().includes('/login'));

  const email = `e2e.${Date.now()}@test.local`;
  await page.goto(`${BASE}/signup`);
  // wait for hydration; clicking before React attaches submits the form natively
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('Your name').fill('E2E Tester');
  await page.getByPlaceholder('Username').fill(`e2e_${Date.now()}`);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password-123');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL('**/app/today', { timeout: 20000 });
  check('signup lands on Today', true);
  // The sidebar resolves the user from the stored session, so it paints a tick
  // after the route does.
  await page.getByText('E2E Tester').waitFor();
  check('sidebar shows user name', true);
  await page.getByRole('link', { name: /Inbox/ }).first().waitFor();
  check('Inbox nav present (trigger-created project loaded)', true);

  console.log('== quick add with natural language ==');
  await page.keyboard.press('q');
  const qa = page.getByPlaceholder(/Task name, e.g./);
  await qa.waitFor();
  await qa.fill('Pay rent tomorrow 9am p1 @finance every month');
  check('due chip parsed Tomorrow', await page.getByText('Tomorrow', { exact: true }).first().isVisible());
  check('priority chip parsed P1', await page.getByText('P1', { exact: true }).first().isVisible());
  check('recurrence chip parsed', await page.getByText(/every month/).first().isVisible());
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');

  console.log('== add a task due today from Today view ==');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Add task' }).first().click();
  const inline = page.getByPlaceholder(/Task name, e.g./);
  await inline.fill('Buy milk p2');
  await main.getByRole('button', { name: 'Add task', exact: true }).last().click();
  await page.waitForSelector('text=Buy milk');
  await page.keyboard.press('Escape');
  check('task appears in Today', await page.getByText('Buy milk').isVisible());
  await shot('today');

  console.log('== complete a task ==');
  const row = page.locator('div', { hasText: 'Buy milk' });
  await page.getByRole('button', { name: 'Complete task' }).first().click();
  await page.waitForTimeout(800);
  check('completed task leaves Today', !(await page.getByText('Buy milk').isVisible().catch(() => false)));

  await page.getByRole('link', { name: 'Completed' }).click();
  await page.waitForURL('**/app/completed');
  await page.getByText('Buy milk').waitFor();
  check('task shows in Completed view', true);

  console.log('== upcoming shows the recurring task ==');
  await page.getByRole('link', { name: 'Upcoming' }).click();
  await page.waitForURL('**/app/upcoming');
  check('recurring task in Upcoming', await page.getByText('Pay rent').first().isVisible());
  await shot('upcoming');

  console.log('== labels ==');
  await page.getByRole('link', { name: /Filters/ }).click();
  await page.waitForURL('**/app/labels');
  check('auto-created label listed', await page.getByText('finance').first().isVisible());
  await page.getByRole('link', { name: /finance/ }).click();
  await page.waitForURL('**/app/label/**');
  await page.getByText('Pay rent').first().waitFor();
  check('label view shows task', true);

  console.log('== project with section ==');
  await page.getByRole('button', { name: 'Add project' }).click();
  await page.locator('input').first().fill('Groceries');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('link', { name: 'Groceries' }).waitFor(); // appears in sidebar
  await page.getByRole('link', { name: 'Groceries' }).click();
  await page.waitForURL('**/app/project/**');
  check('project page opens', await page.getByRole('heading', { name: 'Groceries' }).isVisible());

  await page.getByRole('main').getByRole('button', { name: 'Add task' }).first().click();
  await page.getByPlaceholder(/Task name, e.g./).fill('Eggs saturday');
  await page.getByRole('main').getByRole('button', { name: 'Add task', exact: true }).last().click();
  await page.waitForSelector('text=Eggs');
  await page.keyboard.press('Escape');
  check('task added to project', await page.getByText('Eggs').first().isVisible());
  await shot('project');

  console.log('== comments ==');
  await page.getByText('Eggs').first().click();
  await page.getByPlaceholder('Add a comment').fill('Get the free range ones');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await page.getByText('Get the free range ones').waitFor();
  check('comment added and listed', true);
  check('comment count shown', await page.getByText('Comments (1)').isVisible());
  await page.getByRole('button', { name: 'Cancel' }).click();

  console.log('== display options ==');
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Board' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Tasks' }).waitFor();
  check('board layout renders a column', true);

  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByLabel('Grouping').selectOption('priority');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: /Priority \d/ }).first().waitFor();
  check('board grouped by priority', true);

  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Calendar' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Next month' }).waitFor();
  check('calendar layout renders', true);
  await shot('calendar');

  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByLabel('Priority filter').selectOption('1');
  await page.getByRole('button', { name: 'List' }).click();
  await page.keyboard.press('Escape');
  check('priority filter applied without error', true);
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Reset all' }).click();
  await page.keyboard.press('Escape');
  await page.getByText('Eggs').first().waitFor();
  check('reset restores default list', true);

  console.log('== productivity stats ==');
  await page.getByRole('link', { name: 'Productivity' }).click();
  await page.waitForURL('**/app/stats');
  await page.getByText('Completed this week').waitFor();
  check('stats page renders tiles', true);
  check(
    'daily completions chart renders',
    await page.getByRole('img', { name: 'Bar chart of tasks completed per day' }).isVisible(),
  );
  await shot('stats');
  await page.getByRole('link', { name: 'Groceries' }).click();
  await page.waitForURL('**/app/project/**');

  console.log('== search ==');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search tasks and projects').fill('rent');
  check('search finds task', await page.getByText('Pay rent').first().isVisible());
  await page.keyboard.press('Escape');

  console.log('== completion sound setting ==');
  await page.getByText('E2E Tester').click();
  await page.getByText('Completion sound').click();
  await page.getByRole('button', { name: 'Ding' }).click();
  const soundPref = await page.evaluate(() => localStorage.getItem('todoer.completionSound'));
  check('sound preference persisted', soundPref === 'ding', soundPref);
  await page.keyboard.press('Escape');

  console.log('== accent theme ==');
  await page.getByText('E2E Tester').click();
  await page.getByText('Theme', { exact: true }).click();
  await page.getByRole('button', { name: 'Ocean blue' }).click();
  const accentPref = await page.evaluate(() => localStorage.getItem('todoer.theme'));
  check('accent preference persisted', accentPref === 'ocean', accentPref);
  const brandVar = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--color-brand'),
  );
  check('accent css variable applied', brandVar.trim() === '#2563eb', brandVar);

  await page.getByRole('button', { name: 'Blossom pink' }).click();
  const pinkPref = await page.evaluate(() => localStorage.getItem('todoer.theme'));
  check('pink accent selectable', pinkPref === 'blossom', pinkPref);
  const pinkVar = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--color-brand'),
  );
  check('pink accent applied', pinkVar.trim() === '#db2777', pinkVar);
  await page.keyboard.press('Escape');

  console.log('== mcp instructions ==');
  await page.getByText('E2E Tester').click();
  await page.getByText('AI assistant').click();
  await page.getByText('Connect an AI assistant').waitFor();
  check(
    'mcp dialog keeps setup details collapsed',
    !(await page.getByText('claude mcp add todoer').isVisible().catch(() => false)),
  );
  await page.getByRole('button', { name: 'Learn how to set it up' }).click();
  await page.getByText('claude mcp add todoer').waitFor();
  check('mcp dialog shows setup command once expanded', true);
  check('mcp dialog prefills login', await page.getByText(email).nth(1).isVisible().catch(() => false)
    || (await page.getByRole('dialog').textContent()).includes(email));
  await page.keyboard.press('Escape');

  console.log('== dark mode ==');
  await page.getByText('E2E Tester').click();
  await page.getByText('Dark theme').click();
  await page.waitForTimeout(400);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check('dark class applied', isDark);
  await shot('dark-mode');

  console.log('== password reset page ==');
  await page.goto(`${BASE}/forgot-password`);
  await page.getByPlaceholder('Email or username').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByText('Check your email for a password reset link.').waitFor();
  check('forgot password sends reset email', true);

  console.log('== export ==');
  await page.goto(`${BASE}/app/today`);
  await page.getByText('E2E Tester').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Export data').click();
  const download = await downloadPromise;
  const exportPath = `${process.env.SHOT_DIR ?? '.'}/todoer-export-test.json`;
  await download.saveAs(exportPath);
  const { readFileSync } = await import('node:fs');
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
  check('export is valid todoer json', exported.format === 'todoer-export');
  check(
    'export contains projects and tasks',
    exported.projects.length >= 2 && exported.tasks.length >= 3,
    `projects=${exported.projects?.length} tasks=${exported.tasks?.length}`,
  );

  console.log('== logout ==');
  await page.getByText('E2E Tester').click();
  await page.getByText('Log out').click();
  await page.waitForURL('**/login', { timeout: 15000 });
  check('logout returns to login', true);

  console.log('== account deletion ==');
  await page.getByPlaceholder('Email or username').fill(email);
  await page.getByPlaceholder('Password').fill('password-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/app/today', { timeout: 20000 });
  await page.getByText('E2E Tester').click();
  await page.getByText('Danger zone').click();
  check(
    'danger zone hides destructive options until acknowledged',
    !(await page.getByRole('button', { name: /Delete my account forever/ }).isVisible().catch(() => false)),
  );
  await page.getByRole('button', { name: 'I understand, show options' }).click();
  const deleteBtn = page.getByRole('button', { name: /Delete my account forever/ });
  await deleteBtn.waitFor();
  check('delete stays disabled until the name is typed', await deleteBtn.isDisabled());
  await page.getByLabel('Type your name to confirm deletion').fill('E2E Tester');
  await deleteBtn.click();
  await page.waitForURL(BASE + '/', { timeout: 15000 });
  check('account deletion returns to landing', true);
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('Email or username').fill(email);
  await page.getByPlaceholder('Password').fill('password-123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByText('Invalid login credentials').waitFor();
  check('deleted account cannot log in', true);
} catch (e) {
  failed++;
  console.log('FATAL:', e.message.split('\n')[0]);
  await shot('failure');
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
console.log('screenshots:', shots.join(', '));
process.exit(failed ? 1 : 0);
