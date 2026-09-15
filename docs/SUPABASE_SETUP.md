# Supabase setup

Use a separate Supabase project for the Airport Employee Community Platform.
Do not reuse the SurveyOps Air database.

## 1. Create the project

1. Sign in to Supabase and create a new project.
2. A working project name is `airport-community-platform`.
3. Save the database password in a password manager. Do not add it to GitHub.

## 2. Create the database foundation

In the Supabase dashboard, open **SQL Editor**, start a new query, paste the
contents of:

`supabase/migrations/202609150001_transportation_foundation.sql`

Run the query once. It creates:

- `member_profiles`
- `transportation_interests`
- Validation constraints and matching indexes
- Row-level security policies that restrict members to their own records
- No database access for signed-out visitors

## 3. Configure the local app

Copy `.env.example` to `.env.local`, then enter the browser-safe values from
Supabase **Project Settings > API**:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place the database password or `service_role` key in a Vite environment
variable. Vite variables are included in browser code.

Restart `npm run dev` after changing environment variables.

## 4. Current boundary

This commit provides the schema and secure client service. The existing form
continues using local prototype storage until the next sprint adds sign-in and
switches submissions to `saveTransportationInterest()`.
