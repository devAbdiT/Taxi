import { z } from "zod";
import { QueueStatus, TripStatus } from "./enums.js";
import { Notification } from "./models.js";

export const SOCKET_EVENTS = {
  DEMAND_UPDATE: "demand:update",
  QUEUE_UPDATE: "queue:update",
  NOTIFICATION_NEW: "notification:new",
  TRIP_UPDATE: "trip:update",
  ROUTE_SUBSCRIBE: "route:subscribe",
  ROUTE_UNSUBSCRIBE: "route:unsubscribe",
} as const;

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  route: (routeId: string) => `route:${routeId}`,
  drivers: "drivers",
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
}

export interface ClientToServerEvents {
  "route:subscribe": (payload: RouteSubscribePayload) => void;
  "route:unsubscribe": (payload: RouteSubscribePayload) => void;
}

/** Sent as `io(url, { auth: { token } })`. */
export interface SocketAuth {
  token: string;
}
