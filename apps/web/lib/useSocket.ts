"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  DemandUpdatePayload,
  Notification,
  QueueUpdatePayload,
  ServerToClientEvents,
  TripUpdatePayload,
} from "@taxiflow/shared";
import { getToken } from "@/lib/api";
import { SOCKET_URL, USE_MOCKS } from "@/lib/config";
import { LIVE_CHANNEL, type LiveMessage } from "@/lib/liveChannel";

export interface LiveHandlers {
  onDemand?: (payload: DemandUpdatePayload) => void;
  onQueue?: (payload: QueueUpdatePayload) => void;
  onNotification?: (payload: Notification) => void;
  onTrip?: (payload: TripUpdatePayload) => void;
}

function deliver(message: LiveMessage, handlers: LiveHandlers) {
  if (message.event === "demand:update") handlers.onDemand?.(message.payload as DemandUpdatePayload);
  if (message.event === "queue:update") handlers.onQueue?.(message.payload as QueueUpdatePayload);
  if (message.event === "notification:new") handlers.onNotification?.(message.payload as Notification);
  if (message.event === "trip:update") handlers.onTrip?.(message.payload as TripUpdatePayload);
}

/**
 * Live updates. With the real API this is a Socket.IO connection that reconnects by itself.
 * On mocks, other tabs share the same events over a BroadcastChannel.
 * Pass the route ids the screen is showing so the server adds this connection to those rooms.
 */
export function useSocket(handlers: LiveHandlers, routeIds: string[] = []) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const rooms = [...new Set(routeIds)].sort().join(",");

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    if (USE_MOCKS) {
      const channel = new BroadcastChannel(LIVE_CHANNEL);
      channel.onmessage = (event: MessageEvent<LiveMessage>) => deliver(event.data, handlersRef.current);
      return () => channel.close();
    }

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    const onDemand = (payload: DemandUpdatePayload) => handlersRef.current.onDemand?.(payload);
    const onQueue = (payload: QueueUpdatePayload) => handlersRef.current.onQueue?.(payload);
    const onNotification = (payload: Notification) => handlersRef.current.onNotification?.(payload);
    const onTrip = (payload: TripUpdatePayload) => handlersRef.current.onTrip?.(payload);
    socket.on("demand:update", onDemand);
    socket.on("queue:update", onQueue);
    socket.on("notification:new", onNotification);
    socket.on("trip:update", onTrip);

    const ids = rooms ? rooms.split(",") : [];
    const subscribe = () => ids.forEach((routeId) => socket.emit("route:subscribe", { routeId }));
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();

    return () => {
      ids.forEach((routeId) => socket.emit("route:unsubscribe", { routeId }));
      socket.close();
    };
  }, [rooms]);
}
