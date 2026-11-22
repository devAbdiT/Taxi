import type {
  ArriveTripResponse,
  CallPassengersRequest,
  CallPassengersResponse,
  DriverArriveRequest,
  DriverArriveResponse,
  DriverDemandResponse,
  DriverMeResponse,
  EntryActionResponse,
  Role,
  StartTripRequest,
  TripResponse,
} from "@taxiflow/shared";
import { Prisma } from "../generated/prisma/client.js";
import { AppError, conflict, notFound } from "../lib/errors.js";
import { arrivedText, calledText, noShowText, returnedText } from "../lib/messages.js";
import { prisma } from "../lib/db.js";
import { seatsUsedOf, toDriverTaxi, toDriverTrip, toTripEntry } from "../lib/serialize.js";
import { createNotification, publishDemand, publishQueueChange, publishTripUpdate } from "../realtime/emitter.js";
import { closeTripRoom, joinTripRoom } from "../realtime/membership.js";
import { listRoutesWithDemand } from "./demand.js";
import { claimTurnToStart } from "./driverQueue.js";

type Tx = Prisma.TransactionClient;

const taxiInclude = { currentStation: true } satisfies Prisma.TaxiInclude;

const tripInclude = {
  taxi: { include: { currentStation: true } },
  route: { include: { origin: true, destination: true } },
  entries: { include: { passenger: true }, orderBy: [{ calledAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.TripInclude;

const notYourTrip = () => new AppError(403, "not_your_trip", "This trip belongs to another taxi");
const notYourStation = () => new AppError(403, "not_your_station", "This queue is not at your station");

async function requireTaxi(tx: Tx, driverId: string) {
  const taxi = await tx.taxi.findUnique({ where: { driverId }, include: taxiInclude });
  if (!taxi) throw notFound("taxi_not_found", "This driver has no taxi");
  return taxi;
}

async function loadTrip(tx: Tx, tripId: string) {
  const trip = await tx.trip.findUnique({ where: { id: tripId }, include: tripInclude });
  if (!trip) throw notFound("trip_not_found", "This trip does not exist");
  return trip;
}

async function requireOwnTrip(tx: Tx, driverId: string, tripId: string) {
  const trip = await loadTrip(tx, tripId);
  if (trip.taxi.driverId !== driverId) throw notYourTrip();
  return trip;
}

async function activeTrip(tx: Tx, taxiId: string) {
  return tx.trip.findFirst({
    where: { taxiId, status: { in: ["LOADING", "DEPARTED"] } },
    include: tripInclude,
    orderBy: { createdAt: "desc" },
  });
}

type PassengerNote = { id: string; language: string };
type NoteType = "QUEUE_CALLED" | "QUEUE_NO_SHOW" | "QUEUE_RETURNED" | "TRIP_COMPLETED";
type PendingNote = { userId: string; type: NoteType; title: string; body: string };

function pendingNotes(passengers: PassengerNote[], type: NoteType, textFor: (language: string) => { title: string; body: string }): PendingNote[] {
  return passengers.map((passenger) => ({ userId: passenger.id, type, ...textFor(passenger.language) }));
}

async function deliver(notes: PendingNote[]): Promise<void> {
  for (const note of notes) {
    await createNotification(note);
  }
}

async function routesLeaving(stationIds: Array<string | null>): Promise<string[]> {
  const ids = stationIds.filter((id): id is string => id !== null);
  if (ids.length === 0) return [];
  const routes = await prisma.route.findMany({ where: { originId: { in: ids } }, select: { id: true } });
  return routes.map((route) => route.id);
}

export async function getDriverMe(driverId: string): Promise<DriverMeResponse> {
  return prisma.$transaction(async (tx) => {
    const taxi = await requireTaxi(tx, driverId);
    const trip = await activeTrip(tx, taxi.id);
    const seatsUsed = trip ? seatsUsedOf(trip.entries) : 0;
    return {
      taxi: toDriverTaxi(taxi),
      activeTrip: trip ? toDriverTrip(trip) : null,
      seatsUsed,
      seatsLeft: taxi.capacity - seatsUsed,
    };
  });
}

/** OFFLINE or EN_ROUTE becomes AT_STATION. Does not finish an open trip; use the trip arrive endpoint for that. */
export async function arriveAtStation(driverId: string, body: DriverArriveRequest): Promise<DriverArriveResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const taxi = await requireTaxi(tx, driverId);
    if (taxi.status !== "OFFLINE" && taxi.status !== "EN_ROUTE") {
      throw conflict("invalid_taxi_status", "You can only arrive when offline or en route");
    }
    const station = await tx.station.findUnique({ where: { id: body.stationId } });
    if (!station) throw notFound("station_not_found", "This station does not exist");

    const updated = await tx.taxi.update({
      where: { id: taxi.id },
      data: { status: "AT_STATION", currentStationId: station.id },
      include: taxiInclude,
    });
    return { response: { taxi: toDriverTaxi(updated) }, oldStationId: taxi.currentStationId, newStationId: station.id };
  });
  await publishDemand(await routesLeaving([committed.oldStationId, committed.newStationId]));
  return committed.response;
}

export async function getDemand(driverId: string): Promise<DriverDemandResponse> {
  const [taxi, routes] = await Promise.all([
    prisma.taxi.findUnique({
      where: { driverId },
      include: {
        trips: {
          where: { status: { in: ["LOADING", "DEPARTED"] } },
          include: { route: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    listRoutesWithDemand(),
  ]);
  if (!taxi) throw notFound("taxi_not_found", "This driver has no taxi");

  const sorted = routes
    .map((route) => ({
      ...route,
      highlighted: taxi.status === "AT_STATION" && taxi.currentStationId === route.origin.id,
    }))
    .sort((a, b) => b.waiting - a.waiting || b.priorityWaiting - a.priorityWaiting || a.origin.name.localeCompare(b.origin.name));

  const current = taxi.trips[0];
  const reverse = current
    ? sorted.find((route) => route.origin.id === current.route.destinationId && route.destination.id === current.route.originId)
    : undefined;

  return {
    routes: sorted,
    returnSuggestion: reverse
      ? { route: { id: reverse.id, origin: reverse.origin, destination: reverse.destination }, waiting: reverse.waiting, priorityWaiting: reverse.priorityWaiting }
      : null,
  };
}

export async function startTrip(driverId: string, body: StartTripRequest): Promise<TripResponse> {
  const response = await prisma.$transaction(async (tx) => {
    const taxi = await requireTaxi(tx, driverId);
    if (taxi.status !== "AT_STATION" || !taxi.currentStationId) {
      throw conflict("invalid_taxi_status", "Arrive at a station before loading");
    }
    const route = await tx.route.findUnique({ where: { id: body.routeId } });
    if (!route) throw notFound("route_not_found", "This route does not exist");
    if (route.originId !== taxi.currentStationId) {
      throw conflict("route_not_from_current_station", "This route does not leave your current station");
    }
    if (await activeTrip(tx, taxi.id)) {
      throw conflict("active_trip_exists", "This taxi already has an active trip");
    }

    await claimTurnToStart(tx, taxi);
    const created = await tx.trip.create({ data: { taxiId: taxi.id, routeId: route.id, status: "LOADING" } });
    await tx.taxi.update({ where: { id: taxi.id }, data: { status: "LOADING" } });
    return { trip: toDriverTrip(await loadTrip(tx, created.id)) };
  });
  joinTripRoom(driverId, response.trip.id);
  await publishDemand([body.routeId]);
  await publishTripUpdate(response.trip.id);
  return response;
}

export async function getTrip(driverId: string, tripId: string): Promise<TripResponse> {
  return prisma.$transaction(async (tx) => ({ trip: toDriverTrip(await requireOwnTrip(tx, driverId, tripId)) }));
}

/**
 * Calls the next N waiting passengers in position order. SKIP LOCKED so two taxis
 * calling at the same moment cannot take the same passenger.
 */
export async function callPassengers(driverId: string, tripId: string, body: CallPassengersRequest): Promise<CallPassengersResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const trip = await requireOwnTrip(tx, driverId, tripId);
    if (trip.status !== "LOADING") throw conflict("trip_not_loading", "Passengers can only be called while loading");

    const seatsLeft = trip.taxi.capacity - seatsUsedOf(trip.entries);
    if (seatsLeft <= 0) throw conflict("not_enough_seats", "This taxi is full");
    const count = body.count ?? seatsLeft;
    if (count > seatsLeft) throw conflict("not_enough_seats", `Only ${seatsLeft} seats left`);

    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "QueueEntry"
      WHERE "routeId" = ${trip.routeId} AND status = 'WAITING'
      ORDER BY "isPriority" DESC, "sortKey" ASC, id ASC
      LIMIT ${count}
      FOR UPDATE SKIP LOCKED`;

    let notes: PendingNote[] = [];
    if (locked.length > 0) {
      const calledAt = Date.now();
      const rows = Prisma.join(locked.map((row, index) => Prisma.sql`(${row.id}, ${new Date(calledAt + index)})`));
      await tx.$executeRaw`
        UPDATE "QueueEntry" AS entry
        SET status = 'CALLED', "calledAt" = data.called_at::timestamp, "tripId" = ${trip.id}
        FROM (VALUES ${rows}) AS data(id, called_at)
        WHERE entry.id = data.id`;
      const passengers = await tx.user.findMany({
        where: { queueEntries: { some: { id: { in: locked.map((row) => row.id) } } } },
        select: { id: true, language: true },
      });
      notes = pendingNotes(passengers, "QUEUE_CALLED", (language) =>
        calledText(language, trip.taxi.plate, trip.route.origin.name, trip.route.origin.nameAm),
      );
    }

    const updated = await loadTrip(tx, trip.id);
    const calledIds = new Set(locked.map((row) => row.id));
    return {
      response: {
        trip: toDriverTrip(updated),
        called: updated.entries.filter((entry) => calledIds.has(entry.id)).map(toTripEntry),
      },
      notes,
      routeId: trip.routeId,
    };
  });
  await deliver(committed.notes);
  // Called passengers can now follow the taxi (server-controlled room).
  for (const note of committed.notes) joinTripRoom(note.userId, tripId);
  await publishQueueChange({ routeIds: [committed.routeId] });
  await publishTripUpdate(tripId);
  return committed.response;
}

export async function setEntryOutcome(actor: { userId: string; role: Role }, entryId: string, outcome: "BOARDED" | "NO_SHOW"): Promise<EntryActionResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "QueueEntry" WHERE id = ${entryId} FOR UPDATE`;
    if (!locked[0]) throw notFound("entry_not_found", "This queue entry does not exist");

    const entry = await tx.queueEntry.findUnique({
      where: { id: entryId },
      include: { passenger: true, route: true, trip: { include: { taxi: true } } },
    });
    if (!entry?.trip) throw notFound("entry_not_found", "This queue entry does not exist");

    if (actor.role === "DRIVER") {
      if (entry.trip.taxi.driverId !== actor.userId) throw notYourTrip();
    } else if (actor.role === "STATION_REP") {
      const rep = await tx.user.findUnique({ where: { id: actor.userId }, select: { stationId: true } });
      if (!rep?.stationId || entry.route.originId !== rep.stationId) throw notYourStation();
    } else {
      throw new AppError(403, "forbidden", "You are not allowed to do this");
    }

    if (entry.trip.status !== "LOADING") throw conflict("trip_not_loading", "Passengers can only board while the taxi is loading");
    if (entry.status !== "CALLED") throw conflict("invalid_entry_status", "Only a called passenger can be boarded or marked no-show");

    const updated = await tx.queueEntry.update({
      where: { id: entry.id },
      data: outcome === "BOARDED" ? { status: "BOARDED", boardedAt: new Date() } : { status: "NO_SHOW" },
      include: { passenger: true },
    });
    const notes = outcome === "NO_SHOW" ? pendingNotes([updated.passenger], "QUEUE_NO_SHOW", noShowText) : [];
    return {
      response: { entry: toTripEntry(updated), trip: toDriverTrip(await loadTrip(tx, entry.trip.id)) },
      notes,
      routeId: entry.routeId,
      passengerId: updated.passengerId,
      outcome,
    };
  });
  await deliver(committed.notes);
  await publishQueueChange({
    routeIds: [committed.routeId],
    endedUserIds: committed.outcome === "NO_SHOW" ? [committed.passengerId] : [],
  });
  await publishTripUpdate(committed.response.trip.id);
  return committed.response;
}

export async function departTrip(driverId: string, tripId: string): Promise<TripResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const trip = await requireOwnTrip(tx, driverId, tripId);
    if (trip.status !== "LOADING") throw conflict("trip_not_loading", "Only a loading trip can depart");
    if (!trip.entries.some((entry) => entry.status === "BOARDED")) {
      throw conflict("no_boarded_passengers", "Board at least one passenger before departing");
    }

    const stillCalled = trip.entries.filter((entry) => entry.status === "CALLED");
    if (stillCalled.length > 0) {
      await tx.queueEntry.updateMany({ where: { id: { in: stillCalled.map((entry) => entry.id) } }, data: { status: "NO_SHOW" } });
    }

    await tx.trip.update({ where: { id: trip.id }, data: { status: "DEPARTED", departedAt: new Date() } });
    await tx.taxi.update({ where: { id: trip.taxiId }, data: { status: "EN_ROUTE", currentStationId: null } });
    await tx.driverQueueEntry.updateMany({ where: { taxiId: trip.taxiId, status: "LOADING" }, data: { status: "DEPARTED" } });
    return {
      response: { trip: toDriverTrip(await loadTrip(tx, trip.id)) },
      notes: pendingNotes(stillCalled.map((entry) => entry.passenger), "QUEUE_NO_SHOW", noShowText),
      routeId: trip.routeId,
      endedUserIds: stillCalled.map((entry) => entry.passengerId),
    };
  });
  await deliver(committed.notes);
  // ASSUMPTION: publishQueueChange already emits demand:update, so it is not sent again.
  await publishQueueChange({ routeIds: [committed.routeId], endedUserIds: committed.endedUserIds });
  await publishTripUpdate(tripId);
  return committed.response;
}

/** CALLED and BOARDED passengers go back to WAITING with their original joinedAt. */
export async function cancelTrip(driverId: string, tripId: string): Promise<TripResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const trip = await requireOwnTrip(tx, driverId, tripId);
    if (trip.status !== "LOADING") throw conflict("trip_not_loading", "Only a loading trip can be cancelled");

    const returning = trip.entries.filter((entry) => entry.status === "CALLED" || entry.status === "BOARDED");
    if (returning.length > 0) {
      await tx.queueEntry.updateMany({
        where: { id: { in: returning.map((entry) => entry.id) } },
        data: { status: "WAITING", calledAt: null, boardedAt: null, tripId: null },
      });
    }

    await tx.trip.update({ where: { id: trip.id }, data: { status: "CANCELLED" } });
    await tx.taxi.update({ where: { id: trip.taxiId }, data: { status: "AT_STATION" } });
    // The driver keeps their place in the driver line.
    await tx.driverQueueEntry.updateMany({ where: { taxiId: trip.taxiId, status: "LOADING" }, data: { status: "WAITING" } });
    return {
      response: { trip: toDriverTrip(await loadTrip(tx, trip.id)) },
      notes: pendingNotes(returning.map((entry) => entry.passenger), "QUEUE_RETURNED", returnedText),
      routeId: trip.routeId,
    };
  });
  await deliver(committed.notes);
  await publishQueueChange({ routeIds: [committed.routeId] });
  await publishTripUpdate(tripId);
  return committed.response;
}

export async function arriveTrip(driverId: string, tripId: string): Promise<ArriveTripResponse> {
  const committed = await prisma.$transaction(async (tx) => {
    const trip = await requireOwnTrip(tx, driverId, tripId);
    if (trip.status !== "DEPARTED") throw conflict("trip_not_departed", "Depart before marking the trip arrived");

    const boarded = trip.entries.filter((entry) => entry.status === "BOARDED");
    await tx.trip.update({ where: { id: trip.id }, data: { status: "COMPLETED", arrivedAt: new Date() } });
    const taxi = await tx.taxi.update({
      where: { id: trip.taxiId },
      data: { status: "AT_STATION", currentStationId: trip.route.destinationId },
      include: taxiInclude,
    });
    return {
      response: { trip: toDriverTrip(await loadTrip(tx, trip.id)), taxi: toDriverTaxi(taxi) },
      notes: pendingNotes(boarded.map((entry) => entry.passenger), "TRIP_COMPLETED", arrivedText),
      destinationId: trip.route.destinationId,
    };
  });
  await deliver(committed.notes);
  closeTripRoom(tripId);
  await publishTripUpdate(tripId);
  await publishDemand(await routesLeaving([committed.destinationId]));
  return committed.response;
}
