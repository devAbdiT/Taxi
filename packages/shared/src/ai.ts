import { z } from "zod";
import { Id, IsoDate } from "./common.js";
import { AiMethod, DisputeType } from "./enums.js";
import { MatchScoreParts } from "./gps.js";
import { RouteSummary } from "./models.js";

/** Every AI answer carries these three fields. Never call statistics or rules "machine learning". */
export const AiLabel = z.object({
  method: AiMethod,
  basedOnSamples: z.number().int(),
  /** True when the numbers come from the seeded demo history. */
  synthetic: z.boolean(),
});
export type AiLabel = z.infer<typeof AiLabel>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

/** GET /ai/wait-estimate?routeId= */
export const WaitEstimateQuery = z.object({ routeId: Id });
export type WaitEstimateQuery = z.input<typeof WaitEstimateQuery>;

export const WaitEstimateResponse = AiLabel.extend({
  routeId: z.string(),
  minutes: z.number(),
  lowMinutes: z.number(),
  highMinutes: z.number(),
  confidence: Confidence,
  /** How the number was found, in plain words. */
  basis: z.enum(["same_hour", "route_average", "per_position"]),
});
export type WaitEstimateResponse = z.infer<typeof WaitEstimateResponse>;

/** GET /ai/demand-forecast?stationId= */
export const DemandForecastQuery = z.object({ stationId: Id });
export type DemandForecastQuery = z.input<typeof DemandForecastQuery>;

export const ForecastPoint = z.object({
  hourStart: IsoDate,
  expectedWaiting: z.number(),
  low: z.number(),
  high: z.number(),
});
export type ForecastPoint = z.infer<typeof ForecastPoint>;

export const RouteForecast = z.object({
  route: RouteSummary,
  /** The next 3 hours, starting with the current one. */
  hours: z.array(ForecastPoint),
});
export type RouteForecast = z.infer<typeof RouteForecast>;

export const ForecastRecommendation = z.object({
  routeId: z.string(),
  stationId: z.string(),
  hourStart: IsoDate,
  expectedWaiting: z.number(),
  message: z.string(),
});
export type ForecastRecommendation = z.infer<typeof ForecastRecommendation>;

export const DemandForecastResponse = AiLabel.extend({
  stationId: z.string(),
  routes: z.array(RouteForecast),
  recommendation: ForecastRecommendation.nullable(),
});
export type DemandForecastResponse = z.infer<typeof DemandForecastResponse>;

/** GET /admin/ai/insights?days=7 */
export const InsightsQuery = z.object({
  days: z.coerce.number().int().min(1).max(60).default(7),
  stationId: Id.optional(),
});
export type InsightsQuery = z.input<typeof InsightsQuery>;

export const TopIssue = z.object({
  type: z.string(),
  source: z.enum(["report", "dispute"]),
  count: z.number().int(),
  previousCount: z.number().int(),
  change: z.number().int(),
});
export type TopIssue = z.infer<typeof TopIssue>;

export const Hotspot = z.object({
  stationId: z.string(),
  stationName: z.string(),
  hour: z.number().int().min(0).max(23),
  disputes: z.number().int(),
  topType: DisputeType.nullable(),
});
export type Hotspot = z.infer<typeof Hotspot>;

export const InsightsResponse = AiLabel.extend({
  days: z.number().int(),
  topIssues: z.array(TopIssue),
  hotspots: z.array(Hotspot),
  repeatOffenders: z.object({ count: z.number().int(), userIds: z.array(z.string()) }),
  suggestions: z.array(z.string()),
});
export type InsightsResponse = z.infer<typeof InsightsResponse>;

/** Re-exported so the web can show the match breakdown next to a pickup. */
export const MatchBreakdown = MatchScoreParts;
