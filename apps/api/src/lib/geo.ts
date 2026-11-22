const EARTH_RADIUS_KM = 6371.0088;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A box that contains every point within radiusKm. Cheap prefilter before haversineKm. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = toDeg(radiusKm / EARTH_RADIUS_KM);
  const cos = Math.max(0.01, Math.cos(toRad(lat)));
  const dLng = toDeg(radiusKm / (EARTH_RADIUS_KM * cos));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/**
 * Rounds a coordinate to a grid of about `meters` metres. One degree of latitude is about 111.2 km,
 * and the error is at most half a cell, so 100 m rounding is off by at most about 50 m per axis.
 */
export function roundCoord(value: number, meters: number): number {
  const step = meters / 111_195;
  return Math.round(Math.round(value / step) * step * 1e6) / 1e6;
}

/** Initial compass bearing from point 1 to point 2, 0 to 360 degrees. */
export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Fallback speed when a taxi reports none, or is almost standing still. */
export const DEFAULT_SPEED_KMH = 20;

/** Minutes to cover distanceKm at the taxi's speed (or 20 km/h when the speed is unknown or below 5). */
export function etaMinutes(distanceKm: number, speedKmh: number | null | undefined): number {
  const speed = speedKmh !== null && speedKmh !== undefined && speedKmh >= 5 ? speedKmh : DEFAULT_SPEED_KMH;
  return Math.round((distanceKm / speed) * 60 * 10) / 10;
}
