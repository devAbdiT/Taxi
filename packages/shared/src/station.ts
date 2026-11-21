import { z } from "zod";
import { IsoDate } from "./common.js";
import { QueueStatus, TaxiStatus } from "./enums.js";
import { RouteSummary, Station } from "./models.js";

/** An active entry as seen by a station rep: first name and priority only, never a phone. */
export const StationQueueEntry = z.object({
  id: z.string(),
  firstName: z.string(),
  isPriority: z.boolean(),
  status: QueueStatus,
  /** 1-based rank while WAITING, null while CALLED. */
  position: z.number().int().min(1).nullable(),
  joinedAt: IsoDate,
  tripId: z.string().nullable(),
});
export type StationQueueEntry = z.infer<typeof StationQueueEntry>;

export const StationRouteQueue = z.object({
  route: RouteSummary,
  waiting: z.number().int(),
  priorityWaiting: z.number().int(),
  /** WAITING entries in position order, then CALLED entries. */
  entries: z.array(StationQueueEntry),
});
export type StationRouteQueue = z.infer<typeof StationRouteQueue>;

export const StationTaxi = z.object({
  id: z.string(),
  plate: z.string(),
  capacity: z.number().int(),
  status: TaxiStatus,
  driverFirstName: z.string(),
  activeTripId: z.string().nullable(),
});
export type StationTaxi = z.infer<typeof StationTaxi>;

/** GET /station/queues. Routes leaving the rep's station, plus taxis there. */
export const StationQueuesResponse = z.object({
  station: Station,
  routes: z.array(StationRouteQueue),
  taxis: z.array(StationTaxi),
});
export type StationQueuesResponse = z.infer<typeof StationQueuesResponse>;

/** Response of POST /station/entries/:id/remove: the entry, now CANCELLED. */
export const RemoveEntryResponse = z.object({
  entry: StationQueueEntry,
});
export type RemoveEntryResponse = z.infer<typeof RemoveEntryResponse>;
