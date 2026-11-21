# TaxiFlow API contract

This is the contract both developers build against. The source of truth for every shape below is `packages/shared` (Zod schemas plus TypeScript types with the same names). Do not change a path, field or event name without telling the other person.

## Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `NEXT_PUBLIC_API_URL`, for example `http://localhost:4000`. No `/api` prefix. |
| Auth | `Authorization: Bearer <token>` on every endpoint except `/health`, `/auth/register` and `/auth/login`. The token comes from register or login. |
| Body | JSON, `Content-Type: application/json`, max 100 kB. |
| Dates | ISO 8601 strings in UTC (`"2026-11-21T12:30:00.000Z"`). Show them as relative text ("5 min ago"), never as clock time. |
| Ids | Opaque strings (cuid). |
| Phone | Input may be `09…`, `07…`, `+2519…`, `2519…` (spaces and dashes ignored). Stored and returned as `09XXXXXXXX` or `07XXXXXXXX`. `normalizePhone()` in shared does the same thing on the client. |
| Position | 1-based rank among WAITING entries on the same route: priority first, then earliest `joinedAt`. Computed by the server, never stored. |
| Privacy | Driver and station responses contain a passenger's first name and priority flag only, never a phone number. |
| Lists | Responses are always objects (`{ "routes": [...] }`), never bare arrays, so fields can be added without breaking clients. |

### Errors

Every error has this shape (`ErrorResponse`):

```json
{ "error": "already_in_queue", "message": "You are already in a queue" }
```

`message` is plain English for logs. The web app should map `error` to its own English and Amharic text and never show the raw code. `validation_error` also carries `details: [{ "path": "phone", "message": "..." }]`.

Errors every authenticated endpoint can return, not repeated below:

| Status | `error` | When |
| --- | --- | --- |
| 400 | `validation_error` | Body, params or query fail the Zod schema |
| 400 | `invalid_json` | Body is not valid JSON |
| 401 | `unauthorized` | Missing, invalid or expired token. Send the user to `/login`. |
| 403 | `forbidden` | Logged in with the wrong role for this endpoint |
| 404 | `not_found` | No such endpoint |
| 429 | `rate_limited` | Too many requests (login and queue join) |
| 500 | `internal_error` | Server bug |

All codes are listed in `ErrorCode` in shared.

## Shared objects

These appear inside many responses. Full definitions are in `packages/shared/src/models.ts`.

```ts
PublicUser      { id, name, phone, role, language: "en"|"am", stationId: string|null, createdAt }
Station         { id, name, nameAm: string|null }
RouteSummary    { id, origin: Station, destination: Station }
RouteWithDemand RouteSummary & { waiting, priorityWaiting, taxisAvailable }
QueueEntry      { id, route: RouteSummary, status, assistance, isPriority, joinedAt,
                  calledAt|null, boardedAt|null, tripId|null }                       // passenger's own entry
TripEntry       { id, firstName, isPriority, status, calledAt|null, boardedAt|null }  // driver/rep view, no phone
DriverTaxi      { id, plate, capacity, status, currentStation: Station|null }
DriverTrip      { id, route: RouteSummary, status, taxiPlate, capacity, seatsUsed, seatsLeft,
                  createdAt, departedAt|null, arrivedAt|null, entries: TripEntry[] }
Notification    { id, userId, type, title, body, read, createdAt }  // title and body in the user's language
Rating          { id, tripId, passengerId, stars, tags, comment|null, createdAt }
Report          { id, reporterId, tripId|null, driverId|null, type, description, status,
                  driverResponse|null, resolutionNote|null, createdAt }
AdminReport     Report & { reporter: { id, name }, driver: { id, name }|null, taxiPlate|null }
ContractRequest { id, requesterId, type, pickup, destination, schedule, passengerCount, notes|null, status, createdAt }
```

`taxisAvailable` counts taxis that are AT_STATION or LOADING at the route's origin. `seatsUsed` counts entries on the trip that are CALLED or BOARDED.

### Enums

| Enum | Values |
| --- | --- |
| `Role` | PASSENGER, DRIVER, STATION_REP, ADMIN |
| `QueueStatus` | WAITING, CALLED, BOARDED, CANCELLED, NO_SHOW |
| `TaxiStatus` | OFFLINE, AT_STATION, LOADING, EN_ROUTE |
| `TripStatus` | LOADING, DEPARTED, COMPLETED, CANCELLED |
| `AssistanceType` | NONE, DISABILITY, ELDERLY, PREGNANT, MOBILITY, OTHER |
| `Language` | en, am |
| `RatingTag` | PUNCTUALITY, CLEANLINESS, SAFETY, BEHAVIOR |
| `ReportType` | OVERCHARGING, UNSAFE_DRIVING, DISRESPECT, DISCRIMINATION, LOST_PROPERTY, OTHER |
| `ReportStatus` | OPEN, IN_REVIEW, RESOLVED |
| `ContractType` | FAMILY, SCHOOL, EMPLOYEE, SPECIAL |
| `ContractStatus` | NEW, CONTACTED, CONFIRMED, CLOSED |
| `NotificationType` | QUEUE_JOINED, QUEUE_CALLED, QUEUE_RETURNED, QUEUE_REMOVED, QUEUE_NO_SHOW, TRIP_COMPLETED, PASSENGER_LEFT, REPORT_FILED, REPORT_UPDATED, SYSTEM |

## Endpoints

Each heading names the shared schemas for the request and the response.

### GET /health

Public. Response 200 `HealthResponse`: `{ "ok": true, "uptimeSeconds": 42 }`.

---

### Auth and reference data

#### POST /auth/register

Public. Creates a PASSENGER only. Rate-limited.

Request `RegisterRequest`

```json
{ "name": "Abebe Kebede", "phone": "0912345678", "password": "secret12", "language": "am" }
```

`name` 2–80 chars, `password` 6–100 chars, `language` optional (default `"en"`).

Response 201 `AuthResponse`: `{ "token": "eyJ...", "user": PublicUser }`

| Status | `error` | When |
| --- | --- | --- |
| 409 | `phone_taken` | An account with this phone exists |

#### POST /auth/login

Public. Rate-limited.

Request `LoginRequest`: `{ "phone": "0911000100", "password": "demo1234" }`

Response 200 `AuthResponse`: `{ "token": "eyJ...", "user": PublicUser }`

| Status | `error` | When |
| --- | --- | --- |
| 401 | `invalid_credentials` | Unknown phone or wrong password |

#### GET /me

Any role. Response 200 `MeResponse`: `{ "user": PublicUser }`

#### GET /stations

Any role. Response 200 `StationsResponse`: `{ "stations": Station[] }`

#### GET /routes

Any role. Response 200 `RoutesResponse`: `{ "routes": RouteWithDemand[] }`

```json
{
  "routes": [
    {
      "id": "rt_b_a",
      "origin": { "id": "st_b", "name": "Area B", "nameAm": "..." },
      "destination": { "id": "st_a", "name": "Area A", "nameAm": "..." },
      "waiting": 12,
      "priorityWaiting": 3,
      "taxisAvailable": 1
    }
  ]
}
```

---

### Passenger: queue

#### POST /queue/join

PASSENGER. Rate-limited.

Request `JoinQueueRequest`: `{ "routeId": "rt_b_a", "assistance": "ELDERLY" }`. `assistance` is optional (default `NONE`). Anything other than NONE sets `isPriority: true`, unless the server runs with `PRIORITY_ENABLED=false`.

Response 201 `JoinQueueResponse`: `{ "entry": QueueEntry, "position": 1 }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `route_not_found` | No such route |
| 409 | `already_in_queue` | The passenger already has a WAITING or CALLED entry |

#### GET /queue/me

PASSENGER. Response 200 `MyQueueResponse`

```json
{ "entry": QueueEntry | null, "position": 3 | null, "taxiPlate": "3-A12345" | null }
```

`entry` is null when the passenger has no WAITING or CALLED entry. `position` is set only while `entry.status` is WAITING. `taxiPlate` is set only while CALLED ("Taxi 3-A12345 is ready, board now").

#### POST /queue/leave

PASSENGER. No body. Cancels the active entry (WAITING or CALLED). Leaving while CALLED frees the seat and notifies the driver.

Response 200 `LeaveQueueResponse`: `{ "entry": QueueEntry }` with `status: "CANCELLED"`.

| Status | `error` | When |
| --- | --- | --- |
| 404 | `not_in_queue` | No active entry |

---

### Passenger: trips, ratings, reports, contracts

#### GET /trips/mine

PASSENGER. Trips the passenger boarded, newest first.

Response 200 `MyTripsResponse`: `{ "trips": PassengerTrip[] }`

```ts
PassengerTrip { tripId, entryId, route: RouteSummary, status: TripStatus, taxiPlate, driverFirstName,
                boardedAt|null, departedAt|null, arrivedAt|null, rated: boolean, canRate: boolean }
```

`canRate` is true when the trip is COMPLETED and not rated yet.

#### POST /ratings

PASSENGER. Only for a COMPLETED trip the passenger BOARDED. Once per trip.

Request `CreateRatingRequest`

```json
{ "tripId": "trp_1", "stars": 5, "tags": ["PUNCTUALITY", "SAFETY"], "comment": "Great driver" }
```

`stars` 1–5. `tags` optional (default `[]`). `comment` optional, max 500 chars.

Response 201 `CreateRatingResponse`: `{ "rating": Rating }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `trip_not_found` | No such trip |
| 403 | `not_on_trip` | The passenger did not board this trip |
| 409 | `trip_not_completed` | Trip is not COMPLETED yet |
| 409 | `already_rated` | The passenger already rated this trip |

#### POST /reports

PASSENGER. When `tripId` is given, the server attaches that trip's driver and notifies them.

Request `CreateReportRequest`: `{ "type": "OVERCHARGING", "description": "Charged 20 birr instead of 10", "tripId": "trp_1" }`. `description` 5–1000 chars. `tripId` optional.

Response 201 `CreateReportResponse`: `{ "report": Report }` with `status: "OPEN"`.

| Status | `error` | When |
| --- | --- | --- |
| 404 | `trip_not_found` | `tripId` given but no such trip |
| 403 | `not_on_trip` | The passenger did not board that trip |

#### POST /contracts (stretch)

PASSENGER.

Request `CreateContractRequest`

```json
{ "type": "SCHOOL", "pickup": "Area A", "destination": "Area B school", "schedule": "Weekdays 7:30", "passengerCount": 18, "notes": "Optional" }
```

`passengerCount` 1–100. `notes` optional.

Response 201 `CreateContractResponse`: `{ "request": ContractRequest }` with `status: "NEW"`.

---

### Notifications

#### GET /notifications

Any role. Newest first, at most 50.

Response 200 `NotificationsResponse`: `{ "notifications": Notification[], "unread": 2 }`

#### POST /notifications/read

Any role.

Request `MarkNotificationsReadRequest`: `{ "ids": ["ntf_1", "ntf_2"] }`. Omit `ids` (send `{}`) to mark all read. Ids that are not the caller's are ignored.

Response 200 `MarkNotificationsReadResponse`: `{ "updated": 2 }`

---

### Driver

Every driver endpoint acts on the caller's own taxi.

#### GET /driver/me

DRIVER. Response 200 `DriverMeResponse`

```json
{ "taxi": DriverTaxi, "activeTrip": DriverTrip | null, "seatsUsed": 4, "seatsLeft": 10 }
```

The active trip is the taxi's LOADING or DEPARTED trip. With no active trip, `seatsUsed` is 0 and `seatsLeft` equals capacity.

| Status | `error` | When |
| --- | --- | --- |
| 404 | `taxi_not_found` | The driver has no taxi |

#### POST /driver/arrive

DRIVER. Taxi becomes AT_STATION at the station. Allowed only from OFFLINE or EN_ROUTE (an EN_ROUTE taxi should normally use the trip arrive endpoint instead).

Request `DriverArriveRequest`: `{ "stationId": "st_a" }`

Response 200 `DriverArriveResponse`: `{ "taxi": DriverTaxi }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `station_not_found` | No such station |
| 409 | `invalid_taxi_status` | Taxi is AT_STATION or LOADING |

#### GET /driver/demand

DRIVER. Every route, sorted by `waiting`, highest first.

Response 200 `DriverDemandResponse`

```json
{
  "routes": [
    { "id": "rt_b_a", "origin": Station, "destination": Station,
      "waiting": 12, "priorityWaiting": 3, "taxisAvailable": 1, "highlighted": false }
  ],
  "returnSuggestion": { "route": RouteSummary, "waiting": 12, "priorityWaiting": 3 } | null
}
```

- `returnSuggestion` is the reverse of the taxi's active trip route (for a trip A→B it is B→A). Show it as "Waiting for your return: N passengers". It is null when there is no active trip or no reverse route.
- `highlighted` is true for routes leaving the taxi's current station while the taxi is AT_STATION. The list is sorted by waiting, so the first highlighted route has the most passengers.

#### POST /driver/trips/start

DRIVER. The route's origin must be the taxi's current station. Creates a LOADING trip; the taxi becomes LOADING.

Request `StartTripRequest`: `{ "routeId": "rt_b_a" }`

Response 201 `TripResponse`: `{ "trip": DriverTrip }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `route_not_found` | No such route |
| 409 | `invalid_taxi_status` | Taxi is not AT_STATION |
| 409 | `route_not_from_current_station` | Route origin is not the taxi's current station |
| 409 | `active_trip_exists` | Taxi already has a LOADING or DEPARTED trip |

#### GET /driver/trips/:id

DRIVER. Response 200 `TripResponse`: `{ "trip": DriverTrip }`. `trip.entries` lists every entry attached to the trip with first name, priority and status.

| Status | `error` | When |
| --- | --- | --- |
| 404 | `trip_not_found` | No such trip |
| 403 | `not_your_trip` | Trip belongs to another taxi |

#### POST /driver/trips/:id/call

DRIVER. Calls the next N WAITING passengers in position order. Each called passenger gets a notification ("Taxi {plate} at {station}: board now") and a `queue:update`.

Request `CallPassengersRequest`: `{ "count": 5 }`. Omit `count` (send `{}`) to fill every seat left.

Response 200 `CallPassengersResponse`: `{ "trip": DriverTrip, "called": TripEntry[] }`. `called` is empty when nobody is waiting.

| Status | `error` | When |
| --- | --- | --- |
| 404 | `trip_not_found` | No such trip |
| 403 | `not_your_trip` | Trip belongs to another taxi |
| 409 | `trip_not_loading` | Trip is not LOADING |
| 409 | `not_enough_seats` | `count` is more than `seatsLeft`, or no seats are left |

#### POST /driver/entries/:id/board

DRIVER (own trip) or STATION_REP (entry's route leaves the rep's station). The entry must be CALLED. Sets BOARDED and `boardedAt`.

No body. Response 200 `EntryActionResponse`: `{ "entry": TripEntry, "trip": DriverTrip }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `entry_not_found` | No such entry |
| 403 | `not_your_trip` | Driver: entry is on another taxi's trip |
| 403 | `not_your_station` | Rep: entry's route does not leave the rep's station |
| 409 | `invalid_entry_status` | Entry is not CALLED |
| 409 | `trip_not_loading` | Trip is not LOADING |

#### POST /driver/entries/:id/no-show

Same roles, rules, response and errors as board. Sets NO_SHOW, frees the seat, and notifies the passenger.

#### POST /driver/trips/:id/depart

DRIVER. Needs at least one BOARDED entry. Trip becomes DEPARTED, taxi EN_ROUTE. Entries still CALLED become NO_SHOW.

No body. Response 200 `TripResponse`: `{ "trip": DriverTrip }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `trip_not_found` | No such trip |
| 403 | `not_your_trip` | Trip belongs to another taxi |
| 409 | `trip_not_loading` | Trip is not LOADING |
| 409 | `no_boarded_passengers` | Nobody is BOARDED |

#### POST /driver/trips/:id/cancel

DRIVER. Only while LOADING. CALLED entries go back to WAITING with their original `joinedAt`, so nobody loses their place. BOARDED entries also go back to WAITING. Trip CANCELLED, taxi AT_STATION.

No body. Response 200 `TripResponse`: `{ "trip": DriverTrip }`

Errors: `trip_not_found` (404), `not_your_trip` (403), `trip_not_loading` (409).

#### POST /driver/trips/:id/arrive

DRIVER. Only while DEPARTED. Trip COMPLETED with `arrivedAt`. Taxi AT_STATION at the route's destination. Boarded passengers get a TRIP_COMPLETED notification inviting them to rate.

No body. Response 200 `ArriveTripResponse`: `{ "trip": DriverTrip, "taxi": DriverTaxi }`

Errors: `trip_not_found` (404), `not_your_trip` (403), `trip_not_departed` (409).

#### POST /driver/reports/:id/respond

DRIVER. Only the driver named on the report. One response per report.

Request `RespondReportRequest`: `{ "response": "The fare on this route is 15 birr." }` (2–1000 chars)

Response 200 `RespondReportResponse`: `{ "report": Report }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `report_not_found` | No such report |
| 403 | `not_your_report` | The report is not about this driver |
| 409 | `already_responded` | The driver already responded |

---

### Station rep

#### GET /station/queues

STATION_REP. Routes leaving the rep's station, and the taxis there.

Response 200 `StationQueuesResponse`

```json
{
  "station": Station,
  "routes": [
    {
      "route": RouteSummary,
      "waiting": 12,
      "priorityWaiting": 3,
      "entries": [
        { "id": "qe_1", "firstName": "Almaz", "isPriority": true, "status": "WAITING",
          "position": 1, "joinedAt": "...", "tripId": null }
      ]
    }
  ],
  "taxis": [
    { "id": "tx_3", "plate": "3-B98765", "capacity": 19, "status": "LOADING",
      "driverFirstName": "Kebede", "activeTripId": "trp_9" }
  ]
}
```

`entries` lists WAITING entries in position order, then CALLED entries (`position: null`). `taxis` lists taxis whose current station is this one.

#### POST /station/entries/:id/remove

STATION_REP. The entry must be WAITING or CALLED on a route leaving the rep's station. It becomes CANCELLED, and the passenger is notified (QUEUE_REMOVED).

No body. Response 200 `RemoveEntryResponse`: `{ "entry": StationQueueEntry }`

| Status | `error` | When |
| --- | --- | --- |
| 404 | `entry_not_found` | No such entry |
| 403 | `not_your_station` | Route does not leave the rep's station |
| 409 | `invalid_entry_status` | Entry is not WAITING or CALLED |

Board and no-show for reps use `/driver/entries/:id/board` and `/driver/entries/:id/no-show`.

---

### Admin

#### GET /admin/stats

ADMIN. Response 200 `AdminStatsResponse`

```json
{
  "averageWaitSeconds": 540,
  "loadFactorByRoute": [
    { "route": RouteSummary, "loadFactor": 0.93, "completedTrips": 4 }
  ],
  "tripsToday": 7,
  "waitingNow": 17
}
```

- `averageWaitSeconds` is the average of `calledAt - joinedAt` over every entry that was called. Null when nobody was called yet.
- `loadFactor` is boarded passengers divided by capacity for each COMPLETED trip, averaged per route direction (0 to 1). Null when the route has no completed trips.
- `tripsToday` counts trips created since midnight Addis Ababa time (UTC+3).
- `waitingNow` counts WAITING entries on every route.

#### GET /admin/reports

ADMIN. Optional query `?status=OPEN|IN_REVIEW|RESOLVED` (`AdminReportsQuery`). Newest first.

Response 200 `AdminReportsResponse`: `{ "reports": AdminReport[] }`

#### PATCH /admin/reports/:id

ADMIN. Request `UpdateReportRequest`: `{ "status": "RESOLVED", "resolutionNote": "Driver warned" }`. Send at least one field. The reporter gets a REPORT_UPDATED notification.

Response 200 `UpdateReportResponse`: `{ "report": AdminReport }`

Errors: `report_not_found` (404).

---

### Demo mode only

These exist only when the API runs with `DEMO_MODE=true`. Otherwise they answer 404 `not_found`. They need no token, so the demo can be reset from any browser.

#### POST /dev/reset

Wipes the database and rebuilds the seed state (`npm run seed -- --reset` does the same). Every open socket should refetch afterwards.

No body. Response 200 `DevResetResponse`: `{ "ok": true }`

#### GET /dev/sms

The 100 newest notifications shown as simulated text messages. Nothing is ever sent.

Response 200 `DevSmsResponse`

```json
{ "messages": [{ "id": "ntf_1", "to": "0911000100", "recipientName": "Demo Passenger", "text": "TaxiFlow: Taxi 3-B98765 at Area B is ready. Board now.", "createdAt": "..." }] }
```

---

## Realtime (Socket.IO)

Connect to `NEXT_PUBLIC_SOCKET_URL` (the API server) with the token:

```ts
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@taxiflow/shared";

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, { auth: { token } });
```

A connection without a valid token is refused with `connect_error` message `unauthorized`.

### Rooms

| Room | Who is in it |
| --- | --- |
| `user:{userId}` | Every connection, joined automatically |
| `drivers` | Every DRIVER connection, joined automatically |
| `route:{routeId}` | Any connection that sends `route:subscribe` |

### Server to client

Event names are in `SOCKET_EVENTS`; payload schemas have the same names in shared.

| Event | Sent to | Payload |
| --- | --- | --- |
| `demand:update` | `drivers` and `route:{routeId}` | `DemandUpdatePayload` `{ routeId, waiting, priorityWaiting }` |
| `queue:update` | `user:{passengerId}` | `QueueUpdatePayload` `{ entryId, status, position: number\|null, taxiPlate: string\|null }` |
| `notification:new` | `user:{userId}` | `NotificationNewPayload`, the full `Notification` |
| `trip:update` | `user:{driverId}` | `TripUpdatePayload` `{ tripId, status, seatsUsed, capacity }` |

After every change to a queue, the server sends `demand:update` for the affected routes and `queue:update` to every WAITING passenger on that route, because their positions changed. `position` is set only while WAITING; `taxiPlate` only when CALLED.

### Client to server

| Event | Payload | Effect |
| --- | --- | --- |
| `route:subscribe` | `{ routeId }` | Join `route:{routeId}` to get `demand:update` for that route (for example on the passenger route list) |
| `route:unsubscribe` | `{ routeId }` | Leave the room |

Every live screen should also refetch with SWR every 10 seconds, so the app keeps working if the socket drops.
