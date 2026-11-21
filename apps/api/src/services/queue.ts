import {
  ACTIVE_QUEUE_STATUSES,
  JoinQueueRequest,
  QueueStatus,
  type JoinQueueResponse,
  type LeaveQueueResponse,
  type MyQueueResponse,
  type QueueUpdatePayload,
} from "@taxiflow/shared";
import type { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { conflict, notFound } from "../lib/errors.js";
import { toQueueEntry } from "../lib/serialize.js";
import { publishQueueChange } from "../realtime/emitter.js";
import { joinRouteRoom } from "../realtime/membership.js";

type Tx = Prisma.TransactionClient;

const entryInclude = {
  route: { include: { origin: true, destination: true } },
  trip: { include: { taxi: true } },
} satisfies Prisma.QueueEntryInclude;

const activeStatuses = [...ACTIVE_QUEUE_STATUSES];

const alreadyInQueue = () => conflict("already_in_queue", "You are already in a queue. Leave it before joining another.");

/**
 * 1-based rank among WAITING entries on the entry's route: priority first, then earliest join.
 * Computed on every read, never stored. Null when the entry is not WAITING.
 */
export async function positionOf(tx: Tx, entry: { id: string; routeId: string }): Promise<number | null> {
  const rows = await tx.$queryRaw<{ position: bigint }[]>`
    SELECT ranked.position
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY "isPriority" DESC, "joinedAt" ASC, id ASC) AS position
      FROM "QueueEntry"
      WHERE "routeId" = ${entry.routeId} AND status = 'WAITING'
    ) AS ranked
    WHERE ranked.id = ${entry.id}`;
  const row = rows[0];
  return row ? Number(row.position) : null;
}

/** One query for every WAITING and CALLED entry on a route, with the same window as GET /queue/me. */
export async function listActiveQueueStates(routeId: string): Promise<{ passengerId: string; payload: QueueUpdatePayload }[]> {
  const rows = await prisma.$queryRaw<
    { id: string; passengerId: string; status: string; position: bigint | null; taxiPlate: string | null }[]
  >`
    SELECT q.id, q."passengerId", q.status::text AS status,
           ranked.position,
           CASE WHEN q.status = 'CALLED' THEN taxi.plate ELSE NULL END AS "taxiPlate"
    FROM "QueueEntry" q
    LEFT JOIN (
      SELECT id, ROW_NUMBER() OVER (ORDER BY "isPriority" DESC, "joinedAt" ASC, id ASC) AS position
      FROM "QueueEntry"
      WHERE "routeId" = ${routeId} AND status = 'WAITING'
    ) AS ranked ON ranked.id = q.id
    LEFT JOIN "Trip" trip ON trip.id = q."tripId"
    LEFT JOIN "Taxi" taxi ON taxi.id = trip."taxiId"
    WHERE q."routeId" = ${routeId} AND q.status IN ('WAITING', 'CALLED')`;

  return rows.map((row) => ({
    passengerId: row.passengerId,
    payload: {
      entryId: row.id,
      status: QueueStatus.parse(row.status),
      position: row.position === null ? null : Number(row.position),
      taxiPlate: row.taxiPlate,
    },
  }));
}

export async function joinQueue(passengerId: string, body: z.output<typeof JoinQueueRequest>): Promise<JoinQueueResponse> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const route = await tx.route.findUnique({ where: { id: body.routeId }, select: { id: true } });
      if (!route) {
        throw notFound("route_not_found", "This route does not exist");
      }

      const active = await tx.queueEntry.findFirst({
        where: { passengerId, status: { in: activeStatuses } },
        select: { id: true },
      });
      if (active) {
        throw alreadyInQueue();
      }

      const entry = await tx.queueEntry.create({
        data: {
          passengerId,
          routeId: body.routeId,
          assistance: body.assistance,
          isPriority: env.PRIORITY_ENABLED && body.assistance !== "NONE",
        },
        include: entryInclude,
      });

      const position = await positionOf(tx, entry);
      if (position === null) {
        throw new Error(`New entry ${entry.id} has no position`);
      }
      return { entry: toQueueEntry(entry), position };
    });
    joinRouteRoom(passengerId, body.routeId);
    await publishQueueChange({ routeIds: [body.routeId] });
    return result;
  } catch (err) {
    // Two joins racing past the check above: the one_active_queue_entry index rejects the second.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw alreadyInQueue();
    }
    throw err;
  }
}

export async function getMyQueue(passengerId: string): Promise<MyQueueResponse> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.queueEntry.findFirst({
      where: { passengerId, status: { in: activeStatuses } },
      include: entryInclude,
    });
    if (!entry) {
      return { entry: null, position: null, taxiPlate: null };
    }
    return {
      entry: toQueueEntry(entry),
      position: entry.status === "WAITING" ? await positionOf(tx, entry) : null,
      taxiPlate: entry.status === "CALLED" ? (entry.trip?.taxi.plate ?? null) : null,
    };
  });
}

/** Cancels the passenger's WAITING or CALLED entry. Cancelling a CALLED entry frees its seat on the trip. */
export async function leaveQueue(passengerId: string): Promise<LeaveQueueResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    // Lock the row so a driver calling passengers at the same moment cannot also take it.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "QueueEntry"
      WHERE "passengerId" = ${passengerId} AND status IN ('WAITING', 'CALLED')
      FOR UPDATE`;
    const target = locked[0];
    if (!target) {
      throw notFound("not_in_queue", "You are not in a queue");
    }

    const entry = await tx.queueEntry.update({
      where: { id: target.id },
      data: { status: "CANCELLED" },
      include: entryInclude,
    });
    return { entry: toQueueEntry(entry), routeId: entry.routeId };
  });
  await publishQueueChange({ routeIds: [committed.routeId], endedUserIds: [passengerId] });
  return { entry: committed.entry };
}
