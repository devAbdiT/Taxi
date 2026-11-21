// The API contract lives in packages/shared (Person A). Screens keep importing from here.
export type {
  AdminStatsResponse,
  AssistanceType,
  AuthResponse,
  CallPassengersRequest,
  ContractRequest,
  CreateContractRequest,
  CreateRatingRequest,
  CreateReportRequest,
  DemandRoute,
  DriverArriveRequest,
  DriverDemandResponse,
  DriverMeResponse,
  DriverTrip,
  ErrorResponse,
  JoinQueueRequest,
  JoinQueueResponse,
  Language,
  MarkNotificationsReadRequest,
  MyQueueResponse,
  Notification,
  PassengerTrip,
  QueueEntry,
  QueueStatus,
  Rating,
  RegisterRequest,
  LoginRequest,
  Report,
  ReportStatus,
  ReportType,
  RespondReportRequest,
  ReturnSuggestion,
  Role,
  RouteSummary,
  RouteWithDemand,
  SmsMessage,
  StartTripRequest,
  Station,
  StationQueuesResponse,
  TaxiStatus,
  TripEntry,
  TripStatus,
  UpdateReportRequest,
} from "@taxiflow/shared";

export type { PublicUser as User } from "@taxiflow/shared";

import type { DriverDemandResponse, DriverMeResponse, DriverTrip, MyQueueResponse } from "@taxiflow/shared";

export type MyQueue = MyQueueResponse;
export type DriverMe = DriverMeResponse;
export type DriverDemand = DriverDemandResponse;
export type TripDetail = DriverTrip;
