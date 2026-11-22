import {
  NearbyTaxisQuery,
  TaxiLocationRequest,
  type FleetResponse,
  type LocationConsentRequest,
  type LocationConsentResponse,
  type NearbyTaxisResponse,
  type TaxiLocationResponse,
  type TaxiPosition,
  type TripTrackResponse,
} from "@taxiflow/shared";
import type { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { AppError, forbidden, notFound } from "../lib/errors.js";
import { boundingBox, etaMinutes, haversineKm, roundCoord } from "../lib/geo.js";
import { firstName, toStation } from "../lib/serialize.js";
import { publishTaxiLocation } from "../realtime/emitter.js";
import { STATION_COORDS } from "../data/places.js";

type Client = Prisma.TransactionClient;

export const NEARBY_ROUND_METERS = 100;

export async function requireConsent(db: Client, userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { locationConsentAt: true } });
  if (!user?.locationConsentAt) {
    throw new AppError(403, "consent_required", "Allow location sharing first. You can change this in your profile.");
  }
}

export async function setLocationConsent(userId: string, body: LocationConsentRequest): Promise<LocationConsentResponse> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { locationConsentAt: body.granted ? new Date() : null },
    select: { locationConsentAt: true },
  });
  return { locationConsentAt: user.locationConsentAt?.toISOString() ?? null };
}

export function isStale(updatedAt: Date, now = Date.now()): boolean {
  return now - updatedAt.getTime() > env.LOCATION_STALE_SECONDS * 1000;
}

export function toPosition(location: { lat: number; lng: number; heading: number | null; speedKmh: number | null; updatedAt: Date }): TaxiPosition {
  return {
    lat: location.lat,
    lng: location.lng,
    heading: location.heading,
    speedKmh: location.speedKmh,
    updatedAt: location.updatedAt.toISOString(),
    stale: isStale(location.updatedAt),
  };
}

// 1 request per 2 seconds per driver.
const lastPing = new Map<string, number>();
export const resetLocationRateLimit = () => lastPing.clear();
const MIN_GAP_MS = 2000;

export async function updateTaxiLocation(driverId: string, body: z.output<typeof TaxiLocationRequest>): Promise<{ status: 200 | 202; body: TaxiLocationResponse }> {
  await requireConsent(prisma, driverId);
  const now = Date.now();
  const previous = lastPing.get(driverId);
  if (previous !== undefined && now - previous < MIN_GAP_MS) {
    throw new AppError(429, "too_fast", "Send your location at most once every 2 seconds");
  }
  const taxi = await prisma.taxi.findUnique({ where: { driverId }, select: { id: true } });
  if (!taxi) throw notFound("taxi_not_found", "This driver has no taxi");
  lastPing.set(driverId, now);

  if (body.accuracyM !== undefined && body.accuracyM > 200) {
    return { status: 202, body: { ok: true, ignored: "low_accuracy", updatedAt: null } };
  }
  const saved = await writeTaxiLocation(taxi.id, body);
  return { status: 200, body: { ok: true, updatedAt: saved.toISOString() } };
}

/** Stores the latest position (no history) and tells the people following this taxi. Also used by the demo simulator. */
export async function writeTaxiLocation(
  taxiId: string,
  body: { lat: number; lng: number; heading?: number; speedKmh?: number; accuracyM?: number },
): Promise<Date> {
  const updatedAt = new Date();
  await prisma.taxiLocation.upsert({
    where: { taxiId },
    create: { taxiId, lat: body.lat, lng: body.lng, heading: body.heading ?? null, speedKmh: body.speedKmh ?? null, accuracyM: body.accuracyM ?? null, updatedAt },
    update: { lat: body.lat, lng: body.lng, heading: body.heading ?? null, speedKmh: body.speedKmh ?? null, accuracyM: body.accuracyM ?? null, updatedAt },
  });
  const [trip, pickup] = await Promise.all([
    prisma.trip.findFirst({ where: { taxiId, status: { in: ["LOADING", "DEPARTED"] } }, select: { id: true }, orderBy: { createdAt: "desc" } }),
    prisma.pickupRequest.findFirst({ where: { acceptedTaxiId: taxiId, status: { in: ["ACCEPTED", "ARRIVED"] } }, select: { id: true } }),
  ]);
  if (trip || pickup) {
    publishTaxiLocation({
      taxiId,
      tripId: trip?.id ?? null,
      pickupId: pickup?.id ?? null,
      lat: body.lat,
      lng: body.lng,
      heading: body.heading ?? null,
      speedKmh: body.speedKmh ?? null,
      updatedAt: updatedAt.toISOString(),
    });
  }
  return updatedAt;
}

export async function getNearbyTaxis(passengerId: string, query: z.output<typeof NearbyTaxisQuery>): Promise<NearbyTaxisResponse> {
  await requireConsent(prisma, passengerId);
  const box = boundingBox(query.lat, query.lng, query.radiusKm);
  const taxis = await prisma.taxi.findMany({
    where: {
      status: { in: ["AT_STATION", "EN_ROUTE"] },
      location: { is: { lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } } },
    },
    include: {
      location: true,
      driver: true,
      trips: { where: { status: { in: ["LOADING", "DEPARTED"] } }, include: { entries: { select: { status: true } } }, take: 1 },
    },
  });
  const result: NearbyTaxisResponse["taxis"] = [];
  for (const taxi of taxis) {
    if (!taxi.location) continue;
    const used = taxi.trips[0]?.entries.filter((entry) => entry.status === "CALLED" || entry.status === "BOARDED").length ?? 0;
    const freeSeats = taxi.capacity - used;
    if (freeSeats <= 0) continue;
    // Everything below uses the rounded position, so no exact coordinate or exact distance leaves the API.
    const lat = roundCoord(taxi.location.lat, NEARBY_ROUND_METERS);
    const lng = roundCoord(taxi.location.lng, NEARBY_ROUND_METERS);
    const distanceKm = haversineKm(query.lat, query.lng, lat, lng);
    if (distanceKm > query.radiusKm) continue;
    result.push({
      id: taxi.id,
      plate: taxi.plate,
      driverFirstName: firstName(taxi.driver.name),
      status: taxi.status,
      freeSeats,
      lat,
      lng,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: Math.round(etaMinutes(distanceKm, taxi.location.speedKmh)),
      stale: isStale(taxi.location.updatedAt),
    });
  }
  result.sort((a, b) => a.distanceKm - b.distanceKm || a.plate.localeCompare(b.plate));
  return { taxis: result, roundedToMeters: NEARBY_ROUND_METERS };
}

function polylineOf(route: { waypoints: Prisma.JsonValue | null; origin: { name: string }; destination: { name: string } }): [number, number][] {
  if (Array.isArray(route.waypoints)) {
    const points = route.waypoints.filter((point): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every((n) => typeof n === "number"));
    if (points.length >= 2) return points;
  }
  const a = STATION_COORDS[route.origin.name];
  const b = STATION_COORDS[route.destination.name];
  return a && b ? [[a.lat, a.lng], [b.lat, b.lng]] : [];
}

export async function getTripTrack(actor: { userId: string; role: string }, tripId: string): Promise<TripTrackResponse> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      taxi: { include: { location: true } },
      route: { include: { origin: true, destination: true } },
      entries: { select: { passengerId: true, status: true } },
    },
  });
  if (!trip) throw notFound("trip_not_found", "This trip does not exist");

  if (actor.role === "PASSENGER") {
    if (!trip.entries.some((entry) => entry.passengerId === actor.userId && (entry.status === "CALLED" || entry.status === "BOARDED"))) {
      throw forbidden("You are not on this trip");
    }
    await requireConsent(prisma, actor.userId);
  } else if (actor.role === "DRIVER") {
    if (trip.taxi.driverId !== actor.userId) throw new AppError(403, "not_your_trip", "This trip belongs to another taxi");
    await requireConsent(prisma, actor.userId);
  } else if (actor.role === "STATION_REP") {
    const rep = await prisma.user.findUnique({ where: { id: actor.userId }, select: { stationId: true } });
    if (rep?.stationId !== trip.route.originId && rep?.stationId !== trip.route.destinationId) {
      throw new AppError(403, "not_your_station", "This trip is not at your station");
    }
  }

  const station = trip.route.origin;
  const place = STATION_COORDS[station.name];
  const location = trip.taxi.location;
  let eta: number | null = null;
  if (location && place) {
    const distance = haversineKm(location.lat, location.lng, place.lat, place.lng);
    eta = distance < 0.05 ? 0 : etaMinutes(distance, location.speedKmh);
  }
  return {
    tripId: trip.id,
    taxiPlate: trip.taxi.plate,
    taxi: location ? toPosition(location) : null,
    etaMinutes: eta,
    boardingStation: { ...toStation(station), lat: station.lat, lng: station.lng },
    polyline: polylineOf(trip.route),
  };
}

export async function getFleet(): Promise<FleetResponse> {
  const [taxis, stations, pickups] = await Promise.all([
    prisma.taxi.findMany({ include: { location: true, driver: true }, orderBy: { plate: "asc" } }),
    prisma.station.findMany({ orderBy: { name: "asc" } }),
    prisma.pickupRequest.findMany({ where: { status: "OPEN", lat: { not: null }, lng: { not: null } } }),
  ]);
  return {
    taxis: taxis.map((taxi) => ({
      id: taxi.id,
      plate: taxi.plate,
      status: taxi.status,
      driverFirstName: firstName(taxi.driver.name),
      position: taxi.location ? toPosition(taxi.location) : null,
    })),
    stations: stations.map((station) => ({ ...toStation(station), lat: station.lat, lng: station.lng })),
    openPickups: pickups.map((pickup) => ({
      id: pickup.id,
      approxLat: roundCoord(pickup.lat ?? 0, 300),
      approxLng: roundCoord(pickup.lng ?? 0, 300),
      seats: pickup.seats,
    })),
  };
}
