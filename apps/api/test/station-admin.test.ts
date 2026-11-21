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

describe("station queues and admin stats", () => {
  it("lists the rep's station in position order and removes without a phone number", async () => {
    const rep = await createUser("STATION_REP", "Tesfaye Rep");
    await prisma.user.update({ where: { id: rep.user.id }, data: { stationId: routes.areaB.id } });
    const first = await createPassenger("Bekele Desta");
    const priority = await createPassenger("Almaz Tadesse");
    await prisma.queueEntry.create({
      data: { passengerId: first.user.id, routeId: routes.bToA.id, joinedAt: new Date("2026-11-21T08:00:00.000Z") },
    });
    const priorityEntry = await prisma.queueEntry.create({
      data: {
        passengerId: priority.user.id,
        routeId: routes.bToA.id,
        isPriority: true,
        assistance: "ELDERLY",
        joinedAt: new Date("2026-11-21T08:30:00.000Z"),
      },
    });

    const queues = await request(app).get("/station/queues").set(bearer(rep.token));
    expect(queues.status).toBe(200);
    expect(JSON.stringify(queues.body)).not.toContain(first.user.phone);
    expect(JSON.stringify(queues.body)).not.toContain(priority.user.phone);
    const route = queues.body.routes.find((item: { route: { id: string } }) => item.route.id === routes.bToA.id);
    expect(route.waiting).toBe(2);
    expect(route.priorityWaiting).toBe(1);
    expect(route.entries.map((entry: { firstName: string; position: number }) => [entry.firstName, entry.position])).toEqual([
      ["Almaz", 1],
      ["Bekele", 2],
    ]);

    const removed = await request(app).post(`/station/entries/${priorityEntry.id}/remove`).set(bearer(rep.token));
    expect(removed.status).toBe(200);
    expect(removed.body.entry).toMatchObject({ status: "CANCELLED", position: null, firstName: "Almaz" });
    expect(JSON.stringify(removed.body)).not.toContain(priority.user.phone);

    const notes = await request(app).get("/notifications").set(bearer(priority.token));
    expect(notes.body.notifications[0].type).toBe("QUEUE_REMOVED");
  });

  it("reports a wait time and a B to A load factor after a completed trip", async () => {
    const driver = await createUser("DRIVER", "Kebede Hailu");
    const taxi = await prisma.taxi.create({
      data: { plate: "3-AA-10003", capacity: 4, driverId: driver.user.id, status: "AT_STATION", currentStationId: routes.areaA.id },
    });
    const trip = await prisma.trip.create({
      data: { taxiId: taxi.id, routeId: routes.bToA.id, status: "COMPLETED", arrivedAt: new Date() },
    });
    for (const name of ["Almaz Tadesse", "Bekele Desta"]) {
      const passenger = await createPassenger(name);
      await prisma.queueEntry.create({
        data: {
          passengerId: passenger.user.id,
          routeId: routes.bToA.id,
          status: "BOARDED",
          tripId: trip.id,
          joinedAt: new Date("2026-11-21T09:00:00.000Z"),
          calledAt: new Date("2026-11-21T09:09:00.000Z"),
          boardedAt: new Date("2026-11-21T09:10:00.000Z"),
        },
      });
    }
    const waiting = await createPassenger("Chaltu Bekele");
    await prisma.queueEntry.create({ data: { passengerId: waiting.user.id, routeId: routes.bToA.id } });

    const admin = await createUser("ADMIN", "Admin");
    const stats = await request(app).get("/admin/stats").set(bearer(admin.token));
    expect(stats.status).toBe(200);
    expect(stats.body.averageWaitSeconds).toBe(540);
    expect(stats.body.waitingNow).toBe(1);
    expect(stats.body.tripsToday).toBe(1);
    const bToA = stats.body.loadFactorByRoute.find((item: { route: { id: string } }) => item.route.id === routes.bToA.id);
    expect(bToA).toMatchObject({ loadFactor: 0.5, completedTrips: 1 });
    expect(JSON.stringify(stats.body)).not.toContain(waiting.user.phone);

    const passenger = await createPassenger("Reporter One");
    await prisma.queueEntry.create({
      data: { passengerId: passenger.user.id, routeId: routes.bToA.id, status: "BOARDED", tripId: trip.id },
    });
    const filed = await request(app).post("/reports").set(bearer(passenger.token)).send({
      type: "DISRESPECT",
      description: "The driver was rude",
      tripId: trip.id,
    });
    const reviewed = await request(app)
      .patch(`/admin/reports/${filed.body.report.id}`)
      .set(bearer(admin.token))
      .send({ status: "IN_REVIEW" });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.report.status).toBe("IN_REVIEW");
    expect(reviewed.body.report.reporter).toEqual({ id: passenger.user.id, name: "Reporter One" });
    expect(reviewed.body.report.reporter.phone).toBeUndefined();

    const resolved = await request(app)
      .patch(`/admin/reports/${filed.body.report.id}`)
      .set(bearer(admin.token))
      .send({ status: "RESOLVED", resolutionNote: "Driver warned" });
    expect(resolved.body.report).toMatchObject({ status: "RESOLVED", resolutionNote: "Driver warned" });

    const openOnly = await request(app).get("/admin/reports?status=OPEN").set(bearer(admin.token));
    expect(openOnly.body.reports).toEqual([]);
    const notes = await request(app).get("/notifications").set(bearer(passenger.token));
    expect(notes.body.notifications.filter((item: { type: string }) => item.type === "REPORT_UPDATED")).toHaveLength(2);
  });
});