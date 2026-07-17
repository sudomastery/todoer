# End-to-end tests

These suites gate merges into `main` (prod deploys from `main` only after they pass).

## Prerequisites

- Local Supabase running: `npx supabase start` (needs Docker or rootless Podman with
  `DOCKER_HOST` pointing at the podman socket). Note the printed `API_URL` and `ANON_KEY`.
- For the browser suites: the web app running against it
  (`apps/web/.env.local` with the local URL/key, then `npm run dev`),
  and Chromium installed once via `npx playwright install chromium`.

## Suites

```bash
npm run test:logic      # shared package: quick-add parser, recurrence, dates (no services needed)
npm run test:backend    # DB e2e: signup trigger, RLS isolation, CRUD, constraints, realtime
npm run test:web        # Playwright: auth, quick add, views, project, search, dark mode
npm run test:sync       # Playwright: realtime sync between two logged-in windows
```

`test:backend`, `test:web` and `test:sync` read `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
`BASE_URL` from the environment; the npm scripts default them to the standard local values.

Backend and browser suites create throwaway accounts (`*.@test.local`) on every run,
so they can be rerun without cleanup. Run `npx supabase db reset` for a fresh database.
