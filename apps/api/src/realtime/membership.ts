import { getIO, socketReady } from "./socket.js";
import { pickupRoom, routeRoom, stationRoom, tripRoom, userRoom } from "./rooms.js";

function sync(action: () => void): void {
  if (!socketReady()) return;
  try {
    action();
  } catch (err) {
    console.error("route room membership failed", err);
  }
}

/** Every open tab of this user joins the route room. */
export function joinRouteRoom(userId: string, routeId: string): void {
  sync(() => {
    getIO().in(userRoom(userId)).socketsJoin(routeRoom(routeId));
  });
}

/** Every open tab of this user leaves the route room. */
export function leaveRouteRoom(userId: string, routeId: string): void {
  sync(() => {
    getIO().in(userRoom(userId)).socketsLeave(routeRoom(routeId));
  });
}

/** Server-controlled rooms for live taxi positions. A client can never join these itself. */
export function joinTripRoom(userId: string, tripId: string): void {
  sync(() => {
    getIO().in(userRoom(userId)).socketsJoin(tripRoom(tripId));
  });
}

/** Everyone leaves the trip room when the trip ends. */
export function closeTripRoom(tripId: string): void {
  sync(() => {
    getIO().in(tripRoom(tripId)).socketsLeave(tripRoom(tripId));
  });
}

export function joinPickupRoom(userId: string, pickupId: string): void {
  sync(() => {
    getIO().in(userRoom(userId)).socketsJoin(pickupRoom(pickupId));
  });
}

export function closePickupRoom(pickupId: string): void {
  sync(() => {
    getIO().in(pickupRoom(pickupId)).socketsLeave(pickupRoom(pickupId));
  });
}

export function joinStationRoom(userId: string, stationId: string): void {
  sync(() => {
    getIO().in(userRoom(userId)).socketsJoin(stationRoom(stationId));
  });
}
