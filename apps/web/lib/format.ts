import type { Language, RouteRef, Station } from "@/lib/types";

export function stationName(station: Station, lang: Language): string {
  return (lang === "am" && station.nameAm) || station.name;
}

/** Picks the translation key for zero, one or many. */
export function countKey<K extends string>(n: number, none: K, one: K, many: K): K {
  return n === 0 ? none : n === 1 ? one : many;
}

export function routeName(route: RouteRef, lang: Language): string {
  return `${stationName(route.origin, lang)} → ${stationName(route.destination, lang)}`;
}
