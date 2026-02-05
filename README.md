# Pool Tracker

A Next.js app for recording 8-ball matches, computing Glicko ratings, and tracking streaks with Supabase auth and storage. Includes player profiles, leaderboards, pending game verification, and web push notifications.

## Features
- Record 1v1 and 2v2 8-ball matches
- Glicko ratings, streaks, and rating history charts
- Leaderboard and player profile pages
- Pending game verification flow (opponent or admin)
- Optional push notifications for verification requests
- Nightly backfill endpoint for ratings

## Tech Stack
- Next.js App Router (React 19)
- Supabase (auth + Postgres)
- Prisma schema for Supabase
- Tailwind CSS
- Framer Motion
- Playwright (config only)

## Routes
- `/` Home: stats, streaks, recent games, pending verification
- `/add` Add a match result
- `/leaderboard` Global ratings
- `/profile/[username]` Player profile and history
- `/admin` Admin verification dashboard

## API Routes
- `POST /api/games/verify` Verify or reject a pending game
- `POST /api/notify` Send a push notification
- `GET /api/cron/backfill` Recompute ratings (secured by cron secret)

## Data Model (Supabase)
Core tables in `public` schema:
- `games` Match records
- `profiles` User profiles + ratings
- `config` Feature flags (ex: `require_verification`)
- `push_subscriptions` Web push subscriptions

## Environment Variables
Create a `.env.local` file with:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=
```

Optional:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (fallback for anon key)

## Development
```
npm install
npm run dev
```
Open `http://localhost:3000`.

## Testing
Playwright is configured, but no tests are included by default.
```
npm run test:e2e
```

## Database Utilities
Seed local data (requires Supabase connection and local tooling):
```
npm run db:seed:local
```

## Notes
- Ratings are only computed from `verified` games.
- Admin verification requires `profiles.role = ADMIN`.
- Push notifications require valid VAPID keys.

## Repository Layout
- `app/` Next.js routes and API handlers
- `components/` UI and feature components
- `lib/` domain logic (glicko, supabase, push, types)
- `prisma/` Supabase Prisma schema
- `public/` service worker + assets
- `scripts/` maintenance scripts
