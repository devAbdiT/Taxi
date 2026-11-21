import type { Language, RouteRef, Station } from "@/lib/types";

export function stationName(station: Station, lang: Language): string {
  return (lang === "am" && station.nameAm) || station.name;
}

export function routeName(route: RouteRef, lang: Language): string {
  return `${stationName(route.origin, lang)} → ${stationName(route.destination, lang)}`;
}
