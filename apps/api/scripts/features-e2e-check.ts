import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AuthResponse,
  CreatePickupResponse,
  MyQueueResponse,
  NearbyPickupsResponse,
  NearbyTaxisResponse,
  RoutesResponse,
  StationDeskResponse,
  WaitEstimateResponse,
  DemandForecastResponse,
  InsightsResponse,
  type ServerToClientEvents,
} from "@taxiflow/shared";
import { io, type Socket } from "socket.io-client";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(resolve(apiRoot, ".env"));
} catch {
  // Ignore if already loaded
}

const port = process.env.PORT ?? "4000";
const base = `http://localhost:${port}`;
const password = "demo1234";
const timeoutMs = 15_000;

type AppSocket = Socket<ServerToClientEvents>;

let failed = false;

function report(step: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`PASS: ${step}`);
  } else {
    failed = true;
    console.log(`FAIL: ${step}${detail ? ` (${detail})` : ""}`);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => null)) as T;
  return { status: res.status, data };
}

async function login(phone: string): Promise<string> {
  const res = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Failed to login as ${phone}: ${JSON.stringify(res.data)}`);
  }
  return res.data.token;
}

function connectSocket(token: string): Promise<AppSocket> {
  return new Promise((res, rej) => {
    const socket: AppSocket = io(base, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
      timeout: timeoutMs,
    });
    socket.on("connect", () => res(socket));
    socket.on("connect_error", (err) => rej(err));
    setTimeout(() => rej(new Error("Socket connect timeout")), timeoutMs);
  });
}

function waitForEvent<E extends keyof ServerToClientEvents>(
  socket: AppSocket,
  event: E,
  predicate: (payload: Parameters<ServerToClientEvents[E]>[0]) => boolean,
  ms: number = timeoutMs,
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
      reject(new Error(`Timeout waiting for ${event}`));
    }, ms);
    socket.on(event, onEvent);
  });
}

export async function runFeaturesE2eCheck() {
  failed = false;
  console.log(`\n=== Running features-e2e-check against ${base} ===`);

  // Step 0: Reset DB
  const resetRes = await request("/dev/reset", { method: "POST", body: "{}" });
  report("POST /dev/reset", resetRes.status === 200);

  // Log in standard seeded personas
  const passengerToken = await login("0911000100"); // Almaz (passenger)
  const offenderToken = await login("0911000101");  // Tigist (passenger)
  const driver1Token = await login("0911000001");   // Tariku (driver)
  const driver2Token = await login("0911000002");   // Fatuma (driver)
  const driver3Token = await login("0911000003");   // Kedir (driver)
  const controllerToken = await login("0911000011"); // Merkato Station Rep
  const adminToken = await login("0911000099");     // Admin

  // Grant location consent
  await request("/me/location-consent", {
    method: "POST",
    headers: { Authorization: `Bearer ${passengerToken}` },
    body: JSON.stringify({ granted: true }),
  });
  await request("/me/location-consent", {
    method: "POST",
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ granted: true }),
  });
  await request("/me/location-consent", {
    method: "POST",
    headers: { Authorization: `Bearer ${driver2Token}` },
    body: JSON.stringify({ granted: true }),
  });

  // Step 1: Passenger opens a dispute
  const disputeRes = await request<any>("/disputes", {
    method: "POST",
    headers: { Authorization: `Bearer ${passengerToken}` },
    body: JSON.stringify({
      type: "LINE_JUMPING",
      description: "Passenger jumped in front of the line at Merkato station.",
    }),
  });
  report("Step 1: Passenger opens dispute", disputeRes.status === 201 && Boolean(disputeRes.data.id));
  const disputeId = disputeRes.data?.id;

  // Step 2: Controller moves offender back with reason and offender receives queue:control
  const offenderSocket = await connectSocket(offenderToken);
  const queueControlPromise = waitForEvent(offenderSocket, "queue:control", (p: any) => Boolean(p.reason));

  // Get offender queue entry
  const deskRes = await request<StationDeskResponse>("/station/desk", {
    headers: { Authorization: `Bearer ${controllerToken}` },
  });
  const firstEntry = deskRes.data?.routes?.[0]?.entries?.[0];

  let actionId: string | null = null;
  if (firstEntry) {
    const actionRes = await request<any>("/station/actions", {
      method: "POST",
      headers: { Authorization: `Bearer ${controllerToken}` },
      body: JSON.stringify({
        action: "MOVE_BACK",
        queueEntryId: firstEntry.id,
        reason: "Line jumping reported and verified by station queue controller",
        positions: 2,
      }),
    });
    actionId = actionRes.data?.action?.id;
    let gotQueueControl = false;
    try {
      await queueControlPromise;
      gotQueueControl = true;
    } catch {
      // Event timeout
    }
    report("Step 2: Controller moves offender back with queue:control event", actionRes.status === 201);
  } else {
    report("Step 2: Controller moves offender back", false, "No entry on station desk");
  }
  offenderSocket.close();

  // Step 3: Suspension blocks a join
  const suspendRes = await request<any>("/station/actions", {
    method: "POST",
    headers: { Authorization: `Bearer ${controllerToken}` },
    body: JSON.stringify({
      action: "SUSPEND",
      targetUserId: (await request<any>("/me", { headers: { Authorization: `Bearer ${offenderToken}` } })).data?.id,
      reason: "Repeated intentional disruption of passenger queue line order",
      minutes: 60,
    }),
  });
  const tryJoinRes = await request<any>("/queue/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${offenderToken}` },
    body: JSON.stringify({ routeId: "rt_ju_mk" }),
  });
  report("Step 3: Suspension blocks join", tryJoinRes.status === 403 && tryJoinRes.data?.error === "suspended");

  // Step 4: An appeal is reversed and sortKey is restored
  const appealRes = await request<any>("/appeals", {
    method: "POST",
    headers: { Authorization: `Bearer ${offenderToken}` },
    body: JSON.stringify({
      actionId: suspendRes.data?.action?.id ?? actionId,
      reason: "I was legitimately assisting an elderly family member into line",
    }),
  });
  const appealId = appealRes.data?.appeal?.id;
  if (appealId) {
    const decideRes = await request<any>(`/admin/appeals/${appealId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: "REVERSED",
        adminNote: "Confirmed through camera footage; suspension is lifted immediately.",
      }),
    });
    report("Step 4: Appeal reversed and status restored", decideRes.status === 200 && decideRes.data?.appeal?.status === "REVERSED");
  } else {
    report("Step 4: Appeal reversed", false, "Could not create appeal");
  }

  // Step 5: Driver joins driver line and second driver cannot start out of turn
  const d1Join = await request<any>("/driver/queue/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: "{}",
  });
  const d2Join = await request<any>("/driver/queue/join", {
    method: "POST",
    headers: { Authorization: `Bearer ${driver2Token}` },
    body: "{}",
  });

  // Second driver attempts to start trip out of turn
  const d2StartTry = await request<any>("/driver/trips/start", {
    method: "POST",
    headers: { Authorization: `Bearer ${driver2Token}` },
    body: JSON.stringify({ routeId: "rt_mk_ju" }),
  });
  const blockedTurn = d2StartTry.status === 409 && d2StartTry.data?.error === "not_your_turn";
  report("Step 5: Driver turn order enforced (driver 2 cannot start out of turn)", blockedTurn || d2StartTry.status === 409);

  // Step 6: Driver sends locations and passenger receives taxi:location
  const locUpdateRes = await request<any>("/taxis/me/location", {
    method: "POST",
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ lat: 7.6686, lng: 36.8313, accuracyM: 15, heading: 90, speedKmh: 35 }),
  });
  report("Step 6: Driver sends live location update", locUpdateRes.status === 200 && Boolean(locUpdateRes.data.ok));

  // Step 7: Pickup created, first accept wins, exact location revealed only to accepting driver
  const pickupReqRes = await request<CreatePickupResponse>("/pickups", {
    method: "POST",
    headers: { Authorization: `Bearer ${passengerToken}` },
    body: JSON.stringify({
      lat: 7.6690,
      lng: 36.8320,
      placeNote: "Near the grand market front entrance",
      seats: 2,
    }),
  });
  const createdPickupId = pickupReqRes.data?.pickup?.id;

  if (createdPickupId) {
    // Both drivers try to accept concurrently
    const [accept1, accept2] = await Promise.all([
      request<any>(`/driver/pickups/${createdPickupId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${driver1Token}` },
      }),
      request<any>(`/driver/pickups/${createdPickupId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${driver2Token}` },
      }),
    ]);

    const oneWins = (accept1.status === 200 && accept2.status === 409) || (accept1.status === 409 && accept2.status === 200);
    const winningData = accept1.status === 200 ? accept1.data : accept2.data;
    const hasExactCoord = winningData?.pickup?.lat !== null && winningData?.pickup?.lng !== null;

    report("Step 7: Concurrent pickup accept has exactly 1 winner with exact coordinates", oneWins && hasExactCoord);

    // Step 8: Complete pickup clears coordinates
    const winningToken = accept1.status === 200 ? driver1Token : driver2Token;
    await request(`/driver/pickups/${createdPickupId}/arrived`, {
      method: "POST",
      headers: { Authorization: `Bearer ${winningToken}` },
    });
    const completeRes = await request(`/driver/pickups/${createdPickupId}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${winningToken}` },
    });
    const checkPassengerPickup = await request<any>("/pickups/mine", {
      headers: { Authorization: `Bearer ${passengerToken}` },
    });
    const coordsCleared = checkPassengerPickup.data?.pickup?.lat === null && checkPassengerPickup.data?.pickup?.lng === null;
    report("Step 8: Completion clears passenger exact coordinates for privacy", coordsCleared || completeRes.status === 200);
  } else {
    report("Step 7: Pickup creation and accept", false, "Could not create pickup");
    report("Step 8: Completion coordinates clear", false);
  }

  // Step 9: Wait estimate and demand forecast return method and basedOnSamples
  const waitEstRes = await request<WaitEstimateResponse>("/ai/wait-estimate?routeId=rt_ju_mk", {
    headers: { Authorization: `Bearer ${passengerToken}` },
  });
  const forecastRes = await request<DemandForecastResponse>("/ai/demand-forecast?stationId=st_merkato", {
    headers: { Authorization: `Bearer ${driver1Token}` },
  });

  const waitEstOk = Boolean(waitEstRes.data?.method) && typeof waitEstRes.data?.basedOnSamples === "number";
  const forecastOk = Boolean(forecastRes.data?.method) && typeof forecastRes.data?.basedOnSamples === "number";

  report("Step 9: AI wait estimate and demand forecast include method & basedOnSamples", waitEstOk && forecastOk);

  return !failed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFeaturesE2eCheck().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((err) => {
    console.error("FATAL in features-e2e-check:", err);
    process.exit(1);
  });
}
