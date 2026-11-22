/**
 * Approximate Jimma coordinates. APPROXIMATE, VERIFY ON THE MAP before real use.
 * They are placed by hand from public map knowledge so the demo has plausible distances.
 * Mirrored from apps/api/src/data/places.ts.
 */
export type Place = { lat: number; lng: number };

export const STATION_COORDS: Record<string, Place> = {
  Merkato: { lat: 7.6735, lng: 36.8351 },
  "Jimma University": { lat: 7.6844, lng: 36.8497 },
  Awetu: { lat: 7.6918, lng: 36.8223 },
  Jiren: { lat: 7.6602, lng: 36.8452 },
  "University Hospital": { lat: 7.6797, lng: 36.8561 },
  Hermata: { lat: 7.6879, lng: 36.8302 },
  Bishishe: { lat: 7.6658, lng: 36.8219 },
  "Bus station": { lat: 7.6701, lng: 36.8402 },
};

/**
 * Waypoints between two stations: the stations themselves plus two bends so the line looks like a road.
 * Both directions share one road: the line is built from the alphabetically first station to the second,
 * and the other direction is that line reversed.
 */
export function routeWaypoints(from: string, to: string): [number, number][] {
  const first = from <= to ? from : to;
  const second = from <= to ? to : from;
  const a = STATION_COORDS[first];
  const b = STATION_COORDS[second];
  if (!a || !b) return [];
  const seed = `${first}|${second}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const bend = ((seed % 7) - 3) * 0.0006;
  const at = (t: number, side: number): [number, number] => [
    a.lat + (b.lat - a.lat) * t + side * bend,
    a.lng + (b.lng - a.lng) * t - side * bend,
  ];
  const line: [number, number][] = [[a.lat, a.lng], at(0.35, 1), at(0.7, -1), [b.lat, b.lng]];
  return from <= to ? line : [...line].reverse();
}
