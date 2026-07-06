# Migration to Supabase PostgreSQL

We will completely migrate the database layer from Firebase Firestore to Supabase PostgreSQL while keeping Firebase Authentication and Cloudinary intact.

## Goal
Replace all Firestore reads, writes, updates, deletes, queries, and listeners with Supabase PostgreSQL, optimize football API caching, migrate existing data without loss, and ensure the UI/UX remains identical.

## User Review Required
> [!IMPORTANT]
> - Data Migration: The migration script will need to read from your existing Firebase environment. Please ensure that the `betverset.json` (Service Account Key) is present or Firebase Admin env vars are set.
> - Please confirm the Supabase credentials you provided are correct and that the database is active and accessible.
> - Firebase Auth will be kept. Supabase will use the Firebase Auth `uid` as the primary key in the `users` table. Are you okay with this?

## Open Questions
- Do you want to run the data migration script locally before deploying, or should I create an API endpoint (e.g. `/api/admin/migrate-to-supabase`) to trigger the data copy in production?
- Are there any other specific football API optimization rules beyond keeping the requests under 7,500/day and relying on scheduled cron jobs?

## Proposed Changes

### 1. Supabase Initialization
- **`lib/supabase.ts`**: Create the Supabase client using `@supabase/supabase-js`.
- **`lib/supabase-admin.ts`**: Create a service-role Supabase client (using the anon/service key) for backend API routes that bypass RLS (similar to `firebase-admin`).

### 2. Firebase Cleanup
- **`lib/firebase.ts`**: Remove Firestore and Storage imports. Keep ONLY Firebase App and Auth.
- **`lib/firebase-admin.ts`**: Remove Firestore and Storage. Keep ONLY `admin.auth()`.
- **`package.json`**: Add `@supabase/supabase-js`.

### 3. Database Schema (PostgreSQL)
We will create the following tables in Supabase (with appropriate columns and JSONB fields for dynamic data):
- `users` (id, phone, role, balance, created_at)
- `bet_slips` (id, user_id, ticket_code, total_odds, stake, possible_win, status, selections, is_manual_preset, created_at, updated_at)
- `fixtures` (id, league_id, home_team_id, away_team_id, status, kickoff_at, data, created_at, updated_at)
- `odds` (id, fixture_id, markets, updated_at)
- `leagues` (id, name, country, logo)
- `deposit_methods` & `withdrawal_methods` (id, name, logo, is_active)
- `deposit_requests` & `withdrawal_requests` (id, user_id, method_id, amount, status, created_at)
- `cashout_requests` (id, user_id, bet_slip_id, amount, status)
- `manual_ticket_matches` (id, league_name, home_team, away_team, kickoff_at)
- `app_settings` (key, value)
- `user_promotion_codes` (id, code, discount)

*Indexes* will be added on: `user_id`, `fixture_id`, `status`, `created_at`, `ticket_code`.

### 4. API Route Rewrites
All endpoints in `app/api/` will be rewritten to replace `db.collection(...)...` with `supabase.from(...)`.
- `app/api/betting/*`
- `app/api/admin/*`
- `app/api/auth/*`
- `app/api/cron/*`
- `app/api/fixtures/*`, `app/api/odds/*`, `app/api/leagues/*`, `app/api/teams/*`

### 5. Football Data Optimization
- The cron jobs in `app/api/cron/` will be updated to upsert data into Supabase `fixtures` and `odds` tables.
- Frontend fetches will strictly call our own Next.js APIs which query Supabase, preventing direct external Football API hits.

### 6. Migration Script
- Create a script `migrate-firestore-to-supabase.ts` that:
  - Connects to Firestore via Admin SDK.
  - Connects to Supabase.
  - Reads all collections and does batch inserts into the Supabase tables, preserving IDs (UUIDs and string IDs).

## Verification Plan

### Automated/Code Verification
- Run TypeScript compiler (`npx tsc`) to ensure no missing Firestore types break the build.
- Run a dry-run of the migration script.

### Manual Verification
- Deploy to Vercel.
- Ask you to sign in (Firebase Auth).
- Check balance, place a bet (Supabase Insert).
- Check the Admin Dashboard to see bet slips and users (Supabase Select).
- Trigger a cron job and verify fixtures update in Supabase without excessive API calls.
