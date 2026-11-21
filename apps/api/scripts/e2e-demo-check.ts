/**
 * Walks docs/DEMO.md against a running API, over REST and Socket.IO, with no mock.
 *
 *   npm run e2e:demo -w @taxiflow/api              one run
 *   npm run e2e:demo -w @taxiflow/api -- --runs 3  three runs, POST /dev/reset before each
 *
 * The API must be up with DEMO_MODE=true. Set API_URL to point at a hosted API,
 * otherwise it uses http://localhost:$PORT (PORT comes from apps/api/.env, default 4000).
 * It prints PASS or FAIL per step and exits 1 on any FAIL. It leaves the database reset.
 */
import { existsSync } from "node:fs";
import {
  AdminStatsResponse,
  ArriveTripResponse,
  AuthResponse,
  CallPassengersResponse,
  CreateRatingResponse,
  DevResetResponse,
  DriverDemandResponse,
  DriverMeResponse,
  EntryActionResponse,
  JoinQueueResponse,
  MyQueueResponse,
  MyTripsResponse,
  PublicPulseResponse,
  RemoveEntryResponse,
  RoutesResponse,
  StationQueuesResponse,
  TripResponse,
  type NotificationNewPayload,
  type QueueUpdatePayload,
  type ServerToClientEvents,
} from "@taxiflow/shared";
import { io, type Socket } from "socket.io-client";
import type { ZodType } from "zod";

if (existsSync(".env")) process.loadEnvFile(".env");

const base = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;
const password = "demo1234";
/** A hosted database can take a few seconds per transaction, and events fire before the HTTP reply returns. */
const timeoutMs = 30_000;

const PHONES = {
  hana: "0911000100",
  kebede: "0911000001",
  fatuma: "0911000003",
  merkatoRep: "0911000011",
  admin: "0911000099",
  /** Third in line on Merkato → Jimma University in the seed (second in the queue's order of joining, after one priority). */
  behind: "0911000115",
};

type AppSocket = Socket<ServerToClientEvents>;

let currentRun = 0;
let total = 0;
const failures: string[] = [];

async function step(name: string, fn: () => Promise<string | void>): Promise<void> {
  total += 1;
  try {
    const detail = await fn();
    console.log(`PASS [run ${currentRun}] ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL [run ${currentRun}] ${name}: ${message}`);
    failures.push(`[run ${currentRun}] ${name}`);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`needs ${what} from an earlier step`);
  return value;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function http(method: string, path: string, token: string | null, body?: unknown): Promise<{ status: number; body: unknown }> {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // The login limiter allows 10 a minute. Wait it out instead of failing a healthy API.
    if (response.status === 429 && attempt < 5) {
      await sleep(15_000);
      continue;
    }
    const text = await response.text();
    return { status: response.status, body: text.length > 0 ? (JSON.parse(text) as unknown) : null };
  }
}

async function call<T>(schema: ZodType<T>, method: string, path: string, token: string | null, expected: number, body?: unknown): Promise<T> {
  const reply = await http(method, path, token, body);
  if (reply.status !== expected) {
    throw new Error(`${method} ${path} answered ${reply.status}, expected ${expected}: ${JSON.stringify(reply.body)}`);
  }
  return schema.parse(reply.body);
}

async function login(phone: string): Promise<string> {
  const auth = await call(AuthResponse, "POST", "/auth/login", null, 200, { phone, password });
  return auth.token;
}

/**
 * Starts listening now and returns a function that resolves once a matching event has
 * arrived (or does arrive within the timeout). The clock starts when you await it, so a
 * slow HTTP call between listening and awaiting cannot use it up.
 */
function waitForEvent<E extends keyof ServerToClientEvents>(
  socket: AppSocket,
  event: E,
  predicate: (payload: Parameters<ServerToClientEvents[E]>[0]) => boolean,
): () => Promise<Parameters<ServerToClientEvents[E]>[0]> {
  type Payload = Parameters<ServerToClientEvents[E]>[0];
  let found: Payload | undefined;
  let notify: ((payload: Payload) => void) | undefined;
  const onEvent = (payload: Payload) => {
    if (found !== undefined || !predicate(payload)) return;
    found = payload;
    socket.off(event, onEvent as never);
    notify?.(payload);
  };
  socket.on(event, onEvent as never);
  return () =>
    new Promise<Payload>((resolve, reject) => {
      if (found !== undefined) return resolve(found);
      const timer = setTimeout(() => {
        socket.off(event, onEvent as never);
        reject(new Error(`timed out waiting for ${event}`));
      }, timeoutMs);
      notify = (payload) => {
        clearTimeout(timer);
        resolve(payload);
      };
    });
}

async function openSocket(token: string, sockets: AppSocket[]): Promise<AppSocket> {
  const socket: AppSocket = io(base, { auth: { token }, reconnection: false, transports: ["websocket"] });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timeout")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return socket;
}

function findRoute(routes: RoutesResponse, from: string, to: string) {
  const route = routes.routes.find((item) => item.origin.name === from && item.destination.name === to);
  if (!route) throw new Error(`route ${from} → ${to} is missing`);
  return route;
}

async function runOnce(run: number): Promise<void> {
  currentRun = run;
  const sockets: AppSocket[] = [];

  let hanaToken: string | undefined;
  let hanaSocket: AppSocket | undefined;
  let hanaEntryId: string | undefined;
  let kebedeToken: string | undefined;
  let fatumaToken: string | undefined;
  let routes: RoutesResponse | undefined;
  let tripId: string | undefined;
  let calledIds: string[] = [];

  try {
    await step("reset: POST /dev/reset restores the demo", async () => {
      await call(DevResetResponse, "POST", "/dev/reset", null, 200, {});
    });

    await step("landing: the public pulse shows people waiting", async () => {
      const pulse = await call(PublicPulseResponse, "GET", "/public/pulse", null, 200);
      expect(pulse.waitingNow > 0, `waitingNow is ${pulse.waitingNow}`);
      return `${pulse.waitingNow} waiting`;
    });

    await step("Kebede is at Merkato and the demand board highlights routes leaving it", async () => {
      kebedeToken = await login(PHONES.kebede);
      const me = await call(DriverMeResponse, "GET", "/driver/me", kebedeToken, 200);
      expect(me.taxi.status === "AT_STATION", `taxi status is ${me.taxi.status}`);
      expect(me.taxi.currentStation?.name === "Merkato", `taxi is at ${me.taxi.currentStation?.name}`);
      expect(me.taxi.plate === "OR 3-42115", `plate is ${me.taxi.plate}`);
      const demand = await call(DriverDemandResponse, "GET", "/driver/demand", kebedeToken, 200);
      const highlighted = demand.routes.filter((route) => route.highlighted);
      expect(highlighted.length > 0 && highlighted.every((route) => route.origin.name === "Merkato"), "highlighted routes do not all leave Merkato");
      expect(demand.returnSuggestion === null, "a return suggestion appeared before any trip");
      return `${me.taxi.plate}, ${highlighted.length} routes highlighted`;
    });

    await step("Hana logs in and opens a live socket", async () => {
      hanaToken = await login(PHONES.hana);
      hanaSocket = await openSocket(hanaToken, sockets);
      routes = await call(RoutesResponse, "GET", "/routes", hanaToken, 200);
      const busy = findRoute(routes, "Jimma University", "Merkato");
      expect(busy.waiting === 12, `${busy.waiting} waiting on Jimma University → Merkato, expected 12`);
    });

    await step("Hana joins Jimma University → Merkato as ELDERLY and lands near the front", async () => {
      const token = need(hanaToken, "Hana's token");
      const socket = need(hanaSocket, "Hana's socket");
      const busy = findRoute(need(routes, "routes"), "Jimma University", "Merkato");
      const placed = waitForEvent(socket, "queue:update", (payload: QueueUpdatePayload) => payload.status === "WAITING");
      const joined = await call(JoinQueueResponse, "POST", "/queue/join", token, 201, { routeId: busy.id, assistance: "ELDERLY" });
      hanaEntryId = joined.entry.id;
      expect(joined.entry.isPriority, "elderly did not make the entry priority");
      expect(joined.position <= 4, `position is ${joined.position}`);
      const update = await placed();
      expect(update.entryId === joined.entry.id, "queue:update was for another entry");
      expect(update.position === joined.position, `socket says ${update.position}, REST says ${joined.position}`);
      return `position ${joined.position}`;
    });

    await step("Kebede starts the outbound trip and sees \"Waiting for your return: 13\"", async () => {
      const token = need(kebedeToken, "Kebede's token");
      const outbound = findRoute(need(routes, "routes"), "Merkato", "Jimma University");
      const started = await call(TripResponse, "POST", "/driver/trips/start", token, 201, { routeId: outbound.id });
      expect(started.trip.status === "LOADING", `trip is ${started.trip.status}`);
      const demand = await call(DriverDemandResponse, "GET", "/driver/demand", token, 200);
      const back = demand.returnSuggestion;
      expect(back !== null, "no return suggestion");
      expect(back?.route.origin.name === "Jimma University" && back.route.destination.name === "Merkato", "suggestion is not the return route");
      expect(back?.waiting === 13, `return suggestion shows ${back?.waiting}, expected 13`);
      expect(back?.priorityWaiting === 4, `priorityWaiting is ${back?.priorityWaiting}, expected 4`);
      return `${back?.waiting} waiting, ${back?.priorityWaiting} priority`;
    });

    await step("Fatuma is at Jimma University and starts loading Jimma University → Merkato", async () => {
      fatumaToken = await login(PHONES.fatuma);
      const me = await call(DriverMeResponse, "GET", "/driver/me", fatumaToken, 200);
      expect(me.taxi.currentStation?.name === "Jimma University", `taxi is at ${me.taxi.currentStation?.name}`);
      expect(me.taxi.plate === "OR 3-55012", `plate is ${me.taxi.plate}`);
      const busy = findRoute(need(routes, "routes"), "Jimma University", "Merkato");
      const started = await call(TripResponse, "POST", "/driver/trips/start", fatumaToken, 201, { routeId: busy.id });
      tripId = started.trip.id;
      expect(started.trip.status === "LOADING", `trip is ${started.trip.status}`);
    });

    await step("Fatuma calls everyone waiting; Hana gets queue:update CALLED and notification:new", async () => {
      const token = need(fatumaToken, "Fatuma's token");
      const socket = need(hanaSocket, "Hana's socket");
      const trip = need(tripId, "the trip id");
      const calledUpdate = waitForEvent(socket, "queue:update", (payload: QueueUpdatePayload) => payload.status === "CALLED");
      const calledNote = waitForEvent(socket, "notification:new", (payload: NotificationNewPayload) => payload.type === "QUEUE_CALLED");
      const result = await call(CallPassengersResponse, "POST", `/driver/trips/${trip}/call`, token, 200, {});
      calledIds = result.called.map((entry) => entry.id);
      expect(result.called.length === 13, `${result.called.length} called, expected 13`);
      expect(result.called.some((entry) => entry.id === hanaEntryId), "Hana was not among the called");

      const update = await calledUpdate();
      expect(update.entryId === hanaEntryId, "queue:update was for another entry");
      expect(update.taxiPlate === "OR 3-55012", `taxiPlate is ${update.taxiPlate}`);
      expect(update.position === null, "a called passenger still has a position");
      const note = await calledNote();
      expect(note.body.includes("OR 3-55012"), `notification says "${note.body}"`);
      return `${result.called.length} called`;
    });

    await step("Hana's screen data: /queue/me is CALLED with the plate and the station", async () => {
      const mine = await call(MyQueueResponse, "GET", "/queue/me", need(hanaToken, "Hana's token"), 200);
      expect(mine.entry?.status === "CALLED", `status is ${mine.entry?.status}`);
      expect(mine.taxiPlate === "OR 3-55012", `taxiPlate is ${mine.taxiPlate}`);
      expect(mine.entry?.route.origin.name === "Jimma University", `station is ${mine.entry?.route.origin.name}`);
      expect(mine.position === null, "a called passenger still has a position");
    });

    await step("the driver boards all 13", async () => {
      const token = need(fatumaToken, "Fatuma's token");
      for (let index = 0; index < calledIds.length; index += 4) {
        await Promise.all(
          calledIds.slice(index, index + 4).map(async (id) => {
            const boarded = await call(EntryActionResponse, "POST", `/driver/entries/${id}/board`, token, 200, {});
            expect(boarded.entry.status === "BOARDED", `entry is ${boarded.entry.status}`);
          }),
        );
      }
      const trip = await call(TripResponse, "GET", `/driver/trips/${need(tripId, "the trip id")}`, token, 200);
      expect(trip.trip.seatsUsed === 13, `${trip.trip.seatsUsed} seats used, expected 13`);
      return `${trip.trip.seatsUsed} of ${trip.trip.seatsUsed + trip.trip.seatsLeft} seats`;
    });

    await step("the driver departs", async () => {
      const departed = await call(TripResponse, "POST", `/driver/trips/${need(tripId, "the trip id")}/depart`, need(fatumaToken, "Fatuma's token"), 200, {});
      expect(departed.trip.status === "DEPARTED", `trip is ${departed.trip.status}`);
    });

    await step("the driver arrives; Hana is told the trip is complete", async () => {
      const socket = need(hanaSocket, "Hana's socket");
      const completed = waitForEvent(socket, "notification:new", (payload: NotificationNewPayload) => payload.type === "TRIP_COMPLETED");
      const arrived = await call(ArriveTripResponse, "POST", `/driver/trips/${need(tripId, "the trip id")}/arrive`, need(fatumaToken, "Fatuma's token"), 200, {});
      expect(arrived.trip.status === "COMPLETED", `trip is ${arrived.trip.status}`);
      expect(arrived.taxi.status === "AT_STATION" && arrived.taxi.currentStation?.name === "Merkato", "taxi is not at Merkato");
      const note = await completed();
      expect(note.userId.length > 0, "notification has no userId");
    });

    await step("Hana rates the trip", async () => {
      const token = need(hanaToken, "Hana's token");
      const before = await call(MyTripsResponse, "GET", "/trips/mine", token, 200);
      const trip = before.trips.find((item) => item.tripId === tripId);
      expect(trip !== undefined, "the trip is not in /trips/mine");
      expect(trip?.canRate === true, "canRate is false before rating");
      expect(trip?.route.destination.name === "Merkato", `trip goes to ${trip?.route.destination.name}`);
      const rated = await call(CreateRatingResponse, "POST", "/ratings", token, 201, {
        tripId,
        stars: 5,
        tags: ["PUNCTUALITY", "SAFETY"],
        comment: "Quick and clear.",
      });
      expect(rated.rating.stars === 5, `stars is ${rated.rating.stars}`);
      const after = await call(MyTripsResponse, "GET", "/trips/mine", token, 200);
      const done = after.trips.find((item) => item.tripId === tripId);
      expect(done?.rated === true && done.canRate === false, "the trip is still rateable after rating");
    });

    await step("admin stats show an average wait and a load factor", async () => {
      const token = await login(PHONES.admin);
      const stats = await call(AdminStatsResponse, "GET", "/admin/stats", token, 200);
      expect(stats.averageWaitSeconds !== null && stats.averageWaitSeconds > 0, `averageWaitSeconds is ${stats.averageWaitSeconds}`);
      const line = stats.loadFactorByRoute.find((row) => row.route.origin.name === "Jimma University" && row.route.destination.name === "Merkato");
      expect(line !== undefined, "no load factor row for Jimma University → Merkato");
      expect(line?.loadFactor !== null && Math.abs((line?.loadFactor ?? 0) - 13 / 19) < 0.01, `loadFactor is ${line?.loadFactor}, expected about ${(13 / 19).toFixed(3)}`);
      expect((line?.completedTrips ?? 0) >= 1, "completedTrips is 0");
      expect(stats.tripsToday >= 2, `tripsToday is ${stats.tripsToday}`);
      return `${Math.round(stats.averageWaitSeconds ?? 0)} s wait, load ${Math.round((line?.loadFactor ?? 0) * 100)}%`;
    });

    await step("the Merkato rep removes the second in line and the people behind move up", async () => {
      const rep = await login(PHONES.merkatoRep);
      const lineOf = (desk: StationQueuesResponse) => {
        const found = desk.routes.find((item) => item.route.origin.name === "Merkato" && item.route.destination.name === "Jimma University");
        if (!found) throw new Error("Merkato → Jimma University is missing from the desk");
        return found;
      };

      const before = lineOf(await call(StationQueuesResponse, "GET", "/station/queues", rep, 200));
      const second = before.entries.find((entry) => entry.position === 2);
      const third = before.entries.find((entry) => entry.position === 3);
      expect(before.entries.length === 6 && second !== undefined && third !== undefined, `desk shows ${before.entries.length} waiting`);

      const behindToken = await login(PHONES.behind);
      const mine = await call(MyQueueResponse, "GET", "/queue/me", behindToken, 200);
      expect(mine.entry?.id === third?.id && mine.position === 3, `${PHONES.behind} is at position ${mine.position}, expected 3`);
      const behindSocket = await openSocket(behindToken, sockets);
      const moved = waitForEvent(behindSocket, "queue:update", (payload: QueueUpdatePayload) => payload.position === 2);

      const removed = await call(RemoveEntryResponse, "POST", `/station/entries/${second?.id}/remove`, rep, 200, {});
      expect(removed.entry.status === "CANCELLED", `entry is ${removed.entry.status}`);

      const update = await moved();
      expect(update.entryId === third?.id, "queue:update was for another entry");
      const nowMine = await call(MyQueueResponse, "GET", "/queue/me", behindToken, 200);
      expect(nowMine.position === 2, `REST says position ${nowMine.position}, expected 2`);

      const after = lineOf(await call(StationQueuesResponse, "GET", "/station/queues", rep, 200));
      expect(after.entries.length === 5, `desk shows ${after.entries.length}, expected 5`);
      const positions = after.entries.map((entry) => entry.position).join(",");
      expect(positions === "1,2,3,4,5", `positions are ${positions}`);
      return `${before.entries.length} → ${after.entries.length} waiting`;
    });
  } finally {
    for (const socket of sockets) socket.close();
  }
}

function runsFromArgs(): number {
  const flag = process.argv.indexOf("--runs");
  const raw = flag >= 0 ? process.argv[flag + 1] : process.env.E2E_RUNS;
  const parsed = Number(raw ?? "1");
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

async function main(): Promise<void> {
  const runs = runsFromArgs();
  console.log(`Demo script against ${base}, ${runs} run${runs === 1 ? "" : "s"}`);
  const failedBefore: number[] = [];
  for (let run = 1; run <= runs; run += 1) {
    const failedAtStart = failures.length;
    console.log(`--- run ${run} of ${runs} ---`);
    await runOnce(run);
    failedBefore.push(failures.length - failedAtStart);
  }

  currentRun = runs;
  await step("cleanup: POST /dev/reset leaves the demo state", async () => {
    await call(DevResetResponse, "POST", "/dev/reset", null, 200, {});
  });

  failedBefore.forEach((count, index) => console.log(`run ${index + 1}: ${count === 0 ? "all steps passed" : `${count} failed`}`));
  console.log(`${total - failures.length} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const name of failures) console.log(`  FAILED ${name}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
