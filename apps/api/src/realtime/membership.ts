import { getIO, socketReady } from "./socket.js";
import { routeRoom, userRoom } from "./rooms.js";

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
