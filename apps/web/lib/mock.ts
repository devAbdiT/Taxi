// In-browser fake of the MengedLink API, used when NEXT_PUBLIC_USE_MOCKS=true.
// Seeded with the demo data from MASTER_PROMPT.md section 7 and saved in localStorage,
// so other tabs see the same state after their next refresh.

import type { HttpMethod } from "@/lib/api";
import { emitLive } from "@/lib/live/bus";
import type {
  AssistanceType,
  ContractRequest,
  DriverMe,
  Language,
  Notification,
  QueueEntry,
  Rating,
  Report,
  ReportStatus,
  Role,
  RouteRef,
  RouteSummary,
  Station,
  StationEntry,
  TaxiStatus,
  TripDetail,
  TripStatus,
  TripSummary,
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
interface MockEntry extends QueueEntry {
  passengerId: string;
}
interface MockNotification extends Notification {
  userId: string;
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

function publicUser({ password: _password, ...rest }: MockUser): User {
  return rest;
}

const station = (id: string) => load().stations.find((s) => s.id === id) ?? notFound("Station");
const route = (id: string) => load().routes.find((r) => r.id === id) ?? notFound("Route");
const firstName = (userId: string) => load().users.find((u) => u.id === userId)?.name.split(" ")[0] ?? "";

function routeRef(routeId: string): RouteRef {
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

function routeSummary(r: MockRoute): RouteSummary {
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

const publicEntry = ({ passengerId: _passengerId, ...rest }: MockEntry): QueueEntry => rest;

const tripEntries = (tripId: string) => load().entries.filter((e) => e.tripId === tripId);

const seatsUsed = (tripId: string) =>
  tripEntries(tripId).filter((e) => e.status === "CALLED" || e.status === "BOARDED").length;

const taxiOf = (trip: MockTrip) => load().taxis.find((t) => t.id === trip.taxiId) ?? notFound("Taxi");

function tripSummary(trip: MockTrip): TripSummary {
  return {
    id: trip.id,
    route: routeRef(trip.routeId),
    status: trip.status,
    createdAt: trip.createdAt,
    departedAt: trip.departedAt,
    arrivedAt: trip.arrivedAt,
    seatsUsed: seatsUsed(trip.id),
    capacity: taxiOf(trip).capacity,
  };
}

function toStationEntry(e: MockEntry): StationEntry {
  return {
    id: e.id,
    firstName: firstName(e.passengerId),
    isPriority: e.isPriority,
    assistance: e.assistance,
    status: e.status,
    joinedAt: e.joinedAt,
    calledAt: e.calledAt,
    position: positionOf(e),
  };
}

function tripDetail(trip: MockTrip): TripDetail {
  return {
    ...tripSummary(trip),
    entries: tripEntries(trip.id).map((e) => {
      const { position: _position, ...rest } = toStationEntry(e);
      return rest;
    }),
  };
}

function notify(userId: string, type: string, title: string, body: string) {
  load().notifications.push({ id: newId("nt"), userId, type, title, body, read: false, createdAt: nowIso() });
}

function taxiForDriver(driverId: string): MockTaxi {
  return load().taxis.find((t) => t.driverId === driverId) ?? notFound("Taxi");
}

function activeTripOf(taxi: MockTaxi): MockTrip | null {
  return load().trips.find((t) => t.taxiId === taxi.id && (t.status === "LOADING" || t.status === "DEPARTED")) ?? null;
}

function driverMe(driverId: string): DriverMe {
  const taxi = taxiForDriver(driverId);
  const trip = activeTripOf(taxi);
  const used = trip ? seatsUsed(trip.id) : 0;
  return {
    taxi: {
      id: taxi.id,
      plate: taxi.plate,
      capacity: taxi.capacity,
      status: taxi.status,
      currentStation: taxi.currentStationId ? station(taxi.currentStationId) : null,
    },
    activeTrip: trip ? tripSummary(trip) : null,
    seatsUsed: used,
    seatsLeft: taxi.capacity - used,
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
      const user: MockUser = { id: newId("u"), name, phone, role: "PASSENGER", language, stationId: null, password };
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
  { method: "GET", pattern: "/me", roles: "any", handler: ({ user }) => publicUser(user) },
  { method: "GET", pattern: "/stations", roles: "any", handler: () => load().stations },
  {
    method: "GET",
    pattern: "/public/pulse",
    roles: "public",
    handler: () => ({ waitingNow: load().entries.filter((entry) => entry.status === "WAITING").length }),
  },
  { method: "GET", pattern: "/routes", roles: "any", handler: () => load().routes.map(routeSummary) },

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
      if (!entry) return { entry: null, position: null, route: null, taxiPlate: null };
      const trip = d.trips.find((t) => t.id === entry.tripId);
      return {
        entry: publicEntry(entry),
        position: positionOf(entry),
        route: routeSummary(route(entry.routeId)),
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
      return publicEntry(entry);
    },
  },
  {
    method: "GET",
    pattern: "/trips/mine",
    roles: ["PASSENGER"],
    handler: ({ user }) => {
      const d = load();
      const boarded = d.entries.filter((e) => e.passengerId === user.id && e.status === "BOARDED" && e.tripId);
      return boarded
        .map((e) => d.trips.find((t) => t.id === e.tripId))
        .filter((t): t is MockTrip => !!t && (t.status === "DEPARTED" || t.status === "COMPLETED"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((t) => ({
          id: t.id,
          route: routeRef(t.routeId),
          taxiPlate: taxiOf(t).plate,
          status: t.status,
          departedAt: t.departedAt,
          arrivedAt: t.arrivedAt,
          rated: d.ratings.some((r) => r.tripId === t.id && r.passengerId === user.id),
          canRate: t.status === "COMPLETED" && !d.ratings.some((r) => r.tripId === t.id && r.passengerId === user.id),
          driverFirstName: d.users.find((u) => u.id === taxiOf(t).driverId)?.name.split(" ")[0] ?? "",
        }));
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
        comment: typeof body.comment === "string" ? body.comment : undefined,
        createdAt: nowIso(),
      };
      d.ratings.push(rating);
      return created(rating);
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
      return created(report);
    },
  },
  {
    method: "GET",
    pattern: "/notifications",
    roles: "any",
    handler: ({ user }) =>
      load()
        .notifications.filter((n) => n.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ userId: _userId, ...n }) => n),
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
        notes: typeof body.notes === "string" ? body.notes : undefined,
        status: "NEW",
        createdAt: nowIso(),
      };
      load().contracts.push(contract);
      return created(contract);
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
      return driverMe(user.id);
    },
  },
  {
    method: "GET",
    pattern: "/driver/demand",
    roles: ["DRIVER"],
    handler: ({ user }) => {
      const d = load();
      const taxi = taxiForDriver(user.id);
      const demand = d.routes
        .map((r) => {
          const s = routeSummary(r);
          return { route: routeRef(r.id), waiting: s.waiting, priorityWaiting: s.priorityWaiting, originId: r.originId };
        })
        .sort((a, b) => b.waiting - a.waiting);

      // Only with an active trip: the reverse of its route (matches the backend contract).
      const trip = activeTripOf(taxi);
      const outbound = trip ? route(trip.routeId) : undefined;
      const reverse = outbound
        ? demand.find((x) => x.route.origin.id === outbound.destinationId && x.route.destination.id === outbound.originId)
        : undefined;
      const returnSuggestion = reverse ? { ...reverse, reason: "RETURN_TRIP" as const } : null;
      const strip = <T extends { originId: string }>({ originId: _originId, ...rest }: T) => rest;
      return {
        routes: demand.map(strip),
        returnSuggestion: returnSuggestion ? strip(returnSuggestion) : null,
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
      return created(tripDetail(trip));
    },
  },
  {
    method: "GET",
    pattern: "/driver/trips/:id",
    roles: ["DRIVER"],
    handler: ({ user, params }) => tripDetail(ownTrip(user.id, params.id)),
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
      for (const entry of waitingInOrder(trip.routeId).slice(0, count)) {
        entry.status = "CALLED";
        entry.calledAt = nowIso();
        entry.tripId = trip.id;
        notify(entry.passengerId, "CALLED", "Board now", `Taxi ${taxi.plate} is ready at ${s.name}. Board now.`);
      }
      return tripDetail(trip);
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
      return tripDetail(trip);
    },
  },
  {
    method: "POST",
    pattern: "/driver/entries/:id/no-show",
    roles: ["DRIVER", "STATION_REP"],
    handler: ({ user, params }) => {
      const { entry, trip } = manageableEntry(user, params.id);
      entry.status = "NO_SHOW";
      notify(entry.passengerId, "NO_SHOW", "Missed taxi", `You missed taxi ${taxiOf(trip).plate}. Join the queue again.`);
      return tripDetail(trip);
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
      return tripDetail(trip);
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
      return tripDetail(trip);
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
      return tripDetail(trip);
    },
  },
  {
    method: "GET",
    pattern: "/driver/reports",
    roles: ["DRIVER"],
    handler: ({ user }) => load().reports.filter((report) => report.driverId === user.id),
  },
  {
    method: "POST",
    pattern: "/driver/reports/:id/respond",
    roles: ["DRIVER"],
    handler: ({ user, params, body }) => {
      const report = load().reports.find((r) => r.id === params.id && r.driverId === user.id) ?? notFound("Report");
      if (report.driverResponse) fail(409, "already_responded", "Already responded");
      report.driverResponse = requireText(body.response, "response");
      return report;
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
        queues: d.routes
          .filter((r) => r.originId === s.id)
          .map((r) => ({
            route: routeRef(r.id),
            entries: [
              ...d.entries.filter((e) => e.routeId === r.id && e.status === "CALLED"),
              ...waitingInOrder(r.id),
            ].map(toStationEntry),
          })),
        taxis: d.taxis
          .filter((t) => t.currentStationId === s.id)
          .map(({ id, plate, capacity, status }) => ({ id, plate, capacity, status })),
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
      notify(entry.passengerId, "REMOVED", "Removed from queue", "The station removed you from the queue.");
      return { ok: true };
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
      const averageWaitMinutes = called.length
        ? Math.round(
            (called.reduce((sum, e) => sum + (Date.parse(e.calledAt!) - Date.parse(e.joinedAt)), 0) /
              called.length /
              MINUTE) *
              10,
          ) / 10
        : null;

      const completed = d.trips.filter((t) => t.status === "COMPLETED");
      const loadFactorByRoute = d.routes
        .map((r) => {
          const trips = completed.filter((t) => t.routeId === r.id);
          const factors = trips.map(
            (t) => tripEntries(t.id).filter((e) => e.status === "BOARDED").length / taxiOf(t).capacity,
          );
          const avg = factors.length ? factors.reduce((a, b) => a + b, 0) / factors.length : 0;
          return { route: routeRef(r.id), loadFactor: Math.round(avg * 100) / 100, trips: trips.length };
        })
        .filter((x) => x.trips > 0);

      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      return {
        averageWaitMinutes,
        loadFactorByRoute,
        tripsToday: d.trips.filter((t) => t.status !== "CANCELLED" && Date.parse(t.createdAt) >= midnight.getTime())
          .length,
        waitingNow: d.entries.filter((e) => e.status === "WAITING").length,
        waitSamples: called.slice(-8).map((entry) =>
          Math.max(1, Math.round((Date.parse(entry.calledAt!) - Date.parse(entry.joinedAt)) / MINUTE)),
        ),
      };
    },
  },
  {
    method: "GET",
    pattern: "/admin/reports",
    roles: ["ADMIN"],
    handler: () => [...load().reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
      return report;
    },
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
      return [...d.notifications]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
        .map((n) => ({
          id: n.id,
          to: d.users.find((u) => u.id === n.userId)?.phone ?? "",
          body: n.body,
          createdAt: n.createdAt,
        }));
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
  const token = localStorage.getItem("taxiflow.token");
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
    trip = (started.data as { id?: string }).id
      ? d.trips.find((item) => item.id === (started.data as { id: string }).id)
      : undefined;
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
