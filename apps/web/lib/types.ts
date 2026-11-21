// Frontend copy of the API contract (MASTER_PROMPT.md section 6).
// When packages/shared is published by the backend, replace this file's body with:
//   export * from "@taxiflow/shared";
// Every screen imports types from "@/lib/types", so that is the only change needed.

export type Role = "PASSENGER" | "DRIVER" | "STATION_REP" | "ADMIN";
export type Language = "en" | "am";
export type QueueStatus = "WAITING" | "CALLED" | "BOARDED" | "CANCELLED" | "NO_SHOW";
export type TaxiStatus = "OFFLINE" | "AT_STATION" | "LOADING" | "EN_ROUTE";
export type TripStatus = "LOADING" | "DEPARTED" | "COMPLETED" | "CANCELLED";
export type AssistanceType = "NONE" | "DISABILITY" | "ELDERLY" | "PREGNANT" | "MOBILITY" | "OTHER";
export type ReportType =
  | "OVERCHARGING"
  | "UNSAFE_DRIVING"
  | "DISRESPECT"
  | "DISCRIMINATION"
  | "LOST_PROPERTY"
  | "OTHER";
export type ReportStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";
export type RatingTag = "punctuality" | "cleanliness" | "safety" | "behavior";
export type ContractType = "FAMILY" | "SCHOOL" | "EMPLOYEE" | "SPECIAL";
export type ContractStatus = "NEW" | "CONTACTED" | "CONFIRMED" | "CLOSED";

/** Dates are ISO 8601 strings as sent over JSON. */
export type IsoDate = string;

export interface ApiErrorBody {
  error: string;
  message: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  language: Language;
  stationId: string | null;
}

export interface Station {
  id: string;
  name: string;
  nameAm: string | null;
}

export interface RouteRef {
  id: string;
  origin: Station;
  destination: Station;
}

export interface RouteSummary extends RouteRef {
  waiting: number;
  priorityWaiting: number;
  taxisAvailable: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  password: string;
  language: Language;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface QueueEntry {
  id: string;
  routeId: string;
  status: QueueStatus;
  assistance: AssistanceType;
  isPriority: boolean;
  joinedAt: IsoDate;
  calledAt: IsoDate | null;
  boardedAt: IsoDate | null;
  tripId: string | null;
}

export interface JoinQueueRequest {
  routeId: string;
  assistance?: AssistanceType;
}

export interface JoinQueueResponse {
  entry: QueueEntry;
  position: number;
}

export interface MyQueue {
  entry: QueueEntry | null;
  /** Only set while WAITING. */
  position: number | null;
  route: RouteSummary | null;
  /** Only set while CALLED. */
  taxiPlate: string | null;
}

export interface PassengerTrip {
  id: string;
  route: RouteRef;
  taxiPlate: string;
  status: TripStatus;
  departedAt: IsoDate | null;
  arrivedAt: IsoDate | null;
  rated: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: IsoDate;
}

export interface MarkNotificationsReadRequest {
  /** Omit to mark all as read. */
  ids?: string[];
}

export interface RatingRequest {
  tripId: string;
  stars: number;
  tags: RatingTag[];
  comment?: string;
}

export interface Rating extends RatingRequest {
  id: string;
  passengerId: string;
  createdAt: IsoDate;
}

export interface ReportRequest {
  type: ReportType;
  description: string;
  tripId?: string;
}

export interface Report {
  id: string;
  reporterId: string;
  tripId: string | null;
  driverId: string | null;
  type: ReportType;
  description: string;
  status: ReportStatus;
  driverResponse: string | null;
  resolutionNote: string | null;
  createdAt: IsoDate;
}

export interface UpdateReportRequest {
  status: ReportStatus;
  resolutionNote?: string;
}

export interface DriverResponseRequest {
  response: string;
}

export interface ContractRequestInput {
  type: ContractType;
  pickup: string;
  destination: string;
  schedule: string;
  passengerCount: number;
  notes?: string;
}

export interface ContractRequest extends ContractRequestInput {
  id: string;
  requesterId: string;
  status: ContractStatus;
  createdAt: IsoDate;
}

export interface Taxi {
  id: string;
  plate: string;
  capacity: number;
  status: TaxiStatus;
  currentStation: Station | null;
}

export interface TripSummary {
  id: string;
  route: RouteRef;
  status: TripStatus;
  createdAt: IsoDate;
  departedAt: IsoDate | null;
  arrivedAt: IsoDate | null;
  seatsUsed: number;
  capacity: number;
}

/** What drivers and station reps see about a passenger: first name and priority only, never the phone. */
export interface TripEntry {
  id: string;
  firstName: string;
  isPriority: boolean;
  assistance: AssistanceType;
  status: QueueStatus;
  joinedAt: IsoDate;
  calledAt: IsoDate | null;
}

export interface TripDetail extends TripSummary {
  entries: TripEntry[];
}

export interface DriverMe {
  taxi: Taxi;
  activeTrip: TripSummary | null;
  seatsUsed: number;
  seatsLeft: number;
}

export interface RouteDemand {
  route: RouteRef;
  waiting: number;
  priorityWaiting: number;
}

export interface ReturnSuggestion extends RouteDemand {
  /** RETURN_TRIP: reverse of the active trip. FROM_CURRENT_STATION: busiest route leaving the taxi's station. */
  reason: "RETURN_TRIP" | "FROM_CURRENT_STATION";
}

export interface DriverDemand {
  routes: RouteDemand[];
  returnSuggestion: ReturnSuggestion | null;
}

export interface StartTripRequest {
  routeId: string;
}

export interface CallPassengersRequest {
  count?: number;
}

export interface ArriveRequest {
  stationId: string;
}

export interface StationEntry extends TripEntry {
  /** Only set while WAITING. */
  position: number | null;
}

export interface StationQueue {
  route: RouteRef;
  entries: StationEntry[];
}

export interface StationQueues {
  station: Station;
  queues: StationQueue[];
  taxis: Pick<Taxi, "id" | "plate" | "capacity" | "status">[];
}

export interface RouteLoadFactor {
  route: RouteRef;
  /** 0 to 1 */
  loadFactor: number;
  trips: number;
}

export interface AdminStats {
  averageWaitMinutes: number | null;
  loadFactorByRoute: RouteLoadFactor[];
  tripsToday: number;
  waitingNow: number;
}

export interface SmsMessage {
  id: string;
  to: string;
  body: string;
  createdAt: IsoDate;
}

export const SOCKET_EVENTS = {
  demandUpdate: "demand:update",
  queueUpdate: "queue:update",
  notificationNew: "notification:new",
  tripUpdate: "trip:update",
} as const;

export interface DemandUpdatePayload {
  routeId: string;
  waiting: number;
  priorityWaiting: number;
}

export interface QueueUpdatePayload {
  entryId: string;
  status: QueueStatus;
  position: number | null;
  taxiPlate?: string;
}

export interface TripUpdatePayload {
  tripId: string;
  status: TripStatus;
  seatsUsed: number;
  capacity: number;
}
