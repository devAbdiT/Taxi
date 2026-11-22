"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSWRConfig } from "swr";
import { SOCKET_URL, USE_MOCKS } from "@/lib/config";
import { getToken, TOKEN_EVENT } from "@/lib/api";
import { subscribe } from "@/lib/live/bus";
import { setConnected } from "@/lib/live/status";

function subscribeToken(onChange: () => void) {
  window.addEventListener(TOKEN_EVENT, onChange);
  return () => window.removeEventListener(TOKEN_EVENT, onChange);
}

/**
 * Revalidates every SWR screen when something changes.
 * Mocks: the in-browser bus. Real API: Socket.IO, reconnecting whenever this window signs in or out.
 * Screens also poll every REFRESH_MS, so they keep working if the socket drops.
 */
export function useLive() {
  const { mutate } = useSWRConfig();
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);

  useEffect(() => {
    const refresh = () => {
      void mutate(() => true);
    };

    if (USE_MOCKS) {
      return subscribe("*", refresh);
    }
    if (!token) {
      setConnected(false);
      return;
    }

    let socket: { close: () => void } | null = null;
    let cancelled = false;
    void import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      const client = io(SOCKET_URL, {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket"],
      });
      client.on("connect", () => {
        setConnected(true);
        refresh();
      });
      client.on("disconnect", () => setConnected(false));
      client.on("connect_error", () => setConnected(false));
      client.on("demand:update", refresh);
      client.on("queue:update", refresh);
      client.on("notification:new", refresh);
      client.on("trip:update", refresh);
      client.on("dispute:update", refresh);
      client.on("queue:control", refresh);
      client.on("taxi:location", refresh);
      client.on("pickup:new", refresh);
      client.on("pickup:update", refresh);
      socket = client;
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      socket?.close();
      setConnected(false);
    };
  }, [mutate, token]);
}
