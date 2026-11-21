import { Language, type PublicUser, type RouteSummary, type Station } from "@taxiflow/shared";
import type {
  Route as DbRoute,
  Station as DbStation,
  User as DbUser,
} from "../generated/prisma/client.js";

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

export function toRouteSummary(route: DbRoute & { origin: DbStation; destination: DbStation }): RouteSummary {
  return { id: route.id, origin: toStation(route.origin), destination: toStation(route.destination) };
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
