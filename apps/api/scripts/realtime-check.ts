import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AuthResponse,
  CallPassengersResponse,
  MyQueueResponse,
  RoutesResponse,
  TripResponse,
  type DemandUpdatePayload,
  type NotificationNewPayload,
  type QueueUpdatePayload,
  type ServerToClientEvents,
  type TripUpdatePayload,
} from "@taxiflow/shared";
import { io, type Socket } from "socket.io-client";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(apiRoot, ".env"));

const port = process.env.PORT ?? "4000";
const base = `http://localhost:${port}`;
const password = "demo1234";
// ASSUMPTION: the deadline is 20s, not 2s. On this hosted Postgres a queue or
// call transaction takes longer than 2s, and the event is emitted before the
// HTTP response returns.
const timeoutMs = 20_000;

const failures: string[] = [];

function report(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS: ${name}`);
    return;
  }
  console.log(`FAIL: ${name}${detail ? ` (${detail})` : ""}`);
  failures.push(name);
}

function example(event: string, payload: unknown): void {
  console.log(`EXAMPLE ${event}: ${JSON.stringify(payload)}`);
}

type AppSocket = Socket<ServerToClientEvents>;

function waitForEvent<E extends keyof ServerToClientEvents>(
  socket: AppSocket,
  event: E,
  predicate: (payload: Parameters<ServerToClientEvents[E]>[0]) => boolean,
  ms: number,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const onEvent = (payload: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timed out waiting for ${event}`));
    }, ms);
    socket.on(event, onEvent);
  });
}

function openSocket(token: string): AppSocket {
  return io(base, { auth: { token }, reconnection: false, transports: ["websocket"] });
}

function whenConnected(socket: AppSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timeout")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function hold<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

async function api(path: string, token: string | null, method: string, body?: unknown): Promise<unknown> {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  }
  return parsed;
}

async function login(phone: string): Promise<string> {
  const body = AuthResponse.parse(await api("/auth/login", null, "POST", { phone, password }));
  return body.token;
}

function seed(): void {
  const result = spawnSync("npm", ["run", "seed", "--", "--reset"], { cwd: apiRoot, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("seed --reset failed");
  }
}

async function main(): Promise<void> {
  console.log(`Seeding, then checking ${base}`);
  seed();

  const driverToken = await login("0911000003");
  const aheadToken = await login("0911000103");
  const behindToken = await login("0911000106");
  const joinerToken = await login("0911000100");

  const bad = openSocket("not-a-token");
  const badResult = await Promise.race([
    new Promise<string>((resolve) => {
      bad.on("connect_error", (err: Error) => resolve(err.message));
      bad.on("connect", () => resolve("connected"));
    }),
    new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);
  report("bad-token rejection", badResult === "unauthorized", badResult);
  bad.close();

  const driver = openSocket(driverToken);
  const ahead = openSocket(aheadToken);
  const behind = openSocket(behindToken);
  const behindTab = openSocket(behindToken);
  await Promise.all([whenConnected(driver), whenConnected(ahead), whenConnected(behind), whenConnected(behindTab)]);

  const routes = RoutesResponse.parse(await api("/routes", driverToken, "GET"));
  const route = routes.routes.find((item) => item.origin.name === "Jimma University" && item.destination.name === "Merkato");
  if (!route) throw new Error("Jimma University to Merkato route missing");
  const waitingBefore = route.waiting;

  const mine = MyQueueResponse.parse(await api("/queue/me", behindToken, "GET"));
  if (mine.position === null) throw new Error("passenger behind the leader is not waiting");
  const nextPosition = mine.position - 1;

  const positionTab1 = waitForEvent(behind, "queue:update", (payload: QueueUpdatePayload) => payload.position === nextPosition, timeoutMs);
  const positionTab2 = waitForEvent(behindTab, "queue:update", (payload: QueueUpdatePayload) => payload.position === nextPosition, timeoutMs);
  const demandOnLeave = waitForEvent(
    driver,
    "demand:update",
    (payload: DemandUpdatePayload) => payload.routeId === route.id && payload.waiting === waitingBefore - 1,
    timeoutMs,
  );
  const aheadDemand = hold(waitForEvent(ahead, "demand:update", (payload: DemandUpdatePayload) => payload.routeId === route.id, timeoutMs));
  const leaveEvents = hold(Promise.all([positionTab1, positionTab2, demandOnLeave]));

  await api("/queue/leave", aheadToken, "POST");

  const [tab1Payload, tab2Payload, leaveDemand] = await leaveEvents;
  const aheadSawLeave = await aheadDemand.then(() => true).catch(() => false);
  report("position change when another passenger leaves", tab1Payload.position === nextPosition);
  report("second tab receives the same queue:update", tab2Payload.position === nextPosition && tab2Payload.entryId === tab1Payload.entryId);
  report("driver demand:update on leave", leaveDemand.waiting === waitingBefore - 1);
  example("queue:update", tab1Payload);
  example("demand:update", leaveDemand);
  if (!aheadSawLeave) {
    console.log("note: the leaving passenger did not see their own demand:update before leaving the room");
  }

  let leakedDemand: DemandUpdatePayload | null = null;
  const watchLeak = (payload: DemandUpdatePayload) => {
    if (payload.routeId === route.id) leakedDemand = payload;
  };
  ahead.on("demand:update", watchLeak);

  behindTab.disconnect();
  const reconnected = openSocket(behindToken);
  const restored = hold(
    waitForEvent(
      reconnected,
      "queue:update",
      (payload: QueueUpdatePayload) => payload.status === "WAITING" && payload.position === nextPosition,
      timeoutMs,
    ),
  );

  const demandOnJoin = hold(
    waitForEvent(
      driver,
      "demand:update",
      (payload: DemandUpdatePayload) => payload.routeId === route.id && payload.waiting === leaveDemand.waiting + 1,
      timeoutMs,
    ),
  );
  await api("/queue/join", joinerToken, "POST", { routeId: route.id, assistance: "NONE" });
  const joinDemand = await demandOnJoin;
  report("driver demand:update on join", joinDemand.waiting === leaveDemand.waiting + 1);

  const reconnectPayload = await restored;
  report("reconnect delivers current queue state", reconnectPayload.position === nextPosition && reconnectPayload.status === "WAITING");
  example("queue:update", reconnectPayload);

  const started = TripResponse.parse(await api("/driver/trips/start", driverToken, "POST", { routeId: route.id }));
  const calledQueue = waitForEvent(behind, "queue:update", (payload: QueueUpdatePayload) => payload.status === "CALLED", timeoutMs);
  const calledNote = waitForEvent(behind, "notification:new", (payload: NotificationNewPayload) => payload.type === "QUEUE_CALLED", timeoutMs);
  const tripUpdate = waitForEvent(driver, "trip:update", (payload: TripUpdatePayload) => payload.status === "LOADING" && payload.seatsUsed === 1, timeoutMs);
  const callEvents = hold(Promise.all([calledQueue, calledNote, tripUpdate]));

  const called = CallPassengersResponse.parse(await api(`/driver/trips/${started.trip.id}/call`, driverToken, "POST", { count: 1 }));
  if (called.called.length !== 1) throw new Error("expected exactly one called passenger");

  const [queuePayload, notePayload, tripPayload] = await callEvents;
  report("notification:new on call", notePayload.type === "QUEUE_CALLED");
  report("queue:update on call", queuePayload.status === "CALLED" && queuePayload.position === null && queuePayload.taxiPlate !== null);
  report("trip:update to the driver", tripPayload.tripId === started.trip.id && tripPayload.seatsUsed === 1);
  example("notification:new", notePayload);
  example("queue:update", queuePayload);
  example("trip:update", tripPayload);

  ahead.off("demand:update", watchLeak);
  report("no events after leaving the room", leakedDemand === null, leakedDemand ? JSON.stringify(leakedDemand) : undefined);

  driver.close();
  ahead.close();
  behind.close();
  behindTab.close();
  reconnected.close();
}

main()
  .then(() => {
    if (failures.length > 0) process.exit(1);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
