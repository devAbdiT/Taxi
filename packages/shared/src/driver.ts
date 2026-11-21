import { z } from "zod";
import { Id } from "./common.js";
import { DriverTaxi, DriverTrip, Report, RouteSummary, RouteWithDemand, TripEntry } from "./models.js";

/** GET /driver/me */
export const DriverMeResponse = z.object({
  taxi: DriverTaxi,
  activeTrip: DriverTrip.nullable(),
  /** 0 when there is no active trip. */
  seatsUsed: z.number().int(),
  /** Equals taxi.capacity when there is no active trip. */
  seatsLeft: z.number().int(),
});
export type DriverMeResponse = z.infer<typeof DriverMeResponse>;

/** POST /driver/arrive. Allowed when the taxi is OFFLINE or EN_ROUTE. */
export const DriverArriveRequest = z.object({
  stationId: Id,
});
export type DriverArriveRequest = z.input<typeof DriverArriveRequest>;

export const DriverArriveResponse = z.object({
  taxi: DriverTaxi,
});
export type DriverArriveResponse = z.infer<typeof DriverArriveResponse>;

export const DemandRoute = RouteWithDemand.extend({
  /** True when the route leaves the taxi's current station (taxi AT_STATION). */
  highlighted: z.boolean(),
});
export type DemandRoute = z.infer<typeof DemandRoute>;

/** "Waiting for your return: N passengers". The reverse of the taxi's active trip route. */
export const ReturnSuggestion = z.object({
  route: RouteSummary,
  waiting: z.number().int(),
  priorityWaiting: z.number().int(),
});
export type ReturnSuggestion = z.infer<typeof ReturnSuggestion>;

/** GET /driver/demand. Routes sorted by waiting, highest first. */
export const DriverDemandResponse = z.object({
  routes: z.array(DemandRoute),
  /** Null unless the taxi has an active trip whose reverse route exists. */
  returnSuggestion: ReturnSuggestion.nullable(),
});
export type DriverDemandResponse = z.infer<typeof DriverDemandResponse>;

/** POST /driver/trips/start. The route's origin must be the taxi's current station. */
export const StartTripRequest = z.object({
  routeId: Id,
});
export type StartTripRequest = z.input<typeof StartTripRequest>;

/**
 * Response of POST /driver/trips/start (201), GET /driver/trips/:id,
 * and POST /driver/trips/:id/{depart,cancel}.
 */
export const TripResponse = z.object({
  trip: DriverTrip,
});
export type TripResponse = z.infer<typeof TripResponse>;

/** POST /driver/trips/:id/call. Omit `count` to fill every seat left. */
export const CallPassengersRequest = z.object({
  count: z.number().int().min(1).max(19).optional(),
});
export type CallPassengersRequest = z.input<typeof CallPassengersRequest>;

export const CallPassengersResponse = z.object({
  trip: DriverTrip,
  /** The entries called by this request. Empty when nobody was waiting. */
  called: z.array(TripEntry),
});
export type CallPassengersResponse = z.infer<typeof CallPassengersResponse>;

/** Response of POST /driver/entries/:id/board and POST /driver/entries/:id/no-show. */
export const EntryActionResponse = z.object({
  entry: TripEntry,
  trip: DriverTrip,
});
export type EntryActionResponse = z.infer<typeof EntryActionResponse>;

/** Response of POST /driver/trips/:id/arrive. The taxi is now AT_STATION at the destination. */
export const ArriveTripResponse = z.object({
  trip: DriverTrip,
  taxi: DriverTaxi,
});
export type ArriveTripResponse = z.infer<typeof ArriveTripResponse>;

/** POST /driver/reports/:id/respond. One response per report. */
export const RespondReportRequest = z.object({
  response: z.string().trim().min(2).max(1000),
});
export type RespondReportRequest = z.input<typeof RespondReportRequest>;

export const RespondReportResponse = z.object({
  report: Report,
});
export type RespondReportResponse = z.infer<typeof RespondReportResponse>;
