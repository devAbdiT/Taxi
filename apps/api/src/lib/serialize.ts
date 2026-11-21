import {
  ContractStatus,
  ContractType,
  Language,
  RatingTag,
  ReportStatus,
  ReportType,
  type AdminReport,
  type ContractRequest,
  type DriverTaxi,
  type DriverTrip,
  type Notification,
  type PublicUser,
  type QueueEntry,
  type Rating,
  type Report,
  type RouteSummary,
  type Station,
  type TripEntry,
} from "@taxiflow/shared";
import type {
  Notification as DbNotification,
  QueueEntry as DbQueueEntry,
  Rating as DbRating,
  ContractRequest as DbContractRequest,
  Report as DbReport,
  Route as DbRoute,
  Station as DbStation,
  Taxi as DbTaxi,
  Trip as DbTrip,
  User as DbUser,
} from "../generated/prisma/client.js";

type DbRouteWithStations = DbRoute & { origin: DbStation; destination: DbStation };

/** The only way a user leaves the API. Drops passwordHash. */
export function toPublicUser(user: DbUser): PublicUser {
  const language = Language.safeParse(user.language);
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    language: language.success ? language.data : "en",
    stationId: user.stationId,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toStation(station: DbStation): Station {
  return { id: station.id, name: station.name, nameAm: station.nameAm };
}

export function toRouteSummary(route: DbRouteWithStations): RouteSummary {
  return { id: route.id, origin: toStation(route.origin), destination: toStation(route.destination) };
}

/** A queue entry as its own passenger sees it. */
export function toQueueEntry(entry: DbQueueEntry & { route: DbRouteWithStations }): QueueEntry {
  return {
    id: entry.id,
    route: toRouteSummary(entry.route),
    status: entry.status,
    assistance: entry.assistance,
    isPriority: entry.isPriority,
    joinedAt: entry.joinedAt.toISOString(),
    calledAt: entry.calledAt?.toISOString() ?? null,
    boardedAt: entry.boardedAt?.toISOString() ?? null,
    tripId: entry.tripId,
  };
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function toDriverTaxi(taxi: DbTaxi & { currentStation: DbStation | null }): DriverTaxi {
  return {
    id: taxi.id,
    plate: taxi.plate,
    capacity: taxi.capacity,
    status: taxi.status,
    currentStation: taxi.currentStation ? toStation(taxi.currentStation) : null,
  };
}

/** Driver and station views: first name and priority only, never the phone number. */
export function toTripEntry(entry: DbQueueEntry & { passenger: DbUser }): TripEntry {
  return {
    id: entry.id,
    firstName: firstName(entry.passenger.name),
    isPriority: entry.isPriority,
    status: entry.status,
    calledAt: entry.calledAt?.toISOString() ?? null,
    boardedAt: entry.boardedAt?.toISOString() ?? null,
  };
}

type TripForDriver = DbTrip & {
  taxi: DbTaxi;
  route: DbRouteWithStations;
  entries: (DbQueueEntry & { passenger: DbUser })[];
};

export function seatsUsedOf(entries: { status: string }[]): number {
  return entries.filter((entry) => entry.status === "CALLED" || entry.status === "BOARDED").length;
}

export function toDriverTrip(trip: TripForDriver): DriverTrip {
  const seatsUsed = seatsUsedOf(trip.entries);
  return {
    id: trip.id,
    route: toRouteSummary(trip.route),
    status: trip.status,
    taxiPlate: trip.taxi.plate,
    capacity: trip.taxi.capacity,
    seatsUsed,
    seatsLeft: trip.taxi.capacity - seatsUsed,
    createdAt: trip.createdAt.toISOString(),
    departedAt: trip.departedAt?.toISOString() ?? null,
    arrivedAt: trip.arrivedAt?.toISOString() ?? null,
    entries: trip.entries.map(toTripEntry),
  };
}

export function toNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRating(row: DbRating): Rating {
  return {
    id: row.id,
    tripId: row.tripId,
    passengerId: row.passengerId,
    stars: row.stars,
    tags: row.tags.flatMap((tag) => {
      const parsed = RatingTag.safeParse(tag);
      return parsed.success ? [parsed.data] : [];
    }),
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toContract(row: DbContractRequest): ContractRequest {
  return {
    id: row.id,
    requesterId: row.requesterId,
    type: ContractType.parse(row.type),
    pickup: row.pickup,
    destination: row.destination,
    schedule: row.schedule,
    passengerCount: row.passengerCount,
    notes: row.notes,
    status: ContractStatus.parse(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toReport(row: DbReport): Report {
  return {
    id: row.id,
    reporterId: row.reporterId,
    tripId: row.tripId,
    driverId: row.driverId,
    type: ReportType.parse(row.type),
    description: row.description,
    status: ReportStatus.parse(row.status),
    driverResponse: row.driverResponse,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminReport(
  row: DbReport & { reporter: DbUser; driver: DbUser | null; trip: (DbTrip & { taxi: DbTaxi }) | null },
): AdminReport {
  return {
    ...toReport(row),
    reporter: { id: row.reporter.id, name: row.reporter.name },
    driver: row.driver ? { id: row.driver.id, name: row.driver.name } : null,
    taxiPlate: row.trip?.taxi.plate ?? null,
  };
}
