import type { RouteWithDemand } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { toRouteSummary } from "../lib/serialize.js";

/** Every route with its WAITING counts and the taxis AT_STATION or LOADING at its origin. */
export async function listRoutesWithDemand(): Promise<RouteWithDemand[]> {
  const [routes, waitingGroups, taxiGroups] = await Promise.all([
    prisma.route.findMany({
      include: { origin: true, destination: true },
      orderBy: [{ origin: { name: "asc" } }, { destination: { name: "asc" } }],
    }),
    prisma.queueEntry.groupBy({
      by: ["routeId", "isPriority"],
      where: { status: "WAITING" },
      _count: { _all: true },
    }),
    prisma.taxi.groupBy({
      by: ["currentStationId"],
      where: { status: { in: ["AT_STATION", "LOADING"] }, currentStationId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const taxisByStation = new Map(taxiGroups.map((group) => [group.currentStationId, group._count._all]));

  return routes.map((route) => {
    let waiting = 0;
    let priorityWaiting = 0;
    for (const group of waitingGroups) {
      if (group.routeId !== route.id) continue;
      waiting += group._count._all;
      if (group.isPriority) priorityWaiting += group._count._all;
    }
    return {
      ...toRouteSummary(route),
      waiting,
      priorityWaiting,
      taxisAvailable: taxisByStation.get(route.originId) ?? 0,
    };
  });
}
