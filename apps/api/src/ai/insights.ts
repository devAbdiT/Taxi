import type { Hotspot, InsightsResponse, TopIssue } from "@taxiflow/shared";
import { DisputeType } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";

export async function computeInsights(
  actor: { userId: string; role: string },
  query: { days: number; stationId?: string },
): Promise<InsightsResponse> {
  const days = Math.max(1, query.days || 7);
  const now = new Date();
  const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000);

  // 7. If actor.role === "STATION_REP": filter everything to actor's stationId
  let stationIdFilter = query.stationId;
  if (actor.role === "STATION_REP") {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { stationId: true },
    });
    if (user?.stationId) {
      stationIdFilter = user.stationId;
    }
  }

  // 2. topIssues: count disputes by type for current period and previous period
  const disputeWhereCurrent = {
    createdAt: { gte: currentPeriodStart, lte: now },
    ...(stationIdFilter ? { stationId: stationIdFilter } : {}),
  };
  const disputeWherePrevious = {
    createdAt: { gte: previousPeriodStart, lt: currentPeriodStart },
    ...(stationIdFilter ? { stationId: stationIdFilter } : {}),
  };

  const currentDisputeCounts = await prisma.dispute.groupBy({
    by: ["type"],
    where: disputeWhereCurrent,
    _count: { _all: true },
  });

  const prevDisputeCounts = await prisma.dispute.groupBy({
    by: ["type"],
    where: disputeWherePrevious,
    _count: { _all: true },
  });

  const prevDisputeMap = new Map<string, number>();
  for (const item of prevDisputeCounts) {
    prevDisputeMap.set(item.type, item._count._all);
  }

  const topIssues: TopIssue[] = [];
  const handledDisputeTypes = new Set<string>();

  for (const item of currentDisputeCounts) {
    handledDisputeTypes.add(item.type);
    const count = item._count._all;
    const previousCount = prevDisputeMap.get(item.type) ?? 0;
    topIssues.push({
      type: item.type,
      source: "dispute",
      count,
      previousCount,
      change: count - previousCount,
    });
  }

  // Also include any dispute types that existed only in the previous period
  for (const item of prevDisputeCounts) {
    if (!handledDisputeTypes.has(item.type)) {
      const previousCount = item._count._all;
      topIssues.push({
        type: item.type,
        source: "dispute",
        count: 0,
        previousCount,
        change: -previousCount,
      });
    }
  }

  // Count reports if not filtered by station (reports don't have direct stationId)
  let reportCountTotal = 0;
  if (!stationIdFilter) {
    const currentReportCounts = await prisma.report.groupBy({
      by: ["type"],
      where: {
        createdAt: { gte: currentPeriodStart, lte: now },
      },
      _count: { _all: true },
    });
    const prevReportCounts = await prisma.report.groupBy({
      by: ["type"],
      where: {
        createdAt: { gte: previousPeriodStart, lt: currentPeriodStart },
      },
      _count: { _all: true },
    });

    const prevReportMap = new Map<string, number>();
    for (const item of prevReportCounts) {
      prevReportMap.set(item.type, item._count._all);
    }

    const handledReportTypes = new Set<string>();
    for (const item of currentReportCounts) {
      handledReportTypes.add(item.type);
      const count = item._count._all;
      reportCountTotal += count;
      const previousCount = prevReportMap.get(item.type) ?? 0;
      topIssues.push({
        type: item.type,
        source: "report",
        count,
        previousCount,
        change: count - previousCount,
      });
    }

    for (const item of prevReportCounts) {
      if (!handledReportTypes.has(item.type)) {
        topIssues.push({
          type: item.type,
          source: "report",
          count: 0,
          previousCount: item._count._all,
          change: -item._count._all,
        });
      }
    }
  }

  topIssues.sort((a, b) => b.count - a.count);

  // 3. hotspots: group disputes by (stationId, hour of createdAt). Top 5 by count.
  const currentDisputes = await prisma.dispute.findMany({
    where: disputeWhereCurrent,
    include: {
      station: { select: { id: true, name: true } },
    },
  });

  const hotspotGroups = new Map<
    string,
    {
      stationId: string;
      stationName: string;
      hour: number;
      count: number;
      typeCounts: Map<string, number>;
    }
  >();

  for (const dispute of currentDisputes) {
    const hour = dispute.createdAt.getHours();
    const key = `${dispute.stationId}:${hour}`;
    let group = hotspotGroups.get(key);
    if (!group) {
      group = {
        stationId: dispute.stationId,
        stationName: dispute.station.name,
        hour,
        count: 0,
        typeCounts: new Map<string, number>(),
      };
      hotspotGroups.set(key, group);
    }
    group.count += 1;
    group.typeCounts.set(dispute.type, (group.typeCounts.get(dispute.type) ?? 0) + 1);
  }

  const sortedHotspotGroups = Array.from(hotspotGroups.values()).sort((a, b) => b.count - a.count);
  const hotspots: Hotspot[] = sortedHotspotGroups.slice(0, 5).map((g) => {
    let topType: string | null = null;
    let maxTypeCount = -1;
    for (const [t, c] of g.typeCounts.entries()) {
      if (c > maxTypeCount) {
        maxTypeCount = c;
        topType = t;
      }
    }
    const parsedTopType = topType ? DisputeType.safeParse(topType) : null;
    return {
      stationId: g.stationId,
      stationName: g.stationName,
      hour: g.hour,
      disputes: g.count,
      topType: parsedTopType?.success ? parsedTopType.data : null,
    };
  });

  // 4. repeatOffenders: users with 3+ disputes opened against them in the period.
  //    Return count + userIds (admin only gets userIds; controller only sees their station).
  const againstUserMap = new Map<string, number>();
  for (const dispute of currentDisputes) {
    if (dispute.againstUserId) {
      againstUserMap.set(dispute.againstUserId, (againstUserMap.get(dispute.againstUserId) ?? 0) + 1);
    }
  }

  const offenderUserIds: string[] = [];
  for (const [userId, count] of againstUserMap.entries()) {
    if (count >= 3) {
      offenderUserIds.push(userId);
    }
  }

  const repeatOffenders = {
    count: offenderUserIds.length,
    userIds: actor.role === "ADMIN" ? offenderUserIds : [],
  };

  // 5. suggestions: rule strings
  const suggestions: string[] = [];

  // Rule 1: If top dispute type is LINE_JUMPING at a specific station/hour
  if (hotspots.length > 0 && hotspots[0]?.topType === "LINE_JUMPING") {
    const h = hotspots[0];
    suggestions.push(
      `Most disputes are line-jumping at ${h.stationName} between ${h.hour}:00 and ${(h.hour + 1) % 24}:00: consider adding a second controller`,
    );
  }

  // Rule 2: If more than 40% priority claims
  const priorityDisputes = currentDisputes.filter((d) => d.type === "PRIORITY_CLAIM").length;
  const totalDisputes = currentDisputes.length;
  const priorityDisputeRatio = totalDisputes > 0 ? priorityDisputes / totalDisputes : 0;

  const totalQueue = await prisma.queueEntry.count({
    where: { joinedAt: { gte: currentPeriodStart } },
  });
  const priorityQueue = await prisma.queueEntry.count({
    where: { joinedAt: { gte: currentPeriodStart }, isPriority: true },
  });
  const priorityQueueRatio = totalQueue > 0 ? priorityQueue / totalQueue : 0;

  if (priorityDisputeRatio > 0.4 || priorityQueueRatio > 0.4) {
    suggestions.push("High priority claim rate — consider requiring documentation");
  }

  // Rule 3: If a driver has 3+ skipped-turn disputes: "Driver {plate} has multiple skipped-turn disputes"
  const skippedTurnDrivers = new Map<string, number>();
  for (const dispute of currentDisputes) {
    if (dispute.type === "DRIVER_SKIPPED_TURN" && dispute.againstUserId) {
      skippedTurnDrivers.set(
        dispute.againstUserId,
        (skippedTurnDrivers.get(dispute.againstUserId) ?? 0) + 1,
      );
    }
  }

  for (const [driverId, count] of skippedTurnDrivers.entries()) {
    if (count >= 3) {
      const taxi = await prisma.taxi.findUnique({
        where: { driverId },
        select: { plate: true },
      });
      suggestions.push(`Driver ${taxi?.plate ?? driverId} has multiple skipped-turn disputes`);
    }
  }

  // Rule 4: Repeat offenders advisory
  if (repeatOffenders.count > 0) {
    suggestions.push(
      `${repeatOffenders.count} user(s) have 3 or more disputes filed against them — review for possible suspension`,
    );
  }

  // Rule 5: Peak dispute hotspot advisory
  if (hotspots.length > 0 && hotspots[0] && hotspots[0].disputes >= 2) {
    suggestions.push(
      `Peak dispute activity observed at ${hotspots[0].stationName} around ${hotspots[0].hour}:00 — ensure controller presence during this window`,
    );
  }

  // Build 3-5 suggestions from rules
  const fallbackSuggestions = [
    "Ensure line markers and priority queues remain clearly designated during peak hours.",
    "Monitor passenger wait times during peak morning (7-9 AM) and evening (4-6 PM) commutes.",
    "Dispute rates are currently low across stations. Regular monitoring recommended.",
  ];

  for (const fallback of fallbackSuggestions) {
    if (suggestions.length >= 3) break;
    if (!suggestions.includes(fallback)) {
      suggestions.push(fallback);
    }
  }

  const finalSuggestions = suggestions.slice(0, 5);

  return {
    method: "rules",
    basedOnSamples: currentDisputes.length + reportCountTotal,
    synthetic: true,
    days,
    topIssues,
    hotspots,
    repeatOffenders,
    suggestions: finalSuggestions,
  };
}
