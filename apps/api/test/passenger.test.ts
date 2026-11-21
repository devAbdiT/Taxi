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

async function completedTrip() {
  const driver = await createUser("DRIVER", "Kebede Hailu");
  const taxi = await prisma.taxi.create({
    data: { plate: "3-AA-10003", capacity: 4, driverId: driver.user.id, status: "AT_STATION", currentStationId: routes.areaA.id },
  });
  const trip = await prisma.trip.create({
    data: { taxiId: taxi.id, routeId: routes.bToA.id, status: "COMPLETED", departedAt: new Date(), arrivedAt: new Date() },
  });
  const passenger = await createPassenger("Almaz Tadesse");
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
  return { driver, trip, passenger };
}

describe("ratings, reports and notifications", () => {
  it("lets a boarded passenger rate a completed trip once, and rejects everyone else", async () => {
    const { driver, trip, passenger } = await completedTrip();
    const stranger = await createPassenger("Stranger");

    const denied = await request(app).post("/ratings").set(bearer(stranger.token)).send({ tripId: trip.id, stars: 4 });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("not_on_trip");

    const rated = await request(app).post("/ratings").set(bearer(passenger.token)).send({
      tripId: trip.id,
      stars: 5,
      tags: ["PUNCTUALITY"],
      comment: "Great driver",
    });
    expect(rated.status).toBe(201);
    expect(rated.body.rating).toMatchObject({ tripId: trip.id, stars: 5, tags: ["PUNCTUALITY"], comment: "Great driver" });

    const again = await request(app).post("/ratings").set(bearer(passenger.token)).send({ tripId: trip.id, stars: 1 });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("already_rated");

    const mine = await request(app).get("/trips/mine").set(bearer(passenger.token));
    expect(mine.status).toBe(200);
    expect(mine.body.trips).toEqual([
      expect.objectContaining({ tripId: trip.id, rated: true, canRate: false, driverFirstName: "Kebede", taxiPlate: "3-AA-10003" }),
    ]);

    const filed = await request(app).post("/reports").set(bearer(passenger.token)).send({
      type: "OVERCHARGING",
      description: "Charged 20 birr instead of 10",
      tripId: trip.id,
    });
    expect(filed.status).toBe(201);
    expect(filed.body.report).toMatchObject({ status: "OPEN", driverId: driver.user.id, type: "OVERCHARGING" });

    const note = await request(app).get("/notifications").set(bearer(driver.token));
    expect(note.body.notifications[0]).toMatchObject({ type: "REPORT_FILED", read: false });
    expect(note.body.unread).toBe(1);

    const response = await request(app)
      .post(`/driver/reports/${filed.body.report.id}/respond`)
      .set(bearer(driver.token))
      .send({ response: "The fare on this route is 15 birr." });
    expect(response.status).toBe(200);
    expect(response.body.report.driverResponse).toBe("The fare on this route is 15 birr.");

    const second = await request(app)
      .post(`/driver/reports/${filed.body.report.id}/respond`)
      .set(bearer(driver.token))
      .send({ response: "Again" });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("already_responded");

    const read = await request(app).post("/notifications/read").set(bearer(driver.token)).send({});
    expect(read.body).toEqual({ updated: 1 });
  });
});
