// In-browser fake of the MengedLink API, used when NEXT_PUBLIC_USE_MOCKS=true.
// Seeded with the demo data from MASTER_PROMPT.md section 7 and saved in localStorage,
// so other tabs see the same state after their next refresh.

import type { HttpMethod } from "@/lib/api";
import { emitLive } from "@/lib/live/bus";
import type {
  AdminReport,
  AssistanceType,
  ContractRequest,
  DriverDemandResponse,
  DriverMeResponse,
  DriverTrip,
  Language,
  Notification,
  NotificationType,
  QueueEntry,
  QueueStatus,
  Rating,
  Report,
  ReportStatus,
  Role,
  RouteSummary,
  RouteWithDemand,
  Station,
  StationQueueEntry,
  TaxiStatus,
  TripEntry,
  TripStatus,
  User,
} from "@/lib/types";

interface MockUser extends User {
  password: string;
}
interface MockRoute {
  id: string;
  originId: string;
  destinationId: string;
}
interface MockTaxi {
  id: string;
  plate: string;
  capacity: number;
  status: TaxiStatus;
  driverId: string;
  currentStationId: string | null;
}
interface MockTrip {
  id: string;
  taxiId: string;
  routeId: string;
  status: TripStatus;
  createdAt: string;
  departedAt: string | null;
  arrivedAt: string | null;
}
interface MockEntry {
  id: string;
  passengerId: string;
  routeId: string;
  status: QueueStatus;
  assistance: AssistanceType;
  isPriority: boolean;
  joinedAt: string;
  calledAt: string | null;
  boardedAt: string | null;
  tripId: string | null;
}
interface MockNotification extends Notification {
  userId: string;
}
interface MockPickup {
  id: string;
  passengerId: string;
  lat: number | null;
  lng: number | null;
  seats: number;
  placeNote: string | null;
  status: "OPEN" | "ACCEPTED" | "ARRIVED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  acceptedTaxiId: string | null;
  acceptedDriverId: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}
interface MockDb {
  seq: number;
  users: MockUser[];
  stations: Station[];
  routes: MockRoute[];
  taxis: MockTaxi[];
  trips: MockTrip[];
  entries: MockEntry[];
  notifications: MockNotification[];
  ratings: Rating[];
  reports: Report[];
  contracts: ContractRequest[];
  taxiLocations?: Record<string, { lat: number; lng: number; heading?: number | null; speedKmh?: number | null; accuracyM?: number; updatedAt: string }>;
  pickups?: MockPickup[];
  auditLog?: any[];
  disputes?: any[];
  appeals?: any[];
  userLocationConsent?: Record<string, string>;
}

export interface MockResponse {
  status: number;
  data: unknown;
}

const STORAGE_KEY = "mengedlink.mockdb";
/** University to Merkato is the busy line Fatuma is already parked on. */
const UNIVERSITY_TO_MERKATO = "rt_ju_mk";
const LATENCY_MIN_MS = 250;
const LATENCY_MAX_MS = 600;
const MINUTE = 60_000;
const PASSWORD = "demo1234";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const nowIso = () => new Date().toISOString();

function seed(): MockDb {
  const stations: Station[] = [
    { id: "st_merkato", name: "Merkato", nameAm: "መርካቶ" },
    { id: "st_ju", name: "Jimma University", nameAm: "ጅማ ዩኒቨርሲቲ" },
    { id: "st_awetu", name: "Awetu", nameAm: "አዌቱ" },
    { id: "st_jiren", name: "Jiren", nameAm: "ጅረን" },
    { id: "st_hospital", name: "University Hospital", nameAm: "ዩኒቨርሲቲ ሆስፒታል" },
    { id: "st_hermata", name: "Hermata", nameAm: "ሄርማታ" },
    { id: "st_bishishe", name: "Bishishe", nameAm: "ቢሺሼ" },
    { id: "st_bus", name: "Bus station", nameAm: "አውቶቢስ ጣቢያ" },
  ];
  const spokes: [string, string][] = [
    ["ju", "st_ju"],
    ["aw", "st_awetu"],
    ["jr", "st_jiren"],
    ["ho", "st_hospital"],
    ["he", "st_hermata"],
    ["bi", "st_bishishe"],
    ["bus", "st_bus"],
  ];
  const routes: MockRoute[] = spokes.flatMap(([code, stationId]) => [
    { id: `rt_mk_${code}`, originId: "st_merkato", destinationId: stationId },
    { id: `rt_${code}_mk`, originId: stationId, destinationId: "st_merkato" },
  ]);

  const user = (id: string, name: string, phone: string, role: Role, stationId: string | null = null): MockUser => ({
    id,
    name,
    phone,
    role,
    language: "en",
    stationId,
    createdAt: ago(24 * 60 * MINUTE),
    password: PASSWORD,
  });
  const queueNames = [
    "Tigist Abebe", "Chaltu Gemechu", "Dawit Mekonnen", "Ayantu Tesfaye", "Fikadu Bekele",
    "Lensa Tadesse", "Yonas Hailu", "Mekdes Alemu", "Gemechu Diriba", "Selamawit Kebede",
    "Birhanu Tolasa", "Rahel Girma", "Nahom Desta", "Sifan Ahmed", "Samuel Worku",
    "Eleni Assefa", "Tariku Negash", "Hawi Mohammed", "Genet Bekele", "Abdi Wakjira",
    "Marta Solomon", "Tesfaye Chala", "Birtukan Haile", "Obsa Tadesse", "Helen Getachew",
    "Mulugeta Dagne", "Daniel Teshome", "Zinash Bekele", "Jafar Abdela", "Meseret Wolde",
    "Tolasa Girma", "Bethlehem Tadesse", "Kedir Aman", "Liya Mengistu", "Wondimu Bekele",
    "Aster Fikre", "Ibsa Tamiru", "Meron Ashenafi", "Getachew Bulcha",
  ];
  const users: MockUser[] = [
    user("u_admin", "Selam Tadesse", "0911000099", "ADMIN"),
    user("u_rep_a", "Meron Desta", "0911000011", "STATION_REP", "st_merkato"),
    user("u_rep_b", "Getachew Tolosa", "0911000012", "STATION_REP", "st_ju"),
    user("u_d1", "Kebede Alemu", "0911000001", "DRIVER"),
    user("u_d2", "Abebe Chala", "0911000002", "DRIVER"),
    user("u_d3", "Fatuma Ahmed", "0911000003", "DRIVER"),
    user("u_p100", "Hana Bekele", "0911000100", "PASSENGER"),
    ...queueNames.map((name, i) => user(`u_p${101 + i}`, name, `0911${String(100101 + i).slice(-6)}`, "PASSENGER")),
  ];

  const taxis: MockTaxi[] = [
    { id: "tx_1", plate: "OR 3-42115", capacity: 14, status: "AT_STATION", driverId: "u_d1", currentStationId: "st_merkato" },
    { id: "tx_2", plate: "OR 2-31880", capacity: 16, status: "OFFLINE", driverId: "u_d2", currentStationId: null },
    { id: "tx_3", plate: "OR 3-55012", capacity: 19, status: "AT_STATION", driverId: "u_d3", currentStationId: "st_ju" },
  ];

  const entry = (
    id: string,
    passengerId: string,
    routeId: string,
    joinedMinutesAgo: number,
    assistance: AssistanceType = "NONE",
  ): MockEntry => ({
    id,
    passengerId,
    routeId,
    status: "WAITING",
    assistance,
    isPriority: assistance !== "NONE",
    joinedAt: ago(joinedMinutesAgo * MINUTE),
    calledAt: null,
    boardedAt: null,
    tripId: null,
  });
  const lines: [string, number, AssistanceType[]][] = [
    [UNIVERSITY_TO_MERKATO, 12, ["NONE", "NONE", "ELDERLY", "NONE", "NONE", "NONE", "PREGNANT", "NONE", "NONE", "DISABILITY", "NONE", "NONE"]],
    ["rt_mk_ju", 6, ["NONE", "ELDERLY"]],
    ["rt_mk_ho", 5, ["PREGNANT"]],
    ["rt_mk_aw", 4, []],
    ["rt_mk_bus", 5, ["NONE", "NONE", "NONE", "DISABILITY"]],
    ["rt_jr_mk", 3, []],
    ["rt_he_mk", 2, []],
    ["rt_bi_mk", 2, []],
  ];
  const entries: MockEntry[] = [];
  let person = 0;
  for (const [routeId, count, help] of lines) {
    for (let i = 0; i < count; i++) {
      const assistance = help[i] ?? "NONE";
      entries.push(entry(`qe_${routeId}_${i}`, `u_p${101 + person}`, routeId, 45 - person, assistance));
      person++;
    }
  }

  const pastTrip: MockTrip = {
    id: "tr_past",
    taxiId: "tx_1",
    routeId: "rt_mk_ju",
    status: "COMPLETED",
    createdAt: ago(180 * MINUTE),
    departedAt: ago(170 * MINUTE),
    arrivedAt: ago(140 * MINUTE),
  };
  for (const [i, passengerId] of ["u_p100", "u_p118", "u_p119"].entries()) {
    entries.push({
      ...entry(`qe_past_${i}`, passengerId, "rt_mk_ju", 200 - i * 4),
      status: "BOARDED",
      calledAt: ago(178 * MINUTE),
      boardedAt: ago(175 * MINUTE),
      tripId: pastTrip.id,
    });
  }

  return {
    seq: 1,
    users,
    stations,
    routes,
    taxis,
    trips: [pastTrip],
    entries,
    notifications: [
      {
        id: "nt_past",
        userId: "u_p100",
        type: "TRIP_COMPLETED",
        title: "You arrived",
        body: "You arrived at Jimma University with taxi OR 3-42115. Please rate your trip.",
        read: true,
        createdAt: ago(140 * MINUTE),
      },
    ],
    ratings: [],
    reports: [
      {
        id: "rp_1",
        reporterId: "u_p118",
        tripId: pastTrip.id,
        driverId: "u_d1",
        type: "OVERCHARGING",
        description: "On the Merkato to Jimma University line, the driver asked for more than the fare.",
        status: "OPEN",
        driverResponse: null,
        resolutionNote: null,
        createdAt: ago(120 * MINUTE),
      },
      {
        id: "rp_2",
        reporterId: "u_p119",
        tripId: pastTrip.id,
        driverId: "u_d3",
        type: "DISRESPECT",
        description: "The driver was rude when I asked the fare at the University gate.",
        status: "IN_REVIEW",
        driverResponse: null,
        resolutionNote: null,
        createdAt: ago(90 * MINUTE),
      },
      {
        id: "rp_3",
        reporterId: "u_p120",
        tripId: null,
        driverId: "u_d1",
        type: "UNSAFE_DRIVING",
        description: "The minibus was driving too fast on the road down from Jiren.",
        status: "OPEN",
        driverResponse: null,
        resolutionNote: null,
        createdAt: ago(40 * MINUTE),
      },
      {
        id: "rp_4",
        reporterId: "u_p117",
        tripId: pastTrip.id,
        driverId: "u_d2",
        type: "LOST_PROPERTY",
        description: "I left a blue bag on the seat between Merkato and Awetu.",
        status: "RESOLVED",
        driverResponse: "The bag is with the Merkato station desk.",
        resolutionNote: "Bag returned at Merkato.",
        createdAt: ago(200 * MINUTE),
      },
    ],
    contracts: [],
    taxiLocations: {
      tx_1: { lat: 7.6735, lng: 36.8351, heading: 90, speedKmh: 0, accuracyM: 10, updatedAt: nowIso() },
      tx_3: { lat: 7.6844, lng: 36.8497, heading: 180, speedKmh: 0, accuracyM: 10, updatedAt: nowIso() },
    },
    pickups: [],
    auditLog: [],
    disputes: [],
    appeals: [],
    userLocationConsent: {},
  };
}

let db: MockDb | null = null;

function load(): MockDb {
  if (db) return db;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) db = JSON.parse(saved) as MockDb;
  } catch {
    db = null;
  }
  db ??= seed();
  db.taxiLocations ??= {};
  db.pickups ??= [];
  db.auditLog ??= [];
  db.disputes ??= [];
  db.appeals ??= [];
  db.userLocationConsent ??= {};
  return db;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the mock keeps working in memory.
  }
}

// ---------- helpers ----------

function asListWithKey<T>(arr: T[], key: string, extra?: Record<string, unknown>): any {
  const result: any = [...arr];
  result[key] = arr;
  if (extra) Object.assign(result, extra);
  return result;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function fail(status: number, code: string, message: string): never {
  throw new HttpError(status, code, message);
}
function notFound(what: string): never {
  return fail(404, "not_found", `${what} not found`);
}
function invalidState(message: string): never {
  return fail(409, "invalid_state", message);
}

function newId(prefix: string) {
  const d = load();
  return `${prefix}_${d.seq++}`;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("251") && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}

const isValidPhone = (phone: string) => /^0[79]\d{8}$/.test(phone);

function publicUser(user: MockUser): User {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    language: user.language,
    stationId: user.stationId,
    createdAt: user.createdAt ?? new Date(0).toISOString(),
  };
}

const station = (id: string) => load().stations.find((s) => s.id === id) ?? notFound("Station");
const route = (id: string) => load().routes.find((r) => r.id === id) ?? notFound("Route");
const firstName = (userId: string) => load().users.find((u) => u.id === userId)?.name.split(" ")[0] ?? "";

function routeRef(routeId: string): RouteSummary {
  const r = route(routeId);
  return { id: r.id, origin: station(r.originId), destination: station(r.destinationId) };
}

function waitingInOrder(routeId: string): MockEntry[] {
  return load()
    .entries.filter((e) => e.routeId === routeId && e.status === "WAITING")
    .sort(
      (a, b) =>
        Number(b.isPriority) - Number(a.isPriority) ||
        a.joinedAt.localeCompare(b.joinedAt),
    );
}

function positionOf(entry: MockEntry): number | null {
  if (entry.status !== "WAITING") return null;
  return waitingInOrder(entry.routeId).findIndex((e) => e.id === entry.id) + 1;
}

function routeSummary(r: MockRoute): RouteWithDemand {
  const waiting = waitingInOrder(r.id);
  return {
    ...routeRef(r.id),
    waiting: waiting.length,
    priorityWaiting: waiting.filter((e) => e.isPriority).length,
    taxisAvailable: load().taxis.filter(
      (t) => t.currentStationId === r.originId && (t.status === "AT_STATION" || t.status === "LOADING"),
    ).length,
  };
}

function publicEntry(entry: MockEntry): QueueEntry {
  return {
    id: entry.id,
    route: routeRef(entry.routeId),
    status: entry.status,
    assistance: entry.assistance,
    isPriority: entry.isPriority,
    joinedAt: entry.joinedAt,
    calledAt: entry.calledAt,
    boardedAt: entry.boardedAt,
    tripId: entry.tripId,
  };
}

function publicTripEntry(entry: MockEntry): TripEntry {
  return {
    id: entry.id,
    firstName: firstName(entry.passengerId),
    isPriority: entry.isPriority,
    status: entry.status,
    calledAt: entry.calledAt,
    boardedAt: entry.boardedAt,
  };
}

const tripEntries = (tripId: string) => load().entries.filter((e) => e.tripId === tripId);

const seatsUsed = (tripId: string) =>
  tripEntries(tripId).filter((e) => e.status === "CALLED" || e.status === "BOARDED").length;

const taxiOf = (trip: MockTrip) => load().taxis.find((t) => t.id === trip.taxiId) ?? notFound("Taxi");

function stationEntry(entry: MockEntry): StationQueueEntry {
  return {
    id: entry.id,
    firstName: firstName(entry.passengerId),
    isPriority: entry.isPriority,
    status: entry.status,
    position: positionOf(entry),
    joinedAt: entry.joinedAt,
    tripId: entry.tripId,
  };
}

function driverTrip(trip: MockTrip): DriverTrip {
  const taxi = taxiOf(trip);
  const used = seatsUsed(trip.id);
  return {
    id: trip.id,
    route: routeRef(trip.routeId),
    status: trip.status,
    taxiPlate: taxi.plate,
    capacity: taxi.capacity,
    seatsUsed: used,
    seatsLeft: taxi.capacity - used,
    createdAt: trip.createdAt,
    departedAt: trip.departedAt,
    arrivedAt: trip.arrivedAt,
    entries: tripEntries(trip.id).map(publicTripEntry),
  };
}

function notify(userId: string, type: NotificationType, title: string, body: string) {
  load().notifications.push({ id: newId("nt"), userId, type, title, body, read: false, createdAt: nowIso() });
}

function taxiForDriver(driverId: string): MockTaxi {
  return load().taxis.find((t) => t.driverId === driverId) ?? notFound("Taxi");
}

function activeTripOf(taxi: MockTaxi): MockTrip | null {
  return load().trips.find((t) => t.taxiId === taxi.id && (t.status === "LOADING" || t.status === "DEPARTED")) ?? null;
}

function driverTaxi(taxi: MockTaxi) {
  return {
    id: taxi.id,
    plate: taxi.plate,
    capacity: taxi.capacity,
    status: taxi.status,
    currentStation: taxi.currentStationId ? station(taxi.currentStationId) : null,
  };
}

function driverMe(driverId: string): DriverMeResponse {
  const taxi = taxiForDriver(driverId);
  const trip = activeTripOf(taxi);
  const used = trip ? seatsUsed(trip.id) : 0;
  return {
    taxi: driverTaxi(taxi),
    activeTrip: trip ? driverTrip(trip) : null,
    seatsUsed: used,
    seatsLeft: taxi.capacity - used,
  };
}

function adminReport(report: Report): AdminReport {
  const d = load();
  const reporter = d.users.find((user) => user.id === report.reporterId);
  const driver = report.driverId ? d.users.find((user) => user.id === report.driverId) : undefined;
  const trip = report.tripId ? d.trips.find((item) => item.id === report.tripId) : undefined;
  return {
    ...report,
    reporter: { id: reporter?.id ?? report.reporterId, name: reporter?.name ?? "" },
    driver: driver ? { id: driver.id, name: driver.name } : null,
    taxiPlate: trip ? taxiOf(trip).plate : null,
  };
}

function ownTrip(driverId: string, tripId: string): MockTrip {
  const taxi = taxiForDriver(driverId);
  const trip = load().trips.find((t) => t.id === tripId && t.taxiId === taxi.id);
  return trip ?? notFound("Trip");
}

/** Entry that the driver (own trip) or station rep (own station) may board or mark no-show. */
function manageableEntry(user: MockUser, entryId: string): { entry: MockEntry; trip: MockTrip } {
  const entry = load().entries.find((e) => e.id === entryId) ?? notFound("Entry");
  const trip = load().trips.find((t) => t.id === entry.tripId) ?? notFound("Trip");
  const allowed =
    user.role === "DRIVER"
      ? taxiOf(trip).driverId === user.id
      : route(trip.routeId).originId === user.stationId;
  if (!allowed) notFound("Entry");
  if (entry.status !== "CALLED") invalidState("Only called passengers can be boarded or marked no-show");
  if (trip.status !== "LOADING") invalidState("The trip is not loading");
  return { entry, trip };
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(400, "validation_error", `${field} is required`);
  return value.trim();
}

// ---------- routes ----------

interface Ctx {
  /** Always set unless the route is public. */
  user: MockUser;
  body: Record<string, unknown>;
  params: Record<string, string>;
}

interface RouteDef {
  method: HttpMethod;
  pattern: string;
  roles: Role[] | "any" | "public";
  handler: (ctx: Ctx) => unknown;
}

class Created {
  constructor(public data: unknown) {}
}
const created = (data: unknown) => new Created(data);

const ALL_ROLES: Role[] = ["PASSENGER", "DRIVER", "STATION_REP", "ADMIN"];

const routes: RouteDef[] = [
  // ----- auth and reference data -----
  {
    method: "POST",
    pattern: "/auth/register",
    roles: "public",
    handler: ({ body }) => {
      const name = requireText(body.name, "name");
      const phone = normalizePhone(requireText(body.phone, "phone"));
      const password = requireText(body.password, "password");
      if (!isValidPhone(phone)) fail(400, "validation_error", "Phone must start with 09 or 07");
      if (password.length < 6) fail(400, "validation_error", "Password must be at least 6 characters");
      const d = load();
      if (d.users.some((u) => u.phone === phone)) fail(409, "phone_taken", "Phone already registered");
      const language: Language = body.language === "am" ? "am" : "en";
      const user: MockUser = {
        id: newId("u"),
        name,
        phone,
        role: "PASSENGER",
        language,
        stationId: null,
        createdAt: nowIso(),
        password,
      };
      d.users.push(user);
      return created({ token: `mock-token:${user.id}`, user: publicUser(user) });
    },
  },
  {
    method: "POST",
    pattern: "/auth/login",
    roles: "public",
    handler: ({ body }) => {
      const phone = normalizePhone(String(body.phone ?? ""));
      const user = load().users.find((u) => u.phone === phone && u.password === body.password);
      if (!user) fail(401, "invalid_credentials", "Wrong phone or password");
      return { token: `mock-token:${user.id}`, user: publicUser(user) };
    },
  },
  { method: "GET", pattern: "/me", roles: "any", handler: ({ user }) => ({ user: publicUser(user) }) },
  { method: "GET", pattern: "/stations", roles: "any", handler: () => ({ stations: load().stations }) },
  {
    method: "GET",
    pattern: "/public/pulse",
    roles: "public",
    handler: () => ({ waitingNow: load().entries.filter((entry) => entry.status === "WAITING").length }),
  },
  { method: "GET", pattern: "/routes", roles: "any", handler: () => ({ routes: load().routes.map(routeSummary) }) },

  // ----- passenger -----
  {
    method: "POST",
    pattern: "/queue/join",
    roles: ["PASSENGER"],
    handler: ({ user, body }) => {
      const r = route(requireText(body.routeId, "routeId"));
      const d = load();
      const active = d.entries.some(
        (e) => e.passengerId === user.id && (e.status === "WAITING" || e.status === "CALLED"),
      );
      if (active) fail(409, "already_in_queue", "Already in a queue");
      const assistance = (body.assistance as AssistanceType | undefined) ?? "NONE";
      const entry: MockEntry = {
        id: newId("qe"),
        passengerId: user.id,
        routeId: r.id,
        status: "WAITING",
        assistance,
        isPriority: assistance !== "NONE",
        joinedAt: nowIso(),
        calledAt: null,
        boardedAt: null,
        tripId: null,
      };
      d.entries.push(entry);
      return created({ entry: publicEntry(entry), position: positionOf(entry) });
    },
  },
  {
    method: "GET",
    pattern: "/queue/me",
    roles: ["PASSENGER"],
    handler: ({ user }) => {
      const d = load();
      const entry = d.entries.find(
        (e) => e.passengerId === user.id && (e.status === "WAITING" || e.status === "CALLED"),
      );
      if (!entry) return { entry: null, position: null, taxiPlate: null };
      const trip = d.trips.find((t) => t.id === entry.tripId);
      return {
        entry: publicEntry(entry),
        position: entry.status === "WAITING" ? positionOf(entry) : null,
        taxiPlate: entry.status === "CALLED" && trip ? taxiOf(trip).plate : null,
      };
    },
  },
  {
    method: "POST",
    pattern: "/queue/leave",
    roles: ["PASSENGER"],
    handler: ({ user }) => {
      const d = load();
      const entry =
        d.entries.find((e) => e.passengerId === user.id && (e.status === "WAITING" || e.status === "CALLED")) ??
        fail(404, "not_in_queue", "Not in a queue");
      const trip = d.trips.find((t) => t.id === entry.tripId);
      if (entry.status === "CALLED" && trip) {
        notify(taxiOf(trip).driverId, "PASSENGER_LEFT", "Seat freed", `${firstName(user.id)} left the queue. A seat is free.`);
      }
      entry.status = "CANCELLED";
      return { entry: publicEntry(entry) };
    },
  },
  {
    method: "GET",
    pattern: "/trips/mine",
    roles: ["PASSENGER"],
    handler: ({ user }) => {
      const d = load();
      const boarded = d.entries.filter((e) => e.passengerId === user.id && e.status === "BOARDED" && e.tripId);
      const trips = boarded
        .flatMap((entry) => {
          const trip = d.trips.find((item) => item.id === entry.tripId);
          return trip ? [{ entry, trip }] : [];
        })
        .sort((a, b) => (b.entry.boardedAt ?? "").localeCompare(a.entry.boardedAt ?? ""))
        .map(({ entry, trip }) => {
          const rated = d.ratings.some((rating) => rating.tripId === trip.id && rating.passengerId === user.id);
          return {
            tripId: trip.id,
            entryId: entry.id,
            route: routeRef(trip.routeId),
            status: trip.status,
            taxiPlate: taxiOf(trip).plate,
            driverFirstName: d.users.find((person) => person.id === taxiOf(trip).driverId)?.name.split(" ")[0] ?? "",
            boardedAt: entry.boardedAt,
            departedAt: trip.departedAt,
            arrivedAt: trip.arrivedAt,
            rated,
            canRate: trip.status === "COMPLETED" && !rated,
          };
        });
      return { trips };
    },
  },
  {
    method: "POST",
    pattern: "/ratings",
    roles: ["PASSENGER"],
    handler: ({ user, body }) => {
      const d = load();
      const tripId = requireText(body.tripId, "tripId");
      const stars = Number(body.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, "validation_error", "Stars must be 1 to 5");
      const trip = d.trips.find((t) => t.id === tripId) ?? notFound("Trip");
      const wasBoarded = d.entries.some((e) => e.tripId === tripId && e.passengerId === user.id && e.status === "BOARDED");
      if (!wasBoarded || trip.status !== "COMPLETED") invalidState("You can only rate completed trips you took");
      if (d.ratings.some((r) => r.tripId === tripId && r.passengerId === user.id)) {
        fail(409, "already_rated", "Already rated");
      }
      const rating: Rating = {
        id: newId("rt"),
        tripId,
        passengerId: user.id,
        stars,
        tags: Array.isArray(body.tags) ? (body.tags as Rating["tags"]) : [],
        comment: typeof body.comment === "string" && body.comment.trim() ? body.comment : null,
        createdAt: nowIso(),
      };
      d.ratings.push(rating);
      return created({ rating });
    },
  },
  {
    method: "POST",
    pattern: "/reports",
    roles: ["PASSENGER"],
    handler: ({ user, body }) => {
      const d = load();
      const tripId = typeof body.tripId === "string" ? body.tripId : null;
      const trip = tripId ? d.trips.find((t) => t.id === tripId) ?? notFound("Trip") : null;
      const report: Report = {
        id: newId("rp"),
        reporterId: user.id,
        tripId,
        driverId: trip ? taxiOf(trip).driverId : null,
        type: requireText(body.type, "type") as Report["type"],
        description: requireText(body.description, "description"),
        status: "OPEN",
        driverResponse: null,
        resolutionNote: null,
        createdAt: nowIso(),
      };
      d.reports.push(report);
      return created({ report });
    },
  },
  {
    method: "GET",
    pattern: "/notifications",
    roles: "any",
    handler: ({ user }) => {
      const notifications = load()
        .notifications.filter((note) => note.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { notifications, unread: notifications.filter((note) => !note.read).length };
    },
  },
  {
    method: "POST",
    pattern: "/notifications/read",
    roles: "any",
    handler: ({ user, body }) => {
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : null;
      let updated = 0;
      for (const n of load().notifications) {
        if (n.userId === user.id && !n.read && (!ids || ids.includes(n.id))) {
          n.read = true;
          updated++;
        }
      }
      return { updated };
    },
  },
  {
    method: "POST",
    pattern: "/contracts",
    roles: ["PASSENGER"],
    handler: ({ user, body }) => {
      const contract: ContractRequest = {
        id: newId("ct"),
        requesterId: user.id,
        type: requireText(body.type, "type") as ContractRequest["type"],
        pickup: requireText(body.pickup, "pickup"),
        destination: requireText(body.destination, "destination"),
        schedule: requireText(body.schedule, "schedule"),
        passengerCount: Number(body.passengerCount) || 1,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        status: "NEW",
        createdAt: nowIso(),
      };
      load().contracts.push(contract);
      return created({ request: contract });
    },
  },

  // ----- driver -----
  { method: "GET", pattern: "/driver/me", roles: ["DRIVER"], handler: ({ user }) => driverMe(user.id) },
  {
    method: "POST",
    pattern: "/driver/arrive",
    roles: ["DRIVER"],
    handler: ({ user, body }) => {
      const s = station(requireText(body.stationId, "stationId"));
      const taxi = taxiForDriver(user.id);
      if (taxi.status !== "OFFLINE" && taxi.status !== "EN_ROUTE") {
        invalidState("Arrive is only possible when offline or on the road");
      }
      const trip = activeTripOf(taxi);
      if (trip) invalidState("Finish the active trip first");
      taxi.status = "AT_STATION";
      taxi.currentStationId = s.id;
      return { taxi: driverTaxi(taxi) };
    },
  },
  {
    method: "GET",
    pattern: "/driver/demand",
    roles: ["DRIVER"],
    handler: ({ user }): DriverDemandResponse => {
      const taxi = taxiForDriver(user.id);
      const routes = load()
        .routes.map((item) => ({
          ...routeSummary(item),
          highlighted: taxi.status === "AT_STATION" && taxi.currentStationId === item.originId,
        }))
        .sort((a, b) => b.waiting - a.waiting || b.priorityWaiting - a.priorityWaiting || a.origin.name.localeCompare(b.origin.name));
      const trip = activeTripOf(taxi);
      const outbound = trip ? route(trip.routeId) : undefined;
      const reverse = outbound
        ? routes.find((item) => item.origin.id === outbound.destinationId && item.destination.id === outbound.originId)
        : undefined;
      return {
        routes,
        returnSuggestion: reverse
          ? {
              route: { id: reverse.id, origin: reverse.origin, destination: reverse.destination },
              waiting: reverse.waiting,
              priorityWaiting: reverse.priorityWaiting,
            }
          : null,
      };
    },
  },
  {
    method: "POST",
    pattern: "/driver/trips/start",
    roles: ["DRIVER"],
    handler: ({ user, body }) => {
      const r = route(requireText(body.routeId, "routeId"));
      const taxi = taxiForDriver(user.id);
      if (activeTripOf(taxi)) invalidState("You already have an active trip");
      if (taxi.status !== "AT_STATION") invalidState("Arrive at a station first");
      if (r.originId !== taxi.currentStationId) fail(409, "wrong_station", "Route does not start at your station");
      const trip: MockTrip = {
        id: newId("tr"),
        taxiId: taxi.id,
        routeId: r.id,
        status: "LOADING",
        createdAt: nowIso(),
        departedAt: null,
        arrivedAt: null,
      };
      load().trips.push(trip);
      taxi.status = "LOADING";
      return created({ trip: driverTrip(trip) });
    },
  },
  {
    method: "GET",
    pattern: "/driver/trips/:id",
    roles: ["DRIVER"],
    handler: ({ user, params }) => ({ trip: driverTrip(ownTrip(user.id, params.id)) }),
  },
  {
    method: "POST",
    pattern: "/driver/trips/:id/call",
    roles: ["DRIVER"],
    handler: ({ user, params, body }) => {
      const trip = ownTrip(user.id, params.id);
      if (trip.status !== "LOADING") invalidState("The trip is not loading");
      const taxi = taxiOf(trip);
      const seatsLeft = taxi.capacity - seatsUsed(trip.id);
      const count = body.count === undefined ? seatsLeft : Number(body.count);
      if (!Number.isInteger(count) || count < 1) fail(400, "validation_error", "Count must be a positive number");
      if (count > seatsLeft || seatsLeft === 0) fail(409, "not_enough_seats", "Not enough seats left");
      const s = station(route(trip.routeId).originId);
      const called: TripEntry[] = [];
      for (const entry of waitingInOrder(trip.routeId).slice(0, count)) {
        entry.status = "CALLED";
        entry.calledAt = nowIso();
        entry.tripId = trip.id;
        notify(entry.passengerId, "QUEUE_CALLED", "Board now", `Taxi ${taxi.plate} is ready at ${s.name}. Board now.`);
        called.push(publicTripEntry(entry));
      }
      return { trip: driverTrip(trip), called };
    },
  },
  {
    method: "POST",
    pattern: "/driver/entries/:id/board",
    roles: ["DRIVER", "STATION_REP"],
    handler: ({ user, params }) => {
      const { entry, trip } = manageableEntry(user, params.id);
      entry.status = "BOARDED";
      entry.boardedAt = nowIso();
      return { entry: publicTripEntry(entry), trip: driverTrip(trip) };
    },
  },
  {
    method: "POST",
    pattern: "/driver/entries/:id/no-show",
    roles: ["DRIVER", "STATION_REP"],
    handler: ({ user, params }) => {
      const { entry, trip } = manageableEntry(user, params.id);
      entry.status = "NO_SHOW";
      notify(entry.passengerId, "QUEUE_NO_SHOW", "Missed taxi", `You missed taxi ${taxiOf(trip).plate}. Join the queue again.`);
      return { entry: publicTripEntry(entry), trip: driverTrip(trip) };
    },
  },
  {
    method: "POST",
    pattern: "/driver/trips/:id/depart",
    roles: ["DRIVER"],
    handler: ({ user, params }) => {
      const trip = ownTrip(user.id, params.id);
      if (trip.status !== "LOADING") invalidState("The trip is not loading");
      const entries = tripEntries(trip.id);
      if (!entries.some((e) => e.status === "BOARDED")) {
        fail(409, "no_boarded_passengers", "Board at least one passenger");
      }
      for (const e of entries) if (e.status === "CALLED") e.status = "NO_SHOW";
      trip.status = "DEPARTED";
      trip.departedAt = nowIso();
      const taxi = taxiOf(trip);
      taxi.status = "EN_ROUTE";
      taxi.currentStationId = null;
      return { trip: driverTrip(trip) };
    },
  },
  {
    method: "POST",
    pattern: "/driver/trips/:id/cancel",
    roles: ["DRIVER"],
    handler: ({ user, params }) => {
      const trip = ownTrip(user.id, params.id);
      if (trip.status !== "LOADING") invalidState("Only a loading trip can be cancelled");
      for (const e of tripEntries(trip.id)) {
        if (e.status === "CALLED") {
          e.status = "WAITING";
          e.calledAt = null;
          e.tripId = null;
        }
      }
      trip.status = "CANCELLED";
      taxiOf(trip).status = "AT_STATION";
      return { trip: driverTrip(trip) };
    },
  },
  {
    method: "POST",
    pattern: "/driver/trips/:id/arrive",
    roles: ["DRIVER"],
    handler: ({ user, params }) => {
      const trip = ownTrip(user.id, params.id);
      if (trip.status !== "DEPARTED") invalidState("The trip has not departed");
      trip.status = "COMPLETED";
      trip.arrivedAt = nowIso();
      const destination = station(route(trip.routeId).destinationId);
      const taxi = taxiOf(trip);
      taxi.status = "AT_STATION";
      taxi.currentStationId = destination.id;
      for (const e of tripEntries(trip.id)) {
        if (e.status === "BOARDED") {
          notify(
            e.passengerId,
            "TRIP_COMPLETED",
            "You arrived",
            `You arrived at ${destination.name} with taxi ${taxi.plate}. Please rate your trip.`,
          );
        }
      }
      return { trip: driverTrip(trip), taxi: driverTaxi(taxi) };
    },
  },
  {
    method: "GET",
    pattern: "/driver/reports",
    roles: ["DRIVER"],
    handler: ({ user }) => ({ reports: load().reports.filter((report) => report.driverId === user.id) }),
  },
  {
    method: "POST",
    pattern: "/driver/reports/:id/respond",
    roles: ["DRIVER"],
    handler: ({ user, params, body }) => {
      const report = load().reports.find((r) => r.id === params.id && r.driverId === user.id) ?? notFound("Report");
      if (report.driverResponse) fail(409, "already_responded", "Already responded");
      report.driverResponse = requireText(body.response, "response");
      return { report };
    },
  },

  // ----- station rep -----
  {
    method: "GET",
    pattern: "/station/queues",
    roles: ["STATION_REP"],
    handler: ({ user }) => {
      const d = load();
      const s = station(user.stationId ?? "");
      return {
        station: s,
        routes: d.routes
          .filter((r) => r.originId === s.id)
          .map((r) => {
            const waiting = waitingInOrder(r.id);
            const called = d.entries.filter((e) => e.routeId === r.id && e.status === "CALLED");
            return {
              route: routeRef(r.id),
              waiting: waiting.length,
              priorityWaiting: waiting.filter((entry) => entry.isPriority).length,
              entries: [...waiting, ...called].map(stationEntry),
            };
          }),
        taxis: d.taxis
          .filter((t) => t.currentStationId === s.id)
          .map((t) => ({
            id: t.id,
            plate: t.plate,
            capacity: t.capacity,
            status: t.status,
            driverFirstName: firstName(t.driverId),
            activeTripId:
              d.trips.find((trip) => trip.taxiId === t.id && (trip.status === "LOADING" || trip.status === "DEPARTED"))?.id ??
              null,
          })),
      };
    },
  },
  {
    method: "POST",
    pattern: "/station/entries/:id/remove",
    roles: ["STATION_REP"],
    handler: ({ user, params }) => {
      const entry = load().entries.find((e) => e.id === params.id) ?? notFound("Entry");
      if (route(entry.routeId).originId !== user.stationId) notFound("Entry");
      if (entry.status !== "WAITING" && entry.status !== "CALLED") invalidState("Entry is not active");
      entry.status = "CANCELLED";
      notify(entry.passengerId, "QUEUE_REMOVED", "Removed from queue", "The station removed you from the queue.");
      return { entry: stationEntry(entry) };
    },
  },

  // ----- admin -----
  {
    method: "GET",
    pattern: "/admin/stats",
    roles: ["ADMIN"],
    handler: () => {
      const d = load();
      const called = d.entries.filter((e) => e.calledAt);
      const averageWaitSeconds = called.length
        ? Math.round(
            called.reduce((sum, e) => sum + (Date.parse(e.calledAt!) - Date.parse(e.joinedAt)), 0) / called.length / 1000,
          )
        : null;

      const completed = d.trips.filter((t) => t.status === "COMPLETED");
      const loadFactorByRoute = d.routes.map((r) => {
        const trips = completed.filter((t) => t.routeId === r.id);
        if (trips.length === 0) return { route: routeRef(r.id), loadFactor: null, completedTrips: 0 };
        const avg =
          trips.reduce(
            (sum, t) => sum + tripEntries(t.id).filter((e) => e.status === "BOARDED").length / taxiOf(t).capacity,
            0,
          ) / trips.length;
        return { route: routeRef(r.id), loadFactor: Math.round(avg * 1000) / 1000, completedTrips: trips.length };
      });

      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      return {
        averageWaitSeconds,
        loadFactorByRoute,
        tripsToday: d.trips.filter((t) => Date.parse(t.createdAt) >= midnight.getTime()).length,
        waitingNow: d.entries.filter((e) => e.status === "WAITING").length,
      };
    },
  },
  {
    method: "GET",
    pattern: "/admin/reports",
    roles: ["ADMIN"],
    handler: () => ({
      reports: [...load().reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(adminReport),
    }),
  },
  {
    method: "PATCH",
    pattern: "/admin/reports/:id",
    roles: ["ADMIN"],
    handler: ({ params, body }) => {
      const report = load().reports.find((r) => r.id === params.id) ?? notFound("Report");
      const status = body.status as ReportStatus;
      if (!["OPEN", "IN_REVIEW", "RESOLVED"].includes(status)) fail(400, "validation_error", "Invalid status");
      report.status = status;
      if (typeof body.resolutionNote === "string") report.resolutionNote = body.resolutionNote;
      return { report: adminReport(report) };
    },
  },

  // ----- GPS & location -----
  {
    method: "POST",
    pattern: "/me/location-consent",
    roles: "any",
    handler: ({ user, body }) => {
      const granted = Boolean(body.granted);
      const d = load();
      d.userLocationConsent ??= {};
      const timestamp = granted ? nowIso() : null;
      if (timestamp) {
        d.userLocationConsent[user.id] = timestamp;
      } else {
        delete d.userLocationConsent[user.id];
      }
      return { locationConsentAt: timestamp };
    },
  },
  {
    method: "POST",
    pattern: "/taxis/me/location",
    roles: ["DRIVER"],
    handler: ({ user, body }) => {
      const taxi = taxiForDriver(user.id);
      const d = load();
      d.taxiLocations ??= {};
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const heading = body.heading != null ? Number(body.heading) : null;
      const speedKmh = body.speedKmh != null ? Number(body.speedKmh) : null;
      const accuracyM = body.accuracyM != null ? Number(body.accuracyM) : undefined;
      const now = nowIso();
      d.taxiLocations[taxi.id] = { lat, lng, heading, speedKmh, accuracyM, updatedAt: now };
      return { ok: true, updatedAt: now };
    },
  },
  {
    method: "GET",
    pattern: "/taxis/nearby",
    roles: "any",
    handler: () => {
      const d = load();
      d.taxiLocations ??= {};
      const taxis = d.taxis.map((t) => {
        const loc = d.taxiLocations?.[t.id] ?? {
          lat: 7.6735 + (Math.random() - 0.5) * 0.01,
          lng: 36.8351 + (Math.random() - 0.5) * 0.01,
          heading: 0,
          speedKmh: 0,
          updatedAt: nowIso(),
        };
        const driver = d.users.find((u) => u.id === t.driverId);
        return {
          id: t.id,
          plate: t.plate,
          driverFirstName: driver?.name.split(" ")[0] ?? "Driver",
          status: t.status,
          freeSeats: Math.max(0, t.capacity - 2),
          lat: loc.lat,
          lng: loc.lng,
          distanceKm: 0.8,
          etaMinutes: 4,
          stale: false,
        };
      });
      return { taxis, roundedToMeters: 100 };
    },
  },
  {
    method: "GET",
    pattern: "/trips/:id/track",
    roles: "any",
    handler: ({ params }) => {
      const d = load();
      const trip = d.trips.find((t) => t.id === params.id) ?? d.trips[0];
      const taxi = trip ? taxiOf(trip) : d.taxis[0];
      const r = trip ? route(trip.routeId) : d.routes[0];
      const boardingStation = station(r.originId);
      const loc = d.taxiLocations?.[taxi.id];

      return {
        tripId: trip?.id ?? params.id,
        taxiPlate: taxi.plate,
        taxi: loc
          ? {
              lat: loc.lat,
              lng: loc.lng,
              heading: loc.heading ?? null,
              speedKmh: loc.speedKmh ?? null,
              updatedAt: loc.updatedAt,
              stale: false,
            }
          : {
              lat: 7.6735,
              lng: 36.8351,
              heading: 90,
              speedKmh: 25,
              updatedAt: nowIso(),
              stale: false,
            },
        etaMinutes: 5,
        boardingStation: {
          ...boardingStation,
          lat: 7.6735,
          lng: 36.8351,
        },
        polyline: [
          [7.6735, 36.8351],
          [7.678, 36.84],
          [7.6844, 36.8497],
        ],
      };
    },
  },
  {
    method: "GET",
    pattern: "/admin/fleet",
    roles: ["ADMIN", "STATION_REP"],
    handler: () => {
      const d = load();
      return {
        taxis: d.taxis.map((t) => {
          const loc = d.taxiLocations?.[t.id] ?? {
            lat: 7.6735,
            lng: 36.8351,
            heading: 0,
            speedKmh: 0,
            updatedAt: nowIso(),
          };
          return {
            id: t.id,
            plate: t.plate,
            status: t.status,
            driverFirstName: firstName(t.driverId),
            position: {
              lat: loc.lat,
              lng: loc.lng,
              heading: loc.heading ?? null,
              speedKmh: loc.speedKmh ?? null,
              updatedAt: loc.updatedAt,
              stale: false,
            },
          };
        }),
        stations: d.stations.map((s) => ({
          ...s,
          lat: 7.6735,
          lng: 36.8351,
        })),
        openPickups: (d.pickups ?? [])
          .filter((p) => p.status === "OPEN")
          .map((p) => ({
            id: p.id,
            approxLat: p.lat ?? 7.6735,
            approxLng: p.lng ?? 36.8351,
            seats: p.seats,
          })),
      };
    },
  },

  // ----- pickups -----
  {
    method: "POST",
    pattern: "/pickups",
    roles: ["PASSENGER"],
    handler: ({ user, body }) => {
      const d = load();
      d.pickups ??= [];
      const id = newId("pk");
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const seats = Number(body.seats) || 1;
      const placeNote = typeof body.placeNote === "string" ? body.placeNote : null;
      const pickup: MockPickup = {
        id,
        passengerId: user.id,
        lat,
        lng,
        seats,
        placeNote,
        status: "OPEN",
        acceptedTaxiId: null,
        acceptedDriverId: null,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        acceptedAt: null,
      };
      d.pickups.push(pickup);
      return created({
        pickup: {
          id: pickup.id,
          status: pickup.status,
          seats: pickup.seats,
          placeNote: pickup.placeNote,
          lat: pickup.lat,
          lng: pickup.lng,
          createdAt: pickup.createdAt,
          expiresAt: pickup.expiresAt,
          driversNotified: 2,
          taxi: null,
        },
      });
    },
  },
  {
    method: "GET",
    pattern: "/pickups/mine",
    roles: ["PASSENGER"],
    handler: ({ user }) => {
      const d = load();
      d.pickups ??= [];
      const pickup = d.pickups
        .filter((p) => p.passengerId === user.id && p.status !== "COMPLETED" && p.status !== "CANCELLED")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      if (!pickup) return { pickup: null };

      const taxi = pickup.acceptedTaxiId ? d.taxis.find((t) => t.id === pickup.acceptedTaxiId) : null;
      const driver = taxi ? d.users.find((u) => u.id === taxi.driverId) : null;

      return {
        pickup: {
          id: pickup.id,
          status: pickup.status,
          seats: pickup.seats,
          placeNote: pickup.placeNote,
          lat: pickup.status === "COMPLETED" || pickup.status === "CANCELLED" ? null : pickup.lat,
          lng: pickup.status === "COMPLETED" || pickup.status === "CANCELLED" ? null : pickup.lng,
          createdAt: pickup.createdAt,
          expiresAt: pickup.expiresAt,
          driversNotified: 3,
          taxi: taxi
            ? {
                plate: taxi.plate,
                driverFirstName: driver?.name.split(" ")[0] ?? "Driver",
                position: d.taxiLocations?.[taxi.id]
                  ? {
                      ...d.taxiLocations[taxi.id],
                      heading: d.taxiLocations[taxi.id].heading ?? null,
                      speedKmh: d.taxiLocations[taxi.id].speedKmh ?? null,
                      stale: false,
                    }
                  : null,
                etaMinutes: 4,
              }
            : null,
        },
      };
    },
  },
  {
    method: "POST",
    pattern: "/pickups/:id/cancel",
    roles: ["PASSENGER"],
    handler: ({ params }) => {
      const d = load();
      d.pickups ??= [];
      const pickup = d.pickups.find((p) => p.id === params.id);
      if (pickup) {
        pickup.status = "CANCELLED";
      }
      return { ok: true };
    },
  },
  {
    method: "GET",
    pattern: "/driver/pickups/nearby",
    roles: ["DRIVER"],
    handler: () => {
      const d = load();
      d.pickups ??= [];
      const openPickups = d.pickups.filter((p) => p.status === "OPEN");
      const pickups = openPickups.map((p) => ({
        id: p.id,
        approxLat: p.lat ? Math.round(p.lat * 1000) / 1000 : 7.675,
        approxLng: p.lng ? Math.round(p.lng * 1000) / 1000 : 36.835,
        seats: p.seats,
        distanceKm: 1.2,
        etaMinutes: 4,
        expiresAt: p.expiresAt,
        score: 0.85,
        parts: { distance: 0.9, freeSeats: 1.0, rating: 0.8, idle: 0.7 },
        method: "rules" as const,
        why: "Close to your route and matches your available seats",
      }));
      return { pickups, roundedToMeters: 300 };
    },
  },
  {
    method: "POST",
    pattern: "/driver/pickups/:id/accept",
    roles: ["DRIVER"],
    handler: ({ user, params }) => {
      const d = load();
      d.pickups ??= [];
      const taxi = taxiForDriver(user.id);
      const pickup = d.pickups.find((p) => p.id === params.id) ?? notFound("Pickup");
      pickup.status = "ACCEPTED";
      pickup.acceptedTaxiId = taxi.id;
      pickup.acceptedDriverId = user.id;
      pickup.acceptedAt = nowIso();
      const passenger = d.users.find((u) => u.id === pickup.passengerId);

      return {
        pickup: {
          id: pickup.id,
          status: pickup.status,
          seats: pickup.seats,
          placeNote: pickup.placeNote,
          passengerFirstName: passenger?.name.split(" ")[0] ?? "Passenger",
          lat: pickup.lat,
          lng: pickup.lng,
          expiresAt: pickup.expiresAt,
          acceptedAt: pickup.acceptedAt,
        },
      };
    },
  },
  {
    method: "GET",
    pattern: "/driver/pickups/mine",
    roles: ["DRIVER"],
    handler: ({ user }) => {
      const d = load();
      d.pickups ??= [];
      const pickup = d.pickups.find(
        (p) => p.acceptedDriverId === user.id && (p.status === "ACCEPTED" || p.status === "ARRIVED"),
      );
      if (!pickup) return { pickup: null };
      const passenger = d.users.find((u) => u.id === pickup.passengerId);
      return {
        pickup: {
          id: pickup.id,
          status: pickup.status,
          seats: pickup.seats,
          placeNote: pickup.placeNote,
          passengerFirstName: passenger?.name.split(" ")[0] ?? "Passenger",
          lat: pickup.lat,
          lng: pickup.lng,
          expiresAt: pickup.expiresAt,
          acceptedAt: pickup.acceptedAt,
        },
      };
    },
  },
  {
    method: "POST",
    pattern: "/driver/pickups/:id/arrived",
    roles: ["DRIVER"],
    handler: ({ params }) => {
      const d = load();
      d.pickups ??= [];
      const pickup = d.pickups.find((p) => p.id === params.id);
      if (pickup) pickup.status = "ARRIVED";
      return { ok: true };
    },
  },
  {
    method: "POST",
    pattern: "/driver/pickups/:id/complete",
    roles: ["DRIVER"],
    handler: ({ params }) => {
      const d = load();
      d.pickups ??= [];
      const pickup = d.pickups.find((p) => p.id === params.id);
      if (pickup) {
        pickup.status = "COMPLETED";
        pickup.lat = null;
        pickup.lng = null;
      }
      return { ok: true };
    },
  },

  // ----- controller -----
  {
    method: "GET",
    pattern: "/station/desk",
    roles: ["STATION_REP", "ADMIN"],
    handler: ({ user }) => {
      const d = load();
      const s = user.stationId ? station(user.stationId) : d.stations[0];
      const stationRoutes = d.routes.filter((r) => r.originId === s.id);
      const deskRoutes = stationRoutes.map((r) => {
        const waiting = waitingInOrder(r.id);
        const entries = waiting.map((e, idx) => ({
          id: e.id,
          firstName: firstName(e.passengerId),
          isPriority: e.isPriority,
          priorityVerified: e.isPriority,
          assistance: e.assistance,
          status: e.status,
          position: idx + 1,
          joinedAt: e.joinedAt,
          waitingMinutes: Math.round((Date.now() - Date.parse(e.joinedAt)) / 60000),
          tripId: e.tripId,
        }));
        return {
          route: routeRef(r.id),
          waiting: waiting.length,
          priorityWaiting: waiting.filter((e) => e.isPriority).length,
          entries,
        };
      });

      const driverLine = d.taxis
        .filter((t) => t.currentStationId === s.id)
        .map((t, idx) => ({
          id: `dl_${t.id}`,
          plate: t.plate,
          driverFirstName: firstName(t.driverId),
          status: (t.status === "LOADING" ? "LOADING" : t.status === "AT_STATION" ? "WAITING" : "DEPARTED") as any,
          position: idx + 1,
          isMe: false,
          outOfTurnAllowed: false,
        }));

      return {
        station: s,
        routes: deskRoutes,
        driverLine,
        counts: {
          waiting: deskRoutes.reduce((acc, r) => acc + r.waiting, 0),
          priority: deskRoutes.reduce((acc, r) => acc + r.priorityWaiting, 0),
          openDisputes: (d.disputes ?? []).filter((disp: any) => disp.status === "OPEN").length,
          alerts: 0,
        },
      };
    },
  },
  {
    method: "GET",
    pattern: "/station/alerts",
    roles: ["STATION_REP", "ADMIN"],
    handler: () => asListWithKey([], "alerts", { method: "rules" }),
  },
  {
    method: "GET",
    pattern: "/station/disputes",
    roles: ["STATION_REP", "ADMIN"],
    handler: () => asListWithKey(load().disputes ?? [], "disputes"),
  },
  {
    method: "PATCH",
    pattern: "/station/disputes/:id",
    roles: ["STATION_REP", "ADMIN"],
    handler: ({ params, body }) => {
      const d = load();
      d.disputes ??= [];
      const disp = d.disputes.find((item: any) => item.id === params.id);
      if (disp) {
        if (body.status) disp.status = body.status;
        if (body.resolutionNote) disp.resolutionNote = body.resolutionNote;
      }
      return { ok: true, dispute: disp };
    },
  },
  {
    method: "POST",
    pattern: "/station/actions",
    roles: ["STATION_REP", "ADMIN"],
    handler: ({ user, body }) => {
      const d = load();
      d.auditLog ??= [];
      const action = {
        id: newId("act"),
        stationId: user.stationId ?? "st_merkato",
        stationName: user.stationId ? station(user.stationId).name : "Merkato",
        actorFirstName: firstName(user.id),
        action: body.action,
        targetFirstName: "Passenger",
        queueEntryId: body.queueEntryId ?? null,
        driverQueueEntryId: body.driverQueueEntryId ?? null,
        disputeId: body.disputeId ?? null,
        reason: body.reason ?? "Action taken by controller",
        details: null,
        createdAt: nowIso(),
      };
      d.auditLog.unshift(action);
      return created({ ok: true, action });
    },
  },
  {
    method: "GET",
    pattern: "/station/audit-log",
    roles: ["STATION_REP", "ADMIN"],
    handler: () => asListWithKey(load().auditLog ?? [], "actions", { nextCursor: null }),
  },
  {
    method: "GET",
    pattern: "/admin/audit-log",
    roles: ["ADMIN"],
    handler: () => asListWithKey(load().auditLog ?? [], "actions", { nextCursor: null }),
  },
  {
    method: "POST",
    pattern: "/disputes",
    roles: ["PASSENGER", "DRIVER"],
    handler: ({ user, body }) => {
      const d = load();
      d.disputes ??= [];
      const id = newId("dsp");
      const dispute = {
        id,
        stationId: user.stationId ?? "st_merkato",
        stationName: "Merkato",
        type: body.type ?? "LINE_JUMPING",
        status: "OPEN",
        description: body.description ?? "",
        openedByFirstName: firstName(user.id),
        openedByIsPriority: false,
        againstFirstName: null,
        queueEntryId: body.queueEntryId ?? null,
        tripId: body.tripId ?? null,
        entry: null,
        resolutionNote: null,
        controllerReason: null,
        resolutionActionId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        resolvedAt: null,
        waitingMinutes: 0,
        canAppeal: false,
      };
      d.disputes.unshift(dispute);
      return created({ ok: true, dispute, id, status: "OPEN" });
    },
  },
  {
    method: "GET",
    pattern: "/disputes/mine",
    roles: ["PASSENGER", "DRIVER"],
    handler: ({ user }) => {
      const d = load();
      d.disputes ??= [];
      const myDisputes = d.disputes.filter((item: any) => item.openedByFirstName === firstName(user.id));
      return asListWithKey(myDisputes, "disputes");
    },
  },
  {
    method: "GET",
    pattern: "/actions/mine",
    roles: ["PASSENGER", "DRIVER"],
    handler: () => asListWithKey([], "actions"),
  },
  {
    method: "GET",
    pattern: "/suspensions/me",
    roles: ["PASSENGER", "DRIVER"],
    handler: () => ({ suspension: null, active: false }),
  },
  {
    method: "POST",
    pattern: "/appeals",
    roles: ["PASSENGER", "DRIVER"],
    handler: ({ user, body }) => {
      const d = load();
      d.appeals ??= [];
      const appeal = {
        id: newId("apl"),
        status: "OPEN",
        reason: body.reason ?? "",
        adminNote: null,
        appellantFirstName: firstName(user.id),
        createdAt: nowIso(),
        decidedAt: null,
        action: null,
        disputeId: body.disputeId ?? null,
      };
      d.appeals.unshift(appeal);
      return created({ ok: true, appeal, id: appeal.id, status: "OPEN" });
    },
  },
  {
    method: "GET",
    pattern: "/appeals/mine",
    roles: ["PASSENGER", "DRIVER"],
    handler: () => asListWithKey(load().appeals ?? [], "appeals"),
  },
  {
    method: "GET",
    pattern: "/admin/appeals",
    roles: ["ADMIN"],
    handler: () => asListWithKey(load().appeals ?? [], "appeals"),
  },
  {
    method: "PATCH",
    pattern: "/admin/appeals/:id",
    roles: ["ADMIN"],
    handler: ({ params, body }) => {
      const d = load();
      d.appeals ??= [];
      const appeal = d.appeals.find((a: any) => a.id === params.id);
      if (appeal) {
        appeal.status = body.status ?? "UPHELD";
        appeal.adminNote = body.adminNote ?? null;
        appeal.decidedAt = nowIso();
      }
      return { ok: true, appeal };
    },
  },
  {
    method: "GET",
    pattern: "/driver/queue",
    roles: ["DRIVER"],
    handler: ({ user }) => {
      const d = load();
      const taxi = taxiForDriver(user.id);
      const s = taxi.currentStationId ? station(taxi.currentStationId) : d.stations[0];
      const myLineEntry = {
        id: `dl_${taxi.id}`,
        plate: taxi.plate,
        driverFirstName: firstName(user.id),
        status: "WAITING" as const,
        position: 1,
        isMe: true,
        outOfTurnAllowed: false,
      };
      const line = [myLineEntry];
      return asListWithKey(line, "entries", {
        station: s,
        enforced: true,
        mine: myLineEntry,
        line,
        canStart: true,
        position: 1,
      });
    },
  },
  {
    method: "POST",
    pattern: "/driver/queue/join",
    roles: ["DRIVER"],
    handler: () => ({ ok: true }),
  },
  {
    method: "POST",
    pattern: "/driver/queue/leave",
    roles: ["DRIVER"],
    handler: () => ({ ok: true }),
  },

  // ----- AI -----
  {
    method: "GET",
    pattern: "/ai/wait-estimate",
    roles: "any",
    handler: () => ({
      minutes: 8,
      lowMinutes: 5,
      highMinutes: 12,
      confidence: "medium",
      basedOnSamples: 15,
      method: "statistics",
      synthetic: true,
      routeId: "rt_ju_mk",
      basis: "same_hour",
    }),
  },
  {
    method: "GET",
    pattern: "/ai/demand-forecast",
    roles: "any",
    handler: () => {
      const now = new Date();
      const h0 = new Date(now).toISOString();
      const h1 = new Date(now.getTime() + 3600000).toISOString();
      const h2 = new Date(now.getTime() + 7200000).toISOString();
      return {
        stationId: "st_merkato",
        method: "rules",
        basedOnSamples: 60,
        synthetic: true,
        routes: [
          {
            route: routeRef("rt_mk_ju"),
            hours: [
              { hourStart: h0, expectedWaiting: 12, low: 8, high: 16 },
              { hourStart: h1, expectedWaiting: 18, low: 12, high: 24 },
              { hourStart: h2, expectedWaiting: 9, low: 5, high: 14 },
            ],
          },
        ],
        recommendation: {
          routeId: "rt_mk_ju",
          stationId: "st_merkato",
          hourStart: h1,
          expectedWaiting: 18,
          message: "High demand expected on Merkato to Jimma University in the next hour.",
        },
      };
    },
  },
  {
    method: "GET",
    pattern: "/admin/ai/insights",
    roles: ["ADMIN", "STATION_REP"],
    handler: () => ({
      method: "rules",
      basedOnSamples: 42,
      synthetic: true,
      days: 7,
      topIssues: [
        { type: "OVERCHARGING", source: "report", count: 12, previousCount: 15, change: -3 },
        { type: "LINE_JUMPING", source: "dispute", count: 8, previousCount: 5, change: 3 },
      ],
      hotspots: [
        { stationId: "st_merkato", stationName: "Merkato", hour: 17, disputes: 5, topType: "LINE_JUMPING" as const },
        { stationId: "st_ju", stationName: "Jimma University", hour: 8, disputes: 4, topType: "PRIORITY_CLAIM" as const },
      ],
      repeatOffenders: { count: 0, userIds: [] },
      suggestions: ["Demo mode: no real data yet."],
    }),
  },

  // ----- demo mode -----
  {
    method: "POST",
    pattern: "/dev/reset",
    roles: "public",
    handler: () => {
      db = seed();
      return { ok: true };
    },
  },
  {
    method: "GET",
    pattern: "/dev/sms",
    roles: "public",
    handler: () => {
      const d = load();
      const messages = [...d.notifications]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100)
        .map((n) => {
          const recipient = d.users.find((u) => u.id === n.userId);
          return {
            id: n.id,
            to: recipient?.phone ?? "",
            recipientName: recipient?.name ?? "",
            text: `TaxiFlow: ${n.body}`,
            createdAt: n.createdAt,
          };
        });
      return { messages };
    },
  },
];

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/");
  const a = path.split("/");
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

function userFromToken(token: string | null): MockUser | null {
  if (!token?.startsWith("mock-token:")) return null;
  const id = token.slice("mock-token:".length);
  return load().users.find((u) => u.id === id) ?? null;
}

export async function mockRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  token: string | null,
): Promise<MockResponse> {
  const wait = LATENCY_MIN_MS + Math.floor(Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS));
  await new Promise((resolve) => setTimeout(resolve, wait));
  const cleanPath = path.split("?")[0];

  for (const def of routes) {
    if (def.method !== method) continue;
    const params = match(def.pattern, cleanPath);
    if (!params) continue;

    try {
      const user = userFromToken(token);
      if (def.roles !== "public") {
        if (!user) fail(401, "unauthorized", "Please log in");
        const allowed = def.roles === "any" ? ALL_ROLES : def.roles;
        if (!allowed.includes(user.role)) fail(403, "forbidden", "Not allowed for your role");
      }
      const result = def.handler({
        user: user as MockUser,
        body: (body ?? {}) as Record<string, unknown>,
        params,
      });
      if (method !== "GET") {
        save();
        emitLive("demand:update", {});
        emitLive("queue:update", {});
        emitLive("trip:update", {});
        emitLive("notification:new", {});
      }
      return result instanceof Created
        ? { status: 201, data: structuredClone(result.data) }
        : { status: 200, data: structuredClone(result) };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, data: { error: e.code, message: e.message } };
      console.error("[mock]", e);
      return { status: 500, data: { error: "server_error", message: "Mock server error" } };
    }
  }
  return { status: 404, data: { error: "not_found", message: `No mock for ${method} ${cleanPath}` } };
}

function broadcast() {
  save();
  emitLive("demand:update", {});
  emitLive("queue:update", {});
  emitLive("trip:update", {});
  emitLive("notification:new", {});
}

/** A random extra passenger joins or leaves so counters move during a demo. */
export function tickAmbient() {
  const d = load();
  const liveRoutes = [UNIVERSITY_TO_MERKATO, "rt_mk_ju", "rt_mk_ho", "rt_mk_aw", "rt_mk_bus", "rt_jr_mk"];
  const routeId = liveRoutes[Math.floor(Math.random() * liveRoutes.length)];
  const waiting = d.entries.filter((entry) => entry.routeId === routeId && entry.status === "WAITING");
  if (Math.random() < 0.4 && waiting.length > 4) {
    waiting[waiting.length - 1].status = "CANCELLED";
  } else {
    const id = newId("u");
    const names = ["Hawi Tadesse", "Yonas Gemechu", "Sara Mekonnen", "Dawit Abdi", "Liya Kebede", "Nahom Tolasa"];
    d.users.push({
      id,
      name: names[Math.floor(Math.random() * names.length)],
      phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      role: "PASSENGER",
      language: "en",
      stationId: null,
      createdAt: nowIso(),
      password: PASSWORD,
    });
    const priority = Math.random() < 0.2;
    d.entries.push({
      id: newId("qe"),
      passengerId: id,
      routeId,
      status: "WAITING",
      assistance: priority ? "ELDERLY" : "NONE",
      isPriority: priority,
      joinedAt: nowIso(),
      calledAt: null,
      boardedAt: null,
      tripId: null,
    });
  }
  broadcast();
}

export function resetMock() {
  db = null;
  localStorage.removeItem(STORAGE_KEY);
  emitLive("demand:update", {});
}

export function demoJoin(priority: boolean) {
  const d = load();
  const id = newId("u");
  d.users.push({
    id,
    name: priority ? "Almaz Bekele" : "Bereket Tolasa",
    phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    role: "PASSENGER",
    language: "en",
    stationId: null,
    createdAt: nowIso(),
    password: PASSWORD,
  });
  d.entries.push({
    id: newId("qe"),
    passengerId: id,
    routeId: UNIVERSITY_TO_MERKATO,
    status: "WAITING",
    assistance: priority ? "ELDERLY" : "NONE",
    isPriority: priority,
    joinedAt: priority ? ago(50 * MINUTE) : nowIso(),
    calledAt: null,
    boardedAt: null,
    tripId: null,
  });
  broadcast();
}

export function demoBumpMe() {
  const token = sessionStorage.getItem("taxiflow.token") ?? localStorage.getItem("taxiflow.token");
  const user = userFromToken(token);
  if (!user) return;
  const d = load();
  const mine = d.entries.find(
    (entry) => entry.passengerId === user.id && entry.status === "WAITING",
  );
  if (!mine) return;
  const earlier = d.entries
    .filter((entry) => entry.routeId === mine.routeId && entry.status === "WAITING" && entry.id !== mine.id)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  const ahead = earlier.filter((entry) => (entry.isPriority ? 1 : 0) >= (mine.isPriority ? 1 : 0));
  const target = ahead[0];
  if (!target) return;
  const joined = mine.joinedAt;
  mine.joinedAt = new Date(new Date(target.joinedAt).getTime() - 1000).toISOString();
  if (joined === mine.joinedAt) mine.joinedAt = ago(1000);
  broadcast();
}

export async function demoCallNext() {
  const token = "mock-token:u_d3";
  const d = load();
  const taxi = d.taxis.find((item) => item.driverId === "u_d3");
  let trip = taxi
    ? d.trips.find((item) => item.taxiId === taxi.id && (item.status === "LOADING" || item.status === "DEPARTED"))
    : undefined;
  if (!trip) {
    const started = await mockRequest("POST", "/driver/trips/start", { routeId: UNIVERSITY_TO_MERKATO }, token);
    const startedTrip = (started.data as { trip?: { id: string } }).trip;
    trip = startedTrip ? d.trips.find((item) => item.id === startedTrip.id) : undefined;
  }
  if (!trip || trip.status !== "LOADING") return;
  await mockRequest("POST", `/driver/trips/${trip.id}/call`, { count: 3 }, token);
}

export async function demoCompleteTrip() {
  const d = load();
  const trip = d.trips.find((item) => item.status === "LOADING" || item.status === "DEPARTED");
  if (!trip) return;
  const taxi = d.taxis.find((item) => item.id === trip.taxiId);
  if (!taxi) return;
  const token = `mock-token:${taxi.driverId}`;
  if (trip.status === "LOADING") {
    const called = d.entries.filter((entry) => entry.tripId === trip.id && entry.status === "CALLED");
    const target = called[0] ?? d.entries.find((entry) => entry.tripId === trip.id);
    if (target && target.status !== "BOARDED") {
      if (target.status !== "CALLED") {
        target.status = "CALLED";
        target.calledAt = nowIso();
      }
      await mockRequest("POST", `/driver/entries/${target.id}/board`, {}, token);
    }
    await mockRequest("POST", `/driver/trips/${trip.id}/depart`, {}, token);
  }
  await mockRequest("POST", `/driver/trips/${trip.id}/arrive`, {}, token);
}
