import { API_URL, USE_MOCKS } from "@/lib/config";
import type {
  AdminStats,
  ApiErrorBody,
  ArriveRequest,
  AuthResponse,
  CallPassengersRequest,
  ContractRequest,
  ContractRequestInput,
  DriverDemand,
  DriverMe,
  DriverResponseRequest,
  JoinQueueRequest,
  JoinQueueResponse,
  LoginRequest,
  MarkNotificationsReadRequest,
  MyQueue,
  Notification,
  PassengerTrip,
  QueueEntry,
  Rating,
  RatingRequest,
  RegisterRequest,
  Report,
  ReportRequest,
  RouteSummary,
  SmsMessage,
  StartTripRequest,
  Station,
  StationQueues,
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
  me: () => get<User>("/me"),
  stations: () => get<Station[]>("/stations"),
  routes: () => get<RouteSummary[]>("/routes"),

  joinQueue: (body: JoinQueueRequest) => post<JoinQueueResponse>("/queue/join", body),
  myQueue: () => get<MyQueue>("/queue/me"),
  leaveQueue: () => post<QueueEntry>("/queue/leave"),
  myTrips: () => get<PassengerTrip[]>("/trips/mine"),
  rate: (body: RatingRequest) => post<Rating>("/ratings", body),
  report: (body: ReportRequest) => post<Report>("/reports", body),
  notifications: () => get<Notification[]>("/notifications"),
  markNotificationsRead: (body: MarkNotificationsReadRequest = {}) =>
    post<{ updated: number }>("/notifications/read", body),
  requestContract: (body: ContractRequestInput) => post<ContractRequest>("/contracts", body),

  driverMe: () => get<DriverMe>("/driver/me"),
  driverArrive: (body: ArriveRequest) => post<DriverMe>("/driver/arrive", body),
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
  respondToReport: (id: string, body: DriverResponseRequest) =>
    post<Report>(`/driver/reports/${id}/respond`, body),

  stationQueues: () => get<StationQueues>("/station/queues"),
  removeEntry: (entryId: string) => post<{ ok: true }>(`/station/entries/${entryId}/remove`),

  adminStats: () => get<AdminStats>("/admin/stats"),
  adminReports: () => get<Report[]>("/admin/reports"),
  updateReport: (id: string, body: UpdateReportRequest) => patch<Report>(`/admin/reports/${id}`, body),

  devReset: () => post<{ ok: true }>("/dev/reset"),
  devSms: () => get<SmsMessage[]>("/dev/sms"),
};
