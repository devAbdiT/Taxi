import type { DemandForecastResponse, ForecastPoint, RouteForecast } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { toRouteSummary } from "../lib/serialize.js";

function formatHourAmPm(date: Date): string {
  const h = date.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${ampm}`;
}

export async function computeDemandForecast(stationId: string): Promise<DemandForecastResponse> {
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true, name: true },
  });
  if (!station) {
    throw notFound("station_not_found", "Station not found");
  }

  // 1. Get all routes where originId = stationId OR destinationId = stationId
  const routes = await prisma.route.findMany({
    where: {
      OR: [{ originId: stationId }, { destinationId: stationId }],
    },
    include: {
      origin: true,
      destination: true,
    },
  });

  const now = new Date();
  const currentHour = now.getHours();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const routeIds = routes.map((r) => r.id);

  // Query DemandHistory where routeId in routeIds AND date >= 14 days ago
  const allDemand = await prisma.demandHistory.findMany({
    where: {
      routeId: { in: routeIds },
      date: { gte: fourteenDaysAgo },
    },
  });

  // Group demand by routeId, and by `${routeId}:${hour}`
  const demandByRoute = new Map<string, typeof allDemand>();
  const demandByRouteHour = new Map<string, typeof allDemand>();

  for (const record of allDemand) {
    const list = demandByRoute.get(record.routeId) ?? [];
    list.push(record);
    demandByRoute.set(record.routeId, list);

    const key = `${record.routeId}:${record.hour}`;
    const hourList = demandByRouteHour.get(key) ?? [];
    hourList.push(record);
    demandByRouteHour.set(key, hourList);
  }

  // Live queue count for current hour
  const liveQueueEntries = await prisma.queueEntry.groupBy({
    by: ["routeId"],
    where: {
      routeId: { in: routeIds },
      status: "WAITING",
    },
    _count: { _all: true },
  });

  const liveCounts = new Map<string, number>();
  for (const entry of liveQueueEntries) {
    liveCounts.set(entry.routeId, entry._count._all);
  }

  const routeForecasts: RouteForecast[] = [];
  let bestRecommendationCandidate: {
    routeId: string;
    stationId: string;
    hourStart: string;
    expectedWaiting: number;
    hourDate: Date;
  } | null = null;

  for (const route of routes) {
    const points: ForecastPoint[] = [];

    for (let i = 0; i < 3; i++) {
      const hourDate = new Date(now);
      hourDate.setHours(currentHour + i, 0, 0, 0);
      const targetHour = hourDate.getHours();
      const hourStart = hourDate.toISOString();

      const key = `${route.id}:${targetHour}`;
      const targetRecords = demandByRouteHour.get(key) ?? [];

      let recordsToUse = targetRecords;
      if (recordsToUse.length < 3) {
        const weekdayRecords = (demandByRoute.get(route.id) ?? []).filter((r) => {
          const day = r.date.getDay();
          return day >= 1 && day <= 5; // Monday to Friday
        });
        if (weekdayRecords.length > 0) {
          recordsToUse = weekdayRecords;
        }
      }

      let mean = 0;
      let min = 0;
      let max = 0;

      if (recordsToUse.length > 0) {
        const joinsList = recordsToUse.map((r) => r.joins);
        mean = joinsList.reduce((sum, j) => sum + j, 0) / joinsList.length;
        min = Math.min(...joinsList);
        max = Math.max(...joinsList);
      }

      let expectedWaiting: number;
      if (i === 0) {
        const liveCount = liveCounts.get(route.id) ?? 0;
        expectedWaiting = Math.round((0.6 * mean + 0.4 * liveCount) * 10) / 10;
      } else {
        expectedWaiting = Math.round(mean * 10) / 10;
      }

      const low = Math.min(expectedWaiting, Math.round(min * 10) / 10);
      const high = Math.max(expectedWaiting, Math.round(max * 10) / 10);

      points.push({
        hourStart,
        expectedWaiting,
        low,
        high,
      });

      if (
        !bestRecommendationCandidate ||
        expectedWaiting > bestRecommendationCandidate.expectedWaiting
      ) {
        bestRecommendationCandidate = {
          routeId: route.id,
          stationId: route.originId,
          hourStart,
          expectedWaiting,
          hourDate,
        };
      }
    }

    routeForecasts.push({
      route: toRouteSummary(route),
      hours: points,
    });
  }

  // 5. synthetic = true if any DemandHistory used has synthetic=true (or no demand history exists)
  const synthetic = allDemand.length === 0 || allDemand.some((d) => d.synthetic);

  // 3 & 4: Recommendation
  let recommendation = null;
  if (bestRecommendationCandidate) {
    const formattedHour = formatHourAmPm(bestRecommendationCandidate.hourDate);
    recommendation = {
      routeId: bestRecommendationCandidate.routeId,
      stationId: station.id,
      hourStart: bestRecommendationCandidate.hourStart,
      expectedWaiting: bestRecommendationCandidate.expectedWaiting,
      message: `About ${Math.round(bestRecommendationCandidate.expectedWaiting)} people expected at ${station.name} around ${formattedHour}`,
    };
  }

  return {
    method: "statistics",
    basedOnSamples: allDemand.length,
    synthetic,
    stationId,
    routes: routeForecasts,
    recommendation,
  };
}
