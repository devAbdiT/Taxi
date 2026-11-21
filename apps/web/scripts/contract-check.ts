/**
 * Calls every endpoint the web app uses and parses the body with the Zod schema
 * from @taxiflow/shared. The API must already be running and DEMO_MODE must be on,
 * because the script resets the seed at the start and again at the end.
 *
 *   node --experimental-strip-types scripts/contract-check.ts
 */
import {
  AdminReportsResponse,
  AdminStatsResponse,
  ArriveTripResponse,
  AuthResponse,
  CallPassengersResponse,
  CreateContractResponse,
  CreateRatingResponse,
  CreateReportResponse,
  DevResetResponse,
  DevSmsResponse,
  DriverArriveResponse,
  DriverDemandResponse,
  DriverMeResponse,
  DriverReportsResponse,
  EntryActionResponse,
  JoinQueueResponse,
  LeaveQueueResponse,
  MarkNotificationsReadResponse,
  MeResponse,
  MyQueueResponse,
  MyTripsResponse,
  NotificationsResponse,
  PublicPulseResponse,
  RemoveEntryResponse,
  RespondReportResponse,
  RoutesResponse,
  StationQueuesResponse,
  StationsResponse,
  TripResponse,
  UpdateReportResponse,
} from "@taxiflow/shared";

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PASSWORD = "demo1234";

type Schema = {
  safeParse(data: unknown):
    | { success: true; data: unknown }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
};

const results: { name: string; ok: boolean; detail: string }[] = [];

function pass(name: string) {
  results.push({ name, ok: true, detail: "" });
  console.log(`PASS ${name}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL ${name}: ${detail}`);
}

async function call<T>(
  name: string,
  token: string | null,
  method: string,
  path: string,
  body: unknown,
  schema: Schema,
  expected: number,
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    fail(name, error instanceof Error ? error.message : "network error");
    return null;
  }
  const data: unknown = await res.json().catch(() => null);
  if (res.status !== expected) {
    const code = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "";
    fail(name, `HTTP ${res.status}${code ? ` ${code}` : ""}`);
    return null;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(name, issue ? `${issue.path.join(".") || "(root)"}: ${issue.message}` : "schema mismatch");
    return null;
  }
  pass(name);
  return parsed.data as T;
}

async function login(phone: string, label: string): Promise<string | null> {
  const auth = await call<AuthResponse>(`POST /auth/login ${label}`, null, "POST", "/auth/login", { phone, password: PASSWORD }, AuthResponse, 200);
  return auth?.token ?? null;
}

async function main() {
  console.log(`API ${API}`);
  await call("POST /dev/reset (start)", null, "POST", "/dev/reset", {}, DevResetResponse, 200);

  await call("GET /public/pulse", null, "GET", "/public/pulse", undefined, PublicPulseResponse, 200);

  const stamp = String(Date.now()).slice(-6);
  await call(
    "POST /auth/register",
    null,
    "POST",
    "/auth/register",
    { name: "Contract Check", phone: `0918${stamp}`, password: PASSWORD, language: "en" },
    AuthResponse,
    201,
  );

  const passenger = await login("0911000100", "passenger");
  const driver = await login("0911000002", "driver");
  const station = await login("0911000011", "station");
  const admin = await login("0911000099", "admin");

  if (passenger) {
    await call("GET /me passenger", passenger, "GET", "/me", undefined, MeResponse, 200);
    await call("GET /stations", passenger, "GET", "/stations", undefined, StationsResponse, 200);
    const routes = await call<RoutesResponse>("GET /routes", passenger, "GET", "/routes", undefined, RoutesResponse, 200);
    await call("GET /queue/me", passenger, "GET", "/queue/me", undefined, MyQueueResponse, 200);
    await call("GET /trips/mine passenger", passenger, "GET", "/trips/mine", undefined, MyTripsResponse, 200);
    await call("GET /notifications passenger", passenger, "GET", "/notifications", undefined, NotificationsResponse, 200);
    await call("POST /notifications/read", passenger, "POST", "/notifications/read", {}, MarkNotificationsReadResponse, 200);
    await call(
      "POST /contracts",
      passenger,
      "POST",
      "/contracts",
      { type: "SCHOOL", pickup: "Area A", destination: "Area B school", schedule: "Weekdays 7:30", passengerCount: 18 },
      CreateContractResponse,
      201,
    );
    await call(
      "POST /reports",
      passenger,
      "POST",
      "/reports",
      { type: "OTHER", description: "Contract check report from the demo passenger." },
      CreateReportResponse,
      201,
    );
    const routeId = routes?.routes[0]?.id;
    if (routeId) {
      const joined = await call<JoinQueueResponse>(
        "POST /queue/join",
        passenger,
        "POST",
        "/queue/join",
        { routeId, assistance: "ELDERLY" },
        JoinQueueResponse,
        201,
      );
      if (joined) await call("POST /queue/leave", passenger, "POST", "/queue/leave", {}, LeaveQueueResponse, 200);
    } else fail("POST /queue/join", "no route to join");
  }

  let tripId: string | null = null;
  if (driver) {
    await call("GET /driver/me", driver, "GET", "/driver/me", undefined, DriverMeResponse, 200);
    const demand = await call<DriverDemandResponse>("GET /driver/demand", driver, "GET", "/driver/demand", undefined, DriverDemandResponse, 200);
    await call("GET /driver/reports", driver, "GET", "/driver/reports", undefined, DriverReportsResponse, 200);
    const stations = await call<StationsResponse>("GET /stations driver", driver, "GET", "/stations", undefined, StationsResponse, 200);
    const busiest = [...(demand?.routes ?? [])].sort((a, b) => b.waiting - a.waiting)[0];
    const origin = stations?.stations.find((item) => item.id === busiest?.origin.id) ?? stations?.stations[0];
    if (origin && busiest) {
      const arrived = await call<DriverArriveResponse>(
        "POST /driver/arrive",
        driver,
        "POST",
        "/driver/arrive",
        { stationId: origin.id },
        DriverArriveResponse,
        200,
      );
      if (arrived) {
        const started = await call<TripResponse>(
          "POST /driver/trips/start",
          driver,
          "POST",
          "/driver/trips/start",
          { routeId: busiest.id },
          TripResponse,
          201,
        );
        tripId = started?.trip.id ?? null;
        if (tripId) {
          await call("GET /driver/trips/:id", driver, "GET", `/driver/trips/${tripId}`, undefined, TripResponse, 200);
          const called = await call<CallPassengersResponse>(
            "POST /driver/trips/:id/call",
            driver,
            "POST",
            `/driver/trips/${tripId}/call`,
            { count: 2 },
            CallPassengersResponse,
            200,
          );
          const first = called?.called[0];
          const second = called?.called[1];
          if (first) {
            await call("POST /driver/entries/:id/board", driver, "POST", `/driver/entries/${first.id}/board`, {}, EntryActionResponse, 200);
          } else fail("POST /driver/entries/:id/board", "nobody was called");
          if (second) {
            await call("POST /driver/entries/:id/no-show", driver, "POST", `/driver/entries/${second.id}/no-show`, {}, EntryActionResponse, 200);
          } else fail("POST /driver/entries/:id/no-show", "a second passenger was not called");
          const departed = await call<TripResponse>(
            "POST /driver/trips/:id/depart",
            driver,
            "POST",
            `/driver/trips/${tripId}/depart`,
            {},
            TripResponse,
            200,
          );
          if (departed) {
            await call<ArriveTripResponse>(
              "POST /driver/trips/:id/arrive",
              driver,
              "POST",
              `/driver/trips/${tripId}/arrive`,
              {},
              ArriveTripResponse,
              200,
            );
          }
        }
      }
    } else fail("POST /driver/arrive", "no station or route");
  }

  const sms = await call<DevSmsResponse>("GET /dev/sms", null, "GET", "/dev/sms", undefined, DevSmsResponse, 200);
  const riderPhone = sms?.messages.find((message) => message.text.includes("Please rate"))?.to;
  if (riderPhone && tripId) {
    const rider = await login(riderPhone, "boarded passenger");
    if (rider) {
      const trips = await call<MyTripsResponse>("GET /trips/mine boarded", rider, "GET", "/trips/mine", undefined, MyTripsResponse, 200);
      const rateable = trips?.trips.find((trip) => trip.canRate);
      if (rateable) {
        await call(
          "POST /ratings",
          rider,
          "POST",
          "/ratings",
          { tripId: rateable.tripId, stars: 5, tags: ["PUNCTUALITY", "SAFETY"] },
          CreateRatingResponse,
          201,
        );
        const filed = await call<CreateReportResponse>(
          "POST /reports trip",
          rider,
          "POST",
          "/reports",
          { type: "OVERCHARGING", description: "Contract check report about this trip.", tripId: rateable.tripId },
          CreateReportResponse,
          201,
        );
        if (driver && filed) {
          await call(
            "POST /driver/reports/:id/respond",
            driver,
            "POST",
            `/driver/reports/${filed.report.id}/respond`,
            { response: "The fare on this route is the posted fare." },
            RespondReportResponse,
            200,
          );
          if (admin) {
            await call("GET /admin/stats", admin, "GET", "/admin/stats", undefined, AdminStatsResponse, 200);
            await call("GET /admin/reports", admin, "GET", "/admin/reports", undefined, AdminReportsResponse, 200);
            await call(
              "PATCH /admin/reports/:id",
              admin,
              "PATCH",
              `/admin/reports/${filed.report.id}`,
              { status: "IN_REVIEW" },
              UpdateReportResponse,
              200,
            );
          }
        }
      } else fail("POST /ratings", "boarded passenger has no rateable trip");
    }
  } else if (!riderPhone) fail("POST /ratings", "SMS log had no passenger phone");

  if (station) {
    const queues = await call<StationQueuesResponse>("GET /station/queues", station, "GET", "/station/queues", undefined, StationQueuesResponse, 200);
    const entry = queues?.routes.flatMap((route) => route.entries).find((item) => item.status === "WAITING");
    if (entry) {
      await call("POST /station/entries/:id/remove", station, "POST", `/station/entries/${entry.id}/remove`, {}, RemoveEntryResponse, 200);
    } else fail("POST /station/entries/:id/remove", "no waiting passenger at this station");
  }

  if (driver) {
    const me = await call<DriverMeResponse>("GET /driver/me after trip", driver, "GET", "/driver/me", undefined, DriverMeResponse, 200);
    const here = me?.taxi.currentStation?.id;
    const routes = await call<RoutesResponse>("GET /routes after trip", driver, "GET", "/routes", undefined, RoutesResponse, 200);
    const leaving = routes?.routes.find((route) => route.origin.id === here);
    if (leaving) {
      const started = await call<TripResponse>(
        "POST /driver/trips/start cancel",
        driver,
        "POST",
        "/driver/trips/start",
        { routeId: leaving.id },
        TripResponse,
        201,
      );
      if (started) {
        await call("POST /driver/trips/:id/cancel", driver, "POST", `/driver/trips/${started.trip.id}/cancel`, {}, TripResponse, 200);
      }
    } else fail("POST /driver/trips/:id/cancel", "no route leaves the taxi's station");
  }

  if (admin && !results.some((item) => item.name === "GET /admin/stats")) {
    await call("GET /admin/stats", admin, "GET", "/admin/stats", undefined, AdminStatsResponse, 200);
    await call("GET /admin/reports", admin, "GET", "/admin/reports", undefined, AdminReportsResponse, 200);
  }

  await call("POST /dev/reset (end)", null, "POST", "/dev/reset", {}, DevResetResponse, 200);

  const failed = results.filter((item) => !item.ok);
  console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
