import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/db.js";
import { bearer, createPassenger, createRoutes, createUser, resetDatabase } from "./helpers.js";

const app = createApp();

let routes: Awaited<ReturnType<typeof createRoutes>>;

beforeEach(async () => {
  await resetDatabase();
  routes = await createRoutes();
});

afterAll(() => prisma.$disconnect());

async function createDriver(name: string, plate: string, capacity: number, stationId?: string) {
  const driver = await createUser("DRIVER", name);
  const taxi = await prisma.taxi.create({
    data: {
      plate,
      capacity,
      driverId: driver.user.id,
      status: stationId ? "AT_STATION" : "OFFLINE",
      currentStationId: stationId ?? null,
    },
  });
  return { ...driver, taxi };
}

const NAMES = ["Bekele", "Chaltu", "Dawit", "Eden", "Fikru", "Genet"];

/** Passengers waiting on a route, joined in order. The last one is priority and joined last. */
async function waitingPassengers(routeId: string, count: number) {
  const passengers = [];
  for (let index = 0; index < count; index++) {
    const passenger = await createPassenger(index === count - 1 ? "Almaz Tadesse" : NAMES[index]);
    const entry = await prisma.queueEntry.create({
      data: {
        passengerId: passenger.user.id,
        routeId,
        isPriority: index === count - 1,
        assistance: index === count - 1 ? "ELDERLY" : "NONE",
        joinedAt: new Date(Date.now() - (count - index) * 60_000),
      },
    });
    passengers.push({ ...passenger, entryId: entry.id, joinedAt: entry.joinedAt });
  }
  return passengers;
}

const post = (token: string, path: string, body?: object) =>
  request(app).post(path).set(bearer(token)).send(body ?? {});
const get = (token: string, path: string) => request(app).get(path).set(bearer(token));

describe("arrive, demand and start", () => {
  it("arrives from OFFLINE, highlights routes leaving that station, and rejects a second arrive", async () => {
    const driver = await createDriver("Driver", "3-AA-1", 14);
    await waitingPassengers(routes.bToA.id, 2);
    await waitingPassengers(routes.aToB.id, 1);

    const arrived = await post(driver.token, "/driver/arrive", { stationId: routes.areaB.id });
    expect(arrived.status).toBe(200);
    expect(arrived.body.taxi).toMatchObject({ status: "AT_STATION", currentStation: { id: routes.areaB.id } });

    const me = await get(driver.token, "/driver/me");
    expect(me.body).toMatchObject({ activeTrip: null, seatsUsed: 0, seatsLeft: 14 });

    const demand = await get(driver.token, "/driver/demand");
    expect(demand.body.returnSuggestion).toBeNull();
    expect(demand.body.routes.map((route: { origin: { name: string }; waiting: number }) => route.waiting)).toEqual([2, 1]);
    const highlighted = demand.body.routes.filter((route: { highlighted: boolean }) => route.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].origin.name).toBe("Area B");

    const again = await post(driver.token, "/driver/arrive", { stationId: routes.areaA.id });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("invalid_taxi_status");
  });

  it("starts only a route leaving the current station, and then suggests the reverse route", async () => {
    const driver = await createDriver("Driver", "3-AA-1", 14, routes.areaB.id);
    await waitingPassengers(routes.aToB.id, 4);

    const wrong = await post(driver.token, "/driver/trips/start", { routeId: routes.aToB.id });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error).toBe("route_not_from_current_station");

    const started = await post(driver.token, "/driver/trips/start", { routeId: routes.bToA.id });
    expect(started.status).toBe(201);
    expect(started.body.trip).toMatchObject({ status: "LOADING", seatsUsed: 0, seatsLeft: 14 });

    const second = await post(driver.token, "/driver/trips/start", { routeId: routes.bToA.id });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("invalid_taxi_status");

    const demand = await get(driver.token, "/driver/demand");
    expect(demand.body.returnSuggestion).toMatchObject({
      route: { origin: { name: "Area A" }, destination: { name: "Area B" } },
      waiting: 4,
    });
    expect(demand.body.routes.every((route: { highlighted: boolean }) => route.highlighted === false)).toBe(true);

    await prisma.trip.update({ where: { id: started.body.trip.id }, data: { status: "DEPARTED" } });
    await prisma.taxi.update({ where: { id: driver.taxi.id }, data: { status: "AT_STATION", currentStationId: routes.areaB.id } });
    const blocked = await post(driver.token, "/driver/trips/start", { routeId: routes.bToA.id });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("active_trip_exists");
  });

  it("rejects arrive at an unknown station and a passenger token", async () => {
    const driver = await createDriver("Driver", "3-AA-1", 14);
    const passenger = await createPassenger();
    expect((await post(driver.token, "/driver/arrive", { stationId: "missing" })).body.error).toBe("station_not_found");
    expect((await get(passenger.token, "/driver/me")).status).toBe(403);
  });
});

describe("call", () => {
  it("calls in position order, never returns a phone number, and rejects a count above the seats left", async () => {
    const driver = await createDriver("Driver", "3-AA-1", 2, routes.areaB.id);
    const passengers = await waitingPassengers(routes.bToA.id, 3);
    const priority = passengers[2]!;
    await prisma.user.update({ where: { id: priority.user.id }, data: { phone: "0911222333", language: "am" } });

    const { body: started } = await post(driver.token, "/driver/trips/start", { routeId: routes.bToA.id });

    const tooMany = await post(driver.token, `/driver/trips/${started.trip.id}/call`, { count: 3 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error).toBe("not_enough_seats");
    expect(await prisma.queueEntry.count({ where: { status: "CALLED" } })).toBe(0);

    const called = await post(driver.token, `/driver/trips/${started.trip.id}/call`);
    expect(called.status).toBe(200);
    expect(called.body.called.map((entry: { firstName: string }) => entry.firstName)).toEqual(["Almaz", "Bekele"]);
    expect(called.body.trip.seatsLeft).toBe(0);
    expect(JSON.stringify(called.body)).not.toContain("0911222333");

    const note = await prisma.notification.findFirst({ where: { userId: priority.user.id } });
    expect(note).toMatchObject({ type: "QUEUE_CALLED", title: "ታክሲ ዝግጁ ነው" });
    expect(note?.body).toContain("3-AA-1");
    expect(note?.body).toContain("አሁን ይሳፈሩ");

    const full = await post(driver.token, `/driver/trips/${started.trip.id}/call`);
    expect(full.status).toBe(409);
    expect(full.body.error).toBe("not_enough_seats");
  });

  it("never gives the same passenger to two taxis calling at once", async () => {
    const first = await createDriver("One", "3-AA-1", 3, routes.areaB.id);
    const second = await createDriver("Two", "3-AA-2", 3, routes.areaB.id);
    await waitingPassengers(routes.bToA.id, 5);
    const tripA = (await post(first.token, "/driver/trips/start", { routeId: routes.bToA.id })).body.trip.id as string;
    const tripB = (await post(second.token, "/driver/trips/start", { routeId: routes.bToA.id })).body.trip.id as string;

    const [callA, callB] = await Promise.all([
      post(first.token, `/driver/trips/${tripA}/call`, { count: 3 }),
      post(second.token, `/driver/trips/${tripB}/call`, { count: 3 }),
    ]);
    expect(callA.status).toBe(200);
    expect(callB.status).toBe(200);

    const idsA = callA.body.called.map((entry: { id: string }) => entry.id) as string[];
    const idsB = callB.body.called.map((entry: { id: string }) => entry.id) as string[];
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
    expect(idsA.length + idsB.length).toBe(5);
    expect(await prisma.queueEntry.count({ where: { status: "WAITING" } })).toBe(0);
  });
});

describe("board, no-show, depart, cancel, arrive", () => {
  async function loadingTrip(capacity = 14) {
    const driver = await createDriver("Driver", "3-AA-1", capacity, routes.areaB.id);
    const passengers = await waitingPassengers(routes.bToA.id, 3);
    const tripId = (await post(driver.token, "/driver/trips/start", { routeId: routes.bToA.id })).body.trip.id as string;
    await post(driver.token, `/driver/trips/${tripId}/call`);
    return { driver, passengers, tripId };
  }

  it("lets the driver or the station rep board, and a no-show frees the seat for the next passenger", async () => {
    const { driver, passengers, tripId } = await loadingTrip(2);
    const rep = await createUser("STATION_REP", "Rep");
    await prisma.user.update({ where: { id: rep.user.id }, data: { stationId: routes.areaB.id } });
    const otherRep = await createUser("STATION_REP", "Other");
    await prisma.user.update({ where: { id: otherRep.user.id }, data: { stationId: routes.areaA.id } });

    const boarded = await post(driver.token, `/driver/entries/${passengers[2]!.entryId}/board`);
    expect(boarded.status).toBe(200);
    expect(boarded.body.entry).toMatchObject({ firstName: "Almaz", status: "BOARDED" });

    const wrongStation = await post(otherRep.token, `/driver/entries/${passengers[0]!.entryId}/no-show`);
    expect(wrongStation.status).toBe(403);
    expect(wrongStation.body.error).toBe("not_your_station");

    const noShow = await post(rep.token, `/driver/entries/${passengers[0]!.entryId}/no-show`);
    expect(noShow.status).toBe(200);
    expect(noShow.body.entry.status).toBe("NO_SHOW");
    expect(noShow.body.trip.seatsLeft).toBe(1);

    const next = await post(driver.token, `/driver/trips/${tripId}/call`);
    expect(next.status).toBe(200);
    expect(next.body.called.map((entry: { firstName: string }) => entry.firstName)).toEqual(["Chaltu"]);
  });

  it("refuses to depart with nobody boarded, then departs and turns the rest into no-shows", async () => {
    const { driver, tripId } = await loadingTrip();
    const blocked = await post(driver.token, `/driver/trips/${tripId}/depart`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("no_boarded_passengers");

    const called = (await get(driver.token, `/driver/trips/${tripId}`)).body.trip.entries as { id: string }[];
    await post(driver.token, `/driver/entries/${called[0]!.id}/board`);

    const departed = await post(driver.token, `/driver/trips/${tripId}/depart`);
    expect(departed.status).toBe(200);
    expect(departed.body.trip.status).toBe("DEPARTED");
    expect(departed.body.trip.entries.map((entry: { status: string }) => entry.status).sort()).toEqual(["BOARDED", "NO_SHOW", "NO_SHOW"]);

    const taxi = await prisma.taxi.findFirst({ where: { driverId: driver.user.id } });
    expect(taxi).toMatchObject({ status: "EN_ROUTE", currentStationId: null });
  });

  it("returns called passengers to the queue with their original join time", async () => {
    const { driver, passengers, tripId } = await loadingTrip();
    const before = await prisma.queueEntry.findUniqueOrThrow({ where: { id: passengers[2]!.entryId } });

    const cancelled = await post(driver.token, `/driver/trips/${tripId}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.trip.status).toBe("CANCELLED");
    expect(cancelled.body.trip.entries).toEqual([]);

    const after = await prisma.queueEntry.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("WAITING");
    expect(after.joinedAt.toISOString()).toBe(before.joinedAt.toISOString());
    expect(after.tripId).toBeNull();

    const me = await get(driver.token, "/driver/me");
    expect(me.body.taxi.status).toBe("AT_STATION");
    expect(me.body.activeTrip).toBeNull();

    const again = await post(driver.token, `/driver/trips/${tripId}/cancel`);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("trip_not_loading");
  });

  it("runs the whole loop: call, board, depart, arrive at the destination", async () => {
    const driver = await createDriver("Driver", "3-AA-1", 14, routes.areaB.id);
    const [passenger] = await waitingPassengers(routes.bToA.id, 1);
    const tripId = (await post(driver.token, "/driver/trips/start", { routeId: routes.bToA.id })).body.trip.id as string;
    const called = await post(driver.token, `/driver/trips/${tripId}/call`);
    await post(driver.token, `/driver/entries/${called.body.called[0].id}/board`);
    await post(driver.token, `/driver/trips/${tripId}/depart`);

    const arrived = await post(driver.token, `/driver/trips/${tripId}/arrive`);
    expect(arrived.status).toBe(200);
    expect(arrived.body.trip.status).toBe("COMPLETED");
    expect(arrived.body.taxi).toMatchObject({ status: "AT_STATION", currentStation: { name: "Area A" } });

    const note = await prisma.notification.findFirst({ where: { userId: passenger!.user.id, type: "TRIP_COMPLETED" } });
    expect(note?.body).toContain("rate");

    const early = await post(driver.token, `/driver/trips/${tripId}/arrive`);
    expect(early.body.error).toBe("trip_not_departed");
  });
});
