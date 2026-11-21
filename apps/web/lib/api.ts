import { API_URL, USE_MOCKS } from "@/lib/config";
import type {
  AdminReport,
  AdminStatsResponse,
  AuthResponse,
  CallPassengersRequest,
  ContractRequest,
  CreateContractRequest,
  CreateRatingRequest,
  CreateReportRequest,
  DriverArriveRequest,
  DriverDemand,
  DriverMe,
  ErrorResponse,
  JoinQueueRequest,
  JoinQueueResponse,
  LoginRequest,
  MarkNotificationsReadRequest,
  MyQueue,
  Notification,
  PassengerTrip,
  QueueEntry,
  Rating,
  RegisterRequest,
  Report,
  RespondReportRequest,
  RouteWithDemand,
  SmsMessage,
  StartTripRequest,
  Station,
  StationQueuesResponse,
  TripDetail,
  UpdateReportRequest,
  User,
} from "@/lib/types";

export type HttpMethod = "GET" | "POST" | "PATCH";

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
    const err = (data ?? {}) as Partial<ErrorResponse>;
    throw new ApiError(status, err.error ?? "unknown_error", err.message ?? "Request failed");
  }
  return unwrap(path, data) as T;
}

/** Real responses are wrapped (`{ routes }`, `{ trip }`). Hand the screen the part it renders. */
function unwrap(path: string, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const body = data as Record<string, unknown>;
  const p = path.split("?")[0];
  if (p === "/me" && "user" in body) return body.user;
  if (p === "/stations" && Array.isArray(body.stations)) return body.stations;
  if (p === "/routes" && Array.isArray(body.routes)) return body.routes;
  if (p === "/queue/leave" && "entry" in body) return body.entry;
  if (p === "/trips/mine" && Array.isArray(body.trips)) return body.trips;
  if (p === "/notifications" && Array.isArray(body.notifications)) return body.notifications;
  if (p === "/dev/sms" && Array.isArray(body.messages)) return body.messages;
  if (p === "/admin/reports" && Array.isArray(body.reports)) return body.reports;
  if (
    (p.startsWith("/driver/trips") || p.startsWith("/driver/entries")) &&
    body.trip &&
    typeof body.trip === "object"
  ) {
    return body.trip;
  }
  if (body.rating && typeof body.rating === "object" && p === "/ratings") return body.rating;
  if (body.report && typeof body.report === "object" && (p === "/reports" || p.includes("/reports/"))) {
    return body.report;
  }
  return data;
}

/** SWR fetcher: useSWR("/routes", fetcher) */
export const fetcher = <T>(path: string) => request<T>("GET", path);

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);

export const api = {
  register: (body: RegisterRequest) => post<AuthResponse>("/auth/register", body),
  login: (body: LoginRequest) => post<AuthResponse>("/auth/login", body),
  me: () => get<User>("/me"),
  stations: () => get<Station[]>("/stations"),
  routes: () => get<RouteWithDemand[]>("/routes"),

  joinQueue: (body: JoinQueueRequest) => post<JoinQueueResponse>("/queue/join", body),
  myQueue: () => get<MyQueue>("/queue/me"),
  leaveQueue: () => post<QueueEntry>("/queue/leave"),
  myTrips: () => get<PassengerTrip[]>("/trips/mine"),
  rate: (body: CreateRatingRequest) => post<Rating>("/ratings", body),
  report: (body: CreateReportRequest) => post<Report>("/reports", body),
  notifications: () => get<Notification[]>("/notifications"),
  markNotificationsRead: (body: MarkNotificationsReadRequest = {}) =>
    post<{ updated: number }>("/notifications/read", body),
  requestContract: (body: CreateContractRequest) => post<ContractRequest>("/contracts", body),

  driverMe: () => get<DriverMe>("/driver/me"),
  driverArrive: (body: DriverArriveRequest) => post<DriverMe>("/driver/arrive", body),
  driverDemand: () => get<DriverDemand>("/driver/demand"),
  startTrip: (body: StartTripRequest) => post<TripDetail>("/driver/trips/start", body),
  trip: (id: string) => get<TripDetail>(`/driver/trips/${id}`),
  callPassengers: (id: string, body: CallPassengersRequest = {}) =>
    post<TripDetail>(`/driver/trips/${id}/call`, body),
  boardEntry: (entryId: string) => post<TripDetail>(`/driver/entries/${entryId}/board`),
  noShowEntry: (entryId: string) => post<TripDetail>(`/driver/entries/${entryId}/no-show`),
  departTrip: (id: string) => post<TripDetail>(`/driver/trips/${id}/depart`),
  cancelTrip: (id: string) => post<TripDetail>(`/driver/trips/${id}/cancel`),
  arriveTrip: (id: string) => post<TripDetail>(`/driver/trips/${id}/arrive`),
  respondToReport: (id: string, body: RespondReportRequest) =>
    post<Report>(`/driver/reports/${id}/respond`, body),

  stationQueues: () => get<StationQueuesResponse>("/station/queues"),
  removeEntry: (entryId: string) => post<{ ok: true }>(`/station/entries/${entryId}/remove`),

  adminStats: () => get<AdminStatsResponse>("/admin/stats"),
  adminReports: () => get<AdminReport[]>("/admin/reports"),
  updateReport: (id: string, body: UpdateReportRequest) => patch<AdminReport>(`/admin/reports/${id}`, body),

  devReset: () => post<{ ok: true }>("/dev/reset"),
  devSms: () => get<SmsMessage[]>("/dev/sms"),
};
