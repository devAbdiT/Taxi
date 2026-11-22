import type { DriverLineEntry, DriverQueueResponse, JoinDriverQueueRequest } from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { conflict, notFound } from "../lib/errors.js";
import { firstName, toStation } from "../lib/serialize.js";
import { assertNotSuspended } from "./suspension.js";

type Tx = Prisma.TransactionClient;

const lineInclude = { taxi: true, driver: true } satisfies Prisma.DriverQueueEntryInclude;
type LineRow = Prisma.DriverQueueEntryGetPayload<{ include: typeof lineInclude }>;

/** The drivers waiting or loading at a station, in turn order. WAITING drivers get a position. */
export async function loadLine(db: Tx, stationId: string): Promise<LineRow[]> {
  return db.driverQueueEntry.findMany({
    where: { stationId, status: { in: ["WAITING", "LOADING"] } },
    orderBy: [{ sortKey: "asc" }, { id: "asc" }],
    include: lineInclude,
  });
}

export function toLine(rows: LineRow[], meDriverId: string | null): DriverLineEntry[] {
  let position = 0;
  return rows.map((row) => ({
    id: row.id,
    plate: row.taxi.plate,
    driverFirstName: firstName(row.driver.name),
    status: row.status,
    position: row.status === "WAITING" ? ++position : null,
    isMe: meDriverId !== null && row.driverId === meDriverId,
    outOfTurnAllowed: row.outOfTurnGrantedAt !== null,
  }));
}

async function requireTaxi(db: Tx, driverId: string) {
  const taxi = await db.taxi.findUnique({ where: { driverId }, include: { currentStation: true } });
  if (!taxi) throw notFound("taxi_not_found", "This driver has no taxi");
  return taxi;
}

export async function getDriverQueue(driverId: string): Promise<DriverQueueResponse> {
  return prisma.$transaction(async (tx) => {
    const taxi = await requireTaxi(tx, driverId);
    if (!taxi.currentStation) {
      return { station: null, enforced: env.DRIVER_TURN_ORDER_ENFORCED, mine: null, line: [], canStart: true };
    }
    const line = toLine(await loadLine(tx, taxi.currentStation.id), driverId);
    const mine = line.find((entry) => entry.isMe) ?? null;
    const waiting = line.filter((entry) => entry.status === "WAITING");
    const canStart =
      !env.DRIVER_TURN_ORDER_ENFORCED || waiting.length === 0 || (mine !== null && (mine.position === 1 || mine.outOfTurnAllowed));
    return { station: toStation(taxi.currentStation), enforced: env.DRIVER_TURN_ORDER_ENFORCED, mine, line, canStart };
  });
}

export async function joinDriverQueue(driverId: string, body: JoinDriverQueueRequest): Promise<DriverQueueResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      const taxi = await requireTaxi(tx, driverId);
      if (taxi.status !== "AT_STATION" || !taxi.currentStationId) {
        throw conflict("invalid_taxi_status", "Arrive at a station before joining the driver line");
      }
      await assertNotSuspended(tx, driverId);
      const active = await tx.driverQueueEntry.findFirst({ where: { taxiId: taxi.id, status: { in: ["WAITING", "LOADING"] } } });
      if (active) throw conflict("already_in_queue", "You are already in the driver line");
      await tx.driverQueueEntry.create({
        data: { taxiId: taxi.id, driverId, stationId: taxi.currentStationId, routeId: body.routeId ?? null },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("already_in_queue", "You are already in the driver line");
    }
    throw err;
  }
  return getDriverQueue(driverId);
}

export async function leaveDriverQueue(driverId: string): Promise<DriverQueueResponse> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.driverQueueEntry.findFirst({ where: { driverId, status: "WAITING" } });
    if (!entry) throw notFound("not_in_driver_queue", "You are not waiting in the driver line");
    await tx.driverQueueEntry.update({ where: { id: entry.id }, data: { status: "LEFT" } });
  });
  return getDriverQueue(driverId);
}

/**
 * Called inside the start-trip transaction. When turn order is enforced and the station has a driver line,
 * only the driver at position 1 may start; a controller's ALLOW_OUT_OF_TURN lets one named driver start once.
 * Without any line at the station the older flow keeps working.
 */
export async function claimTurnToStart(tx: Tx, taxi: { id: string; currentStationId: string | null }): Promise<void> {
  if (!taxi.currentStationId) return;
  const waiting = await tx.driverQueueEntry.findMany({
    where: { stationId: taxi.currentStationId, status: "WAITING" },
    orderBy: [{ sortKey: "asc" }, { id: "asc" }],
    include: { taxi: true },
  });
  const mine = waiting.find((entry) => entry.taxiId === taxi.id);

  if (!env.DRIVER_TURN_ORDER_ENFORCED) {
    if (mine) await tx.driverQueueEntry.update({ where: { id: mine.id }, data: { status: "LOADING" } });
    return;
  }
  if (waiting.length === 0) return;
  const first = waiting[0];
  if (!mine || !first) {
    throw conflict("not_your_turn", `Join the driver line first. Taxi ${first?.taxi.plate ?? ""} is next.`.replace("  ", " "));
  }
  let outOfTurn = false;
  if (first.id !== mine.id) {
    if (!mine.outOfTurnGrantedAt) {
      throw conflict("not_your_turn", `Not your turn yet. Taxi ${first.taxi.plate} is in front of you.`);
    }
    outOfTurn = true;
  }
  await tx.driverQueueEntry.update({
    where: { id: mine.id },
    data: { status: "LOADING", startedOutOfTurn: outOfTurn, outOfTurnGrantedAt: null },
  });
}
