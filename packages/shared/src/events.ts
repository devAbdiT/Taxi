import { z } from "zod";
import { ControllerActionType, DisputeStatus, DisputeType, PickupStatus, QueueStatus, TripStatus } from "./enums.js";
import { Notification } from "./models.js";

export const SOCKET_EVENTS = {
  DEMAND_UPDATE: "demand:update",
  QUEUE_UPDATE: "queue:update",
  NOTIFICATION_NEW: "notification:new",
  TRIP_UPDATE: "trip:update",
  DISPUTE_UPDATE: "dispute:update",
  QUEUE_CONTROL: "queue:control",
  TAXI_LOCATION: "taxi:location",
  PICKUP_NEW: "pickup:new",
  PICKUP_UPDATE: "pickup:update",
  ROUTE_SUBSCRIBE: "route:subscribe",
  ROUTE_UNSUBSCRIBE: "route:unsubscribe",
} as const;

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  route: (routeId: string) => `route:${routeId}`,
  drivers: "drivers",
  station: (stationId: string) => `station:${stationId}`,
  trip: (tripId: string) => `trip:${tripId}`,
  pickup: (pickupId: string) => `pickup:${pickupId}`,
} as const;

/** demand:update, sent to room "drivers" and room "route:{routeId}". */
export const DemandUpdatePayload = z.object({
  routeId: z.string(),
  waiting: z.number().int(),
  priorityWaiting: z.number().int(),
});
export type DemandUpdatePayload = z.infer<typeof DemandUpdatePayload>;

/** queue:update, sent to room "user:{passengerId}". */
export const QueueUpdatePayload = z.object({
  entryId: z.string(),
  status: QueueStatus,
  /** Set only while WAITING. */
  position: z.number().int().min(1).nullable(),
  /** Set only when CALLED. */
  taxiPlate: z.string().nullable(),
});
export type QueueUpdatePayload = z.infer<typeof QueueUpdatePayload>;

/** notification:new, sent to room "user:{userId}". */
export const NotificationNewPayload = Notification;
export type NotificationNewPayload = z.infer<typeof NotificationNewPayload>;

/** trip:update, sent to room "user:{driverId}". */
export const TripUpdatePayload = z.object({
  tripId: z.string(),
  status: TripStatus,
  seatsUsed: z.number().int(),
  capacity: z.number().int(),
});
export type TripUpdatePayload = z.infer<typeof TripUpdatePayload>;

/** dispute:update, sent to room "station:{stationId}" and to the user rooms of both parties. */
export const DisputeUpdatePayload = z.object({
  disputeId: z.string(),
  stationId: z.string(),
  type: DisputeType,
  status: DisputeStatus,
});
export type DisputeUpdatePayload = z.infer<typeof DisputeUpdatePayload>;

/** queue:control, sent to the user room of the person a controller acted on. Carries the reason. */
export const QueueControlPayload = z.object({
  actionId: z.string(),
  action: ControllerActionType,
  entryId: z.string().nullable(),
  reason: z.string(),
  /** Until when the person may appeal (48 hours). */
  canAppealUntil: z.string(),
});
export type QueueControlPayload = z.infer<typeof QueueControlPayload>;

/** taxi:location, sent to rooms "trip:{tripId}" and "pickup:{pickupId}". */
export const TaxiLocationPayload = z.object({
  taxiId: z.string(),
  tripId: z.string().nullable(),
  pickupId: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  heading: z.number().nullable(),
  speedKmh: z.number().nullable(),
  updatedAt: z.string(),
});
export type TaxiLocationPayload = z.infer<typeof TaxiLocationPayload>;

/** pickup:new, sent to drivers who may take the request. Approximate position only (about 300 m). */
export const PickupNewPayload = z.object({
  pickupId: z.string(),
  approxLat: z.number(),
  approxLng: z.number(),
  seats: z.number().int(),
  expiresAt: z.string(),
  /** False for the first three drivers, true once the request is widened to everyone in range. */
  widened: z.boolean(),
});
export type PickupNewPayload = z.infer<typeof PickupNewPayload>;

/** pickup:update, sent to the passenger and the accepting driver. */
export const PickupUpdatePayload = z.object({
  pickupId: z.string(),
  status: PickupStatus,
  taxiPlate: z.string().nullable(),
  driverFirstName: z.string().nullable(),
});
export type PickupUpdatePayload = z.infer<typeof PickupUpdatePayload>;

export const RouteSubscribePayload = z.object({
  routeId: z.string(),
});
export type RouteSubscribePayload = z.infer<typeof RouteSubscribePayload>;

/** Typed events for `Server<ClientToServerEvents, ServerToClientEvents>` and `Socket<ServerToClientEvents, ClientToServerEvents>`. */
export interface ServerToClientEvents {
  "demand:update": (payload: DemandUpdatePayload) => void;
  "queue:update": (payload: QueueUpdatePayload) => void;
  "notification:new": (payload: NotificationNewPayload) => void;
  "trip:update": (payload: TripUpdatePayload) => void;
  "dispute:update": (payload: DisputeUpdatePayload) => void;
  "queue:control": (payload: QueueControlPayload) => void;
  "taxi:location": (payload: TaxiLocationPayload) => void;
  "pickup:new": (payload: PickupNewPayload) => void;
  "pickup:update": (payload: PickupUpdatePayload) => void;
}

export interface ClientToServerEvents {
  "route:subscribe": (payload: RouteSubscribePayload) => void;
  "route:unsubscribe": (payload: RouteSubscribePayload) => void;
}

/** Sent as `io(url, { auth: { token } })`. */
export interface SocketAuth {
  token: string;
}
