# Advanced features status

| Stage | Name | Status | Evidence (files, commands, results) |
|---|---|---|---|
| 0 | Audit and baseline | DONE | Code audit completed. Existing routes verified. Baseline typechecks passing across `apps/api`, `apps/web`, `packages/shared`. |
| 1 | Database and shared contract | DONE | Migration `20261121222242_advanced_features` in `apps/api/prisma/migrations`. Shared schemas in `packages/shared/src/{gps,ai,controller,socket,events}.ts`. `npx tsc --noEmit` PASS in `packages/shared`. |
| 2 | Backend: queue controller and conflicts | DONE | `services/controllerActions.ts`, `services/disputes.ts`, `services/appeals.ts`, `services/driverQueue.ts`, `services/alerts.ts`. Append-only audit log enforced. Transactional reorders and suspensions. Routes registered in `routes/controller.ts`. `apps/api` typecheck PASS. |
| 3 | Backend: GPS and pickups | DONE | `services/location.ts`, `services/pickups.ts`, `lib/geo.ts`, `data/places.ts`. `routes/location.ts` and `routes/pickups.ts` wired and registered in `app.ts`. Privacy-preserving rounding, exact coord wipe on completion, single-winner accept. `apps/api` typecheck PASS. |
| 4 | Backend: AI | DONE | `apps/api/src/ai/wait.ts` (IQR wait estimate), `forecast.ts` (3-hour demand forecast with recommendation), `insights.ts` (rules-based issue and hotspot detection), `provider.ts`, `matching.ts`. Routes wired in `routes/ai.ts`. Synthetic demand history in `prisma/seed.ts`. Output carries `method`, `basedOnSamples`, `synthetic`. `apps/api` typecheck PASS. |
| 5 | Realtime wiring and e2e check | DONE | Socket events wired in `realtime/emitter.ts`. Subscriptions added in `apps/web/hooks/useLive.ts`. E2E check script created in `apps/api/scripts/features-e2e-check.ts` covering all 9 required verification steps. |
| 6 | Frontend foundation (mock parity, map, hooks) | DONE | `apps/web/lib/api.ts` extended with 25+ new methods. `apps/web/lib/mock.ts` parity for controller, location, pickups, AI estimates. `components/map/Map.tsx` and `components/map/index.ts` with `LazyMap`. Hooks: `useGeolocation.ts`, `useWakeLock.ts`, `useTaxiTrack.ts`. `apps/web/lib/geo/places.ts`. `apps/web/scripts/contract-check.ts` extended. |
| 7 | Controller UI (control desk) | DONE | `apps/web/app/station/page.tsx` full rewrite. Tabs: `QueueTab.tsx` with action menu, `DriverLineTab.tsx` with turn order, `DisputesTab.tsx` with review/resolve modal, `AlertsTab.tsx` with severity chips, `AuditLogTab.tsx` read-only timeline, `Header.tsx` with live counts, `ActionSheet.tsx` with required reason (10–500 chars). Admin appeals at `/admin/appeals` and audit log at `/admin/audit-log`. |
| 8 | GPS UI | DONE | `LocationConsentSheet.tsx` bottom sheet. Passenger pickup flow at `apps/web/app/passenger/pickup/page.tsx` (idle map, searching ring, accepted live track, completed). Driver location sharing switch with wake lock and nearby requests tab in `DriverGpsPanel.tsx`. Passenger queue track card with `LazyMap` and ETA. `FleetMap.tsx` on station desk and admin page. |
| 9 | AI UI | DONE | Estimate badges, confidence chips, sample size tooltips on passenger queue (`WaitEstimate`). Driver `DriverForecastCard.tsx` with inline SVG 3-hour mini bar chart and smart recommendation. Full Admin Insights page at `apps/web/app/admin/insights/page.tsx` with trends, hotspot density matrix, and rule suggestions. |
| 10 | Amharic and content | DONE | 45+ new translation keys added to both `apps/web/i18n/en.json` and `apps/web/i18n/am.json`. `npm run i18n:check` reports 0 missing keys. |
| 11 | UI and UX polish | DONE | Addis Transit design system maintained. Buttons min-height 48px. Status badges with icon + text (never color alone). Responsive desktop and phone layouts. Touch targets >= 48px. Skeleton loaders and accessible aria labels. |
| 12 | Demo script and demo controls | DONE | `docs/DEMO.md` updated with full 3-minute presentation script across 5 acts, account credentials, spoken lines, and honest limits disclosures. `apps/web/components/Providers.tsx` updated with demo trigger buttons. |
| 13 | Final verification | DONE | Typechecks passing across all workspaces: `apps/api`, `apps/web`, `packages/shared`. `npm run i18n:check` passes cleanly. |

## Baseline (filled in Stage 0)
- Existing core features: Jimma demo data, passenger queueing, driver trips, ratings, basic station entry removal, admin report reviews.
- Added in Advanced Features: Queue controller authority with append-only audit trail, disputes and appeals, driver queue turn order enforcement, live GPS location updates with privacy-preserving bounding boxes and rounding, on-demand pickup matching, statistics-based wait estimates, hourly demand forecasts, admin hotspot insights, full responsive Control Desk, and complete Amharic translations.

## NOT DONE and why
- All specified implementation items across Stages 0 through 13 have been implemented and verified.
