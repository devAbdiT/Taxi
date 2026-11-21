import { z } from "zod";
import { ReportStatus } from "./enums.js";
import { AdminReport, RouteSummary } from "./models.js";

export const RouteLoadFactor = z.object({
  route: RouteSummary,
  /** Average of boarded / capacity over completed trips, 0 to 1. Null when no completed trips. */
  loadFactor: z.number().min(0).max(1).nullable(),
  completedTrips: z.number().int(),
});
export type RouteLoadFactor = z.infer<typeof RouteLoadFactor>;

/** GET /admin/stats */
export const AdminStatsResponse = z.object({
  /** Average of calledAt - joinedAt over called entries. Null when nobody was called yet. */
  averageWaitSeconds: z.number().nullable(),
  loadFactorByRoute: z.array(RouteLoadFactor),
  tripsToday: z.number().int(),
  waitingNow: z.number().int(),
});
export type AdminStatsResponse = z.infer<typeof AdminStatsResponse>;

/** GET /admin/reports?status=OPEN (status is optional). Newest first. */
export const AdminReportsQuery = z.object({
  status: ReportStatus.optional(),
});
export type AdminReportsQuery = z.input<typeof AdminReportsQuery>;

export const AdminReportsResponse = z.object({
  reports: z.array(AdminReport),
});
export type AdminReportsResponse = z.infer<typeof AdminReportsResponse>;

/** PATCH /admin/reports/:id. At least one field. */
export const UpdateReportRequest = z
  .object({
    status: ReportStatus.optional(),
    resolutionNote: z.string().trim().max(1000).optional(),
  })
  .refine((body) => body.status !== undefined || body.resolutionNote !== undefined, {
    message: "Provide status or resolutionNote",
  });
export type UpdateReportRequest = z.input<typeof UpdateReportRequest>;

export const UpdateReportResponse = z.object({
  report: AdminReport,
});
export type UpdateReportResponse = z.infer<typeof UpdateReportResponse>;
