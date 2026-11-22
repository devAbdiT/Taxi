import { z } from "zod";

export const Role = z.enum(["PASSENGER", "DRIVER", "STATION_REP", "ADMIN"]);
export type Role = z.infer<typeof Role>;

export const QueueStatus = z.enum(["WAITING", "CALLED", "BOARDED", "CANCELLED", "NO_SHOW"]);
export type QueueStatus = z.infer<typeof QueueStatus>;

/** WAITING and CALLED count as "active": a passenger has at most one active entry. */
export const ACTIVE_QUEUE_STATUSES = ["WAITING", "CALLED"] as const satisfies readonly QueueStatus[];

export const TaxiStatus = z.enum(["OFFLINE", "AT_STATION", "LOADING", "EN_ROUTE"]);
export type TaxiStatus = z.infer<typeof TaxiStatus>;

export const TripStatus = z.enum(["LOADING", "DEPARTED", "COMPLETED", "CANCELLED"]);
export type TripStatus = z.infer<typeof TripStatus>;

export const AssistanceType = z.enum(["NONE", "DISABILITY", "ELDERLY", "PREGNANT", "MOBILITY", "OTHER"]);
export type AssistanceType = z.infer<typeof AssistanceType>;

export const Language = z.enum(["en", "am"]);
export type Language = z.infer<typeof Language>;

export const RatingTag = z.enum(["PUNCTUALITY", "CLEANLINESS", "SAFETY", "BEHAVIOR"]);
export type RatingTag = z.infer<typeof RatingTag>;

export const ReportType = z.enum([
  "OVERCHARGING",
  "UNSAFE_DRIVING",
  "DISRESPECT",
  "DISCRIMINATION",
  "LOST_PROPERTY",
  "OTHER",
]);
export type ReportType = z.infer<typeof ReportType>;

export const ReportStatus = z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const ContractType = z.enum(["FAMILY", "SCHOOL", "EMPLOYEE", "SPECIAL"]);
export type ContractType = z.infer<typeof ContractType>;

export const ContractStatus = z.enum(["NEW", "CONTACTED", "CONFIRMED", "CLOSED"]);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const NotificationType = z.enum([
  "QUEUE_JOINED",
  "QUEUE_CALLED",
  "QUEUE_RETURNED",
  "QUEUE_REMOVED",
  "QUEUE_NO_SHOW",
  "TRIP_COMPLETED",
  "PASSENGER_LEFT",
  "REPORT_FILED",
  "REPORT_UPDATED",
  "SYSTEM",
  "CONTROLLER_ACTION",
  "DISPUTE_UPDATE",
  "APPEAL_UPDATE",
  "PICKUP_UPDATE",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const DisputeType = z.enum(["LINE_JUMPING", "PRIORITY_CLAIM", "DRIVER_SKIPPED_TURN", "FARE_DISPUTE", "BEHAVIOR", "OTHER"]);
export type DisputeType = z.infer<typeof DisputeType>;

export const DisputeStatus = z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "APPEALED"]);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

export const ControllerActionType = z.enum([
  "WARN",
  "MOVE_BACK",
  "MOVE_FORWARD",
  "CONFIRM_PRIORITY",
  "REJECT_PRIORITY",
  "MARK_NO_SHOW",
  "REMOVE",
  "SUSPEND",
  "ALLOW_OUT_OF_TURN",
  "REORDER_DRIVER",
  "RESOLVE_DISPUTE",
  "APPEAL_REVERSED",
]);
export type ControllerActionType = z.infer<typeof ControllerActionType>;

export const AppealStatus = z.enum(["OPEN", "UPHELD", "REVERSED"]);
export type AppealStatus = z.infer<typeof AppealStatus>;

export const DriverQueueStatus = z.enum(["WAITING", "LOADING", "DEPARTED", "LEFT"]);
export type DriverQueueStatus = z.infer<typeof DriverQueueStatus>;

export const PickupStatus = z.enum(["OPEN", "ACCEPTED", "ARRIVED", "COMPLETED", "CANCELLED", "EXPIRED"]);
export type PickupStatus = z.infer<typeof PickupStatus>;

/** Every AI answer says how it was made. "llm" is only ever used to phrase text. */
export const AiMethod = z.enum(["statistics", "rules", "llm"]);
export type AiMethod = z.infer<typeof AiMethod>;
