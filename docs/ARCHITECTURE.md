# Todoer: Tech Stack and Decisions

This document explains what Todoer is built with, why each piece was chosen, and the trade-offs accepted along the way. The guiding constraints were: production-grade quality, a web app and an Android app that stay in sync, and $0/month hosting.

## The big picture

```
+---------------------+        +----------------------+
|  Web (Next.js 15)   |        |  Android (Expo RN)   |
|  hosted on Vercel   |        |  APK via EAS Build   |
+----------+----------+        +----------+-----------+
           |                              |
           |   @todoer/shared (types, parser,
           |   recurrence, data layer)    |
           +---------------+--------------+
                           |
                +----------v-----------+
                |       Supabase       |
                |  Postgres + RLS      |
                |  Auth (email/pass)   |
                |  Realtime (websocket)|
                +----------------------+
```

Both clients talk directly to Supabase. There is no application server of our own: Postgres row-level security is the backend authorization layer, and Supabase Auth issues the JWTs that RLS policies check.

## Decisions and why

### 1. Supabase as the entire backend (no custom API server)

The usual preferred stack here is Python + FastAPI + SQLAlchemy. It was deliberately not used, and this was confirmed as a project decision up front.

- A FastAPI service needs somewhere to run. Vercel's free tier is built for Next.js, not long-running Python servers; the free Python hosts (Render, Fly.io) sleep on idle, which means multi-second cold starts for every first request, which is unacceptable for a task app you open twenty times a day.
- Supabase's free tier bundles the four things this app needs: Postgres, authentication, a realtime websocket channel, and an auto-generated REST layer (PostgREST). Building those on FastAPI means writing and operating auth, token refresh, websockets, and migrations ourselves for no product gain.
- The trade-off: business logic that would live in an API layer lives in the clients (shared package) and in the database (triggers, constraints, RLS). That is fine at this scale because both clients share one TypeScript code path. If server-side logic becomes necessary later (webhooks, integrations, scheduled digests), Supabase Edge Functions or Next.js route handlers cover it without new infrastructure.

**Security model**: the Supabase anon key ships in both clients by design and is not a secret. Every table has row-level security with `user_id = auth.uid()` policies, so a client can only ever read or write its own rows, no matter what query it sends. The database is the trust boundary.

### 2. Next.js 15 (App Router) on Vercel for the web app

- Vercel free tier deploys Next.js with zero configuration, and the middleware runtime handles Supabase session refresh on every request.
- Server components handle the auth gate (redirect to /login), while everything inside the app is a client component. This is intentional: a task manager is a highly interactive, always-mutating UI, and client-side data with optimistic updates gives the instant feel Todoist has. Server-rendering task lists would add complexity for no perceived speed win after first paint.
- React Query (TanStack Query) manages all server state: caching, optimistic completion of tasks with rollback on error, and cache invalidation driven by realtime events. No Redux or other client state store is needed; the only client state is UI state (dialogs, sidebar).

### 3. Expo (React Native) for Android, in the same monorepo

Considered: PWA (least work, but weaker notifications and a non-native feel), native Kotlin (best feel, but a second codebase that would immediately drift from the web app's behavior).

Expo won because the hard parts of this app are not UI, they are logic: the quick-add parser, the recurrence engine, and the data layer. With React Native those are literally the same files the web app imports (`@todoer/shared`), so "Pay rent tomorrow 9am every month" parses identically on both platforms, forever. EAS Build's free tier produces installable APKs without a local Android SDK, and Expo Router gives file-based navigation similar to Next.js.

### 4. A shared package instead of copy-pasted logic

`packages/shared` holds everything both clients need:

- `types.ts`: one set of TypeScript interfaces matching the DB schema.
- `quickadd.ts`: the natural-language parser (chrono-node for dates, regexes for `p1`-`p4`, `#project`, `@label`, recurrence phrases).
- `recurrence.ts`: recurrence rules and the next-occurrence engine.
- `queries.ts`: every database read/write, written against the `SupabaseClient` interface so web (SSR client) and mobile (AsyncStorage client) inject their own.

It ships as raw TypeScript source (no build step): Next.js compiles it via `transpilePackages`, Metro compiles it natively. This keeps the monorepo free of watch/build orchestration.

### 5. npm workspaces, not pnpm/turborepo

The machine had npm only, and two apps plus one package do not need a task graph. Workspaces give hoisted installs and `@todoer/shared` symlinking out of the box. If the repo grows, Turborepo can be added without restructuring.

### 6. Recurrence stored as compact strings, not RRULE

Rules are stored like `daily`, `weekdays`, `weekly:1`, `monthly:15`, `every:3:days`. Full RFC 5545 RRULE was rejected: it needs a heavyweight library on both clients, and Todoist-style tasks only use a handful of shapes. The compact format is human-readable in the DB, trivially parsed, and covers every phrase the quick-add UI accepts. Completing a recurring task never completes it; it rolls `due_date` forward from max(due, today), so an overdue "every day" task reschedules to tomorrow instead of a date in the past.

### 7. Realtime sync via Postgres change streams

Supabase Realtime broadcasts Postgres changes over a websocket. Clients subscribe to their tables and simply invalidate the React Query cache on any event, then refetch. This "invalidate, don't patch" strategy trades a little bandwidth for a lot of correctness: there is exactly one code path that shapes data (the fetch queries), so realtime can never drift from a fresh load. RLS also filters the change stream, so users only receive events for their own rows.

### 8. Data model choices

- **Inbox is a project** with an `is_inbox` flag and a partial unique index (one per user), created by a `handle_new_user` trigger on signup. This means "move to Inbox" and task queries need no special cases.
- **Subtasks are self-referencing tasks** (`parent_id`), one level deep in the UI. Completing a parent completes its subtasks in a single SQL statement.
- **Priorities are 1-4** (1 highest) with P1/P2/P3 colored like Todoist's flags.
- **Labels are many-to-many** through `task_labels`, which carries `user_id` so RLS stays a single-table check.
- **Due date and time are separate columns** (`date` + `time`): most tasks are day-scoped, and separating them avoids timezone bugs where "July 18" silently becomes "July 17, 23:00" in another timezone. All-day dates are compared as ISO strings in the user's local timezone.

### 9. Styling: Tailwind CSS v4 with a Todoist-inspired theme

Design tokens (brand red `#dc4c3e`, priority colors, the 20-color project palette) live in the shared package and in CSS variables, with light/dark handled by `next-themes` on web and `useColorScheme` on Android. Radix UI provides accessible dialog/popover/dropdown primitives on web; mobile uses native React Native components so the app feels like Android, not an embedded web page.

## Testing strategy

Three layers, all runnable locally against a Dockerized Supabase (`npx supabase start`):

1. **Logic tests** (`e2e/test-shared.mjs`): the quick-add parser, recurrence engine, and date helpers, pure functions, no services.
2. **Backend tests** (`e2e/test-backend.mjs`): real signups against local Supabase verifying the signup trigger, RLS isolation between users (including forged inserts and cross-user updates), CRUD through the shared data layer, check constraints, recurring-task rollover, cascade deletes, and realtime delivery.
3. **Browser tests** (`e2e/test-web-ui.mjs`, `e2e/test-realtime-ui.mjs`): Playwright drives the actual web app: signup, natural-language quick add, completing tasks, projects, labels, search, dark mode, logout, and two-window realtime sync without reload.

This local stack is identical to production (same Postgres image, same auth and realtime services), so a green run is a faithful pre-deploy gate. Notably, the backend suite caught a real bug before first deploy: RLS policies without table-level `GRANT`s, which local testing surfaced as `permission denied`.

## Free-tier limits worth knowing

- **Supabase free**: 500 MB database, 50k monthly active users, realtime included. Projects pause after 1 week of inactivity and resume from the dashboard; fine for personal use.
- **Vercel free (Hobby)**: 100 GB bandwidth/month, more than enough.
- **EAS Build free**: limited builds per month on the shared queue; each APK build takes a few minutes.

## What lives where

| Concern | Location |
|---|---|
| Schema, RLS, triggers | `supabase/migrations/` |
| Types, parser, recurrence, queries | `packages/shared/src/` |
| Web UI, auth pages, middleware | `apps/web/src/` |
| Android screens and components | `apps/mobile/app/`, `apps/mobile/components/` |
| Deployment steps | `README.md` |
