# Todoer

A full-featured, Todoist-style task manager. Web app on Vercel, Android app built with Expo, data and auth on Supabase. Everything runs on free tiers.

## Features

- Tasks with descriptions, subtasks, priorities (P1-P4), due dates and times
- Natural language quick add: `Pay rent tomorrow 9am #Bills @finance p1 every month`
- Recurring tasks: every day, every weekday, every Monday, every 3 weeks, monthly, yearly
- Projects with 20 colors, favorites, and sections
- Labels with per-label views
- Views: Inbox, Today (with overdue), Upcoming (14-day agenda), Completed
- Search (Ctrl+K on web), keyboard shortcuts (Q to add a task, M to toggle sidebar)
- Realtime sync between web and Android via Supabase Realtime
- Dark mode on both platforms
- Row Level Security: every table is scoped to the signed-in user

## Repository layout

```
apps/web          Next.js 15 web app (deploys to Vercel)
apps/mobile       Expo (React Native) Android app
packages/shared   Shared TypeScript: types, quick-add parser, recurrence engine, Supabase queries
supabase/         SQL migrations (schema, triggers, RLS, realtime)
```

## 1. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Open the SQL Editor, paste the contents of `supabase/migrations/00000000000001_schema.sql`, and run it.
   Alternatively, with the Supabase CLI: `supabase link --project-ref YOUR_REF && supabase db push`.
3. In Project Settings, API, copy the Project URL and the anon public key.
4. In Authentication, URL Configuration, set the Site URL to your web app URL (use `http://localhost:3000` while developing) and add `https://YOUR-DOMAIN/auth/callback` to the redirect list.

New users automatically get a profile and an Inbox project via a database trigger.

## 2. Run the web app locally

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in your Supabase URL and anon key
npm run dev                                     # http://localhost:3000
```

## 3. Deploy the web app to Vercel (free)

1. Push this repository to GitHub.
2. Import it on [vercel.com](https://vercel.com), and set the Root Directory to `apps/web`.
3. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Then update the Supabase Site URL and redirect URLs to your Vercel domain.

## 4. Run the Android app

```bash
cp apps/mobile/.env.example apps/mobile/.env    # fill in the same Supabase values
npm run dev:mobile                              # scan the QR code with the Expo Go app
```

## 5. Build an installable APK (free)

Uses Expo's EAS Build free tier:

```bash
npm install -g eas-cli
cd apps/mobile
eas login                    # free Expo account
```

Edit `apps/mobile/eas.json` and put your Supabase URL and anon key in the `preview` profile `env` block, then:

```bash
eas build --profile preview --platform android
```

When the build finishes you get a download link for an APK you can install directly on any Android phone. For Play Store distribution, use `eas build --platform android` (production profile, builds an AAB) and `eas submit`.

## Testing

Four end-to-end suites live in `e2e/` (see `e2e/README.md` for setup):

```bash
npm run test:logic      # parser/recurrence/date logic, no services needed
npm run test:backend    # local Supabase: trigger, RLS, CRUD, constraints, realtime
npm run test:web        # Playwright browser flow through the whole web app
npm run test:sync       # realtime sync between two logged-in browser windows
npm run test:e2e        # all of the above
```

Branch flow: feature branches merge into `dev`; `dev` merges into `main` only after
the suites pass, and production deploys from `main`.

## Development notes

- `npm run build` builds the web app; `npm run typecheck` typechecks every workspace.
- The quick-add parser lives in `packages/shared/src/quickadd.ts`, recurrence rules in `packages/shared/src/recurrence.ts`. Both are shared by web and mobile, so behavior always matches.
- All data access goes through `packages/shared/src/queries.ts`; RLS in Postgres is the security boundary, so the anon key is safe to ship in clients.
