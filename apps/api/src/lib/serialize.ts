import {
  Language,
  type DriverTaxi,
  type DriverTrip,
  type PublicUser,
  type QueueEntry,
  type RouteSummary,
  type Station,
  type TripEntry,
} from "@taxiflow/shared";
import type {
  QueueEntry as DbQueueEntry,
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
