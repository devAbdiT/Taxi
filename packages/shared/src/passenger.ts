import { z } from "zod";
import { Id, IsoDate } from "./common.js";
import { ContractType, RatingTag, ReportType, TripStatus } from "./enums.js";
import { ContractRequest, Rating, Report, RouteSummary } from "./models.js";

/** One trip the passenger boarded. */
export const PassengerTrip = z.object({
  tripId: z.string(),
  entryId: z.string(),
  route: RouteSummary,
  status: TripStatus,
  taxiPlate: z.string(),
  driverFirstName: z.string(),
  boardedAt: IsoDate.nullable(),
  departedAt: IsoDate.nullable(),
  arrivedAt: IsoDate.nullable(),
  rated: z.boolean(),
  /** True when the trip is COMPLETED and not rated yet. */
  canRate: z.boolean(),
});
export type PassengerTrip = z.infer<typeof PassengerTrip>;

/** GET /trips/mine, newest first. */
export const MyTripsResponse = z.object({
  trips: z.array(PassengerTrip),
});
export type MyTripsResponse = z.infer<typeof MyTripsResponse>;

/** POST /ratings */
export const CreateRatingRequest = z.object({
  tripId: Id,
  stars: z.number().int().min(1).max(5),
  tags: z.array(RatingTag).max(4).default([]),
  comment: z.string().trim().max(500).optional(),
});
export type CreateRatingRequest = z.input<typeof CreateRatingRequest>;

export const CreateRatingResponse = z.object({
  rating: Rating,
});
export type CreateRatingResponse = z.infer<typeof CreateRatingResponse>;

/** POST /reports. The driver is taken from the trip when tripId is given. */
export const CreateReportRequest = z.object({
  type: ReportType,
  description: z.string().trim().min(5).max(1000),
  tripId: Id.optional(),
});
export type CreateReportRequest = z.input<typeof CreateReportRequest>;

export const CreateReportResponse = z.object({
  report: Report,
});
export type CreateReportResponse = z.infer<typeof CreateReportResponse>;

/** POST /contracts (stretch) */
export const CreateContractRequest = z.object({
  type: ContractType,
  pickup: z.string().trim().min(2).max(200),
  destination: z.string().trim().min(2).max(200),
  schedule: z.string().trim().min(2).max(200),
  passengerCount: z.number().int().min(1).max(100),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateContractRequest = z.input<typeof CreateContractRequest>;

export const CreateContractResponse = z.object({
  request: ContractRequest,
});
export type CreateContractResponse = z.infer<typeof CreateContractResponse>;
