import type { z } from "zod";
import {
  CancelPickupRequest,
  CreatePickupRequest,
  type CreatePickupResponse,
  type DriverMyPickupResponse,
  type DriverPickupResponse,
  type DriverPickupView,
  type MyPickupResponse,
  type NearbyPickupsResponse,
  type PickupPassengerView,
} from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { scoreCandidate } from "../ai/matching.js";
import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { AppError, conflict, forbidden, notFound } from "../lib/errors.js";
import { boundingBox, etaMinutes, haversineKm, roundCoord } from "../lib/geo.js";
import { pickupText } from "../lib/controllerMessages.js";
import { firstName } from "../lib/serialize.js";
import { publishPickupNew, publishPickupUpdate } from "../realtime/emitter.js";
import { closePickupRoom, joinPickupRoom } from "../realtime/membership.js";
import { notifyTx, publishNotes } from "./notify.js";
import { isStale, requireConsent, toPosition } from "./location.js";

type Tx = Prisma.TransactionClient;

export const PICKUP_ROUND_METERS = 300;
const FIRST_WAVE = 3;
const WIDEN_AFTER_MS = 20_000;
const LIVE = ["OPEN", "ACCEPTED", "ARRIVED"] as const;
const ENDED_COORD_RESET = { lat: null, lng: null, placeNote: null } as const;

const alreadyOpen = () => conflict("already_open", "You already have a pickup request. Cancel it before making another.");

// ---------------------------------------------------------------------------
// Candidates and scoring (rules, see ai/matching.ts)
// ---------------------------------------------------------------------------

type Candidate = {
  taxiId: string;
  driverId: string;
  plate: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  freeSeats: number;
  averageRating: number | null;
  idleMinutes: number;
};

async function loadCandidates(db: Tx, around: { lat: number; lng: number }, radiusKm: number, seatsNeeded: number): Promise<Candidate[]> {
  const box = boundingBox(around.lat, around.lng, radiusKm);
  const taxis = await db.taxi.findMany({
    where: {
      status: { in: ["AT_STATION", "EN_ROUTE"] },
      driver: { locationConsentAt: { not: null } },
      location: { is: { lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } } },
      pickups: { none: { status: { in: ["ACCEPTED", "ARRIVED"] } } },
    },
    include: {
      location: true,
      trips: { where: { status: { in: ["LOADING", "DEPARTED"] } }, include: { entries: { select: { status: true } } }, take: 1 },
    },
  });
  const out: Candidate[] = [];
  for (const taxi of taxis) {
    const location = taxi.location;
    if (!location || isStale(location.updatedAt)) continue;
    const used = taxi.trips[0]?.entries.filter((entry) => entry.status === "CALLED" || entry.status === "BOARDED").length ?? 0;
    const freeSeats = taxi.capacity - used;
    if (freeSeats < seatsNeeded) continue;
    if (haversineKm(around.lat, around.lng, location.lat, location.lng) > radiusKm) continue;
    const [rating, lastTrip] = await Promise.all([
      db.rating.aggregate({ where: { trip: { taxiId: taxi.id } }, _avg: { stars: true } }),
      db.trip.aggregate({ where: { taxiId: taxi.id, status: "COMPLETED" }, _max: { arrivedAt: true } }),
    ]);
    const lastArrived = lastTrip._max.arrivedAt;
    out.push({
      taxiId: taxi.id,
      driverId: taxi.driverId,
      plate: taxi.plate,
      lat: location.lat,
      lng: location.lng,
      speedKmh: location.speedKmh,
      freeSeats,
      averageRating: rating._avg.stars,
      idleMinutes: lastArrived ? Math.min(60, (Date.now() - lastArrived.getTime()) / 60_000) : 30,
    });
  }
  return out;
}

function rank(candidates: Candidate[], pickup: { lat: number; lng: number; seats: number }, radiusKm: number) {
  return candidates
    .map((candidate) => {
      const distanceKm = haversineKm(candidate.lat, candidate.lng, pickup.lat, pickup.lng);
      return {
        candidate,
        distanceKm,
        ...scoreCandidate({
          distanceKm,
          radiusKm,
          freeSeats: candidate.freeSeats,
          requestedSeats: pickup.seats,
          averageRating: candidate.averageRating,
          idleMinutes: candidate.idleMinutes,
        }),
      };
    })
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.candidate.plate.localeCompare(b.candidate.plate));
}

// ---------------------------------------------------------------------------
// Passenger side
// ---------------------------------------------------------------------------

const pickupInclude = {
  passenger: true,
  acceptedTaxi: { include: { driver: true, location: true } },
} satisfies Prisma.PickupRequestInclude;
type PickupRow = Prisma.PickupRequestGetPayload<{ include: typeof pickupInclude }>;

function toPassengerView(row: PickupRow): PickupPassengerView {
  const taxi = row.acceptedTaxi;
  const live = row.status === "OPEN" || row.status === "ACCEPTED" || row.status === "ARRIVED";
  let eta: number | null = null;
  if (taxi?.location && row.lat !== null && row.lng !== null) {
    eta = etaMinutes(haversineKm(taxi.location.lat, taxi.location.lng, row.lat, row.lng), taxi.location.speedKmh);
  }
  return {
    id: row.id,
    status: row.status,
    seats: row.seats,
    placeNote: live ? row.placeNote : null,
    lat: live ? row.lat : null,
    lng: live ? row.lng : null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    driversNotified: row.notifiedDriverIds.length,
    taxi:
      taxi && (row.status === "ACCEPTED" || row.status === "ARRIVED")
        ? {
            plate: taxi.plate,
            driverFirstName: firstName(taxi.driver.name),
            position: taxi.location ? toPosition(taxi.location) : null,
            etaMinutes: eta,
          }
        : null,
  };
}

export async function createPickup(passengerId: string, body: z.output<typeof CreatePickupRequest>): Promise<CreatePickupResponse> {
  let created: PickupRow;
  try {
    created = await prisma.$transaction(async (tx) => {
      await requireConsent(tx, passengerId);
      const existing = await tx.pickupRequest.findFirst({ where: { passengerId, status: { in: [...LIVE] } }, select: { id: true } });
      if (existing) throw alreadyOpen();
      return tx.pickupRequest.create({
        data: {
          passengerId,
          lat: body.lat,
          lng: body.lng,
          placeNote: body.placeNote ?? null,
          seats: body.seats,
          expiresAt: new Date(Date.now() + env.PICKUP_EXPIRY_MINUTES * 60_000),
        },
        include: pickupInclude,
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw alreadyOpen();
    throw err;
  }
  joinPickupRoom(passengerId, created.id);
  const updated = await fanOutFirstWave(created.id);
  if (env.NODE_ENV !== "test") {
    setTimeout(() => void widenPickup(created.id).catch((err: unknown) => console.error("widenPickup failed", err)), WIDEN_AFTER_MS).unref();
  }
  return { pickup: toPassengerView(updated ?? created) };
}

/** First the top 3 drivers by match score hear about it. Everyone in range hears after 20 seconds (widenPickup). */
export async function fanOutFirstWave(pickupId: string): Promise<PickupRow | null> {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId }, include: pickupInclude });
  if (!pickup || pickup.status !== "OPEN" || pickup.lat === null || pickup.lng === null) return pickup;
  const here = { lat: pickup.lat, lng: pickup.lng, seats: pickup.seats };
  const ranked = rank(await loadCandidates(prisma, here, env.PICKUP_RADIUS_KM, pickup.seats), here, env.PICKUP_RADIUS_KM).slice(0, FIRST_WAVE);
  for (const item of ranked) sendPickupNew(item.candidate.driverId, pickup, false);
  return prisma.pickupRequest.update({
    where: { id: pickupId },
    data: { notifiedDriverIds: ranked.map((item) => item.candidate.driverId) },
    include: pickupInclude,
  });
}

function sendPickupNew(driverId: string, pickup: { id: string; lat: number | null; lng: number | null; seats: number; expiresAt: Date }, widened: boolean): void {
  if (pickup.lat === null || pickup.lng === null) return;
  publishPickupNew(driverId, {
    pickupId: pickup.id,
    approxLat: roundCoord(pickup.lat, PICKUP_ROUND_METERS),
    approxLng: roundCoord(pickup.lng, PICKUP_ROUND_METERS),
    seats: pickup.seats,
    expiresAt: pickup.expiresAt.toISOString(),
    widened,
  });
}

/** After 20 seconds without an accept the request goes to every eligible driver in range. */
export async function widenPickup(pickupId: string): Promise<number> {
  const pickup = await prisma.pickupRequest.findUnique({ where: { id: pickupId } });
  if (!pickup || pickup.status !== "OPEN" || pickup.widenedAt || pickup.lat === null || pickup.lng === null) return 0;
  const here = { lat: pickup.lat, lng: pickup.lng, seats: pickup.seats };
  const rest = (await loadCandidates(prisma, here, env.PICKUP_RADIUS_KM, pickup.seats)).filter(
    (candidate) => !pickup.notifiedDriverIds.includes(candidate.driverId),
  );
  for (const candidate of rest) sendPickupNew(candidate.driverId, pickup, true);
  await prisma.pickupRequest.update({
    where: { id: pickupId },
    data: { widenedAt: new Date(), notifiedDriverIds: [...pickup.notifiedDriverIds, ...rest.map((candidate) => candidate.driverId)] },
  });
  return rest.length;
}

export async function getMyPickup(passengerId: string): Promise<MyPickupResponse> {
  const live = await prisma.pickupRequest.findFirst({ where: { passengerId, status: { in: [...LIVE] } }, include: pickupInclude });
  if (live) return { pickup: toPassengerView(live) };
  const recent = await prisma.pickupRequest.findFirst({
    where: { passengerId, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
    orderBy: { createdAt: "desc" },
    include: pickupInclude,
  });
  return { pickup: recent ? toPassengerView(recent) : null };
}

async function lockPickup(tx: Tx, id: string): Promise<PickupRow> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PickupRequest" WHERE id = ${id} FOR UPDATE`;
  if (!locked[0]) throw notFound("pickup_not_found", "This pickup request does not exist");
  const row = await tx.pickupRequest.findUnique({ where: { id }, include: pickupInclude });
  if (!row) throw notFound("pickup_not_found", "This pickup request does not exist");
  return row;
}

type EndKind = "cancelled" | "completed" | "expired";

/** Moves a pickup to an ended state, clears every coordinate and note, and tells both sides. */
async function endPickup(tx: Tx, row: PickupRow, status: "CANCELLED" | "COMPLETED" | "EXPIRED", kind: EndKind, cancelReason?: string) {
  await tx.pickupRequest.update({ where: { id: row.id }, data: { status, ...ENDED_COORD_RESET, cancelReason: cancelReason ?? null } });
  const notes = [await notifyTx(tx, { userId: row.passengerId, type: "PICKUP_UPDATE", ...pickupText(row.passenger.language, kind, row.acceptedTaxi?.plate) })];
  const driverId = row.acceptedTaxi?.driverId ?? null;
  if (driverId && kind === "cancelled") {
    notes.push(await notifyTx(tx, { userId: driverId, type: "PICKUP_UPDATE", ...pickupText("en", "cancelled") }));
  }
  return {
    notes,
    userIds: [row.passengerId, ...(driverId ? [driverId] : [])],
    payload: {
      pickupId: row.id,
      status,
      taxiPlate: row.acceptedTaxi?.plate ?? null,
      driverFirstName: row.acceptedTaxi ? firstName(row.acceptedTaxi.driver.name) : null,
    },
  };
}

export async function cancelPickupAsPassenger(passengerId: string, id: string, body: z.output<typeof CancelPickupRequest>): Promise<MyPickupResponse> {
  const ended = await prisma.$transaction(async (tx) => {
    const row = await lockPickup(tx, id);
    if (row.passengerId !== passengerId) throw forbidden("This is not your pickup request");
    if (!LIVE.includes(row.status as (typeof LIVE)[number])) throw conflict("invalid_pickup_status", "This pickup request has already ended");
    return endPickup(tx, row, "CANCELLED", "cancelled", body.reason);
  });
  publishNotes(ended.notes);
  publishPickupUpdate(ended.userIds, ended.payload);
  closePickupRoom(id);
  return getMyPickup(passengerId);
}

/** Expires every OPEN request that ran out of time. Called by the 30 second sweeper and by tests. */
export async function expireOldPickups(): Promise<number> {
  const due = await prisma.pickupRequest.findMany({ where: { status: "OPEN", expiresAt: { lte: new Date() } }, select: { id: true } });
  let count = 0;
  for (const { id } of due) {
    const ended = await prisma.$transaction(async (tx) => {
      const row = await lockPickup(tx, id);
      if (row.status !== "OPEN") return null;
      return endPickup(tx, row, "EXPIRED", "expired");
    });
    if (!ended) continue;
    count += 1;
    publishNotes(ended.notes);
    publishPickupUpdate(ended.userIds, ended.payload);
    closePickupRoom(id);
  }
  return count;
}

export function startPickupSweeper(): NodeJS.Timeout {
  const timer = setInterval(() => {
    expireOldPickups().catch((err: unknown) => console.error("pickup sweep failed", err));
  }, 30_000);
  timer.unref();
  return timer;
}

// ---------------------------------------------------------------------------
// Driver side
// ---------------------------------------------------------------------------

async function requireDriverTaxi(tx: Tx, driverId: string) {
  const taxi = await tx.taxi.findUnique({
    where: { driverId },
    include: { location: true, trips: { where: { status: { in: ["LOADING", "DEPARTED"] } }, include: { entries: { select: { status: true } } }, take: 1 } },
  });
  if (!taxi) throw notFound("taxi_not_found", "This driver has no taxi");
  const used = taxi.trips[0]?.entries.filter((entry) => entry.status === "CALLED" || entry.status === "BOARDED").length ?? 0;
  return { taxi, freeSeats: taxi.capacity - used };
}

export async function listNearbyPickups(driverId: string): Promise<NearbyPickupsResponse> {
  await requireConsent(prisma, driverId);
  const { taxi, freeSeats } = await requireDriverTaxi(prisma, driverId);
  const location = taxi.location;
  if (!location || isStale(location.updatedAt)) {
    throw new AppError(409, "no_location", "Share your location first so we can find requests near you");
  }
  const busy = await prisma.pickupRequest.count({ where: { acceptedTaxiId: taxi.id, status: { in: ["ACCEPTED", "ARRIVED"] } } });
  if (busy > 0) return { pickups: [], roundedToMeters: PICKUP_ROUND_METERS };

  const box = boundingBox(location.lat, location.lng, env.PICKUP_RADIUS_KM);
  const open = await prisma.pickupRequest.findMany({
    where: {
      status: "OPEN",
      expiresAt: { gt: new Date() },
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
    },
  });
  const [rating, lastTrip] = await Promise.all([
    prisma.rating.aggregate({ where: { trip: { taxiId: taxi.id } }, _avg: { stars: true } }),
    prisma.trip.aggregate({ where: { taxiId: taxi.id, status: "COMPLETED" }, _max: { arrivedAt: true } }),
  ]);
  const lastArrived = lastTrip._max.arrivedAt;
  const idleMinutes = lastArrived ? Math.min(60, (Date.now() - lastArrived.getTime()) / 60_000) : 30;

  const pickups: NearbyPickupsResponse["pickups"] = [];
  for (const pickup of open) {
    if (pickup.lat === null || pickup.lng === null || freeSeats < pickup.seats) continue;
    const distanceKm = haversineKm(location.lat, location.lng, pickup.lat, pickup.lng);
    if (distanceKm > env.PICKUP_RADIUS_KM) continue;
    const match = scoreCandidate({
      distanceKm,
      radiusKm: env.PICKUP_RADIUS_KM,
      freeSeats,
      requestedSeats: pickup.seats,
      averageRating: rating._avg.stars,
      idleMinutes,
    });
    pickups.push({
      id: pickup.id,
      approxLat: roundCoord(pickup.lat, PICKUP_ROUND_METERS),
      approxLng: roundCoord(pickup.lng, PICKUP_ROUND_METERS),
      seats: pickup.seats,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: Math.round(etaMinutes(distanceKm, location.speedKmh)),
      expiresAt: pickup.expiresAt.toISOString(),
      score: match.score,
      parts: match.parts,
      method: "rules",
      why: match.why,
    });
  }
  pickups.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
  return { pickups, roundedToMeters: PICKUP_ROUND_METERS };
}

/** The exact view. Only built for the accepting driver, and only while ACCEPTED or ARRIVED. */
function toDriverView(row: PickupRow): DriverPickupView {
  const live = row.status === "ACCEPTED" || row.status === "ARRIVED";
  return {
    id: row.id,
    status: row.status,
    seats: row.seats,
    placeNote: live ? row.placeNote : null,
    passengerFirstName: firstName(row.passenger.name),
    lat: live ? row.lat : null,
    lng: live ? row.lng : null,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
  };
}

export async function acceptPickup(driverId: string, id: string): Promise<DriverPickupResponse> {
  const accepted = await prisma.$transaction(async (tx) => {
    await requireConsent(tx, driverId);
    const { taxi, freeSeats } = await requireDriverTaxi(tx, driverId);
    const row = await lockPickup(tx, id);
    if (row.status !== "OPEN") {
      if (row.status === "ACCEPTED" || row.status === "ARRIVED" || row.status === "COMPLETED") {
        throw conflict("already_taken", "Another driver already took this request");
      }
      throw conflict("invalid_pickup_status", "This pickup request is no longer open");
    }
    if (row.expiresAt.getTime() <= Date.now()) throw conflict("invalid_pickup_status", "This pickup request ran out of time");
    if (freeSeats < row.seats) throw conflict("not_enough_seats", `This request needs ${row.seats} seats and you have ${freeSeats} free`);
    const serving = await tx.pickupRequest.findFirst({ where: { acceptedTaxiId: taxi.id, status: { in: ["ACCEPTED", "ARRIVED"] } }, select: { id: true } });
    if (serving) throw conflict("invalid_pickup_status", "Finish your current pickup before taking another");

    const updated = await tx.pickupRequest.update({
      where: { id },
      data: { status: "ACCEPTED", acceptedTaxiId: taxi.id, acceptedAt: new Date() },
      include: pickupInclude,
    });
    const note = await notifyTx(tx, {
      userId: row.passengerId,
      type: "PICKUP_UPDATE",
      ...pickupText(row.passenger.language, "accepted", taxi.plate),
    });
    return { updated, note, passengerId: row.passengerId, plate: taxi.plate };
  });
  publishNotes([accepted.note]);
  joinPickupRoom(driverId, id);
  joinPickupRoom(accepted.passengerId, id);
  publishPickupUpdate([accepted.passengerId, driverId], {
    pickupId: id,
    status: "ACCEPTED",
    taxiPlate: accepted.plate,
    driverFirstName: accepted.updated.acceptedTaxi ? firstName(accepted.updated.acceptedTaxi.driver.name) : null,
  });
  return { pickup: toDriverView(accepted.updated) };
}

async function ownAcceptedPickup(tx: Tx, driverId: string, id: string): Promise<PickupRow> {
  const row = await lockPickup(tx, id);
  if (row.acceptedTaxi?.driverId !== driverId) throw forbidden("This is not the pickup you accepted");
  return row;
}

export async function markPickupArrived(driverId: string, id: string): Promise<DriverPickupResponse> {
  const result = await prisma.$transaction(async (tx) => {
    const row = await ownAcceptedPickup(tx, driverId, id);
    if (row.status !== "ACCEPTED") throw conflict("invalid_pickup_status", "Only an accepted pickup can be marked as arrived");
    const updated = await tx.pickupRequest.update({ where: { id }, data: { status: "ARRIVED" }, include: pickupInclude });
    const note = await notifyTx(tx, { userId: row.passengerId, type: "PICKUP_UPDATE", ...pickupText(row.passenger.language, "arrived", row.acceptedTaxi?.plate) });
    return { updated, note };
  });
  publishNotes([result.note]);
  publishPickupUpdate([result.updated.passengerId, driverId], {
    pickupId: id,
    status: "ARRIVED",
    taxiPlate: result.updated.acceptedTaxi?.plate ?? null,
    driverFirstName: result.updated.acceptedTaxi ? firstName(result.updated.acceptedTaxi.driver.name) : null,
  });
  return { pickup: toDriverView(result.updated) };
}

export async function completePickup(driverId: string, id: string): Promise<DriverPickupResponse> {
  const ended = await prisma.$transaction(async (tx) => {
    const row = await ownAcceptedPickup(tx, driverId, id);
    if (row.status !== "ACCEPTED" && row.status !== "ARRIVED") throw conflict("invalid_pickup_status", "This pickup is not in progress");
    const result = await endPickup(tx, row, "COMPLETED", "completed");
    const after = await tx.pickupRequest.findUniqueOrThrow({ where: { id }, include: pickupInclude });
    return { ...result, after };
  });
  publishNotes(ended.notes);
  publishPickupUpdate(ended.userIds, ended.payload);
  closePickupRoom(id);
  return { pickup: toDriverView(ended.after) };
}

/** A driver may cancel before arriving, with a reason. */
export async function cancelPickupAsDriver(driverId: string, id: string, body: { reason: string }): Promise<DriverMyPickupResponse> {
  const ended = await prisma.$transaction(async (tx) => {
    const row = await ownAcceptedPickup(tx, driverId, id);
    if (row.status !== "ACCEPTED") throw conflict("invalid_pickup_status", "You can only cancel before you arrive");
    return endPickup(tx, row, "CANCELLED", "cancelled", body.reason);
  });
  publishNotes(ended.notes);
  publishPickupUpdate(ended.userIds, ended.payload);
  closePickupRoom(id);
  return { pickup: null };
}

export async function getDriverMyPickup(driverId: string): Promise<DriverMyPickupResponse> {
  const row = await prisma.pickupRequest.findFirst({
    where: { acceptedTaxi: { driverId }, status: { in: ["ACCEPTED", "ARRIVED"] } },
    include: pickupInclude,
  });
  return { pickup: row ? toDriverView(row) : null };
}
