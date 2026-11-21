import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/db.js";
import { env } from "../src/lib/env.js";
import { bearer, createPassenger, createRoutes, createUser, resetDatabase } from "./helpers.js";

const app = createApp();

let routes: Awaited<ReturnType<typeof createRoutes>>;

beforeEach(async () => {
  await resetDatabase();
  routes = await createRoutes();
});

afterEach(() => {
  env.PRIORITY_ENABLED = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const join = (token: string, body: object) => request(app).post("/queue/join").set(bearer(token)).send(body);
const me = (token: string) => request(app).get("/queue/me").set(bearer(token));
const leave = (token: string) => request(app).post("/queue/leave").set(bearer(token));

/** Joins passengers one after another, so their joinedAt times are in this order. */
async function joinInOrder(assistances: string[], routeId = routes.bToA.id) {
  const passengers = [];
  for (const [index, assistance] of assistances.entries()) {
    const passenger = await createPassenger(`Passenger ${index + 1}`);
    const res = await join(passenger.token, { routeId, assistance });
    expect(res.status).toBe(201);
    passengers.push(passenger);
  }
  return passengers;
}

async function positions(passengers: { token: string }[]) {
  const result = [];
  for (const passenger of passengers) {
    result.push((await me(passenger.token)).body.position);
  }
  return result;
}

describe("POST /queue/join", () => {
  it("returns 201 with the entry and a 1-based position", async () => {
    const passenger = await createPassenger();
    const res = await join(passenger.token, { routeId: routes.bToA.id });

    expect(res.status).toBe(201);
    expect(res.body.position).toBe(1);
    expect(res.body.entry).toMatchObject({
      status: "WAITING",
      assistance: "NONE",
      isPriority: false,
      tripId: null,
      route: { id: routes.bToA.id, origin: { name: "Area B" }, destination: { name: "Area A" } },
    });
  });

  it("orders passengers by join time", async () => {
    const passengers = await joinInOrder(["NONE", "NONE", "NONE"]);
    expect(await positions(passengers)).toEqual([1, 2, 3]);
  });

  it("puts a priority passenger who joined later ahead of normal passengers", async () => {
    const [first, second, elderly] = await joinInOrder(["NONE", "NONE", "ELDERLY"]);
    expect(await positions([elderly!, first!, second!])).toEqual([1, 2, 3]);
  });

  it("orders priority passengers among themselves by join time", async () => {
    const [normal, pregnant, disability] = await joinInOrder(["NONE", "PREGNANT", "DISABILITY"]);
    expect(await positions([pregnant!, disability!, normal!])).toEqual([1, 2, 3]);
  });

  it("treats every assistance type except NONE as priority", async () => {
    for (const assistance of ["DISABILITY", "ELDERLY", "PREGNANT", "MOBILITY", "OTHER"]) {
      const passenger = await createPassenger();
      const res = await join(passenger.token, { routeId: routes.aToB.id, assistance });
      expect(res.body.entry.isPriority, assistance).toBe(true);
    }
  });

  it("keeps the queues of different routes separate", async () => {
    await joinInOrder(["NONE", "NONE"], routes.bToA.id);
    const [other] = await joinInOrder(["NONE"], routes.aToB.id);
    expect(await positions([other!])).toEqual([1]);
  });

  it("ignores assistance for ordering when PRIORITY_ENABLED is false", async () => {
    env.PRIORITY_ENABLED = false;
    const [first, elderly] = await joinInOrder(["NONE", "ELDERLY"]);

    const elderlyEntry = (await me(elderly!.token)).body.entry;
    expect(elderlyEntry).toMatchObject({ assistance: "ELDERLY", isPriority: false });
    expect(await positions([first!, elderly!])).toEqual([1, 2]);
  });

  it("returns 409 already_in_queue on a second join, on the same or another route", async () => {
    const passenger = await createPassenger();
    expect((await join(passenger.token, { routeId: routes.bToA.id })).status).toBe(201);

    for (const routeId of [routes.bToA.id, routes.aToB.id]) {
      const res = await join(passenger.token, { routeId });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "already_in_queue", message: expect.any(String) });
    }
    expect(await prisma.queueEntry.count({ where: { passengerId: passenger.user.id } })).toBe(1);
  });

  it("returns 409 already_in_queue while the passenger is CALLED", async () => {
    const passenger = await createPassenger();
    const { body } = await join(passenger.token, { routeId: routes.bToA.id });
    await prisma.queueEntry.update({ where: { id: body.entry.id }, data: { status: "CALLED" } });

    const res = await join(passenger.token, { routeId: routes.aToB.id });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("already_in_queue");
  });

  it("creates only one entry when two joins arrive at the same moment", async () => {
    const passenger = await createPassenger();
    const results = await Promise.all([
      join(passenger.token, { routeId: routes.bToA.id }),
      join(passenger.token, { routeId: routes.aToB.id }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(results.find((res) => res.status === 409)?.body.error).toBe("already_in_queue");
    expect(await prisma.queueEntry.count({ where: { passengerId: passenger.user.id } })).toBe(1);
  });

  it("returns 404 route_not_found for an unknown route", async () => {
    const passenger = await createPassenger();
    const res = await join(passenger.token, { routeId: "no-such-route" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("route_not_found");
  });

  it("returns 400 validation_error for a bad body", async () => {
    const passenger = await createPassenger();
    const res = await join(passenger.token, { routeId: routes.bToA.id, assistance: "VIP" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("rejects roles other than PASSENGER and requests without a token", async () => {
    const driver = await createUser("DRIVER");
    expect((await join(driver.token, { routeId: routes.bToA.id })).status).toBe(403);
    expect((await request(app).post("/queue/join").send({ routeId: routes.bToA.id })).status).toBe(401);
  });

  it("rate-limits joins to 10 per passenger per minute", async () => {
    const passenger = await createPassenger();
    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await join(passenger.token, { routeId: routes.bToA.id });
      expect(res.status, `attempt ${attempt}`).toBe(attempt === 1 ? 201 : 409);
    }
    const blocked = await join(passenger.token, { routeId: routes.bToA.id });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");

    const other = await createPassenger();
    expect((await join(other.token, { routeId: routes.bToA.id })).status).toBe(201);
  });
});

describe("GET /queue/me", () => {
  it("returns nulls when the passenger is not in a queue", async () => {
    const passenger = await createPassenger();
    const res = await me(passenger.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ entry: null, position: null, taxiPlate: null });
  });

  it("returns the position while WAITING", async () => {
    const [, second] = await joinInOrder(["NONE", "NONE"]);
    const res = await me(second!.token);
    expect(res.body).toMatchObject({ entry: { status: "WAITING" }, position: 2, taxiPlate: null });
  });

  it("returns the taxi plate and no position while CALLED", async () => {
    const driver = await createUser("DRIVER");
    const taxi = await prisma.taxi.create({
      data: { plate: "3-AA-99999", capacity: 14, driverId: driver.user.id, status: "LOADING", currentStationId: routes.areaB.id },
    });
    const trip = await prisma.trip.create({ data: { taxiId: taxi.id, routeId: routes.bToA.id } });
    const [passenger] = await joinInOrder(["NONE"]);
    await prisma.queueEntry.updateMany({
      where: { passengerId: passenger!.user.id },
      data: { status: "CALLED", calledAt: new Date(), tripId: trip.id },
    });

    const res = await me(passenger!.token);
    expect(res.body).toMatchObject({ entry: { status: "CALLED", tripId: trip.id }, position: null, taxiPlate: "3-AA-99999" });
  });
});

describe("POST /queue/leave", () => {
  it("cancels a WAITING entry and moves everyone behind up one place", async () => {
    const [first, second, third] = await joinInOrder(["NONE", "NONE", "NONE"]);

    const res = await leave(first!.token);
    expect(res.status).toBe(200);
    expect(res.body.entry.status).toBe("CANCELLED");

    expect((await me(first!.token)).body.entry).toBeNull();
    expect(await positions([second!, third!])).toEqual([1, 2]);
  });

  it("cancels a CALLED entry", async () => {
    const [passenger] = await joinInOrder(["NONE"]);
    await prisma.queueEntry.updateMany({ where: { passengerId: passenger!.user.id }, data: { status: "CALLED" } });

    const res = await leave(passenger!.token);
    expect(res.status).toBe(200);
    expect(res.body.entry.status).toBe("CANCELLED");
  });

  it("returns 404 not_in_queue when there is no active entry", async () => {
    const passenger = await createPassenger();
    const res = await leave(passenger.token);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_in_queue");
  });

  it("lets the passenger join again after leaving, at the back of the queue", async () => {
    const [leaver, stayer] = await joinInOrder(["NONE", "NONE"]);
    await leave(leaver!.token);

    const rejoin = await join(leaver!.token, { routeId: routes.bToA.id });
    expect(rejoin.status).toBe(201);
    expect(rejoin.body.position).toBe(2);
    expect(await positions([stayer!])).toEqual([1]);
  });
});
