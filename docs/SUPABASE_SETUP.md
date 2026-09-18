# Supabase setup

Use a separate Supabase project for the Airport Employee Community Platform.
Do not reuse the SurveyOps Air database.

## 1. Create the project

1. Sign in to Supabase and create a new project.
2. A working project name is `airport-community-platform`.
3. Save the database password in a password manager. Do not add it to GitHub.

## 2. Create the database foundation

In the Supabase dashboard, open **SQL Editor** and run each file in
`supabase/migrations` once, in filename order. Start with:

`supabase/migrations/202609150001_transportation_foundation.sql`

Run the query once. It creates:

- `member_profiles`
- `transportation_interests`
- Validation constraints and matching indexes
- Row-level security policies that restrict members to their own records
- No database access for signed-out visitors

Then run `202609150002_member_commute_preferences.sql` to add the onboarding
preferences stored with each member's private profile.

Run `202609150003_member_name_fields.sql` to store first name and last initial
separately while generating a privacy-safe public display name.

Run `202609160004_private_origin_zones.sql` to add the rounded origin-zone
fields used for anonymous proximity matching. The migration does not add an
address column; raw street addresses are never stored in Supabase.

Run `202609180005_station_last_mile_requests.sql` to add the secure **Skip the
Bus** request table. It stores a member's public MARTA meeting station,
station-arrival window, workdays and shared-ride preferences together with the
same rounded home zone. Row-level security limits each member to their own
request, and the table has no street-address field.

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

## 4. Private origin matching

The production app uses `/api/street-suggestions` to search an app-owned index
of official Census/TIGER street names after the member enters a ZIP code. Only
the best eight suggestions are returned to the browser; no Google or commercial
address service is used.

After selection, the app sends the house number, street name and ZIP to the
same-origin Vercel function at `/api/geocode-origin`. That function uses the
structured U.S. Census Geocoder endpoint, rounds the result to two decimal
places (approximately a 0.7-mile zone around Atlanta), and returns only the
rounded zone. The original address is not written to the application database,
browser session storage or any member-facing profile.

Signed-in transportation interests save only the rounded latitude, rounded
longitude, zone label and stated precision. Existing row-level security keeps
those values private to the member. Other users see commute compatibility and
approximate zone distance, never the actual address.

## 5. Skip the Bus requests

The `/skip-the-bus` flow combines MARTA with a shared last mile home. A signed-in
member chooses an exit station, expected station-arrival time, arrival
flexibility, workdays and one of three modes: coworker ride, split rideshare or
either. Coworker riders can say whether they need a ride, can drive from the
station, or can do either.

This first phase saves private matching requests only. It does not contact a
coworker, order a rideshare or confirm a ride. Station matching, route maps and
mutual-acceptance chat are separate follow-up phases.

## 6. Anonymous road-route previews

Opening a modeled match loads an interactive MapLibre map. The map displays
rounded driver and pickup areas rather than house pins. The same-origin
`/api/route-detour` function rounds submitted points again before comparing a
normal airport route with a route through the pickup zone. The returned road
route is cached in that browser for seven days; it is not written to Supabase.

No additional migration or environment variable is required for the demo.
OpenFreeMap supplies the default key-free map style, and the public OSRM demo
router supplies non-traffic route geometry. Both can be replaced later without
changing the stored member-origin data.
