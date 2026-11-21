import { API_URL, USE_MOCKS } from "@/lib/config";
import type {
  AdminReportsResponse,
  AdminStatsResponse,
  ArriveTripResponse,
  AuthResponse,
  CallPassengersRequest,
  CallPassengersResponse,
  CreateContractRequest,
  CreateContractResponse,
  CreateRatingRequest,
  CreateRatingResponse,
  CreateReportRequest,
  CreateReportResponse,
  DevResetResponse,
  DevSmsResponse,
  DriverArriveRequest,
  DriverArriveResponse,
  DriverDemandResponse,
  DriverMeResponse,
  DriverReportsResponse,
  EntryActionResponse,
  JoinQueueRequest,
  JoinQueueResponse,
  LeaveQueueResponse,
  LoginRequest,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
  MeResponse,
  MyQueueResponse,
  MyTripsResponse,
  NotificationsResponse,
  PublicPulseResponse,
  RegisterRequest,
  RemoveEntryResponse,
  RespondReportRequest,
  RespondReportResponse,
  RoutesResponse,
  StartTripRequest,
  StationQueuesResponse,
  StationsResponse,
  TripResponse,
  UpdateReportRequest,
  UpdateReportResponse,
} from "@/lib/types";

export type HttpMethod = "GET" | "POST" | "PATCH";

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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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

  devReset: () => post<DevResetResponse>("/dev/reset"),
  devSms: () => get<DevSmsResponse>("/dev/sms"),
};
