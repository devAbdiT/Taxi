import type { Server as HttpServer } from "node:http";
import type { Role, ServerToClientEvents } from "@taxiflow/shared";
import { SOCKET_EVENTS } from "@taxiflow/shared";
import { Server, type Socket } from "socket.io";
import { verifyToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { getMyQueue } from "../services/queue.js";
import { listRoutesWithDemand } from "../services/demand.js";
import { driversRoom, routeRoom, userRoom } from "./rooms.js";

interface SocketData {
  user: { id: string; role: Role };
}

// ASSUMPTION: the client sends no custom events. route:subscribe stays in the
// shared types but this server never listens for it; route rooms are joined here.
type NoClientEvents = Record<string, never>;

type IOServer = Server<NoClientEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<NoClientEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: IOServer | undefined;

// ASSUMPTION: REST tests boot the app without initSocket, so emitters skip the send.
export function socketReady(): boolean {
  return io !== undefined;
}

export function getIO(): IOServer {
  if (!io) {
    throw new Error("Socket.IO is not initialized. Call initSocket before using it.");
  }
  return io;
}

function readToken(socket: AppSocket): string | null {
  const auth: unknown = socket.handshake.auth;
  if (auth && typeof auth === "object" && "token" in auth && typeof auth.token === "string" && auth.token.length > 0) {
    return auth.token;
  }
  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

async function sendInitialDemand(socket: AppSocket): Promise<void> {
  const routes = await listRoutesWithDemand();
  for (const route of routes) {
    socket.emit(SOCKET_EVENTS.DEMAND_UPDATE, {
      routeId: route.id,
      waiting: route.waiting,
      priorityWaiting: route.priorityWaiting,
    });
  }
}

async function sendInitialQueue(socket: AppSocket, userId: string): Promise<void> {
  const mine = await getMyQueue(userId);
  if (!mine.entry) return;
  if (mine.entry.status !== "WAITING" && mine.entry.status !== "CALLED") return;
  await socket.join(routeRoom(mine.entry.route.id));
  socket.emit(SOCKET_EVENTS.QUEUE_UPDATE, {
    entryId: mine.entry.id,
    status: mine.entry.status,
    position: mine.position,
    taxiPlate: mine.taxiPlate,
  });
}

export function initSocket(httpServer: HttpServer): IOServer {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const auth = verifyToken(readToken(socket) ?? "");
    if (!auth) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = { id: auth.userId, role: auth.role };
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    console.log(`socket connected ${user.id}`);
    void (async () => {
      await socket.join(userRoom(user.id));
      if (user.role === "DRIVER") {
        await socket.join(driversRoom());
        await sendInitialDemand(socket);
      }
      if (user.role === "PASSENGER") {
        await sendInitialQueue(socket, user.id);
      }
    })().catch((err: unknown) => console.error("socket connection failed", err));

    socket.on("disconnect", () => {
      console.log(`socket disconnected ${user.id}`);
    });
  });

  return io;
}
