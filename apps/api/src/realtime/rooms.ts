import { rooms } from "@taxiflow/shared";

// ASSUMPTION: the room-name strings live once, in @taxiflow/shared `rooms`.
export const userRoom = (userId: string) => rooms.user(userId);
export const driversRoom = () => rooms.drivers;
export const routeRoom = (routeId: string) => rooms.route(routeId);
