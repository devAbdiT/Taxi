# TaxiFlow UI rules

Frontend only, inside `apps/web`. Do not edit `apps/api`, Prisma, or the database. Types may be read from `packages/shared` and `docs/api.md`. Do not deploy.

## Product

TaxiFlow organizes shared-taxi boarding. A passenger joins a queue for a route at a station, with optional priority for special needs. A driver arrives, sees demand (including a "waiting for your return" suggestion), starts loading, calls the next passengers, boards them, departs, and arrives. Station reps watch and manage queues. Admins see statistics and handle reports. Everything updates live.

## Stack

Next.js App Router, TypeScript strict, Tailwind, SWR, `next/font`. The only new UI package allowed is `lucide-react`. No chart library, no animation library, no UI kit. Charts are inline SVG. Motion is CSS and respects `prefers-reduced-motion`.

This repo uses Tailwind 4 (`@theme` in `app/globals.css`), so design tokens live there instead of a `tailwind.config` file.

## Data

Screens go through `lib/api.ts`. When `NEXT_PUBLIC_USE_MOCKS=true`, calls hit `lib/mock.ts` (in-memory store in `localStorage`, real queue rules, 250–600 ms latency). Otherwise they hit the HTTP client with `Authorization: Bearer` and plain-language errors.

`lib/live/bus.ts` emits `demand:update`, `queue:update`, `notification:new`, and `trip:update`. `hooks/useLive.ts` listens on the mock bus when mocks are on, and to Socket.IO when they are off. SWR still refreshes every 10 seconds. With mocks on, a random passenger joins or leaves every 8–15 seconds.

## Design: Addis Transit

Warm, confident, local. Blue-and-white minibus heritage with taxi-yellow accents. Big numbers. Soft depth.

- ink `#0E1B33`, cobalt `#1D4E9E`, cobalt-deep `#123267`, sky `#E8F0FE`, cream `#FBF8F1`, card `#FFFFFF`, line `#E6E1D6`, muted `#6B7280`
- taxi `#F5B800`, go `#1F9D6B`, go-soft `#E3F5EC`, alert `#D9473F`, alert-soft `#FCEBEA`, amber-soft `#FFF3CC`
- Cards 20 px, buttons 14 px, pills full. Soft layered shadow. 8 px spacing.
- Mobile first at 360 px. Passenger and driver stay in a 440 px column. Station and admin use a wide dashboard.
- Buttons at least 48 px, visible focus, status is icon plus text, relative times, no raw error codes.

## i18n

`i18n/en.json` and `i18n/am.json`. Every visible string uses `t`. Language is saved in `localStorage`. English is the fallback. `npm run i18n:check` compares the keys.
