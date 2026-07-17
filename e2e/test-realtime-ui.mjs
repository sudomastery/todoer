// Two browser windows, same account: a task added in window A must appear
// in window B without any reload (realtime -> query invalidation).
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();

const email = `sync.${Date.now()}@test.local`;
const ctxA = await browser.newContext();
const pageA = await ctxA.newPage();
pageA.setDefaultTimeout(20000);

// sign up in window A
await pageA.goto(`${BASE}/signup`);
await pageA.getByPlaceholder('Your name').fill('Sync Tester');
await pageA.getByPlaceholder('Email').fill(email);
await pageA.getByPlaceholder('Password').fill('password-123');
await pageA.getByRole('button', { name: 'Sign up' }).click();
await pageA.waitForURL('**/app/today');

// log in with the same account in an isolated second window
const ctxB = await browser.newContext();
const pageB = await ctxB.newPage();
pageB.setDefaultTimeout(20000);
await pageB.goto(`${BASE}/login`);
await pageB.getByPlaceholder('Email').fill(email);
await pageB.getByPlaceholder('Password').fill('password-123');
await pageB.getByRole('button', { name: 'Log in' }).click();
await pageB.waitForURL('**/app/today');
await pageB.getByRole('link', { name: /Inbox/ }).first().waitFor();
await pageB.waitForTimeout(2500); // let the realtime channel subscribe

// add a task in A due today
await pageA.keyboard.press('q');
const input = pageA.getByPlaceholder(/Task name, e.g./);
await input.waitFor();
await input.fill('Synced across devices today');
await pageA.getByRole('button', { name: 'Add task', exact: true }).click();
await pageA.keyboard.press('Escape');

// it should appear in B without reload
try {
  await pageB.getByText('Synced across devices').waitFor({ timeout: 15000 });
  console.log('ok: task appeared in second window without reload');
  console.log('\n1 passed, 0 failed');
} catch {
  console.log('FAIL: task did not sync to second window');
  console.log('\n0 passed, 1 failed');
  process.exitCode = 1;
}
await browser.close();
