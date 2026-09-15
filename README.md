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

- Load representative synthetic early, day, evening and overnight employee scenarios.
- Match a custom modeled ZIP, airport destination, shift and workday pattern.
- Rank MARTA, Xpress + MARTA and carpool/vanpool options.
- Display modeled inbound and return trips and explain transit schedule gaps.
- Connect eligible ZIP/shift combinations to privacy-safe vanpool opportunity clusters.
- Carry commute details into a shared-transportation interest flow for riders and potential drivers.

The planner uses synthetic records only. Prototype interest responses are stored locally in the browser without names, contact details or exact addresses. Live schedules, geocoded addresses, secure accounts and persistent member opt-ins remain future integrations.

## Supabase foundation

The repository includes a secure database foundation for member profiles and
transportation interests. It is not connected to the prototype form yet; that
connection will follow the account and sign-in work.

See [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) for the separate-project
setup, migration and browser-safe environment variables.
