import {
  NotificationNewPayload,
  QueueStatus,
  SOCKET_EVENTS,
  type DemandUpdatePayload,
  type DisputeUpdatePayload,
  type NotificationType,
  type PickupNewPayload,
  type PickupUpdatePayload,
  type QueueControlPayload,
  type QueueUpdatePayload,
  type TaxiLocationPayload,
  type TripUpdatePayload,
} from "@taxiflow/shared";
import { prisma } from "../lib/db.js";
import { seatsUsedOf } from "../lib/serialize.js";
import { listRoutesWithDemand } from "../services/demand.js";
import { getMyQueue, listActiveQueueStates } from "../services/queue.js";
import { leaveRouteRoom } from "./membership.js";
import { driversRoom, pickupRoom, routeRoom, stationRoom, tripRoom, userRoom } from "./rooms.js";
import { getIO, socketReady } from "./socket.js";

function report(label: string, err: unknown): void {
  console.error(label, err);
}

/** Same counts as GET /routes. The socket payload keeps the contract fields only. */
export async function getRouteDemand(routeId: string): Promise<DemandUpdatePayload | null> {
  try {
    const route = (await listRoutesWithDemand()).find((item) => item.id === routeId);
    if (!route) return null;
    return { routeId: route.id, waiting: route.waiting, priorityWaiting: route.priorityWaiting };
  } catch (err) {
    report("getRouteDemand failed", err);
    return null;
  }
}

/** Same source as GET /queue/me, mapped onto the socket payload. */
export async function getQueueStateForUser(userId: string): Promise<QueueUpdatePayload | null> {
  try {
    const mine = await getMyQueue(userId);
    if (!mine.entry) return null;
    return {
      entryId: mine.entry.id,
      status: mine.entry.status,
      position: mine.position,
      taxiPlate: mine.taxiPlate,
    };
  } catch (err) {
    report("getQueueStateForUser failed", err);
    return null;
  }
}

export async function publishDemand(routeIds: string[]): Promise<void> {
  if (!socketReady()) return;
  try {
    const io = getIO();
    for (const routeId of new Set(routeIds)) {
      const payload = await getRouteDemand(routeId);
      if (!payload) continue;
      io.to(driversRoom()).to(routeRoom(routeId)).emit(SOCKET_EVENTS.DEMAND_UPDATE, payload);
    }
  } catch (err) {
    report("publishDemand failed", err);
  }
}

// ASSUMPTION: an ended entry is that passenger's latest row that is not WAITING or CALLED.
async function endedQueueState(userId: string): Promise<{ routeId: string; payload: QueueUpdatePayload } | null> {
  const entry = await prisma.queueEntry.findFirst({
    where: { passengerId: userId, status: { notIn: ["WAITING", "CALLED"] } },
    orderBy: { joinedAt: "desc" },
    select: { id: true, status: true, routeId: true },
  });
  if (!entry) return null;
  return {
    routeId: entry.routeId,
    payload: {
      entryId: entry.id,
      status: QueueStatus.parse(entry.status),
      position: null,
      taxiPlate: null,
    },
  };
}

export async function publishQueueChange(input: { routeIds: string[]; endedUserIds?: string[] }): Promise<void> {
  if (!socketReady()) return;
  try {
    const routeIds = [...new Set(input.routeIds)];
    await publishDemand(routeIds);
    const io = getIO();
    for (const routeId of routeIds) {
      const states = await listActiveQueueStates(routeId);
      for (const state of states) {
        io.to(userRoom(state.passengerId)).emit(SOCKET_EVENTS.QUEUE_UPDATE, state.payload);
      }
    }
    for (const userId of input.endedUserIds ?? []) {
      const ended = await endedQueueState(userId);
      if (!ended) continue;
      io.to(userRoom(userId)).emit(SOCKET_EVENTS.QUEUE_UPDATE, ended.payload);
      leaveRouteRoom(userId, ended.routeId);
    }
  } catch (err) {
    report("publishQueueChange failed", err);
  }
}

export function publishNotification(notification: NotificationNewPayload): void {
  if (!socketReady()) return;
  try {
    getIO().to(userRoom(notification.userId)).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification);
  } catch (err) {
    report("publishNotification failed", err);
  }
}

/** Same trip load as GET /driver/trips/:id. The event keeps the contract fields. */
export async function publishTripUpdate(tripId: string): Promise<void> {
  if (!socketReady()) return;
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { taxi: true, entries: { select: { status: true } } },
    });
    if (!trip) return;
    const payload: TripUpdatePayload = {
      tripId: trip.id,
      status: trip.status,
      seatsUsed: seatsUsedOf(trip.entries),
      capacity: trip.taxi.capacity,
    };
    getIO().to(userRoom(trip.taxi.driverId)).emit(SOCKET_EVENTS.TRIP_UPDATE, payload);
  } catch (err) {
    report("publishTripUpdate failed", err);
  }
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
}): Promise<void> {
  try {
    if (!socketReady()) {
      await prisma.notification.create({ data: input });
      return;
    }
    const row = await prisma.notification.create({ data: input });
    const notification = NotificationNewPayload.parse({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.createdAt.toISOString(),
    });
    publishNotification(notification);
  } catch (err) {
    report("createNotification failed", err);
  }
}

// ---------------------------------------------------------------------------
// Advanced features. All of these are called from the service layer after the transaction commits.
// ---------------------------------------------------------------------------

export function publishDispute(payload: DisputeUpdatePayload, userIds: string[]): void {
  if (!socketReady()) return;
  try {
    const io = getIO();
    io.to(stationRoom(payload.stationId)).emit(SOCKET_EVENTS.DISPUTE_UPDATE, payload);
    for (const userId of new Set(userIds)) io.to(userRoom(userId)).emit(SOCKET_EVENTS.DISPUTE_UPDATE, payload);
  } catch (err) {
    report("publishDispute failed", err);
  }
}

export function publishQueueControl(userId: string, payload: QueueControlPayload): void {
  if (!socketReady()) return;
  try {
    getIO().to(userRoom(userId)).emit(SOCKET_EVENTS.QUEUE_CONTROL, payload);
  } catch (err) {
    report("publishQueueControl failed", err);
  }
}

export function publishTaxiLocation(payload: TaxiLocationPayload): void {
  if (!socketReady()) return;
  try {
    const io = getIO();
    if (payload.tripId) io.to(tripRoom(payload.tripId)).emit(SOCKET_EVENTS.TAXI_LOCATION, payload);
    if (payload.pickupId) io.to(pickupRoom(payload.pickupId)).emit(SOCKET_EVENTS.TAXI_LOCATION, payload);
  } catch (err) {
    report("publishTaxiLocation failed", err);
  }
}

export function publishPickupNew(userId: string, payload: PickupNewPayload): void {
  if (!socketReady()) return;
  try {
    getIO().to(userRoom(userId)).emit(SOCKET_EVENTS.PICKUP_NEW, payload);
  } catch (err) {
    report("publishPickupNew failed", err);
  }
}

export function publishPickupUpdate(userIds: string[], payload: PickupUpdatePayload): void {
  if (!socketReady()) return;
  try {
    const io = getIO();
    for (const userId of new Set(userIds)) io.to(userRoom(userId)).emit(SOCKET_EVENTS.PICKUP_UPDATE, payload);
  } catch (err) {
    report("publishPickupUpdate failed", err);
  }
}
