import type { StationQueueEntry, StationQueuesResponse, StationRouteQueue } from "@taxiflow/shared";
import { QueueStatus } from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { AppError, conflict, notFound } from "../lib/errors.js";
import { removedText } from "../lib/messages.js";
import { firstName, toRouteSummary, toStation } from "../lib/serialize.js";
import { createNotification, publishQueueChange } from "../realtime/emitter.js";

const notYourStation = () => new AppError(403, "not_your_station", "This queue is not at your station");

async function repStation(repId: string) {
  const rep = await prisma.user.findUnique({
    where: { id: repId },
    select: { station: true },
  });
  if (!rep?.station) throw notYourStation();
  return rep.station;
}

type QueueRow = {
  id: string;
  routeId: string;
  status: string;
  isPriority: boolean;
  joinedAt: Date;
  tripId: string | null;
  passengerName: string;
  position: bigint | null;
};

export async function getStationQueues(repId: string): Promise<StationQueuesResponse> {
  const station = await repStation(repId);
  const routes = await prisma.route.findMany({
    where: { originId: station.id },
    include: { origin: true, destination: true },
    orderBy: { destination: { name: "asc" } },
  });
  const routeIds = routes.map((route) => route.id);

  const rows = routeIds.length
    ? await prisma.$queryRaw<QueueRow[]>`
        SELECT q.id, q."routeId", q.status::text AS status, q."isPriority", q."joinedAt", q."tripId",
               u.name AS "passengerName",
               ranked.position
        FROM "QueueEntry" q
        JOIN "User" u ON u.id = q."passengerId"
        LEFT JOIN (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "routeId" ORDER BY "isPriority" DESC, "joinedAt" ASC, id ASC) AS position
          FROM "QueueEntry"
          WHERE status = 'WAITING' AND "routeId" IN (${Prisma.join(routeIds)})
        ) AS ranked ON ranked.id = q.id
        WHERE q."routeId" IN (${Prisma.join(routeIds)}) AND q.status IN ('WAITING', 'CALLED')`
    : [];

  const byRoute = new Map<string, StationQueueEntry[]>();
  for (const row of rows) {
    const entry: StationQueueEntry = {
      id: row.id,
      firstName: firstName(row.passengerName),
      isPriority: row.isPriority,
      status: QueueStatus.parse(row.status),
      position: row.position === null ? null : Number(row.position),
      joinedAt: row.joinedAt.toISOString(),
      tripId: row.tripId,
    };
    const list = byRoute.get(row.routeId) ?? [];
    list.push(entry);
    byRoute.set(row.routeId, list);
  }

  const routeQueues: StationRouteQueue[] = routes.map((route) => {
    const entries = (byRoute.get(route.id) ?? []).sort((a, b) => {
      if (a.position !== null && b.position !== null) return a.position - b.position;
      if (a.position !== null) return -1;
      if (b.position !== null) return 1;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
    return {
      route: toRouteSummary(route),
      waiting: entries.filter((entry) => entry.status === "WAITING").length,
      priorityWaiting: entries.filter((entry) => entry.status === "WAITING" && entry.isPriority).length,
      entries,
    };
  });

  const taxis = await prisma.taxi.findMany({
    where: { currentStationId: station.id },
    include: {
      driver: true,
      trips: { where: { status: { in: ["LOADING", "DEPARTED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { plate: "asc" },
  });

  return {
    station: toStation(station),
    routes: routeQueues,
    taxis: taxis.map((taxi) => ({
      id: taxi.id,
      plate: taxi.plate,
      capacity: taxi.capacity,
      status: taxi.status,
      driverFirstName: firstName(taxi.driver.name),
      activeTripId: taxi.trips[0]?.id ?? null,
    })),
  };
}

export async function removeQueueEntry(repId: string, entryId: string) {
  const committed = await prisma.$transaction(async (tx) => {
    const rep = await tx.user.findUnique({ where: { id: repId }, select: { stationId: true } });
    if (!rep?.stationId) throw notYourStation();

    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "QueueEntry" WHERE id = ${entryId} FOR UPDATE`;
    if (!locked[0]) throw notFound("entry_not_found", "This queue entry does not exist");

    const entry = await tx.queueEntry.findUnique({
      where: { id: entryId },
      include: { passenger: true, route: true },
    });
    if (!entry) throw notFound("entry_not_found", "This queue entry does not exist");
    if (entry.route.originId !== rep.stationId) throw notYourStation();
    if (entry.status !== "WAITING" && entry.status !== "CALLED") {
      throw conflict("invalid_entry_status", "Only a waiting or called passenger can be removed");
    }

    const updated = await tx.queueEntry.update({ where: { id: entry.id }, data: { status: "CANCELLED" } });
    return {
      entry: {
        id: updated.id,
        firstName: firstName(entry.passenger.name),
        isPriority: updated.isPriority,
        status: updated.status,
        position: null,
        joinedAt: updated.joinedAt.toISOString(),
        tripId: updated.tripId,
      } satisfies StationQueueEntry,
      routeId: entry.routeId,
      passengerId: entry.passengerId,
      language: entry.passenger.language,
    };
  });

  const text = removedText(committed.language);
  await createNotification({ userId: committed.passengerId, type: "QUEUE_REMOVED", ...text });
  await publishQueueChange({ routeIds: [committed.routeId], endedUserIds: [committed.passengerId] });
  return { entry: committed.entry };
}
