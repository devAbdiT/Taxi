import { API_URL, USE_MOCKS } from "@/lib/config";
import type {
  AdminAppealEntry,
  AdminReportsResponse,
  AdminStatsResponse,
  ArriveTripResponse,
  AuditLogEntry,
  AuthResponse,
  CallPassengersRequest,
  CallPassengersResponse,
  CreateAppealRequest,
  CreateContractRequest,
  CreateContractResponse,
  CreateDisputeRequest,
  CreatePickupRequest,
  CreatePickupResponse,
  CreateRatingRequest,
  CreateRatingResponse,
  CreateReportRequest,
  CreateReportResponse,
  DecideAppealRequest,
  DemandForecastResponse,
  DevResetResponse,
  DevSmsResponse,
  DriverArriveRequest,
  DriverArriveResponse,
  DriverCorridor,
  DriverCorridorResponse,
  DriverDemandResponse,
  DriverMeResponse,
  DriverMyPickupResponse,
  DriverPickupResponse,
  DriverQueueResponse,
  DriverReportsResponse,
  EntryActionResponse,
  FleetResponse,
  InsightsResponse,
  JoinQueueRequest,
  JoinQueueResponse,
  LeaveQueueResponse,
  LocationConsentResponse,
  LoginRequest,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
  MeResponse,
  MyActionEntry,
  MyAppealEntry,
  MyDisputeEntry,
  MyPickupResponse,
  MyQueueResponse,
  MySuspensionResponse,
  MyTripsResponse,
  NearbyPickupsResponse,
  NearbyTaxisResponse,
  NotificationsResponse,
  PublicPulseResponse,
  RegisterRequest,
  RemoveEntryResponse,
  RespondReportRequest,
  RespondReportResponse,
  RoutesResponse,
  SetDriverCorridorRequest,
  StartTripRequest,
  StationActionRequest,
  StationAlert,
  StationDeskResponse,
  StationDisputeEntry,
  StationQueuesResponse,
  StationsResponse,
  TaxiLocationRequest,
  TaxiLocationResponse,
  TripResponse,
  TripTrackResponse,
  UpdateDisputeRequest,
  UpdateReportRequest,
  UpdateReportResponse,
  WaitEstimateResponse,
} from "@/lib/types";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT";

export interface ApiErrorBody {
  error: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TOKEN_KEY = "taxiflow.token";

/** Fired on window whenever this tab signs in or out, so the live socket can reconnect with the new token. */
export const TOKEN_EVENT = "taxiflow:token";

/**
 * Each browser window keeps its own sign-in (sessionStorage), so a passenger in one window
 * and a driver in another stay separate. localStorage remembers the last sign-in for new windows.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

/** Full page load on purpose: drops every cached response that belonged to the old session. */
function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  window.location.replace("/login");
}

async function send(
  method: HttpMethod,
  path: string,
  body: unknown,
  token: string | null,
): Promise<{ status: number; data: unknown }> {
  if (USE_MOCKS) {
    const { mockRequest } = await import("@/lib/mock");
    return mockRequest(method, path, body, token);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

export async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const { status, data } = await send(method, path, body, getToken());

  // A 401 from /auth/* means wrong credentials, not an expired session.
  if (status === 401 && !path.startsWith("/auth/")) {
    clearToken();
    redirectToLogin();
  }
  if (status >= 400) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(status, err.error ?? "unknown_error", err.message ?? "Request failed");
  }
  return data as T;
}

/** SWR fetcher: useSWR("/routes", fetcher) */
export const fetcher = <T>(path: string) => request<T>("GET", path);

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);

export const api = {
  register: (body: RegisterRequest) => post<AuthResponse>("/auth/register", body),
  login: (body: LoginRequest) => post<AuthResponse>("/auth/login", body),
  me: () => get<MeResponse>("/me"),
  stations: () => get<StationsResponse>("/stations"),
  routes: () => get<RoutesResponse>("/routes"),

  joinQueue: (body: JoinQueueRequest) => post<JoinQueueResponse>("/queue/join", body),
  myQueue: () => get<MyQueueResponse>("/queue/me"),
  leaveQueue: () => post<LeaveQueueResponse>("/queue/leave"),
  myTrips: () => get<MyTripsResponse>("/trips/mine"),
  rate: (body: CreateRatingRequest) => post<CreateRatingResponse>("/ratings", body),
  report: (body: CreateReportRequest) => post<CreateReportResponse>("/reports", body),
  notifications: () => get<NotificationsResponse>("/notifications"),
  markNotificationsRead: (body: MarkNotificationsReadRequest = {}) =>
    post<MarkNotificationsReadResponse>("/notifications/read", body),
  requestContract: (body: CreateContractRequest) => post<CreateContractResponse>("/contracts", body),

  driverMe: () => get<DriverMeResponse>("/driver/me"),
  driverArrive: (body: DriverArriveRequest) => post<DriverArriveResponse>("/driver/arrive", body),
  driverDemand: () => get<DriverDemandResponse>("/driver/demand"),
  driverCorridor: () => get<DriverCorridorResponse>("/driver/corridor"),
  setDriverCorridor: (body: SetDriverCorridorRequest) => put<DriverCorridor>("/driver/corridor", body),
  startTrip: (body: StartTripRequest) => post<TripResponse>("/driver/trips/start", body),
  trip: (id: string) => get<TripResponse>(`/driver/trips/${id}`),
  callPassengers: (id: string, body: CallPassengersRequest = {}) =>
    post<CallPassengersResponse>(`/driver/trips/${id}/call`, body),
  boardEntry: (entryId: string) => post<EntryActionResponse>(`/driver/entries/${entryId}/board`),
  noShowEntry: (entryId: string) => post<EntryActionResponse>(`/driver/entries/${entryId}/no-show`),
  departTrip: (id: string) => post<TripResponse>(`/driver/trips/${id}/depart`),
  cancelTrip: (id: string) => post<TripResponse>(`/driver/trips/${id}/cancel`),
  arriveTrip: (id: string) => post<ArriveTripResponse>(`/driver/trips/${id}/arrive`),
  respondToReport: (id: string, body: RespondReportRequest) =>
    post<RespondReportResponse>(`/driver/reports/${id}/respond`, body),
  driverReports: () => get<DriverReportsResponse>("/driver/reports"),
  pulse: () => get<PublicPulseResponse>("/public/pulse"),

  stationQueues: () => get<StationQueuesResponse>("/station/queues"),
  removeEntry: (entryId: string) => post<RemoveEntryResponse>(`/station/entries/${entryId}/remove`),

  adminStats: () => get<AdminStatsResponse>("/admin/stats"),
  adminReports: () => get<AdminReportsResponse>("/admin/reports"),
  updateReport: (id: string, body: UpdateReportRequest) => patch<UpdateReportResponse>(`/admin/reports/${id}`, body),

  // Location consent
  setLocationConsent: (body: { granted: boolean }) => post<LocationConsentResponse>("/me/location-consent", body),

  // GPS
  updateTaxiLocation: (body: TaxiLocationRequest) => post<TaxiLocationResponse>("/taxis/me/location", body),
  nearbyTaxis: (lat: number, lng: number, radiusKm = 3) =>
    get<NearbyTaxisResponse>(`/taxis/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  tripTrack: (tripId: string) => get<TripTrackResponse>(`/trips/${tripId}/track`),
  fleet: () => get<FleetResponse>("/admin/fleet"),

  // Pickups
  createPickup: (body: CreatePickupRequest) => post<CreatePickupResponse>("/pickups", body),
  myPickup: () => get<MyPickupResponse>("/pickups/mine"),
  cancelPickup: (id: string, body: { reason?: string }) => post<{ ok: boolean }>(`/pickups/${id}/cancel`, body),
  nearbyPickups: () => get<NearbyPickupsResponse>("/driver/pickups/nearby"),
  acceptPickup: (id: string) => post<DriverPickupResponse>(`/driver/pickups/${id}/accept`),
  arrivedPickup: (id: string) => post<{ ok: boolean }>(`/driver/pickups/${id}/arrived`),
  completePickup: (id: string) => post<{ ok: boolean }>(`/driver/pickups/${id}/complete`),
  driverMyPickup: () => get<DriverMyPickupResponse>("/driver/pickups/mine"),

  // Controller
  stationDesk: (stationId?: string) =>
    get<StationDeskResponse>(stationId ? `/station/desk?stationId=${stationId}` : "/station/desk"),
  stationAlerts: (stationId?: string) =>
    get<StationAlert[]>(stationId ? `/station/alerts?stationId=${stationId}` : "/station/alerts"),
  stationDisputes: (status?: string, stationId?: string) =>
    get<StationDisputeEntry[]>(`/station/disputes${status ? `?status=${status}` : ""}`),
  updateDispute: (id: string, body: UpdateDisputeRequest) => patch<{ ok: boolean }>(`/station/disputes/${id}`, body),
  stationAction: (body: StationActionRequest) => post<{ ok: boolean }>("/station/actions"),
  auditLog: (query?: string) => get<AuditLogEntry[]>(`/station/audit-log${query ? `?${query}` : ""}`),
  adminAuditLog: (query?: string) => get<AuditLogEntry[]>(`/admin/audit-log${query ? `?${query}` : ""}`),
  createDispute: (body: CreateDisputeRequest) => post<{ ok: boolean }>("/disputes", body),
  myDisputes: () => get<MyDisputeEntry[]>("/disputes/mine"),
  myActions: () => get<MyActionEntry[]>("/actions/mine"),
  mySuspension: () => get<MySuspensionResponse>("/suspensions/me"),
  createAppeal: (body: CreateAppealRequest) => post<{ ok: boolean }>("/appeals", body),
  myAppeals: () => get<MyAppealEntry[]>("/appeals/mine"),
  adminAppeals: (status?: string) => get<AdminAppealEntry[]>(`/admin/appeals${status ? `?status=${status}` : ""}`),
  decideAppeal: (id: string, body: DecideAppealRequest) => patch<{ ok: boolean }>(`/admin/appeals/${id}`, body),
  driverQueue: () => get<DriverQueueResponse>("/driver/queue"),
  joinDriverQueue: (body: { routeId?: string }) => post<{ ok: boolean }>("/driver/queue/join", body),
  leaveDriverQueue: () => post<{ ok: boolean }>("/driver/queue/leave"),

  // AI
  waitEstimate: (routeId: string) => get<WaitEstimateResponse>(`/ai/wait-estimate?routeId=${routeId}`),
  demandForecast: (stationId: string) => get<DemandForecastResponse>(`/ai/demand-forecast?stationId=${stationId}`),
  aiInsights: (days = 7, stationId?: string) =>
    get<InsightsResponse>(`/admin/ai/insights?days=${days}${stationId ? `&stationId=${stationId}` : ""}`),

  devReset: () => post<DevResetResponse>("/dev/reset"),
  devSms: () => get<DevSmsResponse>("/dev/sms"),
};
