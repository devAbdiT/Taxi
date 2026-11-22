import type { AdminReportsQuery, AdminStatsResponse, UpdateReportRequest } from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { reportUpdatedText } from "../lib/messages.js";
import { toAdminReport, toRouteSummary } from "../lib/serialize.js";
import { createNotification } from "../realtime/emitter.js";

const reportInclude = {
  reporter: true,
  driver: true,
  trip: { include: { taxi: true } },
} as const;

/** Midnight in Addis Ababa (UTC+3), as a UTC instant. */
function startOfTodayAddis(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 3 * 60 * 60 * 1000);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" || (typeof value === "object" && value !== null)) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  const [waitRows, loadRows, routes, tripsToday, waitingNow] = await Promise.all([
    prisma.$queryRaw<{ average: unknown }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("calledAt" - "joinedAt")))::float8 AS average
      FROM "QueueEntry"
      WHERE "calledAt" IS NOT NULL AND synthetic = false`,
    prisma.$queryRaw<{ routeId: string; completed: unknown; factor: unknown }[]>`
      SELECT trip."routeId",
             COUNT(*)::int AS completed,
             AVG(
               (SELECT COUNT(*) FROM "QueueEntry" entry WHERE entry."tripId" = trip.id AND entry.status = 'BOARDED')::float
               / taxi.capacity
             )::float8 AS factor
      FROM "Trip" trip
      JOIN "Taxi" taxi ON taxi.id = trip."taxiId"
      WHERE trip.status = 'COMPLETED'
      GROUP BY trip."routeId"`,
    prisma.route.findMany({
      include: { origin: true, destination: true },
      orderBy: [{ origin: { name: "asc" } }, { destination: { name: "asc" } }],
    }),
    prisma.trip.count({ where: { createdAt: { gte: startOfTodayAddis() } } }),
    prisma.queueEntry.count({ where: { status: "WAITING" } }),
  ]);

  const average = asNumber(waitRows[0]?.average);
  const loads = new Map(loadRows.map((row) => [row.routeId, row]));

  return {
    averageWaitSeconds: average === null ? null : Math.round(average),
    loadFactorByRoute: routes.map((route) => {
      const load = loads.get(route.id);
      const factor = load ? asNumber(load.factor) : null;
      return {
        route: toRouteSummary(route),
        loadFactor: factor === null ? null : Math.round(factor * 1000) / 1000,
        completedTrips: load ? Number(load.completed) : 0,
      };
    }),
    tripsToday,
    waitingNow,
  };
}

export async function listAdminReports(query: AdminReportsQuery) {
  const reports = await prisma.report.findMany({
    where: query.status ? { status: query.status } : {},
    include: reportInclude,
    orderBy: { createdAt: "desc" },
  });
  return { reports: reports.map(toAdminReport) };
}

export async function updateAdminReport(reportId: string, body: UpdateReportRequest) {
  const existing = await prisma.report.findUnique({ where: { id: reportId }, include: { reporter: true } });
  if (!existing) throw notFound("report_not_found", "This report does not exist");

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.resolutionNote !== undefined ? { resolutionNote: body.resolutionNote } : {}),
    },
    include: reportInclude,
  });

  const text = reportUpdatedText(existing.reporter.language);
  await createNotification({ userId: existing.reporterId, type: "REPORT_UPDATED", ...text });
  return { report: toAdminReport(updated) };
}
