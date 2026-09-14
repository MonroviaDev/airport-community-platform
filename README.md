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

The MARTA schedule result is a first-pass service-envelope screen, not a door-to-door itinerary. Xpress results identify geographic candidates, not confirmed airport trips; route-specific schedule and MARTA-transfer testing is the next modeling stage.

Run the analyses with:

```bash
npm run analyze:marta-schedule
npm run analyze:xpress-access
npm run analyze:combined-transit
npm run analyze:vanpool-opportunities
```

The raw MARTA and Xpress GTFS folders are intentionally ignored because agencies update their feeds. Generated model outputs are committed for reproducibility.

## Web application

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
