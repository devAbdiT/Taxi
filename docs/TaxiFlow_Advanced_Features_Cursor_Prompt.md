# TaxiFlow: Advanced Features, Cursor Edition

Same three features as before (queue controller and conflict resolution, GPS tracking, AI) plus a UI polish pass, rebuilt for **Cursor Pro**. The long specification now lives in a file that Cursor reads on demand. You send **eight short chat prompts** instead of one giant paste, so chats stay fast and Cursor does not lose track.

## What changed from the Antigravity version
- **Spec in a file.** `docs/FEATURES_RULES.md` holds the full specification. Chats refer to it with `@docs/FEATURES_RULES.md`.
- **Project rules file.** `.cursor/rules/taxiflow.mdc` applies the basic rules to every chat automatically.
- **One stage group per chat.** Each chat does only its named stages and then stops. Progress is saved in `docs/FEATURES_STATUS.md`.
- **Plan mode for the risky stages.** Transactions, privacy and realtime (chats 2, 3, 4) start with a plan you approve.
- **Context hygiene rules.** Cursor is told to search instead of reading whole files, and to keep edits small.

## Setup (5 minutes, once)

1. Create `docs/FEATURES_RULES.md` and paste **File 1** (Section 1) into it.
2. Create `.cursor/rules/taxiflow.mdc` and paste **File 2** (Section 2).
3. Create `docs/FEATURES_STATUS.md` and paste **File 3** (Section 3).
4. Make sure these already exist from earlier work: `docs/UI_RULES.md`, `Doc/MASTER_PROMPT.md`, `docs/api.md`, `docs/DEMO.md`. If one is missing, tell Cursor in chat 1 and it will note it in the status file.
5. Free port 4000, start Docker (Postgres), and copy your project folder as a backup.
6. In Cursor, use **Agent mode**. Allow terminal commands for tests and builds.

## How to run

Open a **new chat for each row** in Section 4, paste its prompt, and wait for the stage report. Check the "You check" line before opening the next chat.

---

# 1. File 1: docs/FEATURES_RULES.md

Paste everything inside the block below into `docs/FEATURES_RULES.md`.

````
TaxiFlow ADVANCED FEATURES: specification and rules (read by Cursor on demand).

HOW THIS FILE IS USED
- This file is the specification. I start a NEW chat for each group of stages and tell you which stage(s) to do. Do ONLY the stage(s) I name, then stop after the stage report. Never start the next stage on your own.
- Progress lives in docs/FEATURES_STATUS.md. Read it at the start of every chat and update it at the end of every stage.
- Work locally. Do not run any git command. Do not deploy. Do not use any paid service or API key that is not already in the project.
- Context hygiene: do not read whole large files without need; use search to find the relevant code, read only the files the stage touches, and keep each edit small and focused so the chat stays fast.

CONTEXT
- Backend (apps/api): Express, TypeScript strict, Prisma, PostgreSQL, Zod, JWT, Socket.IO, Vitest and supertest. Shared contract in packages/shared and docs/api.md. All errors are { error, message }.
- Frontend (apps/web): Next.js App Router, Tailwind, SWR, i18n (en.json and am.json), a mock mode (NEXT_PUBLIC_USE_MOCKS) and real mode, a design language called "Addis Transit" in docs/UI_RULES.md.
- Roles today: passenger, driver, station rep, admin. The demo city is Jimma (see the seed and docs/DEMO.md).
- Core already works: queues, priority, driver trip flow, notifications, ratings, reports, station remove, admin stats, realtime events.
- The station rep is the "queue controller" in this phase. In the UI call this role "Queue controller". Admin can act on any station.

GLOBAL RULES (apply in every stage)
1. AUDIT FIRST. In each stage, classify every item as DONE, PARTIAL or MISSING by reading the code (not file names), record it in docs/FEATURES_STATUS.md with evidence, and build only PARTIAL and MISSING items. Never rewrite or restyle DONE items except where Stage 11 (UI polish) says so, and then change styling only, never behavior.
2. Do not change the request or response shape of an existing endpoint. New features add new endpoints, tables and events. Update packages/shared, docs/api.md and every caller in the same stage.
3. Backend rules: validate every body and query with Zod; check the role with requireRole on every new route; run every multi-step write in a Prisma transaction; emit realtime events only AFTER the transaction commits, from the service layer, using the existing emitter; never return passwordHash; never return a phone number to anyone except the owner; migrations are new files, never edit an old one.
4. Frontend rules: every screen has loading (skeleton), empty and error states in plain words; no raw error codes; buttons at least 48 px tall; status never by color alone; relative times instead of clock times; every label exists in en.json and am.json; mobile first at 360 px; respect prefers-reduced-motion.
5. Mock parity: every new endpoint and event must also work in mock mode (lib/mock) with the same response shapes and the same business rules, so the demo works with and without the backend. Extend apps/web/scripts/contract-check.ts so every new endpoint response is parsed with its Zod schema from packages/shared.
6. New packages allowed: leaflet and @types/leaflet only (for the map). If react-leaflet is needed, ask yourself first whether plain Leaflet inside a client component with dynamic import (ssr: false) is enough; prefer plain Leaflet. No other new packages. No PostGIS (do distance math with a bounding-box prefilter plus the haversine formula in TypeScript). No Google Maps. Use OpenStreetMap tiles with the required attribution text visible on the map, and do not prefetch or bulk-download tiles.
7. Run the real commands (npm test, npm run build, the check scripts) and paste real output in the stage report. Never write "should work". Fix every failure before moving on. If you cannot fix something after two honest attempts, record it under NOT DONE with the reason and continue.
8. Keep each file small and focused. Mark any choice you had to make with a one-line // ASSUMPTION: comment.
9. Honesty about AI: every AI output carries a `method` ("statistics", "rules" or "llm"), `basedOnSamples` (a number) and `synthetic` (true when it was computed from seeded demo history). The UI shows a small "Estimate" badge and an info tooltip that says how it was made. Do not call something machine learning if it is statistics or rules.
10. After every stage: run tests or build for what you touched, update docs/FEATURES_STATUS.md (status, evidence, real command output summary), print the stage report, and STOP. Do not start the next stage.

NEW ENVIRONMENT VARIABLES (add to .env.example files with comments)
PICKUP_RADIUS_KM=3, PICKUP_EXPIRY_MINUTES=10, LOCATION_STALE_SECONDS=60, DRIVER_TURN_ORDER_ENFORCED=true, DEMO_SIMULATE_GPS=true, AI_PROVIDER=none (values: none, or a provider name only if an adapter and key already exist), NEXT_PUBLIC_DEMO_CONTROLS=true.

======================================================================
STAGE 0: Audit and setup
======================================================================
Read docs/UI_RULES.md, Doc/MASTER_PROMPT.md, docs/api.md, docs/DEMO.md, prisma/schema.prisma and packages/shared; use search for the services and pages. Record in docs/FEATURES_STATUS.md which of the features below already exist in any form (for example station remove, reports, notifications, any location code) so you can skip them. Confirm that npm test passes and npm run build passes BEFORE changing anything, and record the result as the baseline. Stop after the baseline is recorded and Stage 0 is marked DONE.

======================================================================
STAGE 1: Database and shared contract (one migration set, named "advanced_features")
======================================================================
Add these tables and enums (adapt names to existing conventions, reuse existing models where one already fits):

QUEUE CONTROL
- QueueEntry: add sortKey (timestamp, defaults to joinedAt, backfill existing rows). Position ordering becomes: isPriority desc, then sortKey asc. joinedAt is never edited (wait statistics must stay true). Update the position window function everywhere it is used.
- Dispute: id, stationId, type (LINE_JUMPING, PRIORITY_CLAIM, DRIVER_SKIPPED_TURN, FARE_DISPUTE, BEHAVIOR, OTHER), status (OPEN, IN_REVIEW, RESOLVED, APPEALED), openedById, againstUserId?, queueEntryId?, tripId?, description, resolutionNote?, resolvedById?, createdAt, updatedAt, resolvedAt?.
- ControllerAction (APPEND-ONLY audit log): id, stationId, actorId, action (WARN, MOVE_BACK, MOVE_FORWARD, CONFIRM_PRIORITY, REJECT_PRIORITY, MARK_NO_SHOW, REMOVE, SUSPEND, ALLOW_OUT_OF_TURN, REORDER_DRIVER, RESOLVE_DISPUTE), targetUserId?, queueEntryId?, driverQueueEntryId?, disputeId?, reason (required, 10 to 500 characters), details Json?, createdAt. No update or delete code path may exist for this table anywhere.
- Suspension: id, userId, stationId, reason, startsAt, endsAt, createdByActionId, liftedAt?.
- Appeal: id, actionId or disputeId, userId, reason (10 to 500 characters), status (OPEN, UPHELD, REVERSED), adminNote?, decidedById?, createdAt, decidedAt?.
- DriverQueueEntry (driver turn order per station): id, taxiId, driverId, stationId, routeId, status (WAITING, LOADING, DEPARTED, LEFT), joinedAt, sortKey. One active entry per taxi (partial unique index, like the passenger queue). Driver position is computed with a window function (rank by sortKey), never stored.

GPS
- TaxiLocation (latest position only, no history): taxiId unique, lat, lng, heading?, speedKmh?, accuracyM?, updatedAt.
- User.locationConsentAt (nullable timestamp).
- PickupRequest: id, passengerId, lat, lng, placeNote?, seats (1 to 4), status (OPEN, ACCEPTED, ARRIVED, COMPLETED, CANCELLED, EXPIRED), acceptedTaxiId?, acceptedAt?, expiresAt, createdAt.

AI
- DemandHistory (synthetic or real hourly counts): routeId, date, hour, joins, avgWaitSeconds?, synthetic Boolean.

SHARED CONTRACT (packages/shared)
Add Zod schemas and types for every request and response in Stages 2, 3 and 4, plus socket events: dispute:update (to room station:{stationId} and to the parties), queue:control (to the affected passenger or driver, with the reason), taxi:location (to rooms trip:{tripId} and pickup:{pickupId}), pickup:new (to the drivers room, approximate location only), pickup:update (to the passenger and the accepting driver). Add the room helpers (station:{id}, trip:{id}, pickup:{id}) to the one rooms module.

DONE: migrations apply on an empty database and on the seeded one; prisma generate works; shared builds; npm test still passes.

======================================================================
STAGE 2: Backend, queue controller and conflict resolution
======================================================================
Endpoints (all validated with Zod, role-checked, transactional, standard errors):

DRIVER QUEUE
- POST /driver/queue/join (driver whose taxi is AT_STATION; 409 already_in_queue), POST /driver/queue/leave, GET /driver/queue (own position and the line at the station: plate, first name, status, position).
- Starting a trip (existing POST /driver/trips/start): when DRIVER_TURN_ORDER_ENFORCED=true and the route has a driver line, only the driver at position 1 may start, otherwise 409 not_your_turn with a message that names the plate in front. A controller ALLOW_OUT_OF_TURN action lets one named driver start once. Starting a trip sets the driver queue entry to LOADING; depart sets DEPARTED. If the existing start code path works without a driver queue entry (older flows), keep it working when the station has no driver line.

DISPUTES
- POST /disputes (passenger or driver; type, description 10 to 500, optional againstUserId, queueEntryId or tripId; the stationId comes from the entry or trip or the user's current station, never from the client alone; rate limit 5 per hour; 409 duplicate_open_dispute for the same entry and type).
- GET /disputes/mine (own disputes with status, resolution note and the controller's reason, no phone numbers).
- GET /station/disputes?status= (controller's station only; admin sees all) with parties' first names, priority flags, the linked entry and a computed "waiting" age.
- PATCH /station/disputes/:id (status IN_REVIEW, or RESOLVED with resolutionNote 10 to 500). Resolving writes a RESOLVE_DISPUTE action and notifies the parties with the note.

CONTROLLER ACTIONS (one endpoint, validated by action type)
- POST /station/actions { action, reason (10 to 500, required), queueEntryId? | driverQueueEntryId? | targetUserId?, disputeId?, minutes? (for SUSPEND, 5 to 1440), positions? (for MOVE_BACK and MOVE_FORWARD, 1 to 10) }.
  - WARN: notification only.
  - MOVE_BACK or MOVE_FORWARD: change sortKey of the entry by placing it after or before the neighbour that many positions away within the same priority group; never change joinedAt; never move across the priority boundary (409 priority_boundary).
  - CONFIRM_PRIORITY or REJECT_PRIORITY: sets isPriority (reject recomputes the position; confirm marks the entry as verified).
  - MARK_NO_SHOW and REMOVE: reuse the existing services so seats and realtime stay correct.
  - SUSPEND: creates a Suspension (join queue and driver queue join return 403 suspended with the end time).
  - ALLOW_OUT_OF_TURN and REORDER_DRIVER: for the driver line.
  - Every action: inside one transaction write the ControllerAction row (the audit log) AND apply the effect AND create a notification for the affected person that includes the reason; after commit emit queue:control, queue:update and demand:update as the existing emitter does. A rep may act only on their own station (403 not_your_station); admin on any.
- GET /station/audit-log?limit=&cursor= and GET /admin/audit-log (filters: station, actor, action, date). Read-only. There is NO endpoint or code that updates or deletes an action.

APPEALS
- POST /appeals { actionId or disputeId, reason } (only the affected person, within 48 hours, one appeal per action), GET /appeals/mine, GET /admin/appeals?status=, PATCH /admin/appeals/:id { status: UPHELD | REVERSED, adminNote (10 to 500) }. REVERSED undoes what can be undone (lift suspension, restore sortKey, restore priority flag) in a transaction, writes an audit row, and notifies the person.

FAIRNESS ALERTS (rule-based, no ML)
- GET /station/alerts: computed on request from live data, each with type, severity (info, warning), plain-English message and a link target (entry, driver or dispute): passenger waiting longer than 2 times the station's average; same passenger who left and rejoined 3 or more times in an hour; a station where more than 40% of waiting passengers claim priority; a driver who started a trip out of turn; a dispute open longer than 15 minutes.

TESTS (Vitest and supertest; fixtures built inside the test)
1. Position order is isPriority desc then sortKey asc; MOVE_BACK by 2 changes position by exactly 2 inside the same group and leaves joinedAt unchanged; MOVE across the priority boundary returns 409 priority_boundary.
2. Every action writes exactly one audit row in the same transaction (simulate a failure and confirm both roll back); reason shorter than 10 returns 400.
3. A rep cannot act on another station (403); a passenger and a driver cannot call /station/* (403).
4. A suspended passenger cannot join (403 suspended with an end time) and can join after the suspension ends.
5. Driver turn order: driver at position 2 cannot start (409 not_your_turn); after ALLOW_OUT_OF_TURN they can once.
6. Appeals: second appeal on the same action is rejected; an appeal after 48 hours is rejected; REVERSED restores the sortKey.
7. No response contains the keys "phone" or "passwordHash" (recursive key check) and no audit row can be updated or deleted through the API (assert 404 or 405 on PATCH and DELETE).

DONE: all tests above pass together with the old test suite.

======================================================================
STAGE 3: Backend, GPS tracking and pickup requests
======================================================================
- POST /me/location-consent { granted: boolean } (passenger or driver); every location endpoint returns 403 consent_required until consent is granted.
- POST /taxis/me/location (driver; lat -90..90, lng -180..180, heading 0..360?, speedKmh 0..200?, accuracyM?). Upserts TaxiLocation; rate limit 1 request per 2 seconds per driver (429 too_fast); ignore a position whose accuracyM is larger than 200 (respond 202 ignored_low_accuracy). After the upsert emit taxi:location to the rooms of the driver's active trip and accepted pickup, if any. Positions older than LOCATION_STALE_SECONDS are returned with stale: true.
- GET /taxis/nearby?lat&lng&radiusKm (passenger): available taxis (AT_STATION or EN_ROUTE with free seats) within the radius, coordinates ROUNDED to about 100 m, with distanceKm, etaMinutes (distance divided by the taxi's speed, or by 20 km/h when the speed is unknown or below 5), plate and first name. No exact coordinates.
- GET /trips/:id/track (the passenger on that trip, the driver, a controller or admin): the taxi's position, speed, stale flag, etaMinutes to the passenger's boarding station, and the route polyline from the station coordinates (add lat and lng to Station if missing, and an ordered waypoint list to Route; seed approximate Jimma coordinates in a single file apps/api/src/data/places.ts and mark them "approximate, verify on the map").
- PICKUP REQUESTS
  - POST /pickups (passenger with consent; lat, lng, placeNote? max 120, seats 1 to 4; one open request per passenger, 409 already_open; expires after PICKUP_EXPIRY_MINUTES; a background timer (every 30 s) expires old requests and notifies the passenger).
  - GET /driver/pickups/nearby (driver with consent and a fresh location): open requests within PICKUP_RADIUS_KM, sorted by the matching score (below), coordinates ROUNDED to about 300 m and no placeNote until accepted.
  - POST /driver/pickups/:id/accept (transaction; first valid accept wins, the others get 409 already_taken; the taxi must have enough free seats and must not be on another pickup). After acceptance the driver receives the EXACT location and note; the passenger receives the taxi plate, driver first name, live position and ETA, and a notification.
  - POST /driver/pickups/:id/arrived, POST /driver/pickups/:id/complete, POST /pickups/:id/cancel (passenger, or driver before arrival with a reason).
  - GET /pickups/mine (passenger: current request with status and, once accepted, the taxi position and ETA).
  - Privacy: the passenger's exact coordinates are readable only by the accepting driver, only while the pickup is ACCEPTED or ARRIVED, and are cleared (set to null) when the pickup is COMPLETED, CANCELLED or EXPIRED. Nothing stores a position history.
- DEMO GPS SIMULATOR (only when DEMO_MODE=true and DEMO_SIMULATE_GPS=true): apps/api/src/dev/gps-simulator.ts moves each seeded taxi along its route waypoints, updating TaxiLocation every 3 seconds with heading, speed and small realistic noise, and bouncing back at the ends; a taxi that is LOADING stays at its station. Start and stop it with POST /dev/simulate/gps { on: boolean } and let POST /dev/reset restore taxi positions.
- Distance helper: apps/api/src/lib/geo.ts with haversineKm, boundingBox(lat, lng, radiusKm), roundCoord(value, meters), bearing. Unit tests for these functions with known city distances.

TESTS: consent required on every location endpoint; rate limit; rounding precision (the rounded value differs from the real one by no more than 150 m for 100 m rounding); first accept wins under Promise.all of two accepts (one 201, one 409); the passenger's exact coordinates are null after completion and are never present in the nearby list; stale flag; pickup expiry; a driver outside the radius does not see the pickup.

======================================================================
STAGE 4: Backend, AI features (honest and deterministic)
======================================================================
Create apps/api/src/ai/ with: wait.ts, forecast.ts, matching.ts, insights.ts, provider.ts. provider.ts defines an interface for an optional language model used ONLY to phrase text from already computed data; with AI_PROVIDER=none (default) a templated sentence is used. No feature may require an external service.

1. GET /ai/wait-estimate?routeId= (any logged-in user): predicted minutes for a passenger joining now. Method "statistics": weighted average of historical (calledAt minus joinedAt) for the same route and hour bucket (plus or minus 1 hour, last 14 days), scaled by the current queue length relative to the historical average length; fall back to the route's overall average, then to 3 minutes per position. Response: { minutes, lowMinutes, highMinutes (interquartile range), confidence ("low" | "medium" | "high" from sample size: under 10, 10 to 29, 30 and above), basedOnSamples, method, synthetic }. Also add estimate fields to GET /queue/me responses ONLY as a new optional field estimatedWaitMinutes (do not change existing fields).
2. GET /ai/demand-forecast?stationId= (driver, controller, admin): for each route leaving or arriving at the station, expected waiting passengers for each of the next 3 hours: average of the DemandHistory joins for that hour of day and weekday over the last 14 days (fall back to all weekdays), blended with the live queue for the current hour. Response per route: [{ hourStart, expectedWaiting, low, high }], plus a recommendation object { routeId, stationId, hourStart, expectedWaiting, message } for the best opportunity ("About 15 people expected at Merkato around 5 PM"). Method "statistics".
3. Smart matching score (matching.ts), used by pickups: score each candidate taxi = 0.5 * distanceScore + 0.2 * freeSeatsScore + 0.15 * ratingScore + 0.15 * idleScore, each part normalised 0 to 1; return the parts so the UI can explain "why". Pickup notification fan-out: send pickup:new first to the top 3 drivers; if nobody accepts within 20 seconds widen to all drivers inside the radius. Method "rules".
4. GET /admin/ai/insights?days=7 (admin; controller sees their own station): from reports, disputes and audit data compute topIssues (type, count, change versus the previous period), hotspots (station and hour with the most disputes), repeat offenders count (no names, only counts and ids the admin may open), and 3 to 5 suggestions generated from rules (for example: "Most disputes are line-jumping at Merkato between 5 and 6 PM: add a second controller in that hour"). Method "rules"; with a provider configured, "llm" may only rewrite the narrative from the computed numbers.
5. Seed: generate 14 days of DemandHistory (synthetic: true) with a realistic shape (morning peak towards the university or work area, evening return peak, lower weekends, noise), and 14 days of completed trips and waits so the estimates and forecasts have data. Label it synthetic in every API response and in the UI.

TESTS with fixed fixtures: wait estimate equals the hand-computed value for a small fixture; fallback order works with zero samples; confidence levels; forecast respects weekday; matching ranks a closer taxi with the same seats higher and reports its parts; insights counts match fixtures; every AI response includes method, basedOnSamples and synthetic.

======================================================================
STAGE 5: Realtime wiring and the end-to-end check
======================================================================
Wire the new events through the existing emitter module (service layer, after commit): dispute:update, queue:control, taxi:location, pickup:new, pickup:update. Room membership stays server-controlled (station:{id} for the controller, trip:{id} and pickup:{id} for the parties; remove members when the trip or pickup ends). Update docs/api.md (Realtime section and every new endpoint). Extend apps/api/scripts/realtime-check.ts and add apps/api/scripts/features-e2e-check.ts that, after POST /dev/reset, runs and prints PASS or FAIL for each step: a passenger opens a dispute; the controller moves the offender back with a reason and the offender receives queue:control; a suspension blocks a join; an appeal is reversed and the sortKey is restored; the driver joins the driver line and a second driver cannot start out of turn; the driver sends locations and the passenger socket receives taxi:location; a pickup is created, the top 3 drivers get pickup:new, the first accept wins and the exact location is revealed only to that driver; completion clears the coordinates; the wait estimate and the demand forecast return method and basedOnSamples. Run the check 3 times in a row with POST /dev/reset between runs. All backend tests and checks must pass before Stage 6.

======================================================================
STAGE 6: Frontend foundation for the new features
======================================================================
- Types and API layer: add functions for every new endpoint to lib/api/index.ts with types from packages/shared; add the mock implementations in lib/mock with the same rules (controller actions with audit rows, sortKey ordering, suspensions, appeals, driver line, consent, taxi locations, pickups with first-accept-wins and rounding, AI estimates computed from the mock history, fairness alerts). The mock GPS simulator moves taxis along the same Jimma waypoints every 2 to 3 seconds. Extend contract-check.ts.
- hooks: useLive subscribes to the new events; useGeolocation (watchPosition with throttling to one send per 5 seconds, accuracy filtering, permission states: unknown, granted, denied, unavailable, with plain-English guidance), useWakeLock (keep the driver's screen on while sharing, release on stop, graceful fallback), useTaxiTrack(tripId or pickupId).
- Map: components/map/Map.tsx (client component, dynamic import with ssr: false, Leaflet, OpenStreetMap tiles with visible attribution, lazy loaded so the main bundle stays small), custom markers as inline SVG divIcons (taxi with heading rotation, passenger pin, station, selected pin; stale markers shown faded with "last seen 2 min ago"), smooth marker movement (interpolate between pings over about 1 second with requestAnimationFrame, respect reduced motion), route polyline, accuracy circle for the passenger, a "recenter" button, a dark-friendly light map style (CSS filter or lighter tile styling is fine), and a fallback card with the coordinates and a Retry when tiles or geolocation fail.
- Places and coordinates: lib/geo/places.ts mirrors the API places file (same approximate Jimma coordinates, marked "approximate").

DONE: build passes; /dev/ui (component gallery) shows the new components in all states; contract-check passes in real mode and the mock mode returns the same shapes.

======================================================================
STAGE 7: Controller UI ("Control desk")
======================================================================
Route /station becomes a professional control desk for the Queue controller (desktop first, usable on a tablet; stacked on a phone):
- Header: station name, live indicator, counts (waiting, priority, open disputes, alerts).
- Left: the passenger queues per route in position order with priority badges, assistance icons, relative wait time, and a row menu: Warn, Move back, Move forward, Confirm priority, Reject priority, Mark no-show, Remove, Suspend. Every action opens an ActionSheet with the action name, the person, a REQUIRED reason field (10 to 500 characters with a counter and quick-reason chips), and a confirmation. Success shows a Toast and the line animates to its new order.
- Driver line: the drivers waiting at the station in turn order (plate, first name, status), with Reorder and "Allow out of turn".
- Disputes inbox: cards sorted by age with type icon, parties' first names, the linked queue entry, age timer, buttons Review and Resolve (resolution note required). A detail drawer shows the parties' statements and the history.
- Alerts strip: the fairness alerts with severity, plain message and a "Take me there" button.
- Audit log tab: read-only timeline (who, what, to whom, reason, time) with filters; no edit or delete controls anywhere.
- Passenger and driver side: "Report a problem with the line" button on the queue page and on the driver page (opens the dispute form; shows status and the controller's reason in "My disputes"); a clear "Why did this happen to me?" card when a queue:control event arrives, showing the controller's reason and an "Appeal this decision" button (within 48 hours); suspended users see a friendly screen with the end time.
- Admin: an Appeals page (list, decision with required note, the original action and reason side by side) and an Audit log page across stations.

======================================================================
STAGE 8: GPS UI
======================================================================
- Consent: a friendly bottom sheet (shows once, can be changed in the profile) explaining what is shared, with whom and when it stops, with Accept and Not now. Everything location-based works with a clear explanation when consent or permission is missing.
- Passenger: (a) on the queue page, when a taxi is assigned or CALLED, a "Track your taxi" card with a small live map, the taxi marker moving, ETA in minutes with an "Estimate" badge and "last seen" if stale; (b) a new "Request a pickup" flow (tab or card on /passenger): a map where the passenger drops or drags a pin (and a "Use my location" button), optional note and seat count, a searching state ("Finding nearby drivers" with a pulsing ring and the number of drivers notified), then an accepted state with taxi plate, driver first name, live position and ETA, a Cancel button, and a completed state. Show a nearby-taxis layer (rounded positions) before requesting.
- Driver: a "Share my location" switch with a clear status chip (Sharing, Paused, No GPS signal, Permission needed) using useGeolocation and useWakeLock, and a banner explaining that the screen should stay on; a "Nearby requests" tab with a map and a list sorted by the matching score showing distance, passengers, the rounded area, the expiry countdown and the "why this match" explanation; Accept reveals the exact pin and a "Navigate" button (a normal link to a Google Maps or OpenStreetMap directions URL built from the coordinates, opened in a new tab; no API key), then Arrived and Complete buttons; a handled "Already taken" message.
- Controller and admin: a live fleet map (all taxis with plate, status and stale marker, station markers, open pickups as pins without exact coordinates) on the control desk and on the admin overview.
- Demo: in demo mode (mock or DEMO_SIMULATE_GPS) taxis move by themselves, and the Demo controls panel gets "Create a pickup request near me" and "Simulate a driver accepting".

======================================================================
STAGE 9: AI UI
======================================================================
- Passenger: join card and queue page show "About N minutes (range X to Y)" from the wait estimate with the Estimate badge, a confidence chip and a tooltip "Based on K recent trips" (and "Demo data" when synthetic).
- Driver: a "Smart suggestion" card at the top of the demand board from the forecast recommendation ("About 15 people expected at Merkato around 5 PM") with a mini hourly bar chart (inline SVG) for the next 3 hours per route; the pickup list shows the match score breakdown as small bars.
- Controller: fairness alerts (Stage 7) and the forecast for the station so the controller can plan.
- Admin: an "Insights" page: top issues with change arrows, hotspots (station by hour heat grid in inline SVG), the suggestions list, the demand forecast chart, and a "How this is calculated" panel that states the method for each card in plain words. No chart library.

======================================================================
STAGE 10: Amharic and content
======================================================================
Every new label exists in en.json and am.json, and `npm run i18n:check` reports nothing missing. Write natural Amharic. List every translation you are not sure about in docs/amharic-check.md under a new heading for these features, and do not claim they are verified.

======================================================================
STAGE 11: Professional UI and UX polish (whole app)
======================================================================
Raise the entire app to a competition-winning level while keeping the Addis Transit design language from docs/UI_RULES.md. Change styling and structure only; never change behavior of DONE items. Work through this checklist and record each item:
1. Visual consistency: one spacing scale, one radius scale, one elevation scale, consistent icon set and sizes, consistent headings and number styles (tabular figures for counters), no one-off colors outside the tokens.
2. Hierarchy: each screen has one clear primary action (taxi-yellow), secondary actions are quiet, destructive actions are visually separate and always confirmed.
3. Navigation: role-based app shells (bottom tab bar on phones; sidebar and top bar on desktop for controller and admin), clear active states, breadcrumbs or titles on deep pages, a profile menu with language, role switch (demo) and logout.
4. Motion: page transitions (fade and rise), staggered card entry, number roll on changing counters, press feedback, smooth list reordering, pulsing live indicators, skeletons that match the final layout (no layout jump). Everything respects prefers-reduced-motion.
5. Feedback: Toasts for every success and failure in plain words, inline validation messages under fields, optimistic updates where safe, disabled and loading states on every button that sends a request, and undo where an action is reversible.
6. Empty and error states with small inline-SVG illustrations and one clear action; offline and "Reconnecting" banners.
7. Onboarding: a first-run 3-step tour per role (passenger, driver, controller) with a Skip button, stored in localStorage; tooltips on the AI and GPS badges.
8. Dashboards: cards with clear numbers and labels, hand-drawn SVG charts with accessible labels and a text alternative, consistent tables with sticky headers and sensible mobile behavior (cards on a phone).
9. Landing page: a striking hero with the animated route and live counter, a section for each of the three advanced features ("Know where your taxi is", "Smarter waits and forecasts", "Fair queues with a human in charge") with small animated illustrations, a how-it-works strip, a roles section, and a footer with the language switch.
10. Accessibility: contrast of at least 4.5:1, visible focus rings, correct labels and aria attributes (including the map's alternative text and live regions for queue and position changes), keyboard-operable dialogs and sheets, touch targets of at least 48 px.
11. Performance: lazy-load the map and the admin and station routes, next/font with display swap, no image above 50 KB, the first screen of the passenger app under 200 KB of JavaScript if achievable (report the real number from the build output and note it if not).
12. Copy: friendly, short, plain English and Amharic microcopy; no jargon or raw codes.
13. Take screenshots with the browser tool (if available) at 360 px and 1280 px of every main screen and save them to docs/screens-ui/. Fix anything that overlaps, overflows or looks unfinished. If there is no browser tool, say so and list what you verified in the code.

======================================================================
STAGE 12: Demo script, demo controls and rehearsal checks
======================================================================
- Update docs/DEMO.md with a 3-minute script that adds the new features after the core story: (a) a dispute and the controller's reasoned action with the audit log and an appeal; (b) the live taxi map with the passenger tracking the approaching taxi; (c) a pickup request and the drivers' match with the "why" explanation; (d) the demand forecast and wait estimate with the honest "Estimate" and "Demo data" labels; (e) the Amharic switch. Include which login to use in which browser window and what to say, and an honest "limits" slide: browser GPS stops in the background, the data is demo data, AI is statistics and rules today.
- Demo controls (NEXT_PUBLIC_DEMO_CONTROLS): add "Create a dispute", "Another passenger claims priority", "Create a pickup near me", "Simulate a driver accepting", "Start or stop GPS simulation", and Reset (real mode calls POST /dev/reset, mock mode resets the mock store). In real mode hide anything that only works on the mock store.
- Run features-e2e-check.ts 3 times in a row.

======================================================================
STAGE 13: Final verification and report
======================================================================
Run and paste the real output of: npm test (api), the realtime check, the features e2e check (3 runs), the contract check in real mode, npm run i18n:check, npm run build (web). Walk through docs/DEMO.md once with mocks on and once against the real API and record any problem and its fix. Update docs/FEATURES_STATUS.md so every stage is DONE or has a clear reason. End with the final report:
1. Status table (item, before, after: SKIPPED, ADDED, FIXED)
2. Files created or changed (grouped by api, shared, web)
3. Commands run with real output
4. "Done when" checklist with ticks
5. NOT DONE and why
6. Known limits (honest list): browser GPS stops in the background; OpenStreetMap tile terms; Jimma coordinates are approximate and need checking on the map; AI features are statistics and rules on demo data until real history exists; Amharic is not reviewed by a fluent speaker.

DONE WHEN (all must be true)
1. The queue controller can warn, move, confirm or reject priority, remove and suspend with a required reason; every action appears in a read-only audit log; the affected person sees the reason and can appeal; an admin can reverse a decision.
2. The driver line enforces turn order, and the controller can override it with an audit entry.
3. Taxis appear on a live map and the passenger sees the taxi approach with an ETA; a pickup request is matched, the exact location is revealed only to the accepting driver and is cleared afterwards; location sharing needs consent.
4. The wait estimate, demand forecast, matching score and admin insights work, each labelled with method, sample size and demo-data status.
5. All backend tests, the realtime check and the features e2e check (3 runs) pass; the web build passes; mock mode and real mode work and return the same shapes.
6. The UI passes the Stage 11 checklist at 360 px and 1280 px, with screenshots saved.
7. docs/FEATURES_STATUS.md shows every stage DONE, or a reason.
````

---

# 2. File 2: .cursor/rules/taxiflow.mdc

```
---
description: TaxiFlow project rules
alwaysApply: true
---
- The specification is docs/FEATURES_RULES.md. Progress is docs/FEATURES_STATUS.md. Read both at the start of every chat.
- Do ONLY the stage(s) the user names, then print the stage report and stop. Never start the next stage.
- Audit first: classify items DONE, PARTIAL or MISSING by reading the code. Build only PARTIAL and MISSING. Never rewrite DONE items.
- Run real commands (tests, build, check scripts) and paste real output. Never say "should work".
- Local only. No git commands. No deployment. No new packages except the ones allowed in the rules file.
- Backend: Zod validation, requireRole, Prisma transactions, standard { error, message } errors, realtime emits only after commit from the service layer.
- Frontend: loading, empty and error states, 48 px buttons, no raw error codes, every label in en.json and am.json, mock mode and real mode return the same shapes.
- Keep context small: search the codebase instead of reading whole files, and keep edits small.
```

---

# 3. File 3: docs/FEATURES_STATUS.md

```
# Advanced features status

| Stage | Name | Status | Evidence (files, commands, results) |
|---|---|---|---|
| 0 | Audit and baseline | NOT STARTED | |
| 1 | Database and shared contract | NOT STARTED | |
| 2 | Backend: queue controller and conflicts | NOT STARTED | |
| 3 | Backend: GPS and pickups | NOT STARTED | |
| 4 | Backend: AI | NOT STARTED | |
| 5 | Realtime wiring and e2e check | NOT STARTED | |
| 6 | Frontend foundation (mock parity, map, hooks) | NOT STARTED | |
| 7 | Controller UI (control desk) | NOT STARTED | |
| 8 | GPS UI | NOT STARTED | |
| 9 | AI UI | NOT STARTED | |
| 10 | Amharic and content | NOT STARTED | |
| 11 | UI and UX polish | NOT STARTED | |
| 12 | Demo script and demo controls | NOT STARTED | |
| 13 | Final verification | NOT STARTED | |

## Baseline (filled in Stage 0)
## NOT DONE and why
```

---

# 4. The eight chat prompts

Open a **new Cursor chat for each one**. Chats 2, 3 and 4: start in **Plan mode** (Shift+Tab), approve the plan, then let it build.

## Chat 1: Stages 0 and 1 (audit, database, contract)

```
Read @docs/FEATURES_RULES.md and @docs/FEATURES_STATUS.md.
Do ONLY Stage 0 and Stage 1 from the rules file.
Stage 0: audit the repo, record the baseline (npm test and npm run build results before any change), and note which features already exist in any form.
Stage 1: add the database migration set "advanced_features" and the shared Zod schemas, types, socket events and room helpers exactly as specified.
Audit first, build only PARTIAL and MISSING items, run prisma generate, apply the migrations on an empty database and on the seeded one, build the shared package, run npm test, update docs/FEATURES_STATUS.md, and finish with the final report format. Stop after Stage 1.
```
**You check:** migrations apply, `npm test` still passes, the status file shows Stages 0 and 1 DONE.

## Chat 2: Stage 2 (queue controller and conflict resolution backend)

```
Read @docs/FEATURES_RULES.md and @docs/FEATURES_STATUS.md.
Do ONLY Stage 2 (backend: driver queue, disputes, controller actions with the append-only audit log, suspensions, appeals, fairness alerts, and all the listed tests).
Start with a short plan. Key points to protect: every controller action writes the audit row AND applies its effect in ONE transaction; joinedAt is never edited (only sortKey changes); the reason is required (10 to 500 characters); no update or delete path exists for the audit table; realtime events are emitted after commit from the service layer; no response contains phone numbers.
Audit first, build only PARTIAL and MISSING items, run the full test suite (old and new tests), update docs/FEATURES_STATUS.md, and finish with the final report format. Stop after Stage 2.
```
**You check:** start the API, log in as a station rep and try one action with and without a reason. Look at the audit log endpoint.

## Chat 3: Stage 3 (GPS and pickups backend)

```
Read @docs/FEATURES_RULES.md and @docs/FEATURES_STATUS.md.
Do ONLY Stage 3 (backend: consent, taxi location updates, nearby taxis with rounded coordinates, trip tracking, pickup requests with first-accept-wins, privacy rules, the demo GPS simulator, the geo helper and the listed tests).
Start with a short plan. Key points to protect: every location endpoint returns 403 consent_required without consent; exact passenger coordinates are readable only by the accepting driver and are set to null when the pickup ends; no position history is stored; two simultaneous accepts give exactly one success; no PostGIS (bounding box plus haversine in TypeScript).
Audit first, build only PARTIAL and MISSING items, run the full test suite, update docs/FEATURES_STATUS.md, and finish with the final report format. Stop after Stage 3.
```
**You check:** call the nearby-taxis endpoint and confirm coordinates are rounded; accept a pickup twice and confirm the second fails.

## Chat 4: Stages 4 and 5 (AI backend, realtime wiring, e2e check)

```
Read @docs/FEATURES_RULES.md and @docs/FEATURES_STATUS.md.
Do ONLY Stage 4 and Stage 5.
Stage 4: the AI module (wait estimate, demand forecast, matching score, admin insights, provider interface with a deterministic default, seeded 14-day synthetic history labelled synthetic) with the listed tests. Every AI response must include method, basedOnSamples and synthetic.
Stage 5: wire the new realtime events through the existing emitter, update docs/api.md, extend realtime-check.ts, and write features-e2e-check.ts. Run the e2e check 3 times in a row with POST /dev/reset between runs.
Start with a short plan. Audit first, build only PARTIAL and MISSING items, paste real output of npm test, the realtime check and the three e2e runs, update docs/FEATURES_STATUS.md, and finish with the final report format. Stop after Stage 5.
```
**You check:** the e2e script passes three times; the AI endpoints show `method` and `synthetic`.

## Chat 5: Stages 6 and 7 (frontend foundation and control desk)

```
Read @docs/FEATURES_RULES.md, @docs/FEATURES_STATUS.md and @docs/UI_RULES.md.
Do ONLY Stage 6 and Stage 7.
Stage 6: types and API functions for every new endpoint, mock implementations with the same rules and shapes, the hooks (useLive additions, useGeolocation, useWakeLock, useTaxiTrack), the Leaflet map component (client only, dynamic import, OpenStreetMap attribution, SVG markers, smooth movement, fallback card), places file, and the extended contract-check.ts.
Stage 7: the Queue controller control desk at /station (queues with action menus and the required-reason ActionSheet, driver line, disputes inbox, alerts strip, audit log tab), the passenger and driver dispute flow and "Why did this happen to me?" with appeal, the suspended screen, and the admin appeals and audit log pages.
Audit first, build only PARTIAL and MISSING items. Run npm run build in apps/web and the contract check in real mode, update docs/FEATURES_STATUS.md, and finish with the final report format. Stop after Stage 7.
```
**You check:** open `/dev/ui` and `/station` in the browser, perform a controller action in both mock mode and real mode.

## Chat 6: Stages 8, 9 and 10 (GPS UI, AI UI, Amharic)

```
Read @docs/FEATURES_RULES.md, @docs/FEATURES_STATUS.md and @docs/UI_RULES.md.
Do ONLY Stage 8, Stage 9 and Stage 10.
Stage 8: the consent sheet, the passenger "Track your taxi" card and "Request a pickup" flow, the driver location sharing switch with wake lock and the nearby requests tab with matching explanations and the navigate link, the live fleet map for the controller and admin, and the demo additions.
Stage 9: the AI cards on the passenger, driver, controller and admin screens with Estimate badges, confidence, tooltips and the Insights page (inline SVG charts only).
Stage 10: every new label in en.json and am.json, npm run i18n:check clean, uncertain translations listed in docs/amharic-check.md.
Audit first, build only PARTIAL and MISSING items. Run npm run build and the i18n check, update docs/FEATURES_STATUS.md, and finish with the final report format. Stop after Stage 10.
```
**You check:** a passenger can request a pickup and a driver in another window can accept it; the map shows moving taxis; the Estimate badges show.

## Chat 7: Stage 11 (professional UI and UX polish)

```
Read @docs/FEATURES_RULES.md, @docs/FEATURES_STATUS.md and @docs/UI_RULES.md.
Do ONLY Stage 11, the whole-app UI and UX polish checklist (items 1 to 13).
Change styling and structure only; never change the behavior of DONE items. Work through the checklist one item at a time and record each in docs/FEATURES_STATUS.md. Check pages at 360 px and 1280 px (use the built-in browser if available; otherwise tell me which pages I should screenshot and what you verified in the code). Report the real first-load JavaScript size from the build output. Run npm run build, update the status file, and finish with the final report format. Stop after Stage 11.
```
**You check:** open the landing page, the passenger queue, the driver board, the control desk and the admin page at phone width and laptop width.

## Chat 8: Stages 12 and 13 (demo and final verification)

```
Read @docs/FEATURES_RULES.md and @docs/FEATURES_STATUS.md.
Do ONLY Stage 12 and Stage 13.
Stage 12: update docs/DEMO.md with the 3-minute script and the honest limits slide, finish the demo controls (real mode calls POST /dev/reset and hides mock-only actions), and run features-e2e-check.ts 3 times.
Stage 13: run and paste the real output of npm test, the realtime check, the features e2e check (3 runs), the contract check in real mode, npm run i18n:check and npm run build. Walk through docs/DEMO.md once in mock mode and once against the real API and record any problem and fix. Make every stage in docs/FEATURES_STATUS.md DONE or give the reason. End with the final report including the known limits list.
```
**You check:** rehearse `docs/DEMO.md` out loud in two browser windows.

---

# 5. If something goes wrong

| Problem | What to do |
|---|---|
| Chat becomes slow or forgets rules | Open a new chat and paste the same prompt. The status file keeps the progress. |
| Cursor starts the next stage by itself | "Stop. Revert anything outside the stage I named." |
| Cursor rewrites working code | "Revert everything that was DONE in docs/FEATURES_STATUS.md. Only touch PARTIAL and MISSING items." |
| Tests fail and it keeps looping | "Paste the exact error. Fix only this error with the smallest change. If two attempts fail, record it under NOT DONE and stop." |
| Cursor wants a new package | "No. Use only the packages allowed in docs/FEATURES_RULES.md." |
| It says "done" without proof | "Show the command output that proves it." |
| A stage is too big for one chat | Split it: "Do only the backend part of Stage N first" and run a second chat for the rest. |

## Usage tips
- Check your usage in Cursor's account settings. Limits depend on your plan and change over time, so confirm them there rather than relying on this file.
- Use a stronger model for chats 2, 3 and 4. Auto is fine for the UI chats. Avoid the most expensive "Max" settings unless you are stuck.
- Start the app between chats and click through what was just built.

## Scope cuts if time runs out (in this order)
1. The admin Insights page and the forecast chart (Stage 9).
2. The fleet map (Stage 8).
3. Appeal reversal (Stage 2) and fairness alerts.
4. Smart suggestion chart.

Keep: the controller with audit log, the live taxi map, the pickup flow and the wait estimate.
