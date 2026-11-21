import { z } from "zod";
import { IsoDate } from "./common.js";
import {
  AssistanceType,
  ContractStatus,
  ContractType,
  Language,
  NotificationType,
  QueueStatus,
  RatingTag,
  ReportStatus,
  ReportType,
  Role,
  TaxiStatus,
  TripStatus,
} from "./enums.js";

/** A user as returned to themselves. Never contains the password hash. */
export const PublicUser = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  role: Role,
  language: Language,
  stationId: z.string().nullable(),
  createdAt: IsoDate,
});
export type PublicUser = z.infer<typeof PublicUser>;

export const Station = z.object({
  id: z.string(),
  name: z.string(),
  nameAm: z.string().nullable(),
});
export type Station = z.infer<typeof Station>;

export const RouteSummary = z.object({
  id: z.string(),
  origin: Station,
  destination: Station,
});
export type RouteSummary = z.infer<typeof RouteSummary>;

export const RouteDemand = z.object({
  waiting: z.number().int(),
  priorityWaiting: z.number().int(),
  /** Taxis AT_STATION or LOADING at the route's origin station. */
  taxisAvailable: z.number().int(),
});
export type RouteDemand = z.infer<typeof RouteDemand>;

export const RouteWithDemand = RouteSummary.extend(RouteDemand.shape);
export type RouteWithDemand = z.infer<typeof RouteWithDemand>;

/** A queue entry as seen by the passenger who owns it. */
export const QueueEntry = z.object({
  id: z.string(),
  route: RouteSummary,
  status: QueueStatus,
  assistance: AssistanceType,
  isPriority: z.boolean(),
  joinedAt: IsoDate,
  calledAt: IsoDate.nullable(),
  boardedAt: IsoDate.nullable(),
  tripId: z.string().nullable(),
});
export type QueueEntry = z.infer<typeof QueueEntry>;

/** A queue entry as seen by a driver or station rep: first name and priority only, never a phone. */
export const TripEntry = z.object({
  id: z.string(),
  firstName: z.string(),
  isPriority: z.boolean(),
  status: QueueStatus,
  calledAt: IsoDate.nullable(),
  boardedAt: IsoDate.nullable(),
});
export type TripEntry = z.infer<typeof TripEntry>;

export const DriverTaxi = z.object({
  id: z.string(),
  plate: z.string(),
  capacity: z.number().int(),
  status: TaxiStatus,
  currentStation: Station.nullable(),
});
export type DriverTaxi = z.infer<typeof DriverTaxi>;

export const DriverTrip = z.object({
  id: z.string(),
  route: RouteSummary,
  status: TripStatus,
  taxiPlate: z.string(),
  capacity: z.number().int(),
  /** Entries on this trip that are CALLED or BOARDED. */
  seatsUsed: z.number().int(),
  seatsLeft: z.number().int(),
  createdAt: IsoDate,
  departedAt: IsoDate.nullable(),
  arrivedAt: IsoDate.nullable(),
  /** Every entry ever attached to this trip, in call order. */
  entries: z.array(TripEntry),
});
export type DriverTrip = z.infer<typeof DriverTrip>;

export const Notification = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationType,
  /** Written in the recipient's language. */
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
  createdAt: IsoDate,
});
export type Notification = z.infer<typeof Notification>;

export const Rating = z.object({
  id: z.string(),
  tripId: z.string(),
  passengerId: z.string(),
  stars: z.number().int().min(1).max(5),
  tags: z.array(RatingTag),
  comment: z.string().nullable(),
  createdAt: IsoDate,
});
export type Rating = z.infer<typeof Rating>;

export const Report = z.object({
  id: z.string(),
  reporterId: z.string(),
  tripId: z.string().nullable(),
  driverId: z.string().nullable(),
  type: ReportType,
  description: z.string(),
  status: ReportStatus,
  driverResponse: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  createdAt: IsoDate,
});
export type Report = z.infer<typeof Report>;

export const PersonRef = z.object({
  id: z.string(),
  name: z.string(),
});
export type PersonRef = z.infer<typeof PersonRef>;

export const AdminReport = Report.extend({
  reporter: PersonRef,
  driver: PersonRef.nullable(),
  taxiPlate: z.string().nullable(),
});
export type AdminReport = z.infer<typeof AdminReport>;

export const ContractRequest = z.object({
  id: z.string(),
  requesterId: z.string(),
  type: ContractType,
  pickup: z.string(),
  destination: z.string(),
  schedule: z.string(),
  passengerCount: z.number().int(),
  notes: z.string().nullable(),
  status: ContractStatus,
  createdAt: IsoDate,
});
export type ContractRequest = z.infer<typeof ContractRequest>;
