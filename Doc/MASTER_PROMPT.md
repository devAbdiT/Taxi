# TaxiFlow Master Prompt

Both developers load this file at the start of every AI session (or save it as CLAUDE.md / AGENTS.md so the tool reads it automatically). After it, paste ONE phase prompt at a time: Person A uses the A phases, Person B uses the B phases.

---

## 1. Project, scope and roles

**You are** a senior full-stack engineer helping two developers build a working MVP of TaxiFlow in 24 hours. Prefer simple, readable code that works over clever or complete code. If something is outside the scope below, ask before adding it.

**Project.** TaxiFlow coordinates shared taxis (14 to 19 seats) that run on fixed routes between stations in an Ethiopian city. At rush hour passengers cannot find a taxi going their way, and drivers return with empty seats. In TaxiFlow, passengers join an organized digital queue for their route, and drivers see how many passengers are waiting on every route in real time, so they can take full loads, especially on the return journey. **There is no seat reservation. The queue replaces it.**

**Build, in priority order**

1. Accounts and roles.
2. Passenger joins and leaves a route queue and sees a live position, with priority assistance.
3. Live demand board for drivers, with a highlighted return-trip suggestion.
4. Driver flow: arrive at a station, start loading, call passengers, confirm boarding, depart, arrive.
5. Station representative view of the queues at their station.
6. Notifications to passengers: in the app, plus a simulated SMS log page.
7. Ratings and problem reports after a trip.
8. Simple association statistics: average waiting time and how full taxis are by direction.
9. Stretch: a request form for private and contract transportation.

**Do not build:** seat reservations or advance booking, real payments, real SMS or USSD, delivery, maps or GPS tracking, association management tools, an advertisement system, native mobile apps.

**Roles**

| Role | How the account is created | Can do |
| --- | --- | --- |
| PASSENGER | Registers with name, phone and password | Join and leave queues, see position, rate trips, report problems |
| DRIVER | Seeded; owns one taxi | See demand, run the loading and departure flow |
| STATION_REP | Seeded; belongs to one station | See and manage queues at that station |
| ADMIN | Seeded | See statistics, review and resolve reports |

**Local fit.** English and Amharic text on every screen. Mobile first, large tap buttons, very light pages for weak networks, no maps. Show times as relative text ("5 min ago") because many Ethiopians tell time on a clock six hours offset from the international one. Phone numbers are Ethiopian mobile numbers starting 09 or 07.

**Nothing uses real SMS, real payments or real telecom services.** Messages to passengers are simulated and shown in the app.

---

## 2. Working rules for two people

- **Person A** (backend and database) works only in `apps/api`, the database and `packages/shared`.
- **Person B** (frontend) works only in `apps/web`.
- Only Person A edits `packages/shared`. Person B asks for changes with one short request.
- **Contract first.** Do not change an API path, field name or event name without telling the other person.
- Person B builds against mock data until each real endpoint is live.
- Work one phase at a time. Do not start the next phase until the current "Done when" lines are true.
- Ask before adding anything outside the scope above.

### Git branches

```
main        production only
  └── submain       integration
        ├── dev1    Person A (backend)
        └── dev2    Person B (frontend)
```

- Commit small and often on your own branch (dev1 or dev2), and at the end of every phase.
- Merge into `submain` only at the sync gates, then pull `submain` back into your branch.
- Merge `submain` into `main` once, after the demo script has run three times in a row on the hosted copy.

---

## 3. Stack, repo and environment

**Use exactly this stack.**

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | Next.js (App Router), TypeScript, Tailwind CSS, SWR, socket.io-client | Fast to build; SWR also gives a polling fallback if the live connection drops |
| Back end | Node.js, Express, TypeScript, Zod, JWT bearer tokens, bcrypt, Socket.IO | Simple, well known, one server for the API and live updates |
| Database | PostgreSQL with Prisma | Relational data, strict rules, transactions and row locking |
| Testing | Vitest and supertest for the queue rules | The queue logic is the part that must not break |
| Font | Noto Sans Ethiopic for Amharic | Correct Amharic characters on every phone |

**Why PostgreSQL.** The data is relational (users, stations, routes, taxis, trips, queue entries) and the rules are strict. Transactions and row locking stop two taxis from calling the same passenger. Window functions give a queue position without storing it. Free hosted tiers exist (for example Neon or Supabase; check current limits).

**Hosting (check current free-tier terms).** Web app on Vercel, API on Render or Railway, database on Neon or Supabase. Docker Compose for a local PostgreSQL.

**Repo layout (npm workspaces)**

```
taxiflow/
  apps/
    api/        Person A: src/{routes,services,realtime,middleware,lib}, prisma/{schema.prisma,seed.ts}
    web/        Person B: app/{login,register,passenger,driver,station,admin}, components, lib, i18n/{en.json,am.json}
  packages/
    shared/     Zod schemas, TypeScript types, socket event names (Person A edits)
  docker-compose.yml
  README.md
```

**Environment variables**

| App | Variable | Meaning |
| --- | --- | --- |
| api | DATABASE_URL | PostgreSQL connection string |
| api | JWT_SECRET | Long random string, never committed |
| api | CORS_ORIGIN | URL of the web app |
| api | PORT | Server port |
| api | DEMO_MODE | true only for the demo; switches on the reset and SMS log endpoints |
| web | NEXT_PUBLIC_API_URL | Base URL of the API |
| web | NEXT_PUBLIC_SOCKET_URL | URL for live updates (same server as the API) |
| web | NEXT_PUBLIC_USE_MOCKS | true to use lib/mock.ts instead of the real API |

**Quality bar.** TypeScript strict mode. Validate every request body with Zod. Run every state change in a database transaction. Never commit secrets. Keep a short README with the commands to install, migrate, seed and run.

---

## 4. Data model

Implement this in Prisma. Core models are written out; the four small models after it follow the same style. Prisma needs relation fields on both sides, so add the back-relations as you complete the schema.

```prisma
enum Role { PASSENGER DRIVER STATION_REP ADMIN }
enum QueueStatus { WAITING CALLED BOARDED CANCELLED NO_SHOW }
enum TaxiStatus { OFFLINE AT_STATION LOADING EN_ROUTE }
enum TripStatus { LOADING DEPARTED COMPLETED CANCELLED }
enum AssistanceType { NONE DISABILITY ELDERLY PREGNANT MOBILITY OTHER }

model User {
  id            String   @id @default(cuid())
  name          String
  phone         String   @unique
  passwordHash  String
  role          Role
  language      String   @default("en")
  stationId     String?
  station       Station? @relation(fields: [stationId], references: [id])
  taxi          Taxi?
  queueEntries  QueueEntry[]
  createdAt     DateTime @default(now())
}

model Station {
  id         String  @id @default(cuid())
  name       String
  nameAm     String?
  reps       User[]
  routesFrom Route[] @relation("Origin")
  routesTo   Route[] @relation("Destination")
  taxis      Taxi[]
}

model Route {
  id            String  @id @default(cuid())
  originId      String
  destinationId String
  origin        Station @relation("Origin", fields: [originId], references: [id])
  destination   Station @relation("Destination", fields: [destinationId], references: [id])
  trips         Trip[]
  queueEntries  QueueEntry[]
  @@unique([originId, destinationId])
}

model Taxi {
  id               String     @id @default(cuid())
  plate            String     @unique
  capacity         Int        // 14 to 19
  status           TaxiStatus @default(OFFLINE)
  driverId         String     @unique
  driver           User       @relation(fields: [driverId], references: [id])
  currentStationId String?
  currentStation   Station?   @relation(fields: [currentStationId], references: [id])
  trips            Trip[]
}

model Trip {
  id         String     @id @default(cuid())
  taxiId     String
  taxi       Taxi       @relation(fields: [taxiId], references: [id])
  routeId    String
  route      Route      @relation(fields: [routeId], references: [id])
  status     TripStatus @default(LOADING)
  createdAt  DateTime   @default(now())
  departedAt DateTime?
  arrivedAt  DateTime?
  entries    QueueEntry[]
  // add back-relations for Rating and Report
}

model QueueEntry {
  id          String         @id @default(cuid())
  passengerId String
  passenger   User           @relation(fields: [passengerId], references: [id])
  routeId     String
  route       Route          @relation(fields: [routeId], references: [id])
  status      QueueStatus    @default(WAITING)
  assistance  AssistanceType @default(NONE)
  isPriority  Boolean        @default(false)
  joinedAt    DateTime       @default(now())
  calledAt    DateTime?
  boardedAt   DateTime?
  tripId      String?
  trip        Trip?          @relation(fields: [tripId], references: [id])
  @@index([routeId, status, isPriority, joinedAt])
}
```

**Remaining models**

| Model | Fields | Notes |
| --- | --- | --- |
| Notification | id, userId, type, title, body, read (default false), createdAt | Also the source of the simulated SMS log |
| Rating | id, tripId, passengerId, stars (1 to 5), tags (string list), comment (optional), createdAt | Unique on tripId plus passengerId |
| Report | id, reporterId, tripId (optional), driverId (optional), type, description, status, driverResponse (optional), resolutionNote (optional), createdAt | type: OVERCHARGING, UNSAFE_DRIVING, DISRESPECT, DISCRIMINATION, LOST_PROPERTY, OTHER. status: OPEN, IN_REVIEW, RESOLVED |
| ContractRequest (stretch) | id, requesterId, type, pickup, destination, schedule (text), passengerCount, notes (optional), status, createdAt | type: FAMILY, SCHOOL, EMPLOYEE, SPECIAL. status: NEW, CONTACTED, CONFIRMED, CLOSED |

**Add by hand in a SQL migration** (Prisma cannot express it): one active queue entry per passenger.

```sql
CREATE UNIQUE INDEX one_active_queue_entry
  ON "QueueEntry" ("passengerId")
  WHERE status IN ('WAITING', 'CALLED');
```

---

## 5. Business rules and flows

These rules are the heart of the app. Implement them exactly and cover them with tests.

### Queue

- A passenger has **at most one active entry** (WAITING or CALLED). A second join returns 409 `already_in_queue`.
- Joining means choosing a route (origin to destination) and optionally an assistance type. Any assistance type other than NONE sets `isPriority` to true. Keep a `PRIORITY_ENABLED` setting (default true) because priority follows each station's agreed policy.
- **Position** = rank among WAITING entries on the same route, ordered by `isPriority` descending, then `joinedAt` ascending. Compute it with a SQL window function; never store it.
- A passenger can leave while WAITING or CALLED (status CANCELLED). Leaving while CALLED frees the seat and notifies the driver.

### Taxi and trip flow

- **Arrive at station S.** Taxi becomes AT_STATION with `currentStationId` = S. Allowed from OFFLINE or EN_ROUTE.
- **Start loading on route R.** R's origin must equal the taxi's current station. Creates a Trip with status LOADING; the taxi becomes LOADING. One active trip per taxi.
- **Call next N passengers.** Seats used = entries on this trip that are CALLED or BOARDED. N must not exceed the seats left (default: all seats left). In one transaction, select WAITING entries for the route in position order with `FOR UPDATE SKIP LOCKED`, set them to CALLED with `calledAt` and `tripId`, and create a notification for each: taxi plate, station, "board now".
- **Boarding.** The driver or station rep marks an entry BOARDED (sets `boardedAt`) or NO_SHOW. NO_SHOW frees the seat so another passenger can be called.
- **Depart.** Trip becomes DEPARTED and the taxi EN_ROUTE. Any entry still CALLED becomes NO_SHOW. Requires at least one BOARDED passenger.
- **Cancel trip (only while LOADING).** CALLED entries return to WAITING and keep their original `joinedAt`, so nobody loses their place. Trip CANCELLED, taxi AT_STATION.
- **Arrive at destination.** Trip COMPLETED, taxi AT_STATION at the route's destination station, boarded passengers are notified and invited to rate.

### Return-trip demand (the core idea)

- Demand for a route = number of WAITING entries, plus how many of them are priority.
- The driver board lists every route sorted by waiting passengers, highest first.
- **Return suggestion:** when a taxi has an active trip on route R (for example Area A to Area B), also show the reverse route (Area B to Area A) with the label "Waiting for your return: N passengers". When a taxi is AT_STATION, highlight the routes leaving that station with the most waiting passengers.
- Passengers also see, per route, how many taxis are AT_STATION or LOADING at its origin.

### Notifications

Every change that affects a passenger creates a Notification row and pushes it over Socket.IO. The simulated SMS log is only a developer page listing recent notifications as text messages. Do not connect any SMS provider.

### Ratings and reports

- A passenger who was BOARDED on a COMPLETED trip can rate it once: 1 to 5 stars, optional tags (punctuality, cleanliness, safety, behavior) and an optional comment.
- A passenger can report a problem (type, description, optional trip). ADMIN moves it OPEN, IN_REVIEW, RESOLVED. The reported driver can add one response.

### Statistics for the association

- **Average wait** = average of `calledAt` minus `joinedAt` for called entries.
- **Load factor** = boarded passengers divided by taxi capacity for each completed trip, averaged per route direction.
- Also: trips today, passengers waiting now.

### Safety rules

Validate every input with Zod. Check the role on every route. Normalise phone numbers (09 or 07, or +251) to one stored form. Rate-limit login and queue join. Hash passwords with bcrypt and never return the hash. Drivers and station reps see a passenger's first name and priority flag only, never the phone number.

---

## 6. API and realtime contract

Both people build against this. Do not change a path or field name without telling the other person. Errors always look like `{ "error": "code", "message": "text" }` with a fitting HTTP status.

| Method and path | Role | Purpose and key fields |
| --- | --- | --- |
| POST /auth/register | Public | name, phone, password, language. Returns token and user (passenger only) |
| POST /auth/login | Public | phone, password. Returns token and user |
| GET /me | Any | Current user |
| GET /stations | Any | Stations with Amharic names |
| GET /routes | Any | Routes with waiting, priorityWaiting and taxisAvailable |
| POST /queue/join | Passenger | routeId, assistance (optional). 201 with entry and position; 409 already_in_queue |
| GET /queue/me | Passenger | Current entry, position, status, and taxi plate when CALLED |
| POST /queue/leave | Passenger | Cancels the active entry |
| GET /trips/mine | Passenger | Past trips with a rated flag |
| POST /ratings | Passenger | tripId, stars, tags, comment |
| POST /reports | Passenger | type, description, tripId (optional) |
| GET /notifications | Any | Own notifications, newest first |
| POST /notifications/read | Any | Marks notifications read |
| POST /contracts | Passenger | Stretch: type, pickup, destination, schedule, passengerCount, notes |
| GET /driver/me | Driver | Taxi, status, active trip, seats used and left |
| POST /driver/arrive | Driver | stationId |
| GET /driver/demand | Driver | Every route with waiting, priorityWaiting, plus returnSuggestion |
| POST /driver/trips/start | Driver | routeId |
| GET /driver/trips/:id | Driver | Trip with entries (first name, priority, status) |
| POST /driver/trips/:id/call | Driver | count (optional) |
| POST /driver/entries/:id/board | Driver, Rep | Marks BOARDED |
| POST /driver/entries/:id/no-show | Driver, Rep | Marks NO_SHOW |
| POST /driver/trips/:id/depart | Driver | Departs |
| POST /driver/trips/:id/cancel | Driver | Cancels while loading |
| POST /driver/trips/:id/arrive | Driver | Completes the trip |
| POST /driver/reports/:id/respond | Driver | Adds the driver's response |
| GET /station/queues | Rep | Queues for the rep's station, per route, in position order |
| POST /station/entries/:id/remove | Rep | Removes an entry from the queue |
| GET /admin/stats | Admin | Average wait, load factor by direction, trips today, waiting now |
| GET /admin/reports | Admin | All reports |
| PATCH /admin/reports/:id | Admin | status, resolutionNote |
| POST /dev/reset | Demo mode | Reseeds the demo data |
| GET /dev/sms | Demo mode | Recent notifications as simulated text messages |

**Realtime events (Socket.IO).** The client connects with its token. The server puts each connection in the room `user:{userId}`, plus drivers in the room `drivers`.

| Event | Sent to | Payload |
| --- | --- | --- |
| demand:update | drivers, and route:{routeId} | routeId, waiting, priorityWaiting |
| queue:update | user:{userId} | entryId, status, position, taxiPlate (when CALLED) |
| notification:new | user:{userId} | The notification |
| trip:update | user:{driverId} | tripId, status, seatsUsed, capacity |

After every change to a queue, the server sends `demand:update` for the affected routes and `queue:update` to every WAITING passenger on that route, because their positions changed.

---

## 7. Demo seed data (for reference)

One command (`npm run seed -- --reset`, or `POST /dev/reset` in demo mode) rebuilds this state. All phone numbers are fake and the password is for demos only.

| Role | Phone | Password | Notes |
| --- | --- | --- | --- |
| Admin | 0911000099 | demo1234 | |
| Station rep, Area A | 0911000011 | demo1234 | |
| Station rep, Area B | 0911000012 | demo1234 | |
| Driver 1 | 0911000001 | demo1234 | Capacity 14, at Area A |
| Driver 2 | 0911000002 | demo1234 | Capacity 16, offline |
| Driver 3 | 0911000003 | demo1234 | Capacity 19, at Area B |
| Demo passenger | 0911000100 | demo1234 | Not in any queue, used live |
| 20 other passengers | 0911000101 to 0911000120 | demo1234 | Fill the queues below |

**Stations and routes:** Area A (residential) and Area B (working), with routes A to B and B to A.

**Queues at the start:** 12 passengers waiting at Area B for B to A, three of them priority (elderly, pregnant, disability), and 5 waiting at Area A for A to B. Join times are spread over the last 40 minutes.

---

## 8. Demo script (about 2 minutes)

1. The demo passenger joins the Area B to Area A queue and marks "elderly". Their position shows near the front.
2. Driver 1, loading at Area A, shows "Waiting for your return: 13 passengers" on the demand board.
3. Driver 3, at Area B, starts loading on B to A and calls everyone waiting (13 passengers).
4. The demo passenger's phone shows "Taxi ready, board now".
5. The driver marks passengers boarded and departs, then arrives.
6. The passenger rates the trip. The admin page shows average wait and the taxi's load factor.

---

**Now wait for my phase prompt.** Do not build anything until I paste one.
