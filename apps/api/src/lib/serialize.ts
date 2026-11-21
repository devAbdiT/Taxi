import { Language, type PublicUser, type QueueEntry, type RouteSummary, type Station } from "@taxiflow/shared";
import type {
  QueueEntry as DbQueueEntry,
  Route as DbRoute,
  Station as DbStation,
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
