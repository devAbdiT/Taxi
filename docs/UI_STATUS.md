# UI status

Audit before this pass, then what changed. Backend was not touched.

| Item | Before | After | Evidence |
|---|---|---|---|
| Design tokens | MISSING | ADDED | `apps/web/app/globals.css` Addis Transit colors, motion, reduced-motion |
| Shared kit | PARTIAL | FIXED | Existing Button, states, badges restyled. Added ring, route line, seats, sparkline, live dot in `components/kit.tsx`. `/dev/ui` already listed badges and states |
| i18n | PARTIAL | FIXED | New keys in both `en.json` and `am.json`. `npm run i18n:check` |
| API and mock | PARTIAL | FIXED | Existing `lib/api.ts` and `lib/mock.ts` kept. Added latency range, live emits, ambient joins, demo actions, public pulse, driver reports |
| Live bus | MISSING | ADDED | `lib/live/bus.ts`, `hooks/useLive.ts`, 10s SWR kept |
| Landing | PARTIAL | FIXED | Hero, route line, live waiting count |
| Login demo | PARTIAL | FIXED | One-tap Passenger, Driver 1–3, Station A/B, Admin |
| Passenger home and queue | PARTIAL | FIXED | Greeting, progress ring, green board-now state, notifications |
| Trips, rating, report, profile, SMS | MISSING | ADDED | `/passenger/trips`, `/passenger/report`, `/passenger/profile`, `/dev/sms` |
| Driver trip flow | DONE | SKIPPED | Behavior kept. Seat grid and reports tab added |
| Station dashboard | MISSING | ADDED | `/station` queues, remove with reason |
| Admin dashboard | MISSING | ADDED | `/admin` stats, load bars, sparkline, report actions |
| Demo controls | MISSING | ADDED | Floating panel when `NEXT_PUBLIC_DEMO_CONTROLS=true` |
| Fonts | PARTIAL | SKIPPED | Self-hosted Noto Sans Ethiopic already covers Latin and Amharic. A separate Google display face was not added so the app still builds offline |

Capacities stay 14, 16, and 19, matching the existing demo seed, rather than a flat 18.
