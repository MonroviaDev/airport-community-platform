# Airport Employee Community Platform

An independent community and workforce-transportation platform for airport employees. The current modeling work uses a 6,521-member synthetic sample drawn from a 65,211-worker ATL-area baseline.

## Transportation modeling

- `scripts/generate-synthetic-population.js` builds synthetic schedules and airport-area destinations.
- `scripts/analyze-marta-accessibility.js` measures straight-line proximity to the 38 MARTA rail stations.
- `scripts/analyze-marta-schedule-viability.js` screens shift compatibility against current Airport Station service, including weekday/weekend differences.
- `scripts/analyze-xpress-accessibility.js` extracts active Xpress park-and-ride nodes and identifies areas where Xpress could extend transit access beyond MARTA's rail catchment.
- `scripts/analyze-combined-transit-viability.js` joins route-specific MARTA rail journeys, rail transfers, Xpress park-and-ride service, Xpress-to-MARTA transfers, work schedules and airport final-mile allowances.
- `data/gco-vanpool-integration-v1.json` defines a privacy-safe referral and opt-in integration path for Georgia Commute Options vanpools.
- `scripts/analyze-vanpool-opportunities.js` groups unresolved transit demand into privacy-safe geographic and schedule opportunity clusters for opt-in recruitment.

The combined model tests both sides of the work trip, including route-specific MARTA service, Xpress park-and-ride schedules, transfers and airport final-mile allowances. It is a planning model rather than a live door-to-door trip planner.

Run the analyses with:

```bash
npm run analyze:marta-schedule
npm run analyze:xpress-access
npm run analyze:combined-transit
npm run analyze:vanpool-opportunities
```

The raw MARTA and Xpress GTFS folders are intentionally ignored because agencies update their feeds. Generated model outputs are committed for reproducibility.

## Web application

The Transportation module includes a model-backed **Plan My Commute** prototype at `/plan-my-commute`. It can:

- Load 20 reusable synthetic test personas spanning regions, shifts and airport work areas.
- Match a custom modeled ZIP, airport destination, shift and workday pattern.
- Rank MARTA, Xpress + MARTA and carpool/vanpool options.
- Rank up to 18 compatible modeled shared commutes across all 6,521 synthetic members.
- Convert a real starting point into an anonymous origin zone for proximity and pickup-detour scoring.
- Display modeled inbound and return trips and explain transit schedule gaps.
- Connect eligible ZIP/shift combinations to privacy-safe vanpool opportunity clusters.
- Carry commute details into a shared-transportation interest flow for riders and potential drivers.

Synthetic scenarios are isolated in a labeled Demo Mode and cannot be saved to
the live member-interest table. For signed-in members, the app saves the
commute details they entered while using the synthetic population only to
model and rank recommendations.

The planner uses synthetic commute records for modeling. Signed-in member
profiles and transportation-interest responses are stored privately in
Supabase without exact home addresses. Live schedules and geocoded addresses
remain future integrations.

All modeled match names and roles are generated test data. They do not
represent real employees, registered accounts or available rides. The app
labels both the list and profile views accordingly.

Private origin matching uses a Vercel serverless function and the U.S. Census
Geocoder. The app rounds returned coordinates to an approximately 0.7-mile
zone, discards the submitted address, and stores only the rounded zone when a
signed-in member joins the transportation-interest list. Synthetic members use
stable generated origin points around public ZIP-code centroids.

## Vercel deployment

The root `vercel.json` rewrites direct browser requests to the Vite single-page
application. In Vercel, set these environment variables for Production,
Preview and Development:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

After the first deployment, add the production Vercel URL to Supabase Auth
redirect URLs before testing passwordless sign-in on the hosted app.

## Supabase foundation

The repository includes passwordless email sign-in plus secure persistence for
member profiles and transportation interests. Row-level security restricts
members to their own records.

See [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) for the separate-project
setup, migration and browser-safe environment variables.
