import { z } from "zod";
import { RouteWithDemand, Station } from "./models.js";

/** GET /stations */
export const StationsResponse = z.object({
  stations: z.array(Station),
});
export type StationsResponse = z.infer<typeof StationsResponse>;

/** GET /routes */
export const RoutesResponse = z.object({
  routes: z.array(RouteWithDemand),
});
export type RoutesResponse = z.infer<typeof RoutesResponse>;

/** GET /public/pulse. Waiting passengers on every route. No token. */
export const PublicPulseResponse = z.object({
  waitingNow: z.number().int().nonnegative(),
});
export type PublicPulseResponse = z.infer<typeof PublicPulseResponse>;
