import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/db.js";
import { env } from "../src/lib/env.js";
import { bearer, createPassenger, createRoutes, createUser, resetDatabase } from "./helpers.js";

const app = createApp();

const protectedRoutes: Array<[string, string]> = [
  ["get", "/me"],
  ["get", "/stations"],
  ["get", "/routes"],
  ["post", "/queue/join"],
  ["get", "/queue/me"],
  ["post", "/queue/leave"],
  ["get", "/trips/mine"],
  ["post", "/ratings"],
  ["post", "/reports"],
  ["post", "/contracts"],
  ["get", "/notifications"],
  ["post", "/notifications/read"],
  ["get", "/driver/me"],
  ["post", "/driver/arrive"],
  ["get", "/driver/demand"],
  ["post", "/driver/trips/start"],
  ["get", "/driver/trips/missing"],
  ["post", "/driver/trips/missing/call"],
  ["post", "/driver/entries/missing/board"],
  ["post", "/driver/entries/missing/no-show"],
  ["post", "/driver/trips/missing/depart"],
  ["post", "/driver/trips/missing/cancel"],
  ["post", "/driver/trips/missing/arrive"],
  ["get", "/driver/reports"],
  ["post", "/driver/reports/missing/respond"],
  ["get", "/station/queues"],
  ["post", "/station/entries/missing/remove"],
  ["get", "/admin/stats"],
  ["get", "/admin/reports"],
  ["patch", "/admin/reports/missing"],
];

beforeEach(async () => {
  env.DEMO_MODE = false;
  await resetDatabase();
});

afterEach(() => {
  env.DEMO_MODE = false;
});

afterAll(() => prisma.$disconnect());

describe("role checks and the error format", () => {
  it("rejects every protected route without a token", async () => {
    for (const [method, path] of protectedRoutes) {
      const response = await request(app)[method as "get"](path).send({});
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(response.body.error, `${method} ${path}`).toBe("unauthorized");
      expect(typeof response.body.message).toBe("string");
    }
  });

  it("rejects the wrong role and an invalid body with the standard error", async () => {
    const passenger = await createPassenger("Hana Bekele");
    const forbidden = await request(app).get("/admin/stats").set(bearer(passenger.token));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ error: "forbidden", message: expect.any(String) });

    const invalid = await request(app).post("/contracts").set(bearer(passenger.token)).send({});
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("validation_error");
    expect(invalid.body.details.length).toBeGreaterThan(0);

    const driver = await createUser("DRIVER");
    const badArrive = await request(app).post("/driver/arrive").set(bearer(driver.token)).send({});
    expect(badArrive.status).toBe(400);
    expect(badArrive.body.error).toBe("validation_error");
  });
});

describe("public pulse, contracts, and driver reports", () => {
  it("counts waiting passengers with no token", async () => {
    const routes = await createRoutes();
    const passenger = await createPassenger();
    await prisma.queueEntry.create({ data: { passengerId: passenger.user.id, routeId: routes.aToB.id } });

    const response = await request(app).get("/public/pulse");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ waitingNow: 1 });
  });

  it("saves a contract request for a passenger and hides it from drivers", async () => {
    const passenger = await createPassenger("Hana Bekele");
    const response = await request(app).post("/contracts").set(bearer(passenger.token)).send({
      type: "SCHOOL",
      pickup: "Merkato",
      destination: "Jimma University",
      schedule: "Weekdays 7:30",
      passengerCount: 18,
      notes: "  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.request).toMatchObject({
      requesterId: passenger.user.id,
      type: "SCHOOL",
      pickup: "Merkato",
      destination: "Jimma University",
      schedule: "Weekdays 7:30",
      passengerCount: 18,
      notes: null,
      status: "NEW",
    });
    expect(await prisma.contractRequest.count()).toBe(1);

    const driver = await createUser("DRIVER");
    const denied = await request(app).post("/contracts").set(bearer(driver.token)).send({
      type: "FAMILY",
      pickup: "Merkato",
      destination: "Awetu",
      schedule: "Sunday",
      passengerCount: 4,
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("forbidden");
  });

  it("lists only the reports about the signed-in driver", async () => {
    const driver = await createUser("DRIVER", "Kebede Alemu");
    const other = await createUser("DRIVER", "Abebe Chala");
    const passenger = await createPassenger();
    await prisma.report.create({
      data: {
        reporterId: passenger.user.id,
        driverId: driver.user.id,
        type: "OVERCHARGING",
        description: "Charged 20 birr instead of 10",
      },
    });
    await prisma.report.create({
      data: {
        reporterId: passenger.user.id,
        driverId: other.user.id,
        type: "DISRESPECT",
        description: "The other driver was rude",
      },
    });

    const response = await request(app).get("/driver/reports").set(bearer(driver.token));
    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0]).toMatchObject({
      driverId: driver.user.id,
      type: "OVERCHARGING",
      description: "Charged 20 birr instead of 10",
    });
    expect(JSON.stringify(response.body)).not.toContain(passenger.user.phone);
  });
});

describe("demo reset and the SMS log", () => {
  it("stays hidden unless demo mode is on", async () => {
    const reset = await request(app).post("/dev/reset");
    const sms = await request(app).get("/dev/sms");
    expect(reset.status).toBe(404);
    expect(sms.status).toBe(404);
    expect(reset.body.error).toBe("not_found");
    expect(sms.body.error).toBe("not_found");
  });

  it("reseeds the database and lists notifications as text messages", async () => {
    env.DEMO_MODE = true;
    const reset = await request(app).post("/dev/reset");
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ ok: true });

    const admin = await prisma.user.findUnique({ where: { phone: "0911000099" } });
    expect(admin?.role).toBe("ADMIN");
    expect(admin?.name).toBe("Selam Tadesse");

    const stations = await prisma.station.findMany({ select: { name: true }, orderBy: { name: "asc" } });
    expect(stations.map((station) => station.name)).toEqual([
      "Awetu",
      "Bishishe",
      "Bus station",
      "Hermata",
      "Jimma University",
      "Jiren",
      "Merkato",
      "University Hospital",
    ]);

    const kebede = await prisma.user.findUniqueOrThrow({
      where: { phone: "0911000001" },
      include: { taxi: { include: { currentStation: true } } },
    });
    expect(kebede.name).toBe("Kebede Alemu");
    expect(kebede.taxi).toMatchObject({ plate: "OR 3-42115", status: "AT_STATION", currentStation: { name: "Merkato" } });
    expect(await prisma.report.count()).toBe(3);
    expect(await prisma.trip.count({ where: { status: "COMPLETED" } })).toBe(2);

    const passenger = await prisma.user.findUniqueOrThrow({ where: { phone: "0911000100" } });
    expect(passenger.name).toBe("Hana Bekele");
    await prisma.notification.create({
      data: {
        userId: passenger.id,
        type: "QUEUE_CALLED",
        title: "Taxi ready",
        body: "Taxi OR 3-55012 at Jimma University is ready. Board now.",
      },
    });

    const sms = await request(app).get("/dev/sms");
    expect(sms.status).toBe(200);
    expect(sms.body.messages[0]).toMatchObject({
      to: "0911000100",
      recipientName: "Hana Bekele",
      text: "TaxiFlow: Taxi OR 3-55012 at Jimma University is ready. Board now.",
    });
    expect(sms.body.messages.length).toBeLessThanOrEqual(100);
  });
});
