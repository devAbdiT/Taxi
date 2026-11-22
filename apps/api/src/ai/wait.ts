import type { WaitEstimateResponse } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/errors.js";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function isSameHourBucket(h1: number, h2: number): boolean {
  const diff = Math.abs(h1 - h2) % 24;
  const dist = diff > 12 ? 24 - diff : diff;
  return dist <= 1;
}

export async function computeWaitEstimate(routeId: string): Promise<WaitEstimateResponse> {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true },
  });
  if (!route) {
    throw notFound("route_not_found", "Route not found");
  }

  const now = new Date();
  const currentHour = now.getHours();

  // 1. Current queue length for this route (count WAITING entries)
  const currentQueueLength = await prisma.queueEntry.count({
    where: { routeId, status: "WAITING" },
  });

  // 2. Query QueueEntry where routeId = routeId AND status in [CALLED, BOARDED]
  //    AND calledAt IS NOT NULL AND joinedAt IS NOT NULL AND calledAt >= 14 days ago.
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const rawEntries = await prisma.queueEntry.findMany({
    where: {
      routeId,
      status: { in: ["CALLED", "BOARDED"] },
      calledAt: { not: null, gte: fourteenDaysAgo },
    },
    select: {
      joinedAt: true,
      calledAt: true,
    },
  });

  const routeWideSamples = rawEntries
    .filter((e) => e.calledAt !== null && e.joinedAt !== null)
    .map((e) => ({
      waitSeconds: Math.max(0, Math.round((e.calledAt!.getTime() - e.joinedAt.getTime()) / 1000)),
      hour: e.calledAt!.getHours(),
    }));

  // 3. Filter to same hour-of-day ±1 (mod 24)
  const sameHourSamples = routeWideSamples.filter((s) => isSameHourBucket(s.hour, currentHour));

  // Historical average queue length from DemandHistory for this route/hour bucket over last 14 days
  const demandRecords = await prisma.demandHistory.findMany({
    where: {
      routeId,
      hour: currentHour,
      date: { gte: fourteenDaysAgo },
    },
    select: { joins: true, synthetic: true },
  });

  const historicalAvgQueueLength =
    demandRecords.length > 0
      ? demandRecords.reduce((sum, r) => sum + r.joins, 0) / demandRecords.length
      : 1;

  // 7. Synthetic = true if any DemandHistory for this route has synthetic=true (or no history at all — demo data).
  const anySyntheticHistory = await prisma.demandHistory.findFirst({
    where: { routeId, synthetic: true },
    select: { id: true },
  });
  const totalHistoryCount = await prisma.demandHistory.count({
    where: { routeId },
  });
  const synthetic = totalHistoryCount === 0 || anySyntheticHistory !== null;

  // 4. If samples >= 10:
  if (sameHourSamples.length >= 10) {
    const waitSecondsList = sameHourSamples.map((s) => s.waitSeconds).sort((a, b) => a - b);
    const meanWaitSeconds = waitSecondsList.reduce((sum, s) => sum + s, 0) / waitSecondsList.length;
    const queueRatio = currentQueueLength / Math.max(historicalAvgQueueLength, 1);
    const weightedMeanSeconds = meanWaitSeconds * queueRatio;
    const minutes = Math.round((weightedMeanSeconds / 60) * 10) / 10;
    const p25Sec = percentile(waitSecondsList, 0.25);
    const p75Sec = percentile(waitSecondsList, 0.75);
    const lowMinutes =
      currentQueueLength === 0 ? 0 : Math.min(minutes, Math.round(((p25Sec * queueRatio) / 60) * 10) / 10);
    const highMinutes =
      currentQueueLength === 0 ? 0 : Math.max(minutes, Math.round(((p75Sec * queueRatio) / 60) * 10) / 10);
    const confidence = sameHourSamples.length >= 30 ? "high" : "medium";

    return {
      method: "statistics",
      basedOnSamples: sameHourSamples.length,
      synthetic,
      routeId,
      minutes,
      lowMinutes,
      highMinutes,
      confidence,
      basis: "same_hour",
    };
  }

  // 5. Else if route-wide samples (all hours, last 14 days) >= 1:
  if (routeWideSamples.length >= 1) {
    const waitSecondsList = routeWideSamples.map((s) => s.waitSeconds).sort((a, b) => a - b);
    const meanWaitSeconds = waitSecondsList.reduce((sum, s) => sum + s, 0) / waitSecondsList.length;
    const queueRatio = currentQueueLength / Math.max(historicalAvgQueueLength, 1);
    const weightedMeanSeconds = meanWaitSeconds * queueRatio;
    const minutes = Math.round((weightedMeanSeconds / 60) * 10) / 10;
    const p25Sec = percentile(waitSecondsList, 0.25);
    const p75Sec = percentile(waitSecondsList, 0.75);
    const lowMinutes =
      currentQueueLength === 0 ? 0 : Math.min(minutes, Math.round(((p25Sec * queueRatio) / 60) * 10) / 10);
    const highMinutes =
      currentQueueLength === 0 ? 0 : Math.max(minutes, Math.round(((p75Sec * queueRatio) / 60) * 10) / 10);

    return {
      method: "statistics",
      basedOnSamples: routeWideSamples.length,
      synthetic,
      routeId,
      minutes,
      lowMinutes,
      highMinutes,
      confidence: "low",
      basis: "route_average",
    };
  }

  // 6. Else: minutes = currentQueueLength * 3, basis "per_position", confidence "low", low = minutes * 0.5, high = minutes * 1.5.
  const minutes = currentQueueLength * 3;
  const lowMinutes = Math.round(minutes * 0.5 * 10) / 10;
  const highMinutes = Math.round(minutes * 1.5 * 10) / 10;

  return {
    method: "statistics",
    basedOnSamples: 0,
    synthetic,
    routeId,
    minutes,
    lowMinutes,
    highMinutes,
    confidence: "low",
    basis: "per_position",
  };
}

export async function quickEstimate(routeId: string): Promise<number> {
  const estimate = await computeWaitEstimate(routeId);
  return estimate.minutes;
}
