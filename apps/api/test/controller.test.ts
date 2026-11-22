import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/db.js";
import * as notify from "../src/services/notify.js";
import {
  bearer,
  createDriverWithTaxi,
  createPassenger,
  createRep,
  createRoutes,
  createUser,
  hasKey,
  resetDatabase,
  waitingEntry,
} from "./helpers.js";

const app = createApp();
let routes: Awaited<ReturnType<typeof createRoutes>>;

beforeEach(async () => {
  await resetDatabase();
  routes = await createRoutes();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const REASON = "Jumped the line at the front";

async function line(count: number, extraPriority = 0) {
  const people = [];
  for (let index = 0; index < extraPriority; index += 1) {
    const person = await createPassenger(`Priority${index}`);
    const entry = await waitingEntry(person.user.id, routes.aToB.id, 60 - index, { isPriority: true });
    people.push({ person, entry });
  }
  for (let index = 0; index < count; index += 1) {
    const person = await createPassenger(`Person${index}`);
    const entry = await waitingEntry(person.user.id, routes.aToB.id, 40 - index);
    people.push({ person, entry });
  }
  return people;
}

async function positions(token: string) {
  const desk = await request(app).get("/station/desk").set(bearer(token));
  expect(desk.status).toBe(200);
  const route = desk.body.routes.find((item: { route: { id: string } }) => item.route.id === routes.aToB.id);
  return route.entries.map((entry: { id: string; position: number | null }) => [entry.id, entry.position]) as [string, number | null][];
}

describe("queue order and controller moves", () => {
  it("orders by priority, then sortKey; MOVE_BACK by 2 moves exactly 2 places and never touches joinedAt", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(4, 1); // 1 priority + 4 regular
    const [priority, p1, p2, p3, p4] = people.map((item) => item.entry.id);

    expect(await positions(rep.token)).toEqual([[priority, 1], [p1, 2], [p2, 3], [p3, 4], [p4, 5]]);

    const before = await prisma.queueEntry.findUniqueOrThrow({ where: { id: p1 as string } });
    const moved = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MOVE_BACK", queueEntryId: p1, reason: REASON, positions: 2 });
    expect(moved.status).toBe(201);
    expect(moved.body.action.details).toMatchObject({ positions: 2, fromPosition: 2, toPosition: 4 });
    expect(moved.body.action.details.before).toBeUndefined();

    expect(await positions(rep.token)).toEqual([[priority, 1], [p2, 2], [p3, 3], [p1, 4], [p4, 5]]);
    const after = await prisma.queueEntry.findUniqueOrThrow({ where: { id: p1 as string } });
    expect(after.joinedAt.toISOString()).toBe(before.joinedAt.toISOString());
    expect(after.sortKey.getTime()).toBeGreaterThan(before.sortKey.getTime());

    const forward = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MOVE_FORWARD", queueEntryId: p1, reason: REASON, positions: 2 });
    expect(forward.status).toBe(201);
    expect((await positions(rep.token)).map(([id]) => id)).toEqual([priority, p1, p2, p3, p4]);
  });

  it("returns 409 priority_boundary when a move would cross into the other priority group", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(3, 1);
    const [priority, p1] = people.map((item) => item.entry.id);

    const back = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MOVE_BACK", queueEntryId: priority, reason: REASON, positions: 2 });
    expect(back.status).toBe(409);
    expect(back.body.error).toBe("priority_boundary");

    const forward = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MOVE_FORWARD", queueEntryId: p1, reason: REASON, positions: 1 });
    expect(forward.status).toBe(409);
    expect(forward.body.error).toBe("priority_boundary");
    expect(await prisma.controllerAction.count()).toBe(0);
  });
});

describe("audit log", () => {
  it("writes exactly one audit row per action, in the same transaction as the effect", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(3);
    const target = people[0]?.entry.id as string;
    const ok = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "REMOVE", queueEntryId: target, reason: "Left the station without telling us" });
    expect(ok.status).toBe(201);
    expect(await prisma.controllerAction.count()).toBe(1);
    expect((await prisma.queueEntry.findUniqueOrThrow({ where: { id: target } })).status).toBe("CANCELLED");

    // Make the last step of the transaction (the notification) fail: effect and audit row must both roll back.
    const second = people[1]?.entry.id as string;
    vi.spyOn(notify, "notifyTx").mockRejectedValueOnce(new Error("simulated failure"));
    const failed = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MOVE_BACK", queueEntryId: second, reason: REASON, positions: 1 });
    expect(failed.status).toBe(500);
    expect(await prisma.controllerAction.count()).toBe(1);
    const unchanged = await prisma.queueEntry.findUniqueOrThrow({ where: { id: second } });
    expect(unchanged.sortKey.toISOString()).toBe(unchanged.joinedAt.toISOString());
  });

  it("rejects a reason shorter than 10 characters with 400", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(2);
    const response = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "WARN", queueEntryId: people[0]?.entry.id, reason: "too short" });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("validation_error");
    expect(await prisma.controllerAction.count()).toBe(0);
  });

  it("is append-only: the database refuses UPDATE and DELETE, and the API has no such route", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(1);
    const created = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "WARN", queueEntryId: people[0]?.entry.id, reason: REASON });
    const id = created.body.action.id as string;
    await expect(prisma.controllerAction.update({ where: { id }, data: { reason: "A changed reason here" } })).rejects.toThrow();
    await expect(prisma.controllerAction.delete({ where: { id } })).rejects.toThrow();

    const admin = await createUser("ADMIN");
    for (const [method, path, token] of [
      ["patch", `/station/audit-log/${id}`, rep.token],
      ["delete", `/station/audit-log/${id}`, rep.token],
      ["patch", `/admin/audit-log/${id}`, admin.token],
      ["delete", `/admin/audit-log/${id}`, admin.token],
    ] as const) {
      const response = await request(app)[method](path).set(bearer(token));
      expect([404, 405]).toContain(response.status);
    }

    const log = await request(app).get("/station/audit-log").set(bearer(rep.token));
    expect(log.status).toBe(200);
    expect(log.body.actions).toHaveLength(1);
    expect(log.body.actions[0]).toMatchObject({ action: "WARN", reason: REASON, stationName: "Area A" });
  });
});

describe("who may act", () => {
  it("rejects a rep from another station and any passenger or driver", async () => {
    const otherRep = await createRep(routes.areaB.id, "Other Rep");
    const people = await line(1);
    const foreign = await request(app)
      .post("/station/actions")
      .set(bearer(otherRep.token))
      .send({ action: "WARN", queueEntryId: people[0]?.entry.id, reason: REASON });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toBe("not_your_station");

    const passenger = await createPassenger();
    const driver = await createDriverWithTaxi("Dawit Driver", "OR 1-00001", routes.areaA.id);
    for (const token of [passenger.token, driver.token]) {
      for (const [method, path] of [
        ["post", "/station/actions"],
        ["get", "/station/disputes"],
        ["get", "/station/desk"],
        ["get", "/station/audit-log"],
        ["get", "/station/alerts"],
      ] as const) {
        const response = await request(app)[method](path).set(bearer(token)).send({});
        expect(response.status).toBe(403);
      }
    }
  });
});

describe("suspension", () => {
  it("blocks joining with 403 suspended and an end time, and allows joining again after it ends", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(1);
    const offender = people[0]?.person as { user: { id: string }; token: string };
    await request(app).post("/queue/leave").set(bearer(offender.token));

    const suspend = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "SUSPEND", targetUserId: offender.user.id, reason: "Repeated line jumping today", minutes: 30 });
    expect(suspend.status).toBe(201);
    expect(suspend.body.action.details.minutes).toBe(30);

    const blocked = await request(app).post("/queue/join").set(bearer(offender.token)).send({ routeId: routes.aToB.id });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe("suspended");
    expect(new Date(blocked.body.endsAt).getTime()).toBeGreaterThan(Date.now());

    const status = await request(app).get("/suspensions/me").set(bearer(offender.token));
    expect(status.body.suspension.reason).toBe("Repeated line jumping today");

    await prisma.suspension.updateMany({ where: { userId: offender.user.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const allowed = await request(app).post("/queue/join").set(bearer(offender.token)).send({ routeId: routes.aToB.id });
    expect(allowed.status).toBe(201);
  });
});

describe("driver turn order", () => {
  it("lets only the first driver start; ALLOW_OUT_OF_TURN lets the second start once", async () => {
    const rep = await createRep(routes.areaA.id);
    const first = await createDriverWithTaxi("Abel First", "OR 1-00011", routes.areaA.id);
    const second = await createDriverWithTaxi("Biruk Second", "OR 1-00012", routes.areaA.id);

    expect((await request(app).post("/driver/queue/join").set(bearer(first.token)).send({})).status).toBe(201);
    const joined = await request(app).post("/driver/queue/join").set(bearer(second.token)).send({});
    expect(joined.body.mine.position).toBe(2);
    expect((await request(app).post("/driver/queue/join").set(bearer(second.token)).send({})).body.error).toBe("already_in_queue");

    const early = await request(app).post("/driver/trips/start").set(bearer(second.token)).send({ routeId: routes.aToB.id });
    expect(early.status).toBe(409);
    expect(early.body.error).toBe("not_your_turn");
    expect(early.body.message).toContain("OR 1-00011");

    const mineEntry = joined.body.mine.id as string;
    const allow = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "ALLOW_OUT_OF_TURN", driverQueueEntryId: mineEntry, reason: "First driver is not at the taxi" });
    expect(allow.status).toBe(201);

    const started = await request(app).post("/driver/trips/start").set(bearer(second.token)).send({ routeId: routes.aToB.id });
    expect(started.status).toBe(201);
    const entry = await prisma.driverQueueEntry.findUniqueOrThrow({ where: { id: mineEntry } });
    expect(entry.status).toBe("LOADING");
    expect(entry.startedOutOfTurn).toBe(true);
    expect(entry.outOfTurnGrantedAt).toBeNull(); // used up: it was for one start

    const alerts = await request(app).get("/station/alerts").set(bearer(rep.token));
    expect(alerts.body.alerts.some((alert: { type: string }) => alert.type === "OUT_OF_TURN_START")).toBe(true);

    const ok = await request(app).post("/driver/trips/start").set(bearer(first.token)).send({ routeId: routes.aToB.id });
    expect(ok.status).toBe(201);
  });

  it("keeps the older flow working when the station has no driver line", async () => {
    const driver = await createDriverWithTaxi("Solo Driver", "OR 1-00020", routes.areaA.id);
    const started = await request(app).post("/driver/trips/start").set(bearer(driver.token)).send({ routeId: routes.aToB.id });
    expect(started.status).toBe(201);
  });
});

describe("disputes and appeals", () => {
  async function openLineJumpingDispute() {
    const rep = await createRep(routes.areaA.id);
    const people = await line(3);
    const victim = people[2]?.person as { user: { id: string }; token: string };
    const created = await request(app)
      .post("/disputes")
      .set(bearer(victim.token))
      .send({ type: "LINE_JUMPING", description: "Someone stepped in front of me in the line" });
    expect(created.status).toBe(201);
    return { rep, people, victim, dispute: created.body.dispute as { id: string } };
  }

  it("opens, lists, reviews and resolves a dispute without phone numbers", async () => {
    const { rep, victim, dispute } = await openLineJumpingDispute();
    const duplicate = await request(app)
      .post("/disputes")
      .set(bearer(victim.token))
      .send({ type: "LINE_JUMPING", description: "Same complaint again, please look at it" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("duplicate_open_dispute");

    const list = await request(app).get("/station/disputes?status=OPEN").set(bearer(rep.token));
    expect(list.body.disputes).toHaveLength(1);
    expect(list.body.disputes[0].entry.position).toBe(3);
    expect(hasKey(list.body, ["phone", "passwordHash"])).toBe(false);

    const review = await request(app).patch(`/station/disputes/${dispute.id}`).set(bearer(rep.token)).send({ status: "IN_REVIEW" });
    expect(review.status).toBe(200);
    const noNote = await request(app).patch(`/station/disputes/${dispute.id}`).set(bearer(rep.token)).send({ status: "RESOLVED" });
    expect(noNote.status).toBe(400);
    const resolved = await request(app)
      .patch(`/station/disputes/${dispute.id}`)
      .set(bearer(rep.token))
      .send({ status: "RESOLVED", resolutionNote: "Checked the line, the order is correct" });
    expect(resolved.status).toBe(200);
    expect(resolved.body.dispute.status).toBe("RESOLVED");

    const mine = await request(app).get("/disputes/mine").set(bearer(victim.token));
    expect(mine.body.disputes[0]).toMatchObject({ status: "RESOLVED", controllerReason: "Checked the line, the order is correct", canAppeal: true });
    expect(await prisma.controllerAction.count({ where: { action: "RESOLVE_DISPUTE" } })).toBe(1);
  });

  it("allows one appeal per action, refuses after 48 hours, and REVERSED restores the sortKey", async () => {
    const rep = await createRep(routes.areaA.id);
    const admin = await createUser("ADMIN");
    const people = await line(3);
    const target = people[0] as NonNullable<(typeof people)[number]>;
    const original = await prisma.queueEntry.findUniqueOrThrow({ where: { id: target.entry.id } });

    const moved = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MOVE_BACK", queueEntryId: target.entry.id, reason: "Reported for jumping the line", positions: 2 });
    const actionId = moved.body.action.id as string;
    const mineBefore = await request(app).get("/actions/mine").set(bearer(target.person.token));
    expect(mineBefore.body.actions[0]).toMatchObject({ id: actionId, canAppeal: true, appealStatus: null });

    const stranger = await createPassenger("Stranger");
    expect((await request(app).post("/appeals").set(bearer(stranger.token)).send({ actionId, reason: "I want to appeal this one" })).status).toBe(404);

    const appeal = await request(app).post("/appeals").set(bearer(target.person.token)).send({ actionId, reason: "I never jumped the line, I was here first" });
    expect(appeal.status).toBe(201);
    const again = await request(app).post("/appeals").set(bearer(target.person.token)).send({ actionId, reason: "Trying to appeal a second time" });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("already_appealed");

    // An appeal after 48 hours: the audit table cannot be edited, so insert an old row instead.
    const old = await prisma.controllerAction.create({
      data: {
        stationId: routes.areaA.id,
        actorId: rep.user.id,
        action: "WARN",
        targetUserId: target.person.user.id,
        queueEntryId: target.entry.id,
        reason: "Warning from a long time ago",
        createdAt: new Date(Date.now() - 49 * 3_600_000),
      },
    });
    const late = await request(app).post("/appeals").set(bearer(target.person.token)).send({ actionId: old.id, reason: "This is far too late to appeal" });
    expect(late.status).toBe(409);
    expect(late.body.error).toBe("appeal_window_closed");

    const appealId = appeal.body.appeal.id as string;
    expect((await request(app).patch(`/admin/appeals/${appealId}`).set(bearer(rep.token)).send({ status: "REVERSED", adminNote: "Not allowed for reps" })).status).toBe(403);
    const reversed = await request(app)
      .patch(`/admin/appeals/${appealId}`)
      .set(bearer(admin.token))
      .send({ status: "REVERSED", adminNote: "Camera shows they were first in the line" });
    expect(reversed.status).toBe(200);
    expect(reversed.body.appeal.status).toBe("REVERSED");

    const restored = await prisma.queueEntry.findUniqueOrThrow({ where: { id: target.entry.id } });
    expect(restored.sortKey.toISOString()).toBe(original.sortKey.toISOString());
    expect(await prisma.controllerAction.count({ where: { action: "APPEAL_REVERSED" } })).toBe(1);
    expect((await request(app).patch(`/admin/appeals/${appealId}`).set(bearer(admin.token)).send({ status: "UPHELD", adminNote: "Deciding twice should fail" })).status).toBe(409);
  });
});

describe("priority actions, no-show and fairness alerts", () => {
  it("rejects priority, recomputes the position, confirms priority and lists alerts", async () => {
    const rep = await createRep(routes.areaA.id);
    const people = await line(4, 2); // 2 priority, 4 regular: 33 percent
    const priorityEntry = people[0]?.entry.id as string;
    const confirm = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "CONFIRM_PRIORITY", queueEntryId: priorityEntry, reason: "Checked the walking stick, genuine" });
    expect(confirm.status).toBe(201);
    expect((await prisma.queueEntry.findUniqueOrThrow({ where: { id: priorityEntry } })).priorityVerified).toBe(true);

    const second = people[1]?.entry.id as string;
    const reject = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "REJECT_PRIORITY", queueEntryId: second, reason: "Not elderly and no assistance needed" });
    expect(reject.status).toBe(201);
    const order = await positions(rep.token);
    expect(order[0]).toEqual([priorityEntry, 1]);
    expect(order.find(([id]) => id === second)?.[1]).toBe(2); // first of the regular group now, joined earliest

    const long = people[5]?.entry.id as string;
    await prisma.queueEntry.update({ where: { id: long }, data: { joinedAt: new Date(Date.now() - 3 * 3_600_000) } });
    await prisma.queueEntry.create({
      data: {
        passengerId: (await createPassenger("History")).user.id,
        routeId: routes.aToB.id,
        status: "BOARDED",
        joinedAt: new Date(Date.now() - 30 * 60_000),
        calledAt: new Date(Date.now() - 20 * 60_000),
      },
    });
    const alerts = await request(app).get("/station/alerts").set(bearer(rep.token));
    expect(alerts.body.method).toBe("rules");
    expect(alerts.body.alerts.some((alert: { type: string; target: { id: string } }) => alert.type === "LONG_WAIT" && alert.target.id === long)).toBe(true);
  });

  it("marks a called passenger as a no-show and removes a waiting one", async () => {
    const rep = await createRep(routes.areaA.id);
    const driver = await createDriverWithTaxi("Caller", "OR 1-00031", routes.areaA.id);
    const people = await line(2);
    const trip = await request(app).post("/driver/trips/start").set(bearer(driver.token)).send({ routeId: routes.aToB.id });
    await request(app).post(`/driver/trips/${trip.body.trip.id}/call`).set(bearer(driver.token)).send({ count: 1 });
    const calledId = people[0]?.entry.id as string;

    const noShow = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MARK_NO_SHOW", queueEntryId: calledId, reason: "Did not come to the taxi in time" });
    expect(noShow.status).toBe(201);
    expect((await prisma.queueEntry.findUniqueOrThrow({ where: { id: calledId } })).status).toBe("NO_SHOW");
    const mark = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "MARK_NO_SHOW", queueEntryId: people[1]?.entry.id, reason: "This one is still waiting, not called" });
    expect(mark.status).toBe(409);
  });
});

describe("no private data in any response", () => {
  it("never returns phone or passwordHash from the new endpoints", async () => {
    const rep = await createRep(routes.areaA.id);
    const admin = await createUser("ADMIN");
    const people = await line(2);
    const first = people[0] as NonNullable<(typeof people)[number]>;
    await request(app).post("/disputes").set(bearer(first.person.token)).send({ type: "BEHAVIOR", description: "Another passenger was rude to me" });
    const action = await request(app)
      .post("/station/actions")
      .set(bearer(rep.token))
      .send({ action: "WARN", queueEntryId: first.entry.id, reason: "Please be polite to everyone" });
    await request(app).post("/appeals").set(bearer(first.person.token)).send({ actionId: action.body.action.id, reason: "I was polite the whole time" });

    const responses = [
      await request(app).get("/station/desk").set(bearer(rep.token)),
      await request(app).get("/station/disputes").set(bearer(rep.token)),
      await request(app).get("/station/audit-log").set(bearer(rep.token)),
      await request(app).get("/station/alerts").set(bearer(rep.token)),
      await request(app).get("/disputes/mine").set(bearer(first.person.token)),
      await request(app).get("/actions/mine").set(bearer(first.person.token)),
      await request(app).get("/appeals/mine").set(bearer(first.person.token)),
      await request(app).get("/admin/appeals").set(bearer(admin.token)),
      await request(app).get("/admin/audit-log").set(bearer(admin.token)),
      await request(app).get("/station/desk").query({ stationId: routes.areaA.id }).set(bearer(admin.token)),
    ];
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(hasKey(response.body, ["phone", "passwordHash"])).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain(first.person.user.phone);
    }
  });
});
