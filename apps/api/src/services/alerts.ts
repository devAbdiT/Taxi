import type { AlertsResponse, DeskEntry, FairnessAlert, StationDeskResponse } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { firstName } from "../lib/serialize.js";
import { toLine, loadLine } from "./driverQueue.js";
import { repStationOf, type Actor, assertStationAccess } from "./controllerCommon.js";
import { badRequest, notFound } from "../lib/errors.js";
import { toStation } from "../lib/serialize.js";
import { toRouteSummary } from "../lib/serialize.js";

const minutes = (from: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));

/** Fairness alerts. Plain rules over live data, no machine learning. */
export async function computeAlerts(stationId: string): Promise<FairnessAlert[]> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const routes = await prisma.route.findMany({ where: { originId: stationId }, select: { id: true } });
  const routeIds = routes.map((route) => route.id);
  const alerts: FairnessAlert[] = [];

  // 1. Someone has waited more than twice as long as the station's average.
  const averageRows = await prisma.$queryRaw<{ average: number | null }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM ("calledAt" - "joinedAt")))::float8 AS average
    FROM "QueueEntry"
    WHERE "routeId" = ANY(${routeIds}) AND "calledAt" IS NOT NULL AND synthetic = false`;
  const averageSeconds = averageRows[0]?.average ?? 0;
  const waiting = await prisma.queueEntry.findMany({
    where: { routeId: { in: routeIds }, status: "WAITING" },
    include: { passenger: true },
  });
  if (averageSeconds > 0) {
    for (const entry of waiting) {
      const waited = (now.getTime() - entry.joinedAt.getTime()) / 1000;
      if (waited > 2 * averageSeconds) {
        alerts.push({
          id: `long-wait-${entry.id}`,
          type: "LONG_WAIT",
          severity: "warning",
          message: `${firstName(entry.passenger.name)} has waited ${Math.round(waited / 60)} minutes, more than twice the station average of ${Math.round(averageSeconds / 60)} minutes.`,
          target: { kind: "entry", id: entry.id },
        });
      }
    }
  }

  // 2. The same person left and rejoined three or more times in an hour.
  const recent = await prisma.queueEntry.groupBy({
    by: ["passengerId"],
    where: { routeId: { in: routeIds }, joinedAt: { gte: hourAgo }, synthetic: false },
    _count: { _all: true },
    having: { passengerId: { _count: { gte: 3 } } },
  });
  for (const group of recent) {
    const user = await prisma.user.findUnique({ where: { id: group.passengerId }, select: { name: true } });
    const active = waiting.find((entry) => entry.passengerId === group.passengerId);
    alerts.push({
      id: `rejoin-${group.passengerId}`,
      type: "REPEAT_REJOIN",
      severity: "warning",
      message: `${firstName(user?.name ?? "A passenger")} joined this station's lines ${group._count._all} times in the last hour.`,
      target: active ? { kind: "entry", id: active.id } : { kind: "station", id: stationId },
    });
  }

  // 3. More than 40 percent of the waiting passengers claim priority.
  const priority = waiting.filter((entry) => entry.isPriority).length;
  if (waiting.length >= 5 && priority / waiting.length > 0.4) {
    alerts.push({
      id: `priority-share-${stationId}`,
      type: "PRIORITY_SHARE",
      severity: "info",
      message: `${priority} of ${waiting.length} waiting passengers (${Math.round((priority / waiting.length) * 100)} percent) claim priority. Check a few.`,
      target: { kind: "station", id: stationId },
    });
  }

  // 4. A driver started a trip out of turn in the last three hours.
  const outOfTurn = await prisma.driverQueueEntry.findMany({
    where: { stationId, startedOutOfTurn: true, joinedAt: { gte: new Date(now.getTime() - 3 * 3_600_000) } },
    include: { taxi: true, driver: true },
  });
  for (const entry of outOfTurn) {
    alerts.push({
      id: `out-of-turn-${entry.id}`,
      type: "OUT_OF_TURN_START",
      severity: "info",
      message: `Taxi ${entry.taxi.plate} (${firstName(entry.driver.name)}) started a trip out of turn.`,
      target: { kind: "driver", id: entry.id },
    });
  }

  // 5. A dispute has been open for more than 15 minutes.
  const disputes = await prisma.dispute.findMany({
    where: { stationId, status: { in: ["OPEN", "IN_REVIEW"] }, createdAt: { lte: new Date(now.getTime() - 15 * 60_000) } },
    include: { openedBy: true },
  });
  for (const dispute of disputes) {
    alerts.push({
      id: `dispute-${dispute.id}`,
      type: "DISPUTE_OPEN_LONG",
      severity: "warning",
      message: `A dispute from ${firstName(dispute.openedBy.name)} has been open for ${minutes(dispute.createdAt, now)} minutes.`,
      target: { kind: "dispute", id: dispute.id },
    });
  }
  return alerts;
}

async function stationFor(actor: Actor, requested: string | undefined): Promise<string> {
  const repStationId = await repStationOf(prisma, actor);
  if (repStationId !== null) {
    if (requested) assertStationAccess(repStationId, requested);
    return repStationId;
  }
  if (!requested) throw badRequest("validation_error", "Choose a station");
  return requested;
}

export async function getStationAlerts(actor: Actor, stationId?: string): Promise<AlertsResponse> {
  return { alerts: await computeAlerts(await stationFor(actor, stationId)), method: "rules" };
}

/** One call for the whole control desk. */
export async function getStationDesk(actor: Actor, requested?: string): Promise<StationDeskResponse> {
  const stationId = await stationFor(actor, requested);
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) throw notFound("station_not_found", "This station does not exist");
  const now = new Date();

  const routes = await prisma.route.findMany({
    where: { originId: stationId },
    include: { origin: true, destination: true },
    orderBy: { destination: { name: "asc" } },
  });
  const entries = await prisma.queueEntry.findMany({
    where: { routeId: { in: routes.map((route) => route.id) }, status: { in: ["WAITING", "CALLED"] } },
    include: { passenger: true },
    orderBy: [{ isPriority: "desc" }, { sortKey: "asc" }, { id: "asc" }],
  });

  const deskRoutes = routes.map((route) => {
    let position = 0;
    const list: DeskEntry[] = entries
      .filter((entry) => entry.routeId === route.id)
      .map((entry) => ({
        id: entry.id,
        firstName: firstName(entry.passenger.name),
        isPriority: entry.isPriority,
        priorityVerified: entry.priorityVerified,
        assistance: entry.assistance,
        status: entry.status,
        position: entry.status === "WAITING" ? ++position : null,
        joinedAt: entry.joinedAt.toISOString(),
        waitingMinutes: minutes(entry.joinedAt, now),
        tripId: entry.tripId,
      }));
    // Called passengers first (they are boarding), then the waiting line in order.
    list.sort((a, b) => (a.status === b.status ? (a.position ?? 0) - (b.position ?? 0) : a.status === "CALLED" ? -1 : 1));
    return {
      route: toRouteSummary(route),
      waiting: list.filter((entry) => entry.status === "WAITING").length,
      priorityWaiting: list.filter((entry) => entry.status === "WAITING" && entry.isPriority).length,
      entries: list,
    };
  });

  const [alerts, openDisputes, line] = await Promise.all([
    computeAlerts(stationId),
    prisma.dispute.count({ where: { stationId, status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.$transaction((tx) => loadLine(tx, stationId)),
  ]);
  const waiting = deskRoutes.reduce((sum, route) => sum + route.waiting, 0);
  const priorityTotal = deskRoutes.reduce((sum, route) => sum + route.priorityWaiting, 0);
  return {
    station: toStation(station),
    routes: deskRoutes,
    driverLine: toLine(line, null),
    counts: { waiting, priority: priorityTotal, openDisputes, alerts: alerts.length },
  };
}
